# Módulo de Contabilidad — Colombia
### Especificación funcional + Prompt de desarrollo (Node/Express/MongoDB/React/TS)

Este documento tiene dos partes:
1. **Qué elementos debe tener** el módulo (mapa del menú + features por área).
2. **El prompt completo** listo para pegar en Claude Code y arrancar el desarrollo.

---

## PARTE 1 — Decisiones de arquitectura (lee esto primero)

El módulo de Contabilidad no es una pantalla más: es el **motor de partida doble** que amarra todo lo que ya tienes (Ventas, Compras, Tesorería, Nómina). Cuatro decisiones lo sostienen:

1. **Motor de asientos centralizado.** Toda transacción (factura, compra, gasto, pago, recaudo, nómina) genera un **comprobante contable** con líneas débito/crédito que **siempre cuadran**. Nadie escribe contabilidad "a mano" desde los módulos: hay un servicio único `postingService` que recibe el documento origen y produce el asiento.

2. **Multimarco NIIF / COLGAAP en paralelo.** Ya lo tienes en "Cuentas por defecto" (código NIIF + código COLGAAP). El motor debe poder llevar **doble columna contable** o, mínimo, marcar el marco activo por empresa y guardar el mapeo del otro para reportes.

3. **Multitenant (DB-per-tenant).** Cada empresa tiene su propio PUC, sus consecutivos, sus períodos y sus impuestos. Nada de esto vive en `tec_control`; vive en la DB del tenant vía `useDb()`.

4. **Trazabilidad bidireccional.** Cada asiento apunta a su documento origen (`origen: { tipo, id }`) y cada documento muestra su asiento. Anular el documento anula/reversa el asiento (nunca se borra: se contabiliza un reverso).

---

## PARTE 2 — Estructura del menú "Contabilidad"

Lo que ya tienes en **Configuración** es la base correcta (PUC, Cuentas por defecto, Consecutivos, Centros de costo). El menú **Contabilidad** (hoy en "PRONTO") debería quedar así:

```
Contabilidad
├── Comprobantes              → listado unificado de asientos (filtros por tipo/fecha/cuenta/tercero/estado)
│   ├── Causaciones           (CC)  asientos de compras/gastos
│   ├── Egresos               (CE)  pagos a proveedores
│   ├── Ingresos / Recaudos   (RC)  recaudos de clientes
│   ├── Facturación           (FV)  asientos de ventas
│   └── Notas de contabilidad (NC)  asientos manuales / ajustes / depreciación
├── Libros
│   ├── Libro diario
│   ├── Libro mayor y balances
│   ├── Auxiliar por cuenta
│   └── Auxiliar por tercero
├── Estados financieros
│   ├── Balance de prueba
│   ├── Estado de situación financiera (Balance General)
│   ├── Estado de resultados (P&G)
│   ├── Flujo de efectivo
│   └── Cambios en el patrimonio
├── Conciliación bancaria
├── Períodos y cierres
│   ├── Períodos contables    (abrir / cerrar / bloquear meses)
│   └── Cierre anual          (cancelación de resultados + apertura)
├── Impuestos
│   ├── Certificados de retención (fuente, IVA, ICA)
│   └── Liquidación / borradores  (IVA, retención, ICA)
└── DIAN / Exógena
    ├── Información exógena    (medios magnéticos)
    └── Conciliación fiscal    (formato 2516 — avanzado/opcional)
```

---

## PARTE 3 — Elementos por área (qué construir)

### 3.1 Motor contable (lo más importante)
- Entidad **ComprobanteContable** (encabezado) + **LíneaContable** (detalle).
- Validación dura: `Σ débitos === Σ créditos` (con tolerancia 0). No se guarda descuadrado.
- **Tipos de comprobante:** causación (CC), egreso (CE), ingreso/recaudo (RC), factura (FV), nota de contabilidad (NC), apertura (AP), cierre (CL), depreciación (DEP), nómina (NOM).
- **Estados:** `borrador` → `contabilizado` → `anulado` (el anulado genera reverso, no se elimina).
- **Origen:** `manual` o referencia al documento (`{ tipo: 'compra'|'factura'|'pago'|'recaudo'|'nomina', id }`).
- **Consecutivo automático** por tipo de comprobante, respetando rangos bloqueados (ya tienes esa config).

### 3.2 Plan de cuentas (PUC) — extender lo que ya tienes
- Jerarquía por longitud de código: **clase (1) → grupo (2) → cuenta (4) → subcuenta (6) → auxiliar (8+)**.
- Por cuenta: `naturaleza` (débito/crédito), `nivel`, `codigo_padre`, `marco` (NIIF/COLGAAP), `equivalente` (código del otro marco).
- Banderas operativas: `manejaTercero` (sí/no), `manejaCentroCosto` (sí/no), `manejaBase` (sí/no, para impuestos), `esMovimiento` (solo cuentas hoja/auxiliares reciben asientos).
- Validación: una línea no puede imputarse a una cuenta de mayor (no-movimiento).

### 3.3 Terceros unificados
Hoy tienes Clientes y Proveedores separados. Para contabilidad y exógena necesitas un **maestro único de terceros**:
- Identificación: `tipoDocumento` (NIT/CC/CE/PASAPORTE…), `numero`, `dv`, `tipoPersona` (natural/jurídica).
- Fiscal: `responsabilidadesFiscales` (códigos DIAN: O-13, O-15, O-23…), `responsableIVA` (sí/no), `granContribuyente`, `autorretenedor`, `regimenSimple` (RST).
- Ubicación: `ciudad` + `codigoMunicipio` (clave para reteICA y exógena).
- Actividad: `codigoCIIU`.
- Clientes/Proveedores/Empleados son **roles** del mismo tercero, no entidades distintas.

### 3.4 Impuestos y retenciones (parametrizable por año)
- **Tabla UVT por año** (nunca hardcodear el valor; cargarlo por vigencia).
- **Conceptos de retención en la fuente:** código, descripción, base mínima en UVT, tarifa %, cuenta contable. (Compras, servicios, honorarios, arrendamientos, etc.)
- **ReteIVA:** tarifa sobre el IVA, cuenta.
- **ReteICA:** tarifa por mil **por municipio + actividad**, cuenta. (Es municipal: depende de la ciudad del tercero.)
- **Autorretención de renta** (Decreto 2201/2016): tarifa por actividad económica.
- **IVA:** tarifas 0% / 5% / 19% / exento / excluido, con su cuenta de IVA generado y descontable.
- El motor calcula automáticamente la retención cuando la base supera el mínimo y el tercero/concepto lo exige.

### 3.5 Comprobantes (UI)
- Listado unificado con filtros (tipo, rango de fechas, cuenta, tercero, centro de costo, estado).
- Editor de comprobante manual con grilla débito/crédito, validación de cuadre en vivo, autocompletar cuentas y terceros.
- Vista de detalle con enlace al documento origen y botón de anulación (reverso).
- Plantillas de comprobante recurrente (opcional): asientos repetitivos precargados.

### 3.6 Automatización contable (reglas de contabilización)
El corazón del valor. Cada documento dispara un asiento según reglas configurables:

| Documento | Débito | Crédito |
|---|---|---|
| **Factura de venta** | CxC cliente / Retenciones que me practican | Ingreso + IVA generado |
| **Compra / gasto** | Gasto-costo + IVA descontable | CxP proveedor + Retenciones que practico |
| **Pago a proveedor** | CxP proveedor | Banco / Caja |
| **Recaudo de cliente** | Banco / Caja | CxC cliente |
| **Nómina** | Gastos de personal + Aportes | CxP nómina + Seguridad social + Provisiones |
| **Depreciación** | Gasto depreciación | Depreciación acumulada |

- Las cuentas salen de **Cuentas por defecto** (ya las tienes) con **override** opcional por producto, proveedor, concepto de gasto o centro de costo.
- Motor de reglas: `ReglaContabilizacion { documento, condicion, cuentaDebito, cuentaCredito, prioridad }`.

### 3.7 Períodos y cierres
- **PeriodoContable** mensual: `abierto` / `cerrado` / `bloqueado`. No se permiten asientos en períodos cerrados.
- **Cierre anual:** comprobante de cierre que **cancela cuentas de resultado** (clases 4, 5, 6, 7) contra utilidad/pérdida del ejercicio (3605/5905 según marco), y **comprobante de apertura** del nuevo año con saldos de balance.
- Bloqueo por usuario/rol (ya tienes RBAC).

### 3.8 Libros oficiales y auxiliares
- **Libro diario:** todos los asientos cronológicos.
- **Libro mayor y balances:** por cuenta con saldo inicial, débitos, créditos, saldo final.
- **Auxiliar por cuenta / por tercero / por centro de costo:** detalle de movimientos filtrable.
- Exportable a Excel/PDF (ya usas pptxgenjs/xlsx; reutiliza el pipeline).

### 3.9 Estados financieros
- **Balance de prueba** (trial balance) comparativo, base de todo lo demás.
- **Estado de Situación Financiera** (clases 1, 2, 3) comparativo por períodos.
- **Estado de Resultados** (clases 4, 5, 6, 7).
- **Flujo de efectivo** (método indirecto inicial; directo opcional).
- **Cambios en el patrimonio.**
- Todos parten del balance de prueba + mapeo de cuentas a renglones del estado.

### 3.10 Conciliación bancaria
- Importar extracto bancario (CSV/Excel del banco).
- Match automático contra movimientos de la cuenta banco (por valor, fecha, referencia).
- Partidas conciliatorias (cheques en tránsito, consignaciones no identificadas, comisiones).
- Saldo según libros vs saldo según banco.

### 3.11 DIAN / Exógena / Certificados
- **Información exógena (medios magnéticos):** generación de formatos según la resolución vigente del año gravable:
  - 1001 Pagos y abonos en cuenta · 1003 Retenciones practicadas · 1005 IVA descontable · 1006 IVA generado · 1007 Ingresos · 1008 Saldos CxC · 1009 Saldos CxP · 1010 Socios/accionistas.
  - Salida en **XML** (esquema DIAN) y/o Excel para revisión.
- **Certificados de retención** (fuente, IVA, ICA) por tercero y período — PDF (reutiliza pdf-lib que ya usas en GenesisX).
- **Conciliación fiscal (formato 2516):** avanzado/opcional, diferencias contable vs fiscal.

### 3.12 Auditoría y trazabilidad
- Log inmutable: quién creó / contabilizó / anuló cada comprobante y cuándo.
- Vínculo documento ↔ asiento en ambos sentidos.
- Sello de período y bloqueo post-cierre.

---

## PARTE 4 — Modelo de datos (entidades clave)

```ts
// ComprobanteContable (encabezado)
{
  empresaId: ObjectId,            // tenant
  tipo: 'CC'|'CE'|'RC'|'FV'|'NC'|'AP'|'CL'|'DEP'|'NOM',
  consecutivo: number,           // por tipo, respeta rangos bloqueados
  fecha: Date,
  periodo: string,               // 'YYYY-MM'
  descripcion: string,
  estado: 'borrador'|'contabilizado'|'anulado',
  origen: { tipo: string|null, id: ObjectId|null }, // documento fuente
  totalDebito: number,
  totalCredito: number,          // === totalDebito (validado)
  marco: 'NIIF'|'COLGAAP',
  creadoPor: ObjectId,
  contabilizadoPor: ObjectId|null,
  anuladoPor: ObjectId|null,
  reversaDe: ObjectId|null,      // si es un asiento de reverso
}

// LineaContable (detalle, 1..N por comprobante)
{
  comprobanteId: ObjectId,
  cuenta: string,                // código PUC (debe ser cuenta de movimiento)
  terceroId: ObjectId|null,      // requerido si cuenta.manejaTercero
  centroCostoId: ObjectId|null,  // requerido si cuenta.manejaCentroCosto
  debito: number,                // uno de los dos en 0
  credito: number,
  base: number|null,             // base gravable, si cuenta.manejaBase
  descripcion: string,
}

// CuentaPUC (extiende tu import actual)
{
  empresaId, codigo, nombre, tipo, naturaleza: 'debito'|'credito',
  nivel: number, codigoPadre: string|null,
  marco: 'NIIF'|'COLGAAP', equivalente: string|null,
  manejaTercero: boolean, manejaCentroCosto: boolean,
  manejaBase: boolean, esMovimiento: boolean, activa: boolean,
}

// Tercero (maestro unificado)
{
  empresaId, tipoDocumento, numero, dv, tipoPersona,
  razonSocial, nombres, apellidos,
  responsableIVA: boolean, granContribuyente: boolean,
  autorretenedor: boolean, regimenSimple: boolean,
  responsabilidadesFiscales: string[],   // códigos DIAN
  codigoCIIU: string, codigoMunicipio: string, ciudad: string,
  roles: ('cliente'|'proveedor'|'empleado'|'otro')[],
}

// ConceptoRetencion
{
  empresaId, tipo: 'fuente'|'iva'|'ica'|'autorrenta',
  codigo, descripcion,
  baseMinimaUVT: number, tarifa: number,
  codigoMunicipio: string|null,   // solo ICA
  cuenta: string,
}

// PeriodoContable
{ empresaId, periodo: 'YYYY-MM', estado: 'abierto'|'cerrado'|'bloqueado', cerradoPor }

// ReglaContabilizacion
{ empresaId, documento, condicion, cuentaDebito, cuentaCredito, prioridad }

// TablaUVT
{ anio: number, valor: number }
```

---

## PARTE 5 — Reglas de negocio críticas

1. **Partida doble:** ningún comprobante se persiste si `totalDebito !== totalCredito`.
2. **Cuenta de movimiento:** las líneas solo imputan a cuentas hoja (`esMovimiento: true`).
3. **Tercero obligatorio:** si la cuenta `manejaTercero`, la línea exige `terceroId`.
4. **Período cerrado:** rechazar cualquier asiento cuya `fecha` caiga en período `cerrado`/`bloqueado`.
5. **Anulación = reverso:** nunca borrar; crear comprobante inverso enlazado (`reversaDe`).
6. **Cálculo de impuestos:** la retención se aplica solo si `base ≥ baseMinimaUVT * UVT(año)` y el tercero/concepto la exige; redondeo según norma (al peso).
7. **Consecutivos:** únicos por empresa+tipo, respetando rangos bloqueados de la config existente.
8. **Cierre anual:** las clases 4/5/6/7 deben quedar en saldo cero tras el cierre; el resultado va a patrimonio.

---

## PARTE 6 — EL PROMPT (copiar y pegar en Claude Code)

> Pega el bloque siguiente en Claude Code (Opus 4.8, xhigh). Ajusta nombres de repos/carpetas a tu proyecto real antes de ejecutar.

```text
Eres un ingeniero senior trabajando en el módulo de CONTABILIDAD para Colombia de un
SaaS B2B multitenant. Implementa siguiendo EXACTAMENTE estas reglas. No improvises
estructura; pregunta si algo es ambiguo antes de generar código masivo.

## CONTEXTO DEL SISTEMA
- Stack: Node.js + Express + TypeScript (backend), MongoDB con Mongoose, React + TypeScript (frontend).
- Multitenant con base de datos por empresa vía Mongoose useDb(). La config global vive en
  la DB de control; la contabilidad vive en la DB del tenant.
- El sistema ya tiene: Ventas (facturas, recaudos, clientes), Compras y gastos (proveedores,
  compras, gastos), Tesorería (pagos a proveedores, lotes de pago, bancos), Nómina.
- Ya existe configuración de: Plan de cuentas (PUC) importable por CSV, Cuentas contables por
  defecto (con código NIIF y COLGAAP), Consecutivos (con rangos bloqueados), Centros de costo.
- Validación con Zod, logs con Winston. Mantén ese patrón.

## OBJETIVO
Construir el motor contable de partida doble que conecta todos los módulos y expone el menú
"Contabilidad". TODA transacción genera un comprobante contable con líneas débito/crédito que
SIEMPRE cuadran.

## PRINCIPIOS NO NEGOCIABLES
1. Partida doble: no se persiste un comprobante si Σdébitos !== Σcréditos (tolerancia 0).
2. Servicio único de contabilización (postingService): los módulos NO escriben asientos
   directamente; le pasan el documento origen y él produce el comprobante.
3. Trazabilidad bidireccional: cada asiento referencia su documento origen y viceversa.
4. Anulación = reverso (comprobante inverso enlazado), nunca borrado físico.
5. Multimarco NIIF/COLGAAP: marco activo por empresa + mapeo del equivalente.
6. Multitenant estricto: todo filtrado por empresaId / DB del tenant.
7. Parametrización fiscal por año: UVT, tarifas y bases de retención NUNCA hardcodeadas.

## MODELO DE DATOS (Mongoose)
Crea schemas para: ComprobanteContable (encabezado), LineaContable (detalle),
CuentaPUC (extiende el existente con naturaleza, nivel, codigoPadre, marco, equivalente,
manejaTercero, manejaCentroCosto, manejaBase, esMovimiento), Tercero (maestro unificado con
responsabilidades fiscales DIAN, responsableIVA, granContribuyente, autorretenedor,
regimenSimple, codigoCIIU, codigoMunicipio, roles[]), ConceptoRetencion (tipo fuente/iva/ica/
autorrenta, baseMinimaUVT, tarifa, codigoMunicipio para ICA, cuenta), PeriodoContable
(periodo YYYY-MM, estado abierto/cerrado/bloqueado), ReglaContabilizacion (documento,
condicion, cuentaDebito, cuentaCredito, prioridad), TablaUVT (anio, valor).
(Usa exactamente los campos que te indique el spec adjunto; si falta alguno, propónlo.)

## MOTOR DE CONTABILIZACIÓN (postingService)
Implementa la generación automática de asientos para:
- Factura de venta: D CxC cliente / D Retenciones que me practican ; C Ingreso + C IVA generado.
- Compra/gasto: D Gasto-costo + D IVA descontable ; C CxP proveedor + C Retenciones que practico.
- Pago a proveedor: D CxP proveedor ; C Banco/Caja.
- Recaudo de cliente: D Banco/Caja ; C CxC cliente.
- Nómina: D Gastos de personal + Aportes ; C CxP nómina + Seguridad social + Provisiones.
- Depreciación: D Gasto depreciación ; C Depreciación acumulada.
Las cuentas salen de "Cuentas por defecto", con override opcional por producto/proveedor/
concepto/centro de costo vía ReglaContabilizacion. El cálculo de retención aplica solo si
base >= baseMinimaUVT * UVT(año) y el tercero/concepto lo exige; redondea al peso.

## VALIDACIONES (server-side, con Zod + lógica de dominio)
- Cuadre débito/crédito exacto.
- Líneas solo a cuentas de movimiento (esMovimiento === true).
- terceroId obligatorio si cuenta.manejaTercero; centroCostoId si manejaCentroCosto.
- Rechazar asientos en períodos cerrados/bloqueados.
- Consecutivo único por empresa+tipo, respetando rangos bloqueados.

## API (Express, REST, prefijo /api/contabilidad)
- Comprobantes: CRUD + contabilizar + anular(reverso) + listar con filtros (tipo, fechas,
  cuenta, tercero, centroCosto, estado).
- Libros: diario, mayor y balances, auxiliar por cuenta/tercero/centro.
- Estados financieros: balance de prueba, situación financiera, resultados (todos derivados del
  balance de prueba + mapeo a renglones).
- Períodos: abrir/cerrar/bloquear; cierre anual (cancelación de resultados + apertura).
- Impuestos: certificados de retención (fuente/IVA/ICA) por tercero/período.
- Exógena: generación de formatos 1001/1003/1005/1006/1007/1008/1009/1010 (XML + Excel) según
  resolución vigente del año.
Todos los endpoints autenticados, autorizados por RBAC existente y filtrados por tenant.

## FRONTEND (React + TS)
- Menú "Contabilidad" con la estructura: Comprobantes (con sub-tipos), Libros, Estados
  financieros, Conciliación bancaria, Períodos y cierres, Impuestos, DIAN/Exógena.
- Editor de comprobante manual: grilla débito/crédito con validación de cuadre EN VIVO,
  autocompletar de cuentas (solo de movimiento) y terceros, suma de control visible.
- Vistas de libros y estados con exportación a Excel/PDF (reutiliza el pipeline existente).

## ENTREGA POR FASES (no hagas todo de una; entrega y valida fase por fase)
FASE 1 — Núcleo: schemas (Comprobante, Linea, CuentaPUC extendida, Periodo) + postingService +
         validación de cuadre + editor de comprobante manual + libro diario. Tests del cuadre.
FASE 2 — Automatización: enganchar facturas, compras/gastos, pagos y recaudos al postingService.
         Terceros unificados + ReglaContabilizacion + cálculo de impuestos/retenciones.
FASE 3 — Reportes: balance de prueba, mayor y balances, auxiliares, estados financieros.
FASE 4 — Cierres: períodos, cierre anual, comprobante de apertura.
FASE 5 — DIAN: certificados de retención + información exógena (formatos XML/Excel).

## CRITERIOS DE ACEPTACIÓN
- Imposible guardar un comprobante descuadrado (probado con test).
- Una factura/compra/pago/recaudo genera su asiento correcto y enlazado, y al anular el
  documento se genera el reverso.
- El balance de prueba cuadra (total débitos = total créditos) en cualquier corte.
- Períodos cerrados rechazan nuevos asientos.
- Retenciones se calculan solo cuando corresponde, con UVT del año parametrizada.

Empieza por la FASE 1. Antes de generar código, muéstrame:
(a) la estructura de carpetas que vas a crear,
(b) los schemas Mongoose finales,
(c) la firma del postingService.
Luego espera mi visto bueno para implementar.
```

---

## PARTE 7 — Roadmap sugerido (orden de construcción)

| Fase | Entrega | Por qué primero |
|---|---|---|
| **1** | Núcleo: motor de partida doble + comprobante manual + libro diario | Sin motor que cuadre, nada más sirve |
| **2** | Auto-asientos desde Ventas/Compras/Tesorería + terceros + impuestos | Es el 80% del valor diario |
| **3** | Balance de prueba + libros + estados financieros | Reportería sobre datos ya correctos |
| **4** | Períodos y cierre anual | Necesario para cerrar el ejercicio |
| **5** | DIAN: certificados + exógena | Cumplimiento, una vez todo lo demás esté sólido |

---

### Notas finales
- **No hardcodees UVT, tarifas ni la resolución de exógena**: cárgalas por año/vigencia. Cambian cada año y te tocaría reescribir código.
- **Reutiliza lo que ya tienes**: Cuentas por defecto, Consecutivos, Centros de costo y el PUC son justo los cimientos correctos. El módulo Contabilidad los consume, no los reemplaza.
- **Maestro de terceros unificado** es la decisión que más dolor te ahorra de cara a exógena y certificados: empieza por ahí en la Fase 2.
