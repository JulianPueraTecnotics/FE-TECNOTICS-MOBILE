# Fundamentos de Contabilidad Financiera → aplicado a nuestro sistema

> Análisis del libro **"Fundamentos de contabilidad financiera"** (Montiel Paternina & Peña Sánchez, Universidad Libre, 2022) contrastado con el motor contable implementado en `MC-TECNOTICS-FACTURACION` / `FE_TECNOTICS_PORTAL`. Para cada concepto del libro: qué dice, cómo lo cumplimos hoy y qué falta.

---

## Resumen ejecutivo

El libro confirma que **el núcleo del motor contable está bien construido** y alineado con la teoría colombiana (PUC, partida doble, naturaleza por clase, cierre con 5905, depreciación línea recta). El **gap principal no es teórico sino de cobertura**: el libro enseña el ciclo completo **compra → venta → costo de ventas → utilidad bruta → cierre**, y nuestro sistema **solo contabiliza el lado de compras/egresos**. Ventas, recaudos y nómina no generan asientos, por lo que el Estado de Resultados que el libro presenta (p.134) hoy **no se puede producir correctamente** (no hay ingresos ni costo de ventas contabilizados). Ver [[integracion-contable-incompleta]].

---

## 1. Las cuentas y el PUC (Unidad 6) — ✅ CUMPLIDO

**El libro (p.69-73):**
- Cuentas reales/balance (1 Activo, 2 Pasivo, 3 Patrimonio) y nominales/resultado (4 Ingresos, 5 Gastos, 6 Costo de ventas, 7 Costos de producción).
- Código jerárquico: 1 dígito = **clase**, 2 = **grupo**, 4 = **cuenta**, 6 = **subcuenta**, 8 = **auxiliar**. (DR 2650/93.)
- Estructura: catálogo + descripciones + **dinámicas** (cómo se mueve el debe/haber de cada cuenta).

**Nuestro código:** `CoaAccountModel` (`accounting.model.ts`) usa exactamente esta jerarquía; `es_movimiento` distingue las auxiliares que reciben asientos; la naturaleza se deriva del primer dígito en `PostingService`. **Coincide 1:1.**

**Oportunidad menor:** el libro habla de las "dinámicas" del PUC. Hoy no mostramos al usuario la dinámica esperada de cada cuenta (cuándo va al debe/haber). Sería un buen texto de ayuda contextual en la pantalla de PUC.

---

## 2. Ecuación contable y partida doble (Unidad 7) — ✅ CUMPLIDO

**El libro (p.79-81):** `A = P + PT`. La partida doble exige que en toda operación **Σ débitos = Σ créditos**, sin excepciones.

**Nuestro código:** `PostingService.assertBalanced()` rechaza con error 400 cualquier asiento donde `round2(Σdébito) !== round2(Σcrédito)` o cuyo total sea 0. **Es el corazón del motor y está correctamente implementado.**

---

## 3. Reglas del debe y el haber (Unidad 8) — ✅ CUMPLIDO

**El libro (p.88, tabla "EN RESUMEN"):**

| Clase | Debe | Haber | Saldo |
|---|---|---|---|
| 1 Activo | Aumenta | Disminuye | Débito |
| 2 Pasivo | Disminuye | Aumenta | Crédito |
| 3 Patrimonio | Disminuye | Aumenta | Crédito |
| 4 Ingresos | Disminuye/cancela | Aumenta | Crédito |
| 5 Gastos | Aumenta | Disminuye/cancela | Débito |
| 6 Costo de ventas | Aumenta | Disminuye/cancela | Débito |
| 7 Costos producción | Aumenta | Disminuye | Débito |

**Nuestro código:** la naturaleza (débito para 1/5/6/7, crédito para 2/3/4) se aplica en `trialBalance`/`generalLedger`/`financialStatements` para derivar el saldo. **Coincide exactamente.**

**Esquema de compra del libro (p.90)** — idéntico a nuestro `fromPurchase`:
```
D 1435/5xxx  Inventario o gasto      (subtotal)
D 240805     IVA descontable         (iva)
C 2205       Proveedores  (o 1110 Banco si es de contado)   (total)
```
Nuestro `PostingService.fromPurchase` produce justo esto, y desde el piloto además **distribuye el gasto por producto y agrega retenciones** (D gasto por cuenta del ítem, C retefuente/reteiva/reteica), reduciendo la CxP neta. **Vamos más allá del libro aquí.**

---

## 4. Asientos de ajuste y depreciación (Unidad 10) — ⚠️ PARCIAL

**El libro (p.105-108):**
- **Depreciación línea recta:** `Depreciación anual = Costo / vida útil (años)`; mensual `= Costo / (vida útil × 12)`. Asiento: **D gasto depreciación / C 1592 depreciación acumulada**.
- **Cuenta de gasto según uso del activo:** administración → **5160**, ventas → **5260**, producción (CIF) → **7360**. Crédito siempre a **1592**.
- **Tabla de vida útil fiscal (Ley 1819/2016):** Edificaciones 45 años (2,22%), Maquinaria/Equipos 10, Equipos de oficina 10, Muebles y enseres 10, **Equipos de cómputo 5 (20%)**, Flota y transporte 10.
- **Valor neto en libros = Costo − Depreciación acumulada.**

**Nuestro código:** `FixedAssets.service` calcula `cuotaMensual = (costo − residual)/vida_util_meses`, `valor_libros = costo − dep_acumulada`, y postea asiento **DEP** (D `cuenta_gasto_depreciacion` / C `cuenta_depreciacion_acumulada`). **Cumple el método** y además contempla **valor residual** (el libro lo menciona pero no lo usa en el ejemplo).

**Lo que falta (✚ recomendaciones):**
1. **Sugerir vida útil y cuenta de gasto por categoría** al crear el activo, usando la tabla fiscal del libro (cómputo 60 meses, vehículos 120, edificaciones 540…) y la cuenta de gasto según uso (5160/5260/7360). Hoy el usuario los teclea a mano.
2. **Amortización de diferidos (1705)** — el libro la trata junto a la depreciación: `AM = valor / nº meses`, D gasto / C 1710 (o reducción del diferido). **No la tenemos.** Es un proceso pendiente del doc.
3. Otros ajustes del libro que faltan: **GMF (4×1000)**, **provisión de prestaciones sociales**, **ingresos recibidos por anticipado**.

---

## 5. Asientos de cierre (Unidad 11) — ✅ CUMPLIDO Y VALIDADO

**El libro (p.113):** el cierre usa la cuenta puente **5905 Ganancias y Pérdidas**:
1. Cerrar ingresos (4): **D ingresos / C 5905**.
2. Cerrar gastos (5): **D 5905 / C gastos**.
3. Cerrar costo de ventas (6): **D 5905 / C costos**.
4. Saldar 5905 contra **360505 utilidad** (si ingresos > gastos+costos) o **360510 pérdida**.

**Nuestro código:** el cierre anual (fase 4, ya validado con workflow) cancela clases 4/5/6/7 contra el resultado y lleva el neto a la cuenta de resultado del ejercicio (utilidad/pérdida), evitando el doble conteo. **El libro confirma nuestras reglas.** Ver [[contabilidad-cierre-fase4]].

> Nota: nosotros parametrizamos la cuenta puente/resultado en `AccountingConfig` en vez de fijar 5905/3605; es funcionalmente equivalente y más flexible.

---

## 6. Estados financieros (Unidad 13) — ⚠️ BLOQUEADO POR EL GAP DE VENTAS

**El libro (p.134-135)** presenta los dos estados clave:

**Estado de Resultados:**
```
Ventas netas
(−) Costo de ventas
(=) UTILIDAD BRUTA
(−) Gastos operacionales (administración, ventas, depreciación…)
(=) Utilidad operacional
(±) Ingresos/gastos no operacionales
(=) Utilidad antes de impuestos
(−) Provisión impuesto de renta
(=) Utilidad del periodo
```

**Estado de Situación Financiera:** Activo corriente/no corriente = Pasivo + Patrimonio (con resultado del ejercicio).

**Nuestro código:** `Reports.service.financialStatements` arma balance general y estado de resultados desde los asientos. **El motor existe**, pero:

> ⚠️ **Como las ventas y su costo de ventas NO se contabilizan**, hoy el Estado de Resultados saldría **sin "Ventas netas" ni "Costo de ventas" ni "Utilidad bruta"** — solo mostraría gastos. La "Utilidad" sería negativa y falsa. Este es el hallazgo central: el formato del libro **exige cerrar el circuito de ventas**.

---

## 7. El gap estructural (lo más importante del análisis)

El libro enseña que **toda operación mercantil tiene dos actores y genera asientos en ambos** (partida doble universal, p.81). En nuestro sistema:

| Operación del libro | Asiento que el libro espera | ¿Lo generamos? |
|---|---|---|
| Compra de mercancía/gasto | D inventario/gasto + D IVA desc / C proveedor-banco | ✅ Sí (`fromPurchase`) |
| Pago a proveedor | D proveedor / C banco | ✅ Sí (`fromPayment`) |
| Depreciación | D gasto / C 1592 | ✅ Sí (DEP) |
| **Venta de mercancía** | **D banco/cliente + D costo ventas / C ingreso + C IVA gen + C inventario** | ❌ **No** |
| **Recaudo de cliente** | **D banco / C cliente (CxC)** | ❌ **No** |
| **Nómina** | **D gasto sueldos / C salarios por pagar + C retenciones + C seguridad social** | ❌ **No** |

**Consecuencia en cadena:**
- Estados financieros sin ingresos → utilidad irreal.
- Exógena **1006 (IVA generado), 1007 (ingresos), 1008 (CxC)** salen en cero/incompletos.
- El cierre anual cancela gastos pero **no hay ingresos que cancelar** → arrastra pérdida ficticia.
- La cartera del reporte de aging funciona **solo porque se calcula aparte** leyendo facturas directamente (no de la contabilidad).

---

## 8. Recomendaciones accionables (priorizadas)

1. **🔴 ALTA — Auto-asiento de ventas (FV).** Al aprobar una factura DIAN (APPROVED), postear:
   `D 1305 Clientes (o 1110 si contado) + D costo de ventas (si se maneja inventario) / C 4135 Ingresos + C 2408 IVA generado (+ C 1435 inventario)`.
   Cierra el circuito y habilita EEFF reales, 1006/1007/1008 y el cierre correcto.
2. **🔴 ALTA — Auto-asiento de recaudo (RC).** Al registrar pago de cliente: `D 1110 Banco + D retención sufrida / C 1305 Clientes`. Conecta la cartera con la contabilidad (1008 real).
3. **🟠 MEDIA — Auto-asiento de nómina (NOM).** Al emitir nómina aprobada: `D 5105 gastos de personal / C 2505 salarios por pagar + C 2370 retenciones + C 2380 aportes`. Da costo laboral contable y alimenta el F220 desde el mayor.
4. **🟠 MEDIA — Sugerir vida útil + cuenta de gasto de depreciación** por categoría de activo (tabla Ley 1819/2016 del libro).
5. **🟡 BAJA — Amortización de diferidos (1705)** y otros ajustes (GMF, prestaciones, ingresos anticipados) como procesos del módulo de Contabilidad.
6. **🟡 BAJA — Mostrar la "dinámica" del PUC** (texto de ayuda débito/haber por cuenta) en la pantalla de plan de cuentas.

> Las recomendaciones 1-3 son la pieza que falta para que el sistema sea, como dice el libro, una contabilidad de **partida doble completa** y no solo del lado de egresos.

---

## Apéndice — Cuentas PUC citadas por el libro (referencia rápida)

| Código | Cuenta | Uso |
|---|---|---|
| 1105 | Caja | Efectivo |
| 1110 | Bancos | Cuentas corrientes |
| 1305 | Clientes | CxC ventas a crédito |
| 1435 | Inventario de mercancías | Compra/venta de mercancía |
| 1504/1516/1528/1540 | PP&E (terrenos, edificios, cómputo, transporte) | Activos fijos |
| 1592 | Depreciación acumulada | Crédito de la depreciación |
| 1705 | Gastos pagados por anticipado | Diferidos a amortizar |
| 2205 | Proveedores | CxP compras |
| 2370/2380 | Retenciones / aportes | Por pagar |
| 2408 | IVA (descontable 240805 / generado 240810) | Impuesto |
| 3605/3610 | Resultado del ejercicio (utilidad/pérdida) | Cierre |
| 4135 | Comercio al por mayor y menor | Ingreso por ventas |
| 5105 | Gastos de personal | Nómina admin |
| 5160 / 5260 / 7360 | Depreciación (admin / ventas / producción) | Gasto depreciación |
| 5905 | Ganancias y pérdidas | Cuenta puente de cierre |
| 6135 | Costo de ventas (comercio) | Costo de la mercancía vendida |
