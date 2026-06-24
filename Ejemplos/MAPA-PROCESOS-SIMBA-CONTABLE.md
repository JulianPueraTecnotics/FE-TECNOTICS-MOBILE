# Mapa completo de procesos — Facturación, SIMBA y Contabilidad

> Verificado sobre el código real de `MC-TECNOTICS-FACTURACION`. Cada documento, qué se emite a SIMBA/DIAN, y qué asiento contable genera. Diagramas en **Mermaid** (pégalos en [mermaid.live](https://mermaid.live), Notion, Obsidian, draw.io o GitHub).
>
> **Convención:** 🟢 va a SIMBA · 🔵 se importa/interno · ⚙️ genera asiento automático · ⛔ no contabiliza.

---

## 1. Panorama general

```mermaid
graph TD
    subgraph EMISION["📤 EMISIÓN A SIMBA / DIAN"]
        FV["Factura de venta (01)"]
        POS["Factura POS (01/20)"]
        NC["Nota crédito (03)"]
        ND["Nota débito (02)"]
        DS["Documento soporte (11)"]
        NOM["Nómina electrónica (102)"]
    end

    subgraph IMPORT["📥 IMPORTACIÓN (no SIMBA)"]
        COM["Compra (XML/ZIP DIAN)"]
        GAS["Gasto (XML/ZIP DIAN)"]
        MAIL["Recepción por correo"]
    end

    subgraph INTERNO["🏦 PROCESOS INTERNOS (no SIMBA)"]
        REC["Recaudo de cliente"]
        PAG["Pago a proveedor (lote)"]
        DEP["Depreciación"]
        CIE["Cierre anual"]
        RET["Retención sobre compra"]
    end

    SIMBA(["SIMBA → DIAN"])
    LEDGER[("📒 Libro Mayor\nmotor partida doble")]

    FV & POS & NC & ND & DS & NOM -->|emite, CUFE/CUNE| SIMBA

    FV -->|⚙️ FV| LEDGER
    POS -->|⚙️ FV| LEDGER
    NC -->|⚙️ NC reverso| LEDGER
    ND -.->|⛔ no contabiliza| LEDGER
    DS -.->|⛔ no contabiliza| LEDGER
    NOM -->|⚙️ NOM| LEDGER

    MAIL --> COM & GAS
    COM -->|⚙️ CC| LEDGER
    GAS -->|⚙️ CC| LEDGER
    RET -->|⚙️ recontabiliza CC| LEDGER

    REC -->|⚙️ RC| LEDGER
    PAG -->|⚙️ CE| LEDGER
    DEP -->|⚙️ DEP| LEDGER
    CIE -->|⚙️ CL| LEDGER

    LEDGER --> EXO["Exógena / Estados financieros / Analítica"]
```

---

## 2. Flujo de VENTA → SIMBA → asiento (factura 01)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant API as Facturas.service
    participant DB as MongoDB
    participant S as SIMBA/DIAN
    participant P as PostingService
    participant L as LedgerService

    U->>API: POST /invoices (cliente, ítems, totales)
    API->>API: valida cliente + ítems, reserva consecutivo
    API->>S: verify_dian_client_nit (valida NIT)
    API->>DB: guarda FacturaModel (estado SENT)
    API->>S: emitirFactura(documento)
    S-->>API: CUFE + DIAN STATUS (00 = APPROVED)
    API->>DB: actualiza facturaStatus = APPROVED, CUFE
    Note over API: si APPROVED → fire-and-forget
    API->>API: calcularCostoVentas (cruza Lineas con Item.cost_price, solo productos)
    API->>P: fromSale(subtotal, iva, total, costo, cliente)
    P-->>API: asiento FV cuadrado
    API->>L: postAuto(origen=factura_venta) idempotente
    L->>DB: JournalEntry FV contabilizado
```

**Asiento FV:** `D 130505 Cliente (total) / C 4135 Ingreso (subtotal) + C 240810 IVA generado`
y si hay productos con costo: `+ D 6135 Costo de ventas / C 1435 Inventario`.

**Nota crédito (03):** mismo flujo, **invierte** el asiento (NC): `D Ingreso + D IVA / C Cliente` (+ inventario regresa).

---

## 3. Flujo de COMPRA / GASTO (importación, no SIMBA)

```mermaid
sequenceDiagram
    actor U as Usuario / Correo
    participant API as Purchases.service
    participant X as dianXmlParser
    participant SUP as Suppliers / SupplierItems
    participant DB as MongoDB
    participant P as PostingService
    participant L as LedgerService

    alt Importación manual
        U->>API: POST /purchases/:kind/import (XML/ZIP)
    else Recepción por correo
        U->>API: POST /intake/<slug> (adjunto XML)
        API->>API: resuelve empresa por NIT receptor
    end
    API->>X: parseDianFile (NIT proveedor, líneas, IVA, total)
    API->>SUP: crea/empareja Supplier por NIT + SupplierItems por código
    API->>DB: guarda PurchaseModel (kind: purchase|expense)
    API->>P: fromPurchase(líneas) → computePostingBreakdown
    Note over P: distribuye gasto por cuenta del producto + calcula retenciones
    P-->>API: asiento CC cuadrado
    API->>L: postAuto(origen=compra|gasto)
    L->>DB: JournalEntry CC contabilizado
```

**Asiento CC:** `D 5135 Gasto (distribuido por producto) + D 240805 IVA descontable / C 2205 Proveedor (neto) + C 236540/2367/2368 Retenciones`.

> ⚠️ **Las compras/gastos NO se emiten a SIMBA**: son facturas que **otros** emitieron y la empresa **importa** (del XML DIAN o por correo). SIMBA solo se usa para EMITIR lo que la empresa vende.

---

## 4. Flujo de RECAUDO / PAGO / NÓMINA

```mermaid
graph LR
    subgraph REC["Recaudo de cliente (RC)"]
        R1["POST /invoices/:id/payments"] --> R2["registra pago en factura"]
        R2 --> R3["⚙️ fromCollection"]
        R3 --> R4["D Banco/Caja + D Ret.sufrida 135515 / C Cliente 130505"]
    end
    subgraph PAG["Pago a proveedor (CE)"]
        P1["POST /treasury/batches"] --> P2["lote ACH: generado→enviado→conciliado"]
        P2 --> P3["⚙️ fromPayment"]
        P3 --> P4["D Proveedor 2205 / C Banco 111005"]
    end
    subgraph NOM["Nómina (NOM) 🟢 SIMBA"]
        N1["POST /nomina · /nomina/lote"] --> N2["emitirNomina → CUNE"]
        N2 --> N3["⚙️ fromPayroll (solo APPROVED, individual)"]
        N3 --> N4["D Gasto 5105 / C Salarios 2505 + C Retención 236505 + C Aportes 2370"]
    end
```

> Recaudos y pagos son **internos** (no SIMBA). La **nómina SÍ se emite a SIMBA** (tipo 102, devuelve CUNE) y luego contabiliza. Las notas de ajuste de nómina (REEMPLAZAR/ELIMINAR) **no** contabilizan automáticamente.

---

## 5. El motor contable (cómo se conecta todo)

```mermaid
graph TD
    subgraph DOCS["Documentos de negocio"]
        D1["Factura venta"] --> M1
        D2["Compra/Gasto"] --> M2
        D3["Recaudo"] --> M3
        D4["Pago proveedor"] --> M4
        D5["Nómina"] --> M5
        D6["Activo fijo"] --> M6
    end
    subgraph POST["PostingService (construye asiento cuadrado)"]
        M1["fromSale → FV/NC"]
        M2["fromPurchase → CC"]
        M3["fromCollection → RC"]
        M4["fromPayment → CE"]
        M5["fromPayroll → NOM"]
        M6["depreciate → DEP"]
    end
    M1 & M2 & M3 & M4 & M5 & M6 --> AB["assertBalanced\nΣdébito = Σcrédito"]
    AB --> PA["LedgerService.postAuto\nidempotente por origen{tipo,id}"]
    PA --> JE[("JournalEntry\nestado: contabilizado")]
    JE --> ANUL["Anulación = reverso\n(nunca DELETE)"]

    CFG["AccountingConfig\n+ PUC base de fábrica\n(bootstrapAccounting)"] -.->|cuentas por defecto| POST
```

**Reglas del motor:**
- **Partida doble:** `assertBalanced` exige Σdébito = Σcrédito.
- **Idempotente:** `postAuto` no duplica el asiento de un mismo `origen` (tipo+id).
- **Inmutable:** anular = crear un reverso enlazado; nunca se borra.
- **De fábrica:** `bootstrapAccounting` siembra PUC base + cuentas por defecto al crear la empresa.

---

## 6. Tabla resumen — acción → SIMBA → asiento → tercero

| Documento | Tipo DIAN | ¿SIMBA? | Asiento | Tercero |
|---|---|---|---|---|
| Factura de venta | 01 | 🟢 CUFE | **FV**: D Cliente / C Ingreso + IVA gen (+ D Costo / C Inventario) | Cliente |
| Factura POS | 01/20 | 🟢 CUFE | **FV** (igual, con centro de costo) | Cliente |
| Nota crédito | 03 | 🟢 CUFE | **NC**: reverso de la venta | Cliente |
| Nota débito | 02 | 🟢 CUFE | ⛔ no contabiliza auto | Cliente |
| Documento soporte | 11 | 🟢 CUNE | ⛔ no contabiliza auto | Proveedor |
| Nómina electrónica | 102 | 🟢 CUNE | **NOM**: D Gasto / C Salarios + Retención + Aportes | Empleado |
| Compra | (importada) | 🔵 no | **CC**: D Gasto + IVA desc / C Proveedor + Retenciones | Proveedor |
| Gasto | (importada) | 🔵 no | **CC** (origen=gasto) | Proveedor |
| Retención sobre compra | — | 🔵 no | recontabiliza CC (C CxP neta + C Retención) | Proveedor |
| Recaudo de cliente | — | 🔵 no | **RC**: D Banco/Caja + Ret.sufrida / C Cliente | Cliente |
| Pago a proveedor (lote) | — | 🔵 no | **CE**: D Proveedor / C Banco | Proveedor |
| Depreciación | — | 🔵 no | **DEP**: D Gasto / C Dep. acumulada | — |
| Cierre anual | — | 🔵 no | **CL**: cancela resultado → 3605/3610 | — |

---

## 7. Puntos a verificar (checklist)

- ✅ Toda venta APPROVED genera asiento FV con el cliente como tercero → exógena de ingresos.
- ✅ Toda compra/gasto importado genera asiento CC con el proveedor como tercero → exógena de pagos.
- ✅ Recaudo reduce la CxC del cliente; pago reduce la CxP del proveedor.
- ✅ Nómina aprobada genera costo laboral con el empleado como tercero.
- ✅ Costo de ventas se registra si el producto tiene `cost_price`.
- ✅ **Nota débito (02)** genera asiento de venta (D Cliente / C Ingreso + IVA). *(cerrado)*
- ✅ **Documento soporte (11)** genera asiento de compra (D Gasto + IVA / C CxP proveedor). *(cerrado)*
- ✅ **Notas de ajuste de nómina** (reemplazar/eliminar) reversan automáticamente el asiento del predecesor. *(cerrado)*
