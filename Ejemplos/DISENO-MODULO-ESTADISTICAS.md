Tengo todo lo necesario, anclado al código real. Aquí está el documento de diseño completo.

---

# Diseño del Módulo de Estadísticas Robusto — Portal Tecnotics

> Documento de diseño (no código). Frontend: `FE_TECNOTICS_PORTAL`. Backend: `MC-TECNOTICS-FACTURACION`.
> Fuente de verdad analítica nueva: **Libro Mayor** (`JournalEntryModel` / `ledger.model.ts`), que ahora recibe asientos contabilizados de TODO el circuito (CC/CE/RC/FV/NC/AP/CL/DEP/NOM).

---

## 1. Diagnóstico del módulo actual

### 1.1. Qué muestra hoy

El módulo "Estadísticas" vive en `src/features/billing-history/page/BillingHistory.tsx` y monta dos componentes apilados (no hay tabs):

- **`StatisticsDashboard.tsx`** — consume `GET /company/statistics` (sin filtro de fechas, caché 2 min en servidor). Tipos en `company-statistics.service.ts`. Muestra 8 KPI cards (facturas emitidas, total facturado, aprobadas, borradores, clientes, nóminas, empleados, ítems) y 8 gráficos Chart.js: documentos/mes (Bar), facturado/mes (Line), facturas por estado (Doughnut), por tipo doc (Bar), por prefijo (Bar), nómina por mes (Bar), productos vs servicios (Doughnut), clientes por tipo doc (Bar).
- **`ReportsPanel.tsx`** — consume 7 endpoints `GET /reports/*` (con `?from&to`), tipados en `business-reports.service.ts`. Muestra 4 KPI (por cobrar, por pagar, recaudado, cotizaciones facturadas), 5 gráficos (comparativo ventas/compras/gastos, aging cartera, aging CxP, recaudo forma de pago, embudo cotizaciones) y 3 tablas (top clientes Pareto, top proveedores Pareto, detalle cartera por cliente). Tiene filtro de fechas por presets (mes/trimestre/año/custom) en `presetRange()`.

### 1.2. Qué quedó obsoleto / duplicado / mal

| Problema | Evidencia en código | Impacto |
|---|---|---|
| **`StatisticsDashboard` no tiene filtro de fechas** | `getCompanyStatistics()` no recibe parámetros; el panel agrega "toda la historia". | Imposible analizar un período fiscal concreto; mezcla años. |
| **Doble cálculo de "facturado"** | `StatisticsDashboard` muestra `facturas.totalFacturado` (toda la historia) y `ReportsPanel` muestra ventas/mes por otra vía (`businessMatch`). Dos números de "ventas" que no concilian. | Confusión, cifras que no cuadran entre paneles. |
| **No usa el Ledger en absoluto** | Las rutas `LEDGER_*` ya existen en `global.ts` (líneas 199-218) pero NINGÚN componente de estadísticas las consume. | El estado de resultados real, balance, IVA, retenciones y flujo de caja no se visualizan pese a estar disponibles. |
| **Ventas calculadas desde `FacturaModel`, no desde el ledger** | `getVentasComprasGastos` usa `BusinessReports.service` (match sobre facturas/compras). | Las cifras no reflejan NC, ajustes manuales (NC tipo asiento), ni costo de ventas. No concilian con financial-statements. |
| **Cartera/CxP ignoran períodos contables** | `getCarteraAging`/`getCxpAging` no aceptan `from/to` ni período; leen histórico. | Al cerrar año (CL), los reportes siguen mostrando datos sin avisar que el período está cerrado. |
| **Aging cartera duplica la lógica del ledger** | `BusinessReports` recalcula saldo = total − NC − pagos desde `FacturaModel`; el ledger ya tiene CxC en clase 13. | Dos fuentes de cartera que pueden divergir. |
| **KPIs "vanidad", no financieros** | Borradores, ítems de catálogo, clientes por tipo doc. | Ocupan espacio premium sin valor de decisión. |
| **Sin export** | Ningún botón de CSV/PDF/Excel. | El contador re-teclea todo. |
| **Sin comparativo período anterior** | No hay variación % vs mes/año anterior. | No se ve tendencia ni alertas. |

### 1.3. Data nueva (sobre todo del ledger) que HOY no se explota

Disponible vía modelos/servicios del backend, **cero visualización actual**:

- **Estado de Resultados real** (`Reports.service.financialStatements()`): ingresos clase 4 − costos clase 6 − gastos clase 5, con lógica anti-doble-conteo de cierre (CL).
- **Balance General real**: activos (clase 1), pasivos (clase 2), patrimonio (clase 3).
- **Costo de ventas (6135)** → utilidad bruta y margen, que hoy NO se calculan.
- **Flujo de caja desde cuentas clase 11** (caja/bancos): entradas (RC) − salidas (CE) por mes; saldo real bancario.
- **IVA generado (2408xx) vs descontable (240820 / 2408 inferior)** → saldo a pagar/favor por período.
- **Retenciones practicadas** (créditos cuentas 2365xx) y **sufridas** (débitos 1355) por período/tercero.
- **Exógena DIAN** (formatos 1001-1009) con validación de cuadre y terceros sin identificar.
- **Saldos por tercero** (`thirdPartyDetail`) y **por cuenta** (`accountDetail`).
- **Centro de costo** (`lineas[].centro_costo_id`) → gasto por proyecto/departamento.
- **Nómina contabilizada** (asientos NOM): costo laboral real, aportes, retención de nómina (236505).
- **Depreciación** (asientos DEP, clase 68xx / activos clase 15): valor en libros, depreciación del período.
- **Estado de períodos** (`AccountingPeriodModel`): abierto/cerrado/bloqueado; estado de cierre anual (`/ledger/closing-status`).

---

## 2. Arquitectura propuesta

### 2.1. Principio rector

> **El Libro Mayor es la fuente de verdad financiera.** Todo KPI monetario "de cierre" (ingresos, costos, gastos, utilidad, caja, CxC, CxP, IVA, retenciones, patrimonio) debe leerse del ledger (`JournalEntryModel`) para que **concilie con los estados financieros oficiales**. Los reportes comerciales operativos (embudo de cotizaciones, top productos, detalle por documento, firma de remisiones) siguen leyendo de los modelos operativos (`Quote`, `Factura`, `Purchase`) porque el ledger no guarda ese grano.

Regla de asignación de fuente:

- **Cifra que debe cuadrar con DIAN / contabilidad** → Ledger.
- **Cifra operativa / pre-contable / de detalle comercial** → modelo operativo (`BusinessReports`).
- Cuando ambas existen (ej. cartera), el ledger es el "oficial" y el operativo es el "drill-down con antigüedad por documento".

### 2.2. Nuevo servicio backend: `Analytics.service.ts`

Un servicio de analítica que se apoya en lo ya construido y agrega lo que falta:

```
Analytics.service.ts  (nuevo, MC-TECNOTICS-FACTURACION/src/services)
  ├── usa Reports.service.ts        (financialStatements, trialBalance, generalLedger)  ← YA EXISTE
  ├── usa BusinessReports.service.ts (aging, top, recaudo, embudo)                       ← YA EXISTE, se reutiliza
  ├── usa Dian.service.ts           (exogena, retention-parties)                         ← YA EXISTE
  └── agrega: agregaciones nuevas sobre JournalEntryModel por (periodo, clase/cuenta, tercero, CC)
              + comparativos período-anterior + KPIs ejecutivos consolidados.
```

Característica clave: **TODO endpoint nuevo acepta `?from&to` (y opcional `?periodo=YYYY-MM` o `?anio=YYYY`)** y respeta `to` ampliado a 23:59:59 (como ya hace `BusinessReports`). Caché en memoria por `companyId + rango` (patrón de `CompanyStatistics.service`, 2 min).

### 2.3. Estructura del módulo frontend

Reescribir `BillingHistory.tsx` (o renombrar la feature a `analytics/`) a un layout con **tabs + barra de filtro global** (el `DateRange` y el preset suben a estado del contenedor, compartido por todas las tabs — hoy el filtro vive aislado en `ReportsPanel`).

```
features/analytics/
  page/AnalyticsPage.tsx                  ← contenedor: tabs + DateRangeBar global + estado período
  components/
    DateRangeBar.tsx                      ← extraído de ReportsPanel (presets + custom + comparar-con)
    PeriodStatusBadge.tsx                 ← "Período 2026-06 ABIERTO" / "Año 2025 CERRADO"
    KpiCard.tsx                           ← KPI reutilizable con valor + delta% + sparkline opcional
    ChartCard.tsx                         ← wrapper card (título + chart + estado vacío + export)
    tabs/
      ResumenEjecutivoTab.tsx
      VentasTab.tsx
      RentabilidadTab.tsx
      CarteraCxpTab.tsx
      TesoreriaTab.tsx
      TributarioTab.tsx
      NominaTab.tsx
      ActivosTab.tsx
  services/analytics.service.ts           ← nuevos endpoints /analytics/*
```

Reutilizar tal cual: el stack Chart.js (registro de `CategoryScale…Filler`), la paleta `COLORS`, `MONTH_NAMES`, `formatMoney`/`moneyShort`/`money`, `presetRange()`, `StatisticsDashboard.css` + `ReportsPanel.css`. Los servicios `business-reports.service.ts` y `company-statistics.service.ts` se conservan (los consumen las tabs operativas).

### 2.4. Tabs del dashboard

| # | Tab | Fuente principal | Para quién |
|---|---|---|---|
| 1 | **Resumen ejecutivo** | Ledger (financial-statements) + agregados | Gerente / dueño |
| 2 | **Ventas** | `BusinessReports` + ledger (clase 4) | Comercial |
| 3 | **Rentabilidad / Resultados** | Ledger (clases 4/5/6) | Gerente / contador |
| 4 | **Cartera y CxP** | Ledger (13/22) + `BusinessReports` (aging) | Cartera / tesorería |
| 5 | **Tesorería / Flujo de caja** | Ledger (clase 11) | Tesorería |
| 6 | **Tributario** | Ledger (IVA/retenciones) + `Dian.service` | Contador |
| 7 | **Nómina** | Ledger (NOM) + nómina | RRHH / contador |
| 8 | **Activos** | Ledger (15/68) + módulo activos | Contador |

---

## 3. Catálogo COMPLETO de KPIs y gráficos por sección

Convención de columnas: **Visual** = KPI / Línea / Barra / Barra apilada / Dona / Tabla / Treemap / Combo / Waterfall. **Temporal** = punto único (corte) / serie mensual / comparativo período-anterior. **Prioridad** = Alto / Medio / Bajo.

---

### 3.1. TAB 1 — Resumen ejecutivo

| KPI / Gráfico | Qué mide | Fuente exacta | Visual | Temporal | Prio |
|---|---|---|---|---|---|
| **Ingresos del período** | Ventas netas reales | Ledger: SUM créditos clase **4** (`financial-statements`) | KPI + delta% | corte + vs período anterior | Alto |
| **Costo de ventas** | Costo directo | Ledger: SUM débitos **6135** | KPI | corte | Alto |
| **Gastos operativos** | Gastos (incl. nómina, depreciación) | Ledger: SUM débitos clase **5** | KPI + delta% | corte | Alto |
| **Utilidad neta** | Resultado del período | `4 − 6 − 5` (o saldo **3010** si hay CL) | KPI grande + delta% | corte | Alto |
| **Margen neto %** | Utilidad / Ingresos | derivado | KPI (badge color) | corte | Alto |
| **Caja y bancos** | Disponible real | Ledger: saldo clase **11** (1105/1110) | KPI | corte (a fecha `to`) | Alto |
| **Por cobrar (CxC)** | Cartera contable | Ledger: saldo clase **13** (1305/1320) | KPI | corte | Alto |
| **Por pagar (CxP)** | Deuda proveedores | Ledger: saldo clase **22** (2205/2209) | KPI | corte | Alto |
| **Capital de trabajo** | Activo corriente − pasivo corriente | Ledger (clase 1 corr. − clase 2 corr.) | KPI | corte | Medio |
| **Resultado mensual (Ing/Cost/Gasto/Utilidad)** | Tendencia P&L | Ledger por `periodo` | Combo (barras Ing/Gasto + línea Utilidad) | serie 12-18 m | Alto |
| **Composición de activos** | Estructura del balance | Ledger clase 1 por grupo (11,13,14,15) | Dona | corte | Medio |
| **Estructura financiera** | Pasivo vs patrimonio | Ledger clase 2 vs 3 | Barra apilada | corte | Medio |
| **Semáforo de alertas** | Cartera vencida, IVA por pagar, períodos sin cerrar, exógena descuadrada | agregador (varias fuentes) | Tabla de alertas con badge | corte | Alto |

---

### 3.2. TAB 2 — Ventas

| KPI / Gráfico | Qué mide | Fuente exacta | Visual | Temporal | Prio |
|---|---|---|---|---|---|
| **Ventas netas del período** | Facturado real (01) − NC (03) | Ledger clase 4 (oficial) / `BusinessReports.businessMatch` (operativo) | KPI + delta% | corte + vs ant. | Alto |
| **Nº facturas / ticket promedio** | Volumen y valor medio | `Factura` count + ventas / count | KPI x2 | corte | Alto |
| **Ventas por mes** | Tendencia | Ledger clase 4 por `periodo` | Línea (fill) | serie 12-18 m | Alto |
| **Top clientes (Pareto)** | Concentración | `GET /reports/top-clientes` (ya existe) | Tabla Pareto + Barra | rango | Alto |
| **Top productos** | Productos más vendidos | `Factura.Lineas[].Item.Nombre` (nuevo agregado) o `Quote.lines[].name` | Tabla / Barra horizontal | rango | Medio |
| **Ventas por forma de pago** | Mix de cobro | `GET /reports/recaudo-forma-pago` (`systemInfo.pagos[].method`) | Dona | rango | Medio |
| **Ventas por estado DIAN** | Salud de emisión | `CompanyStatistics.porEstado` (APPROVED/SENT/PENDING/REJECTED) | Dona | corte | Medio |
| **Ventas por prefijo / sucursal** | Por punto de emisión | `CompanyStatistics.porPrefijo` (excluir SET*/NESET*) | Barra | corte | Bajo |
| **Distribución por tipo doc** | 01 vs 02 vs 03 vs 11 | `CompanyStatistics.porTipoDocumento` (normalizar cero inicial) | Barra | corte | Bajo |
| **Notas crédito del período** | Devoluciones/anulaciones | Ledger tipo NC / `totalNotasCredito` | KPI + % sobre ventas | corte | Medio |
| **Cotizado vs facturado (embudo)** | Conversión comercial | `GET /reports/embudo-cotizaciones` | Embudo / Barra + tasa% | rango | Medio |
| **Ventas por ciudad/departamento** | Geografía | `ExternUser.address.departamento_codigo` cruzado con factura | Barra / mapa simple | rango | Bajo |

---

### 3.3. TAB 3 — Rentabilidad / Resultados

| KPI / Gráfico | Qué mide | Fuente exacta | Visual | Temporal | Prio |
|---|---|---|---|---|---|
| **Utilidad bruta** | Ventas − costo de ventas | Ledger: clase 4 − **6135** | KPI | corte | Alto |
| **Margen bruto %** | Utilidad bruta / ventas | derivado | KPI badge | corte + serie | Alto |
| **Utilidad operacional** | Ingresos − (costos + gastos op.) | Ledger: 4 − (6 + 5) | KPI | corte | Alto |
| **Margen operacional %** | derivado | derivado | KPI badge | corte | Alto |
| **Utilidad neta y margen neto** | resultado final | Ledger (o 3010 si CL) | KPI | corte | Alto |
| **Estado de resultados mensual** | P&L por mes | `GET /ledger/reports/financial-statements` agregado por `periodo` | Combo (barras ingreso/costo/gasto + línea margen%) | serie 12 m | Alto |
| **Estado de resultados (vista contable)** | Reporte formal Ing/Costo/Gasto/Utilidad con subtotales por grupo 2-díg | `financialStatements()` (agrupa grupo 2-díg) | Tabla jerárquica + export | corte | Alto |
| **Gasto por grupo PUC** | Estructura de gasto (51 admin, 52 ventas, 53 fin., nómina…) | Ledger clase 5 por grupo 2-díg | Treemap / Barra apilada | rango | Medio |
| **Gasto por centro de costo** | Por proyecto/depto | Ledger `lineas[].centro_costo_id` (clase 5/6) | Barra / Tabla | rango | Medio |
| **Punto de equilibrio aprox.** | Ventas necesarias (gastos fijos / margen) | derivado de gasto fijo + margen | KPI | corte | Bajo |
| **Resultado acumulado (YTD)** | Utilidad del año a la fecha | Ledger año gravable | KPI + línea acumulada | acumulado | Medio |

---

### 3.4. TAB 4 — Cartera y CxP

| KPI / Gráfico | Qué mide | Fuente exacta | Visual | Temporal | Prio |
|---|---|---|---|---|---|
| **Total por cobrar** | CxC oficial | Ledger saldo clase **13** (corte) | KPI | corte | Alto |
| **Cartera vencida** | Saldo con días > 0 | `GET /reports/cartera-aging` (`totalVencido`) | KPI (rojo) | corte | Alto |
| **Aging de cartera (buckets)** | corriente/1-30/31-60/61-90/+90 | `GET /reports/cartera-aging` (ya existe) | Barra | corte | Alto |
| **Detalle cartera por cliente** | Saldo × tramo | `cartera.rows[]` (ya en `ReportsPanel`) | Tabla + export | corte | Alto |
| **DSO (días de cartera)** | CxC / ventas × días | Ledger (CxC clase 13) / ventas período | KPI + serie | serie | Alto |
| **Rotación de cartera** | Ventas / CxC promedio | derivado | KPI | rango | Medio |
| **Total por pagar** | CxP oficial | Ledger saldo clase **22** | KPI | corte | Alto |
| **CxP vencida + aging** | proveedores vencidos | `GET /reports/cxp-aging` (`Purchase`) | Barra + KPI | corte | Alto |
| **Detalle CxP por proveedor** | Saldo × tramo | `cxp.rows[]` | Tabla + export | corte | Alto |
| **DPO (días de pago)** | CxP / compras × días | Ledger CxP clase 22 / compras | KPI | rango | Medio |
| **Top proveedores (Pareto)** | concentración compra | `GET /reports/top-proveedores` | Tabla Pareto | rango | Medio |
| **Ciclo de conversión de caja** | DSO + DIO − DPO | derivado | KPI | corte | Bajo |
| **Cartera por antigüedad — evolución** | cómo crece lo vencido | aging por corte mensual (nuevo) | Barra apilada | serie | Medio |

---

### 3.5. TAB 5 — Tesorería / Flujo de caja

| KPI / Gráfico | Qué mide | Fuente exacta | Visual | Temporal | Prio |
|---|---|---|---|---|---|
| **Saldo de caja y bancos** | Disponible a la fecha | Ledger saldo clase **11** (1105/1110) | KPI | corte | Alto |
| **Entradas del período** | Recaudos (RC) + otros ingresos efectivo | Ledger: débitos clase 11 (tipo **RC**) | KPI verde | rango | Alto |
| **Salidas del período** | Pagos (CE) + egresos | Ledger: créditos clase 11 (tipo **CE**) | KPI rojo | rango | Alto |
| **Flujo neto** | Entradas − salidas | derivado | KPI + delta | rango | Alto |
| **Flujo de caja mensual** | Saldo inicial → entradas → salidas → saldo final | Ledger clase 11 por `periodo` | Waterfall / Combo (barras E/S + línea saldo) | serie 12 m | Alto |
| **Saldo por cuenta bancaria** | Por banco/cuenta PUC | Ledger por cuenta clase 11 + `Bank` maestro | Barra / Tabla | corte | Medio |
| **Recaudo por forma de pago** | mix de cobro | `GET /reports/recaudo-forma-pago` | Dona | rango | Medio |
| **Pagos por banco (lotes ACH)** | salidas por banco emisor | `PaymentBatch.total_amount` group `bank.bank_id` | Barra | rango | Medio |
| **Lotes pendientes de conciliar** | riesgo de cuadre | `PaymentBatch.status != reconciled` | KPI + Tabla | corte | Medio |
| **Diferencia de conciliación** | saldo_banco − saldo_libros | `BankReconciliation` (`saldo_banco − saldo_libros`) | KPI (alerta) + Tabla por cuenta | corte | Medio |
| **Conciliatorias por tipo** | comisiones/cheques tránsito/consignaciones no id | `BankReconciliation.conciliatorias[].tipo` | Dona | rango | Bajo |
| **Proyección de caja 30/60/90** | caja + CxC por vencer − CxP por vencer | aging cartera/CxP futuro | Línea proyectada | proyección | Bajo |

---

### 3.6. TAB 6 — Tributario

| KPI / Gráfico | Qué mide | Fuente exacta | Visual | Temporal | Prio |
|---|---|---|---|---|---|
| **IVA generado** | IVA en ventas | Ledger: créditos **2408xx** (240810 si aplica) | KPI | rango | Alto |
| **IVA descontable** | IVA en compras | Ledger: débitos **2408** inferior / **240820** | KPI | rango | Alto |
| **Saldo de IVA (a pagar / a favor)** | generado − descontable | derivado | KPI (badge pagar/favor) | bimestre/cuatrimestre | Alto |
| **IVA gen. vs desc. por bimestre** | tendencia declaración | Ledger por período fiscal | Barra agrupada | serie | Alto |
| **Retenciones practicadas** | retefuente/reteiva/reteica que la empresa retuvo | Ledger: créditos cuentas **2365xx / 2367 / 2368** (`RetentionConcept.cuenta`) | KPI + Barra por tipo | rango | Alto |
| **Retenciones sufridas** | lo que retuvieron a la empresa | Ledger: débitos **1355** | KPI | rango | Alto |
| **Retenciones practicadas por concepto** | por código/tarifa | Ledger por cuenta + `RetentionConcept` | Tabla (concepto, base, tarifa, valor) | rango | Medio |
| **Top terceros con retención** | quién retuvo más | `GET /ledger/dian/retention-parties` (ya existe) | Tabla + export certificado | año | Medio |
| **Exógena — resumen formatos 1001-1009** | totales por formato | `GET /ledger/dian/exogena` | Tabla (formato, total contable, total formato, identificado) | año | Medio |
| **Exógena — validación de cuadres** | descuadres + terceros sin NIT | `GET /ledger/dian/exogena/validacion` | Tabla de alertas | año | Alto |
| **ICA por municipio** | reteica por municipio | `RetentionConcept` tipo ica + `codigo_municipio` | Barra | año | Bajo |
| **Carga tributaria efectiva** | (IVA pagar + retenc.) / ventas | derivado | KPI | rango | Bajo |

---

### 3.7. TAB 7 — Nómina

| KPI / Gráfico | Qué mide | Fuente exacta | Visual | Temporal | Prio |
|---|---|---|---|---|---|
| **Costo laboral del período** | Gasto total de nómina | Ledger: débitos cuenta_gasto_nomina (**5105/51xx**) en asientos **NOM** | KPI + delta% | rango | Alto |
| **Costo laboral mensual** | tendencia | Ledger NOM por `periodo` | Línea | serie 12 m | Alto |
| **Headcount (empleados activos)** | nº trabajadores | `CompanyStatistics.nomina.empleados` / módulo nómina | KPI | corte | Alto |
| **Costo promedio por empleado** | costo / headcount | derivado | KPI | rango | Medio |
| **Aportes por pagar (seguridad social)** | EPS/pensión causados | Ledger créditos **2370** (cuenta_aportes_por_pagar) | KPI | corte | Medio |
| **Salarios por pagar** | neto pendiente a empleados | Ledger créditos **2505** | KPI | corte | Medio |
| **Retención de nómina (236505)** | retefuente de empleados | Ledger créditos **236505** | KPI | rango | Medio |
| **Nóminas emitidas por mes** | volumen comprobantes DIAN | `CompanyStatistics.nomina.porMes` | Barra | serie | Bajo |
| **Composición del costo laboral** | salario / aportes / prestaciones / parafiscales | Ledger NOM por cuenta | Barra apilada / Dona | rango | Medio |
| **Costo laboral / ingresos %** | peso de la nómina | nómina / ventas | KPI badge | rango | Medio |
| **Nómina por centro de costo** | por área | Ledger NOM `centro_costo_id` | Barra | rango | Bajo |

> Nota: el dominio nómina-activos vino `null` en el inventario; el costo laboral se reconstruye desde los **asientos NOM** del ledger (fuente fiable) y el headcount desde `CompanyStatistics.nomina`. Confirmar si existe `PayrollModel` para drill-down por empleado.

---

### 3.8. TAB 8 — Activos

| KPI / Gráfico | Qué mide | Fuente exacta | Visual | Temporal | Prio |
|---|---|---|---|---|---|
| **Valor en libros (neto)** | activo fijo − depreciación acum. | Ledger: saldo clase **15** − depreciación acum. (**1592/159x**) | KPI | corte | Alto |
| **Costo histórico activos** | inversión bruta | Ledger débitos clase **15** | KPI | corte | Medio |
| **Depreciación del período** | gasto de depreciación | Ledger: débitos **5160 / 6xxx** en asientos **DEP** | KPI | rango | Alto |
| **Depreciación acumulada** | desgaste total | Ledger saldo **1592/159x** | KPI | corte | Medio |
| **Depreciación mensual** | tendencia | Ledger DEP por `periodo` | Barra | serie | Medio |
| **Activos por categoría** | terrenos/edificios/equipo/vehículos/cómputo | Ledger clase 15 por grupo (1504,1516,1524,1528,1540…) | Treemap / Dona | corte | Medio |
| **% depreciado por categoría** | obsolescencia | dep. acum. / costo por categoría | Barra (gauge) | corte | Bajo |
| **Activos por estado** | activo/baja/vendido | módulo activos (si existe `AssetModel`) | Dona | corte | Bajo |
| **Próximas a depreciar totalmente** | planeación de reposición | módulo activos (vida útil restante) | Tabla | proyección | Bajo |

> Nota: confirmar existencia de un `AssetModel` en el módulo de activos para el detalle por activo (categoría, estado, vida útil). Si no existe, los KPIs salen del ledger (asientos DEP + saldos clase 15) y los de "estado/vida útil restante" quedan fuera de la Fase inicial.

---

## 4. Endpoints backend a crear / reutilizar

Base nueva: `GET /analytics/*` (con `companyAuth`, `?from&to` y opcional `?compareTo=prev` para variación). Donde ya existe endpoint, **se reutiliza** y solo se documenta.

### 4.1. Reutilizar (ya existen — no crear)

| Endpoint | Servicio | Uso en el módulo |
|---|---|---|
| `GET /company/statistics` | `CompanyStatistics.service` | KPIs operativos de volumen (estado DIAN, prefijos, headcount, ítems). **Pendiente**: aceptar `?from&to`. |
| `GET /reports/cartera-aging` | `BusinessReports` | Tab Cartera (aging + detalle). |
| `GET /reports/cxp-aging` | `BusinessReports` | Tab CxP. |
| `GET /reports/top-clientes` `?from&to` | `BusinessReports` | Tab Ventas. |
| `GET /reports/top-proveedores` `?from&to` | `BusinessReports` | Tab CxP. |
| `GET /reports/ventas-compras-gastos` `?from&to` | `BusinessReports` | Tab Ventas (operativo). |
| `GET /reports/recaudo-forma-pago` `?from&to` | `BusinessReports` | Tab Tesorería/Ventas. |
| `GET /reports/embudo-cotizaciones` `?from&to` | `BusinessReports` | Tab Ventas. |
| `GET /ledger/reports/financial-statements` `?from&to` | `Reports.service` | Tabs Resumen/Rentabilidad (P&L + balance). |
| `GET /ledger/reports/trial-balance` | `Reports.service` | Tab Rentabilidad (vista contable). |
| `GET /ledger/reports/general-ledger` | `Reports.service` | Saldos por cuenta. |
| `GET /ledger/dian/retention-parties` `?anio` | `Dian.service` | Tab Tributario. |
| `GET /ledger/dian/exogena` `?anio` | `Dian.service` | Tab Tributario. |
| `GET /ledger/dian/exogena/validacion` `?anio` | `Dian.service` | Tab Tributario (alertas). |
| `GET /ledger/closing-status` | `Ledger.service` | Badge de período/cierre. |

### 4.2. Crear nuevos (firma → fuente)

> Convención de respuesta: `{ ok: true, data: ... }` (igual que `business-reports.service.parse()`).

1. **`GET /analytics/executive-summary?from&to&compareTo=prev`**
   - Devuelve: `{ ingresos, costoVentas, gastos, utilidadNeta, margenNeto, caja, cxc, cxp, capitalTrabajo, deltas:{ingresos,utilidad,...} }`.
   - Fuente: `Reports.financialStatements()` (clases 4/5/6) + saldos clase 11/13/22 del trial balance, a corte `to`; `compareTo` recalcula el período inmediatamente anterior de igual longitud.

2. **`GET /analytics/pl-monthly?from&to`**
   - `[{ year, month, ingresos, costo, gastoOperativo, utilidadBruta, utilidadOperativa, utilidadNeta, margenBruto, margenNeto }]`.
   - Fuente: agregación de `JournalEntryModel` por `periodo`, clases 4/5/6135/6 con naturaleza signada.

3. **`GET /analytics/cashflow-monthly?from&to`**
   - `[{ year, month, saldoInicial, entradas, salidas, neto, saldoFinal }]`.
   - Fuente: `JournalEntryModel.lineas` cuenta clase **11**; débitos=entradas, créditos=salidas; saldoInicial = acumulado previo a `from`.

4. **`GET /analytics/cash-by-account?to`**
   - `[{ cuenta, nombre, banco, saldo }]`.
   - Fuente: saldo clase 11 por cuenta + cruce con `Bank` maestro.

5. **`GET /analytics/iva?from&to`**
   - `{ generado, descontable, saldo, signo:'pagar'|'favor', porPeriodo:[{periodo,generado,descontable,saldo}] }`.
   - Fuente: ledger créditos 2408xx (generado) vs débitos 2408 inferior/240820 (descontable). Parametrizar cuentas vía `AccountingConfig.cuenta_iva*`.

6. **`GET /analytics/retenciones?from&to`**
   - `{ practicadas:[{concepto,cuenta,base,tarifa,valor}], sufridas:total1355, totalPracticadas, totalSufridas, porPeriodo:[...] }`.
   - Fuente: ledger créditos cuentas de `RetentionConcept.cuenta` (practicadas) y débitos 1355 (sufridas), con `base` de `lineas[].base`.

7. **`GET /analytics/dso-dpo?from&to`**
   - `{ dso, dpo, rotacionCartera, rotacionCxp, cicloCaja }`.
   - Fuente: saldo clase 13/22 (ledger) ÷ ventas/compras del rango × días.

8. **`GET /analytics/payroll?from&to`**
   - `{ costoLaboral, headcount, costoPromedio, aportesPorPagar, salariosPorPagar, retencionNomina, porPeriodo:[...], composicion:[{cuenta,nombre,valor}] }`.
   - Fuente: asientos **NOM** del ledger por cuenta + `CompanyStatistics.nomina.empleados`.

9. **`GET /analytics/assets?to`**
   - `{ costoHistorico, depreciacionAcum, valorEnLibros, depreciacionPeriodo, porCategoria:[{grupo,nombre,costo,depAcum,neto}] }`.
   - Fuente: saldos clase **15** y **159x**, asientos **DEP** del período; cruce con `AssetModel` si existe.

10. **`GET /analytics/top-productos?from&to&limit=10`**
    - `[{ nombre, cantidad, total, pct, acumPct }]`.
    - Fuente: `FacturaModel.Lineas[].Item.Nombre` (excluir SET*/NESET*, solo 01 APPROVED/SENT). Patrón Pareto idéntico a `topClientes`.

11. **`GET /analytics/expense-by-cost-center?from&to`** *(si se usa CC)*
    - `[{ centro_costo_id, nombre, total }]`.
    - Fuente: ledger `lineas[].centro_costo_id` en clases 5/6.

12. **`GET /analytics/alerts?to`** *(agregador para el semáforo)*
    - `[{ tipo, severidad, mensaje, valor }]` — cartera vencida, IVA por pagar próximo, períodos abiertos del año anterior, exógena descuadrada, lotes ACH sin conciliar.
    - Fuente: compone aging + iva + closing-status + exogena/validacion + PaymentBatch.

### 4.3. Mejora transversal recomendada

Hacer que **`/company/statistics`, `/reports/cartera-aging` y `/reports/cxp-aging` acepten `?from&to`** (hoy ignoran fechas), para que el filtro global del dashboard aplique a TODAS las tabs sin inconsistencias.

---

## 5. Plan de implementación por fases

Orden por **valor / esfuerzo** (primero alto valor + bajo esfuerzo, apoyándose en lo ya construido).

### Fase 0 — Refactor base del frontend (1 sprint, bajo esfuerzo, habilitador)
- Crear `features/analytics/` con `AnalyticsPage.tsx` (contenedor con tabs).
- Extraer `DateRangeBar`, `KpiCard`, `ChartCard`, `PeriodStatusBadge` desde el código actual de `ReportsPanel`/`StatisticsDashboard`.
- Subir el `DateRange` + preset a estado global del contenedor (compartido entre tabs).
- Migrar el contenido actual a **Tab Ventas** (lo de `StatisticsDashboard`) y **Tab Cartera/CxP** (lo de `ReportsPanel`) sin tocar backend. *Resultado: misma data, mejor organización, ya con tabs.*

### Fase 1 — Resumen ejecutivo + Rentabilidad (alto valor, reutiliza ledger existente)
- Crear `GET /analytics/executive-summary` y `GET /analytics/pl-monthly` (sobre `Reports.financialStatements`, que YA existe).
- Construir **Tab 1 Resumen ejecutivo** (KPIs financieros + combo P&L + composición de activos) y **Tab 3 Rentabilidad** (márgenes + estado de resultados mensual + tabla contable).
- *Mayor salto de valor: por fin se ve utilidad real, margen y costo de ventas.*

### Fase 2 — Tesorería / Flujo de caja (alto valor, fuente ledger clase 11)
- Crear `GET /analytics/cashflow-monthly`, `/analytics/cash-by-account`.
- **Tab 5 Tesorería**: saldo, entradas/salidas, waterfall mensual, saldo por banco. Reusar `recaudo-forma-pago`. Integrar conciliación (`BankReconciliation`) y lotes (`PaymentBatch`).

### Fase 3 — Tributario (alto valor para contador, fuentes ya existen en `Dian.service`)
- Crear `GET /analytics/iva` y `/analytics/retenciones`.
- **Tab 6 Tributario**: IVA gen/desc/saldo, retenciones practicadas/sufridas, y embeber exógena (`/ledger/dian/exogena` + `/validacion`) y `retention-parties` (todos ya existen).

### Fase 4 — Cartera/CxP avanzada + indicadores (medio valor)
- Crear `GET /analytics/dso-dpo`. Añadir DSO/DPO/rotación/ciclo de caja a **Tab 4**.
- Hacer que aging acepte `?from&to`. Añadir evolución del aging por corte.

### Fase 5 — Ventas avanzada (medio valor)
- Crear `GET /analytics/top-productos`. Añadir top productos, ventas por geografía, NC% a **Tab 2**.

### Fase 6 — Nómina (medio valor, depende de confirmar `PayrollModel`)
- Crear `GET /analytics/payroll`. **Tab 7** desde asientos NOM.

### Fase 7 — Activos (depende de módulo de activos / `AssetModel`)
- Crear `GET /analytics/assets`. **Tab 8** desde clase 15/159x + asientos DEP.

### Fase 8 — Cierres transversales
- `GET /analytics/alerts` (semáforo en Resumen).
- Export CSV/Excel/PDF en todas las tablas (cartera, P&L, exógena, retenciones).
- Comparativo período-anterior (`compareTo=prev`) y deltas % en todos los KPI.
- Caché por `companyId+rango` en `Analytics.service` (patrón `CompanyStatistics`).

---

## 6. Decisiones de diseño críticas (resumen para implementación)

1. **Conciliación obligatoria**: las cifras del Tab Resumen/Rentabilidad/Tesorería/Tributario DEBEN salir del ledger y cuadrar con `/ledger/reports/financial-statements`. Nunca mostrar dos "ventas" distintas: la oficial es la del ledger; la de `BusinessReports` se etiqueta como "operativa/comercial".
2. **Lógica anti-doble-conteo del cierre (CL)**: respetar `hayCierre`. Si el año tiene asiento CL contabilizado, el resultado está en 30xx (patrimonio) y las clases 4/5/6/7 están en cero; NO recalcular en vivo. `financialStatements()` ya lo maneja — el frontend solo refleja el badge "Año cerrado".
3. **Filtro de fechas único y global**, propagado a todas las tabs (hoy está aislado en `ReportsPanel`).
4. **Período fiscal vs período libre**: para IVA usar período bimestral/cuatrimestral; para P&L mensual; permitir corte `to` para balances.
5. **Cuentas parametrizables**: no hardcodear PUC. Leer de `AccountingConfig` (cuenta_iva, cuenta_banco, cuenta_cliente, etc.) y `RetentionConcept.cuenta`. Las cuentas citadas (2408, 1305, 2205, 6135, 1355, 5105, 2370, 2505, 236505, 15xx, 159x) son los **defaults PUC** colombianos; el servicio debe resolver la cuenta real desde la configuración de la empresa.
6. **Gotchas de `Factura` ya conocidos** (del inventario): normalizar `TipoDocElectronico` (cero inicial), excluir `is_draft`, filtrar `facturaStatus ∈ [APPROVED, SENT]`, excluir prefijos SET*/NESET*. Aplican en cualquier agregado operativo (top productos, ventas por estado).

---

## Archivos relevantes (rutas absolutas)

- Dashboard resumen actual: `C:\Users\Admin\Documents\GitHub\FE_TECNOTICS_PORTAL\src\features\billing-history\components\StatisticsDashboard.tsx`
- Panel de reportes actual: `C:\Users\Admin\Documents\GitHub\FE_TECNOTICS_PORTAL\src\features\billing-history\components\ReportsPanel.tsx`
- Contenedor de la página: `C:\Users\Admin\Documents\GitHub\FE_TECNOTICS_PORTAL\src\features\billing-history\page\BillingHistory.tsx`
- Servicio reportes comerciales (reutilizar): `C:\Users\Admin\Documents\GitHub\FE_TECNOTICS_PORTAL\src\services\business-reports.service.ts`
- Servicio estadísticas (extender con fechas): `C:\Users\Admin\Documents\GitHub\FE_TECNOTICS_PORTAL\src\services\company-statistics.service.ts`
- Rutas API (ya tiene bloque `LEDGER_*` y `REPORT_*` sin consumir en stats): `C:\Users\Admin\Documents\GitHub\FE_TECNOTICS_PORTAL\src\utils\global.ts` (líneas 199-218 ledger/dian, 282-291 stats/reports)
- Backend a crear: `C:\Users\Admin\Documents\GitHub\MC-TECNOTICS-FACTURACION\src\services\Analytics.service.ts` (apoyándose en `Reports.service.ts`, `BusinessReports.service.ts`, `Dian.service.ts`)

Hallazgo clave: las rutas del Libro Mayor (`LEDGER_TRIAL_BALANCE`, `LEDGER_FINANCIAL`, `LEDGER_DIAN_EXOGENA`, etc.) **ya están declaradas** en `global.ts` pero **ningún componente de Estadísticas las usa** — son la mayor oportunidad de valor inmediato (Fase 1) porque el backend que las sirve ya existe.