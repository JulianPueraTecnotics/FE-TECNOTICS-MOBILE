# Proyección — Reagrupación de navegación por módulos de negocio

> Rama: `cambios-Alejandro` · Autor del plan: equipo dev · Fecha: 2026-06-20
> Objetivo: pasar de un menú plano de 8 enlaces a una navegación agrupada por módulos
> (estilo Siigo/Alegra/World Office) con acordeón expandible.

---

## 1. Estado actual de la navegación

El menú **está duplicado en dos componentes** (hay que tocar los dos siempre):

- `src/components/shared/navbar/Navbar.tsx` — header horizontal (desktop, `width > 495`).
- `src/components/shared/sidebar/Siderbar.tsx` — menú lateral deslizante (móvil / botón hamburguesa).

Ambos renderizan **3 variantes** según sesión:
1. Pública (sin login): Inicio · Cómo funciona · Planes · Login/Registro.
2. Superadmin: Empresas · Planes · Administradores.
3. Empresa/usuario (lo que reagrupamos): lista plana de enlaces.

Enlaces actuales del menú de empresa (rol `company`/`admin`/`user`):

| Enlace actual | Ruta (`PATHS`) | Componente |
|---|---|---|
| Facturas | `/documentos` `DOCUMENTS` | Documents |
| Facturación (crear) | `/dashboard` `DASHBOARD` | Dashboard (widget fe-billing) |
| Productos y Servicios | `/productos-servicios` `PRODUCTS_SERVICES` | ProductsServices |
| Clientes | `/clientes` `CLIENTS` | Clients |
| Nómina y empleados | `/nomina-empleados` `NOMINA_EMPLEADOS` | NominaEmpleados |
| Estadísticas | `/historico-facturacion` `BILLING_HISTORY` | BillingHistory |
| Sincronización DIAN | `/sincronizacion-dian` `DIAN_SYNC` | DianSync |
| Usuarios (solo no-`user`) | `/sub-usuarios` `SUB_USERS` | SubUsers |

Routing: `src/router/index.route.tsx` usa un `switch` por `pathname` en `PrivateRouteSwitch`
+ rutas sueltas. **Reagrupar el menú NO obliga a cambiar las rutas** (las URLs siguen existiendo);
solo cambia cómo se agrupan los enlaces visualmente.

---

## 2. Árbol de navegación OBJETIVO

```
Inicio                         → /dashboard (Facturación / widget)
Ventas                  ▾
  · Facturas                   → /documentos            [EXISTE]
  · Recaudos                   → /ventas/recaudos       [NUEVO]
  · Cotizaciones               → /ventas/cotizaciones   [NUEVO]
  · Remisiones                 → /ventas/remisiones     [NUEVO]
  · Facturas de plantilla      → /ventas/plantillas     [NUEVO]
  · Clientes                   → /clientes              [EXISTE]
Compras y gastos        ▾      [NUEVO MÓDULO]
Productos y servicios          → /productos-servicios   [EXISTE]
Cajas y bancos          ▾      [NUEVO MÓDULO]
Nómina                         → /nomina-empleados      [EXISTE]
Contabilidad            ▾      [NUEVO MÓDULO]
Reportes                ▾
  · Estadísticas               → /historico-facturacion [EXISTE, renombrar]
  · Sincronización DIAN        → /sincronizacion-dian   [EXISTE, reubicar]
Configuración / Usuarios       → /sub-usuarios / mi-perfil [EXISTE]
```

> Nota: "Facturación" (el widget de crear factura, `/dashboard`) hoy es el inicio.
> Se mantiene como **Inicio**, y dentro de Ventas el acceso a crear se hace desde el listado.

---

## 3. Clasificación por sensibilidad

### 🟢 TIPO A — Reagrupar lo que YA existe (riesgo BAJO)
Solo presentación. Cero backend, cero rutas nuevas. Mover enlaces existentes a grupos:
- Ventas → Facturas, Clientes
- Reportes → Estadísticas, Sincronización DIAN
- Nómina, Productos y servicios → quedan como grupo/enlace de primer nivel

**Esfuerzo:** 1 componente de acordeón reutilizable + refactor de Navbar y Siderbar.
**Riesgo:** bajo. El único cuidado es no romper el `NavLink active` ni la lógica de cierre
en móvil (`handleNavClick`), y replicar en LOS DOS archivos.

### 🟡 TIPO A.1 — Cascarón de módulos nuevos (riesgo BAJO-MEDIO)
Botones de Compras, Cajas, Contabilidad y sub-items de Ventas que aún no existen,
apuntando a una página **"Próximamente"** (placeholder). Permite ver la estructura
final completa sin construir lógica.
**Esfuerzo:** 1 página `ComingSoon` + rutas placeholder.

### 🔴 TIPO B — Módulos nuevos reales (riesgo ALTO, fuera de esta etapa)
Requieren **backend nuevo** (modelos, endpoints en MC-TECNOTICS-FACTURACION), páginas
completas y lógica de negocio. NO los toca el SDK `fe-billing` (son documentos no-DIAN).

| Módulo | Qué implica | Depende de |
|---|---|---|
| Cotizaciones | Documento no fiscal, convertible a factura. Modelo + CRUD + PDF + "convertir a factura". | Backend nuevo |
| Remisiones | Entrega sin facturar, convertible. Similar a cotización + control de inventario. | Backend + inventario |
| Recaudos/Cartera | Pagos/abonos contra facturas, estados de cuenta, cruce de cartera. | Backend + relación con facturas |
| Compras y gastos | Facturas de proveedor + gastos. Base de la contabilidad. Cruza con Sync DIAN (docs recibidos). | Backend nuevo |
| Cajas y bancos | Cuentas, movimientos, conciliación, arqueo. | Backend nuevo |
| Contabilidad | PUC, comprobantes, libros, balances. El más grande (mini-ERP). | Backend grande |

---

## 4. Decisión de alcance (acordada)

- **Esta etapa (rama `cambios-Alejandro`):** Tipo A + Tipo A.1.
  Navegación agrupada en acordeón + reubicar pantallas existentes + placeholders
  "Próximamente" para los módulos no construidos. **Sin backend.**
- **Estilo:** acordeón expandible.
- **Prioridad de módulos nuevos (etapas siguientes):** Compras y gastos → Remisiones →
  Recaudos/Cartera → Cotizaciones (todos marcados prioritarios por Alejandro).

---

## 5. Plan de implementación (esta etapa)

1. **Modelo de menú declarativo** (`src/components/shared/nav/menu.config.ts`):
   un único array de grupos `{ label, icon, path?, role?, children?[] }` que alimente
   AMBOS componentes (Navbar y Siderbar) → elimina la duplicación actual.
2. **Componente acordeón reutilizable** (`NavGroup`) con expand/colapso, estado del grupo
   activo derivado de la ruta, accesible (botón con `aria-expanded`, navegable por teclado).
3. **Refactor Navbar + Siderbar** para consumir `menu.config` + `NavGroup`.
4. **Página `ComingSoon`** y rutas placeholder para módulos/sub-items no construidos.
5. **Paths nuevos** en `paths.contants.ts` (Ventas/*, Compras, Cajas, Contabilidad)
   apuntando a placeholders por ahora.
6. **Estilos** del acordeón en el CSS existente (`sidebar/index.css`, `navbar/index.css`),
   respetando variables de tema (`var(--primary-color)`, dark mode).
7. **Verificación:** `pnpm build` (tsc + vite) y `pnpm lint` limpios; revisar móvil/desktop.

## 6. Riesgos y cuidados
- Menú duplicado: todo cambio va en los DOS componentes (lo resuelve el `menu.config`).
- Permisos por rol: respetar que `user` no ve "Usuarios" (y futuros sub-items sensibles).
- `react-router` v7: el `switch` de `PrivateRouteSwitch` debe registrar las nuevas rutas
  placeholder o caerán en `null` (pantalla en blanco).
- No romper el scroll-restore (`ScrollManager`) ni `handleNavClick` (cierre en móvil).

---

## 7. IMPLEMENTADO en esta etapa (rama `cambios-Alejandro`, 2026-06-20)

Archivos nuevos:
- `src/components/shared/nav/menu.config.ts` — fuente única del menú (grupos, roles, comingSoon) + helpers `filterMenuByRole`, `isGroupActive`.
- `src/components/shared/nav/NavMenu.tsx` + `NavMenu.css` — acordeón reutilizable (variant "sidebar"|"header").
- `src/features/coming-soon/page/ComingSoon.tsx` + `.css` — placeholder que lee el nombre del módulo desde la config según la ruta.

Archivos modificados:
- `paths.contants.ts` — nuevas rutas: `SALES_RECAUDOS/COTIZACIONES/REMISIONES/PLANTILLAS`, `PURCHASES`, `CASH_BANKS`, `ACCOUNTING`.
- `router/index.route.tsx` — casos del switch para las 7 rutas nuevas → `ComingSoonPage` (lazy).
- `navbar/Navbar.tsx` y `sidebar/Siderbar.tsx` — la lista plana de empresa reemplazada por `<NavMenu variant=... />`. Variantes pública y superadmin intactas. (De paso se quitó la prop `_open_sidebar` sin usar en Navbar.)

Verificación: `tsc -b` ✅ · `eslint` de los archivos nuevos ✅ · `vite build` ✅.
(El proyecto tiene ~94 errores de lint PREEXISTENTES en otros archivos y el chunk de 1.78MB,
ajenos a este cambio — ver auditoría.)

Pendiente de decisión del usuario:
- "Inicio" hoy = `/dashboard` (widget de facturación). Confirmar si Inicio debe ser un dashboard
  de resumen y mover "crear factura" a un sub-item de Ventas.

---

## 8. Origen real de cada módulo (verificado en los repos)

> Importante: los 3 proyectos usan librerías UI DISTINTAS. Este portal usa CSS propio + remixicon;
> Causación/Tesorería usa **IBM Carbon**; fichas_tecnicas usa **MUI**. Al portar módulos se reescriben
> estilos, pero la lógica (servicios/hooks/modelos) es portable. Todos los backends son **MongoDB/Mongoose**.

### Causación/Tesorería (`*_Causacion_Tesoreria`) — React 19 + Vite + Carbon, Express 5 + Mongo
- **Compras y gastos** ← módulo Causación (`convertions.model`, endpoints `/convert`, `/get-convertions`).
  Maduro. OJO: es compras a proveedores (XML/Doc Soporte DIAN recibidos), encaja directo.
- **Cajas y bancos** ← catálogo de bancos + Tesorería (lotes bancarios, firma, conciliación,
  comprobante de egreso). Maduro. "Cajas" allí = caja menor de compras (no POS de ventas).
- **Contabilidad** ← PUC multi-ERP (adapters CONTAI/HGI/Siigo/Megasistemas/custom), cierres de
  periodo, consecutivos, centros de costo. Lo más sólido y diferenciador. Incluye sugerencia de
  asiento contable con IA (Claude Haiku).
- **Recaudos/Cartera** ← informes de cartera EXISTEN pero son de cuentas por PAGAR (proveedores).
  Para cartera de CLIENTES (ventas) hay que **reorientar** la lógica de antigüedad/saldos a CxC.
  Reutilizable como plantilla de UI/export, no como lógica directa.
- Cuidado al portar back: scope multi-tenant es MANUAL (no middleware global) → portar
  `resolveCompanyIdFromAuth`/`resolveActiveSedeIdFromAuth` o hay fuga cross-tenant. God-files
  `converter.service.ts` (~2665 LOC) y `company.service.ts` (~2652 LOC).

### fichas_tecnicas (`fichas_tecnicas_*`) — React 18 + Vite + MUI, Express 5 + Mongo
- **Cotizaciones** ← módulo completo: crear → PDF (Puppeteer + plantilla HTML) → enviar email →
  vista pública con aprobación por código de seguridad → listado/reenvío. El modelo `Cotizacion.js`
  YA trae campos previstos para evolucionar a factura: `tipoDocumento` enum
  ["cotizacion","factura","recibo","orden"], `estadoPago`, `numeracion`, `fechaPago`, `metodoPago`,
  `idClienteRef` (aún sin usar). NO convierte a factura todavía (habría que mapear cotización→UBL DIAN).
  Reutiliza el mismo selector de cliente y de productos que su módulo de factura electrónica.
- Aclaración: "sacar las cotizaciones de Mantenimiento" es impreciso — Cotizaciones es un módulo
  propio; Mantenimiento solo aporta el catálogo de clientes como una de tres fuentes al cotizar.

### Orden de construcción recomendado (prioridad del usuario: todos)
1. **Cotizaciones** (autónomo, no fiscal, alto valor, base ya existe en fichas_tecnicas).
2. **Compras y gastos** (base de la contabilidad; cruza con Sincronización DIAN ya existente).
3. **Recaudos/Cartera** (requiere reorientar a CxC de clientes).
4. **Cajas y bancos** y **Contabilidad** (los más grandes; dependen de lo anterior).
