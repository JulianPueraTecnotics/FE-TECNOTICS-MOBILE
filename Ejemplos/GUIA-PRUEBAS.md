# Guía de pruebas end-to-end — Portal TECNOTICS

> Qué hace falta para poder probar el sistema completo (facturación, compras, gastos,
> nómina y **contabilidad automática**), qué se puede probar **sin SIMBA/DIAN** y los
> pasos concretos para hacerlo. Resultado de la revisión rigurosa de requisitos.

---

## 0. Resumen ejecutivo (TL;DR)

| Quiero probar… | ¿Necesita SIMBA/DIAN? | Qué hace falta |
|---|---|---|
| Contabilidad, reportes y analítica | **No** | Empresa con PUC + cuentas (botón "Inicializar PUC") y movimientos en el libro |
| Causar compras/gastos (XML/ZIP DIAN) | **No** | Cuentas por defecto + UVT + conceptos de retención |
| Comprobantes manuales (libro mayor) | **No** | PUC inicializado |
| **Emitir** factura electrónica / nómina | **Sí** | Empresa habilitada en SIMBA + prefijo con resolución + cliente verificado + ítems |

**Atajo:** en *Contabilidad → Cuentas por defecto* hay un botón **"Datos de prueba"** que
siembra de un golpe (idempotente) PUC, cuentas, UVT del año, conceptos de retención y un
**cliente / proveedor / ítem demo**. Con eso ya puedes causar compras y registrar
movimientos sin tocar SIMBA.

---

## 1. Requisitos para ARRANCAR (entorno) — bloqueantes

Estas variables de entorno deben existir. **Ya están configuradas en tu `.env`** (backend) y
`.env` del frontend; aquí solo se listan para referencia. No es necesario tocarlas para probar.

### Backend (`MC-TECNOTICS-FACTURACION/.env`)
| Variable | Rol | Bloqueante |
|---|---|---|
| `PORT` | Puerto del backend (3001) | 🔴 Sí |
| `MONGODB_URI` | Conexión a MongoDB | 🔴 Sí |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Firma de sesiones | 🔴 Sí |
| `ENVIROMENT` | `prod` \| `pruebas` (ambiente SIMBA) | 🟡 Para emitir |
| `SIMBA_DIAN_TOKEN`, `SIMBA_ENDPOINT_URL`, `SIMBA_NOMINA_ENDPOINT_URL` | Emisión electrónica | 🟡 Solo para emitir |
| `ANTHROPIC_API_KEY` | IA (parametrización, asistentes) | 🟢 Opcional (IA da 503 si falta) |
| `MAILGUN_*` | Envío de correos | 🟢 Opcional |

### Frontend (`FE_TECNOTICS_PORTAL/.env`)
| Variable | Rol | Bloqueante |
|---|---|---|
| `VITE_APP_BACK_URL` | URL del backend (http://localhost:3001) | 🔴 Sí |

> **Importante (degradación elegante):** si falta SIMBA, la app **arranca igual**. La
> contabilidad, los reportes y la analítica funcionan; lo único que no se puede es **emitir**
> documentos electrónicos reales.

### Arranque
```bash
# Backend
cd MC-TECNOTICS-FACTURACION
npm install
npm run dev            # escucha en :3001

# Frontend
cd FE_TECNOTICS_PORTAL
pnpm install
pnpm dev               # escucha en :5173 (o :5174)
```
La primera vez, crear el super-admin: `npm run seed:super-admin` (o el script equivalente en
`package.json`). Solo crea el super-admin, **no** datos de empresa.

---

## 2. Configuración POR EMPRESA antes de probar

Al **crear una empresa**, el backend ejecuta automáticamente `bootstrapAccounting` (mejor
esfuerzo): siembra el **PUC base colombiano** y asigna las **cuentas por defecto**. Si por
algún motivo no corrió, en *Contabilidad → Cuentas por defecto* está el botón
**"Inicializar PUC + cuentas"**.

### 2.1 Lo que el sistema NO siembra solo (y bloquea flujos)
| Dato | Lo necesita… | Cómo cargarlo |
|---|---|---|
| **UVT del año** | Cálculo de retenciones | *Contabilidad → UVT* o botón "Datos de prueba" |
| **Conceptos de retención** (retefuente/reteIVA/reteICA) | Causar compras con retención | *Contabilidad → Retenciones* o "Datos de prueba" |
| **Cliente** (NIT, correo) | Emitir factura | *Clientes → Nuevo* o "Datos de prueba" |
| **Ítems** de catálogo | Emitir factura | *Productos/Servicios → Nuevo* o "Datos de prueba" |
| **Prefijo + resolución DIAN** | Emitir factura | *Empresa → Prefijos* (manual; ver §4) |
| **Habilitación SIMBA** (`simba_token`, `setTestId`) | Emitir factura/nómina | Onboarding SIMBA (ver §4) |

### 2.2 Botón "Datos de prueba" (atajo recomendado)
*Contabilidad → Cuentas por defecto → **Datos de prueba***. Siembra, de forma **idempotente**:
- PUC base + cuentas por defecto.
- UVT del año en curso (valor oficial DIAN).
- Conceptos de retención: RF compras (2,5%), RF servicios (6%), RF honorarios (11%),
  ReteIVA (15%), ReteICA Bogotá.
- **Cliente Demo SAS** (NIT 900123456), **Proveedor Demo LTDA** (NIT 800987654).
- **Producto Demo** (precio 100 000, costo 60 000, IVA 19%) y **Servicio Demo**.

> Volver a pulsarlo no duplica nada: si un dato ya existe, lo deja igual. Endpoint:
> `POST /accounting/bootstrap-test-data` (acepta `{ "anio": 2026 }` opcional).

---

## 3. Qué se puede probar SIN SIMBA (la mayor parte del valor)

Todo el **núcleo contable** y la **analítica** son independientes de la emisión electrónica:

1. **Comprobantes manuales** (libro mayor): asientos de partida doble, cuadre automático
   (Σdébito = Σcrédito), comprobantes CC/CE/RC/etc. → *Contabilidad → Libro / Comprobantes*.
2. **Causar compras y gastos**: importar XML/ZIP de la DIAN o registrar manual. El sistema
   crea el proveedor si no existe, cruza ítems y **contabiliza automáticamente** (D gasto /
   IVA / C CxP, con retenciones). → *Compras y gastos*.
3. **Recaudos**: registrar pagos de cartera → asiento RC (D banco/caja, C cliente).
4. **Reportes**: Estado de Resultados, Balance, libros auxiliares, IVA, retenciones,
   medios magnéticos (exógena). → *Reportes*.
5. **Analítica/Estadísticas**: resumen ejecutivo, tesorería proyectada (±1σ), cartera,
   DSO/DPO, scoring de terceros, semáforo de alertas. → *Estadísticas*.

> **Cómo generar datos contables sin emitir:** usa "Datos de prueba" y luego **causa una
> compra** (importa un XML DIAN de ejemplo o regístrala manual). Eso ya alimenta libro,
> reportes y analítica. Para el lado de ventas sin SIMBA, ver la nota crítica de §5.

---

## 4. Qué hace falta para EMITIR (factura/nómina electrónica) con SIMBA

Solo si quieres probar la **emisión real** contra el ambiente de pruebas de SIMBA/DIAN:

1. **Ambiente pruebas**: `ENVIROMENT=pruebas` en el `.env` del backend.
2. **Habilitación de la empresa en SIMBA**: completar el onboarding (firmar mandato) para
   obtener `simba_token`; queda guardado en la empresa. Sin token, la emisión falla.
3. **Habilitación electrónica DIAN** (`setTestId`): registrar el set de pruebas de la DIAN.
4. **Prefijo + resolución** vigente en la empresa: `{ init, end, start_date, end_date,
   tipo_doc_electronico, resolution_number, status: "active" }`. En pruebas se usan prefijos
   especiales (`SET`/`SETP` facturas, `NESET` nómina).
5. **Cliente verificado** (NIT válido) y **al menos un ítem** en el catálogo.

Con eso, *Facturación → Nueva factura* emite contra SIMBA y, **si la DIAN aprueba**, se
contabiliza la venta automáticamente.

---

## 5. ⚠️ Nota crítica: contabilidad de VENTAS y SIMBA

La contabilización de la **venta** (asiento FV: D cliente / C ingreso + IVA) se dispara
**solo cuando la DIAN aprueba** la factura (`DIAN_STATUS === "APPROVED"`). Es correcto para
producción, pero implica que:

- **Sin SIMBA habilitado no se prueba el circuito contable de ventas** por la vía normal.
- En cambio, **compras, gastos, recaudos, nómina y comprobantes manuales SÍ** se contabilizan
  sin depender de la emisión electrónica.

### Cómo probar la contabilidad de ventas sin emitir realmente
Tres caminos, de menor a mayor fidelidad:
1. **Vía compras + manual**: prueba todo el circuito contable (gasto/IVA/CxP, recaudo,
   nómina, costo de ventas) con compras causadas y comprobantes manuales. Cubre la mayoría.
2. **Comprobante manual de venta**: registra el asiento FV a mano en el libro mayor para
   validar reportes/analítica del lado de ingresos.
3. **Emisión real en ambiente pruebas** (§4): la opción fiel; requiere habilitación SIMBA.

> Si más adelante se quiere probar el asiento de venta automático **sin** SIMBA, habría que
> añadir un modo "mock" de emisión (no implementado por decisión: no tocar el flujo de SIMBA).

---

## 6. Checklist de prueba end-to-end (sin SIMBA)

- [ ] Backend en `:3001`, frontend en `:5173`, login OK.
- [ ] Empresa creada (o existente) con PUC inicializado.
- [ ] Pulsar **"Datos de prueba"** en *Contabilidad → Cuentas por defecto*.
- [ ] Verificar en *Contabilidad → UVT* que está el año en curso.
- [ ] Verificar en *Contabilidad → Retenciones* los 5 conceptos demo.
- [ ] **Causar una compra** (importar XML/ZIP DIAN o manual) → revisar que generó asiento.
- [ ] Revisar *Reportes* → Estado de Resultados / Balance refleja la compra.
- [ ] Registrar un **recaudo** → revisar asiento RC.
- [ ] Abrir *Estadísticas* → resumen, tesorería, cartera, alertas con datos.

---

## 7. Pendientes de UX (no bloquean pruebas)

- **Ajustes contables** (amortización de diferidos, provisiones, diferencia en cambio):
  endpoints listos (`POST /ledger/adjustments/*`), falta pantalla.
- **ICA por municipio**: endpoint listo (`GET /ledger/dian/ica-municipio`), falta pantalla.
- **Formato 1010 (socios)**: requiere un modelo nuevo de socios/aportes (decisión pendiente).
