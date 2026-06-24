# Procesos y Herramientas Contables — Colombia
### El tercer pilar del módulo (Procesos), además de Configuración y Reportes

Tu captura ("Más procesos") cubre las **operaciones** del módulo contable: cierres, saldos iniciales, activos fijos, medios magnéticos, certificados y utilidades. Aquí están **todos los elementos de tu pantalla** integrados, más los que recomiendo agregar.

**Convención:**
- 📷 **De tu captura** — ya lo tienes identificado.
- ➕ **Recomiendo agregar** — falta en la pantalla pero lo vas a necesitar.
- ⚠️ **Cuidado de integridad** — interactúa con la regla "nunca borrar, solo reversar".

---

## Dónde encaja en el menú

Sobre la estructura que ya teníamos, se agregan dos bloques: **Activos fijos** y **Procesos**.

```
Contabilidad
├── Comprobantes · Libros · Estados financieros · Conciliación · Períodos · Impuestos · DIAN/Exógena
│   (lo anterior)
├── Activos fijos
│   ├── Ficha de activos (crear / importar)
│   ├── Depreciación (calcular y contabilizar)
│   └── Bajas y ventas
└── Procesos  ("Más procesos")
    ├── Saldos iniciales        (CxC · CxP · otras cuentas)
    ├── Cierres                 (año · cuentas de impuestos por tercero · reapertura)
    ├── Ajustes contables       (diferencia en cambio · amortizaciones · provisiones)
    ├── Certificados            (retención · Formulario 220)
    ├── Medios magnéticos       (nacional DIAN · distrital/municipal)
    └── Utilidades              (plantillas favoritas · verificar y bloquear · depuración · recálculo)
```

---

## 1. Saldos iniciales — el proceso de arranque (lo más importante)

Cuando arrancas el sistema (o migras desde otro), debes **cargar la posición de apertura** para que la contabilidad continúe correcta. Son tres cargas:

| Proceso | Cómo se carga | Origen |
|---|---|---|
| **Saldos iniciales de cuentas por cobrar** | **Factura por factura, por tercero** (no solo el saldo global) | 📷 |
| **Saldos iniciales de cuentas por pagar** | **Factura por factura, por proveedor** | 📷 |
| **Saldos iniciales de otras cuentas contables** | El resto del balance (bancos, activos, patrimonio…) vía comprobante de apertura | 📷 |
| **Importador masivo por Excel/CSV** | Plantilla con código de cuenta, tercero, valor débito/crédito | ➕ |

**Reglas técnicas que no puedes saltarte:**
- El comprobante de apertura es **partida doble**: la suma de saldos débito debe igualar la de crédito. Si no cuadra, no se confirma.
- CxC y CxP se cargan **por documento individual**, no en bloque. Si cargas solo el saldo total, el **aging (cartera por edades) y los recaudos parciales no funcionan** después.
- Marca una **fecha de corte** única para toda la carga.
- Tras confirmar, **bloquea la edición** de los saldos iniciales (solo admin con reverso).

> Si esto queda mal hecho, el primer Balance de Situación Financiera sale incorrecto y arrastras el error todo el ejercicio. Es la primera cosa que un cliente hace al adoptar el software, así que tiene que ser a prueba de errores.

---

## 2. Cierres contables

| Proceso | Qué hace | Origen |
|---|---|---|
| **Cierre de año** | Cancela cuentas de resultado (clases 4, 5, 6, 7) contra utilidad/pérdida del ejercicio y genera el **comprobante de apertura** del nuevo año con los saldos de balance | 📷 |
| **Cierre de cuentas de impuestos y otras por tercero** | Al terminar el período fiscal, **salda/reclasifica** IVA generado vs. descontable → IVA por pagar/favor; retenciones por pagar; anticipos. "Por tercero" porque anticipos y retenciones sufridas se saldan **contra el tercero específico** | 📷 |
| **Reapertura / reversión de cierre** | Revierte un cierre mal ejecutado para corregir y volver a cerrar | ➕ |
| **Verifica y bloquea documentos** | Valida integridad y **bloquea el período** para que nadie modifique lo ya reportado | 📷 |

---

## 3. Ajustes contables

| Proceso | Qué hace | Origen |
|---|---|---|
| **Diferencia en cambio** | Revalúa saldos en moneda extranjera (USD, etc.) a la **TRM de cierre**; la diferencia va a ingreso/gasto financiero. Aplica a tus CxC/CxP/bancos en divisa | 📷 |
| **Amortización de diferidos** | Distribuye gastos pagados por anticipado (pólizas, licencias) en el tiempo | ➕ |
| **Causación de provisiones recurrentes** | Provisiones mensuales automáticas (nómina, servicios) | ➕ |

---

## 4. Activos fijos

| Proceso | Qué hace | Origen |
|---|---|---|
| **Creación de activo fijo** | Ficha: costo, fecha adquisición, **vida útil**, valor residual, método (línea recta), cuenta de activo, depreciación acumulada, gasto, centro de costo. **Doble vida útil NIIF vs. fiscal** | 📷 |
| **Importar activo fijo** | Carga masiva de activos por Excel/CSV | 📷 |
| **Cálculo y contabilización de depreciación** | Proceso periódico: D gasto depreciación / C depreciación acumulada | ➕ |
| **Baja / venta de activo** | Retira el activo y calcula utilidad o pérdida en la venta | ➕ |

---

## 5. Medios magnéticos (exógena)

| Proceso | Qué hace | Origen |
|---|---|---|
| **Asistente de medios magnéticos** | Genera los formatos nacionales DIAN (1001, 1003, 1005, 1006, 1007, 1008, 1009, 1010…), valida topes y cruza con los auxiliares por tercero | 📷 |
| **Informe auxiliar distrital / municipal** | Exógena propia de **Medellín, Bogotá, Cali** (información de ICA y retenciones municipales) | 📷 |
| **Validación previa (cuadres)** | Verifica que los formatos cuadren contra contabilidad antes de exportar el XML | ➕ |

---

## 6. Certificados

| Proceso | Qué hace | Origen |
|---|---|---|
| **Certificado de retención** (renta, IVA, ICA) | Por tercero y período, en PDF, entregable al proveedor | 📷 |
| **Certificado de ingresos y retenciones — Formulario 220** | Anual, para cada empleado | 📷 |

---

## 7. Utilidades / herramientas de comprobantes

| Proceso | Qué hace | Origen |
|---|---|---|
| **Copias de comprobantes favoritos** | Guarda asientos modelo (nómina, depreciación, ajustes) y los **duplica** cambiando fecha/valores. Ahorra tiempo y reduce errores | 📷 |
| **Verifica y bloquea documentos** | Valida cuadre, consecutivos y cuentas válidas; bloquea el período | 📷 |
| **Borrado masivo de comprobantes** | Depura comprobantes — **con restricciones de integridad (ver abajo)** | 📷 ⚠️ |
| **Recálculo / reconstrucción de saldos** | Recomputa el libro mayor desde los asientos si algún saldo quedó inconsistente (útil tras migraciones o cargas masivas) | ➕ |

---

## ⚠️ Borrado masivo de comprobantes — léelo antes de implementarlo

Esto **choca con la regla "nunca borrar, solo reversar"** que definimos en la arquitectura. No es contradicción si lo implementas con el matiz correcto:

**Se PUEDE borrar únicamente:**
- Comprobantes en estado **borrador**, o
- Comprobantes de **períodos abiertos NO reportados**, por usuario **administrador**, **antes** de imprimir libros oficiales o presentar exógena.

**Está PROHIBIDO borrar:**
- Comprobantes **contabilizados** de períodos **cerrados** o **ya reportados a la DIAN**. Ahí solo aplica **reverso**. Borrarlos rompe la **trazabilidad** y la **numeración consecutiva**, que la DIAN exige sin saltos.

**Implementación segura:**
1. El "borrado masivo" debe **filtrar por estado y período** — nunca tocar períodos sellados.
2. **Confirmación doble** + registro en log (quién, qué, cuándo).
3. Considera renombrarlo a **"Depuración de borradores"** para que el nombre comunique su alcance real.

> Regla de oro: en producción, lo que ya pasó a libros o a la DIAN **se corrige con un comprobante de reverso, no con un DELETE**. El borrado masivo es solo para limpiar lo que aún no es oficial.

---

## Resumen de lo que agregué a tu captura

De la pantalla salieron: saldos iniciales (CxC/CxP/otras), cierre de año, cierre de cuentas de impuestos por tercero, diferencia en cambio, verifica y bloquea, copias favoritas, borrado masivo, asistente de medios magnéticos + auxiliar distrital, creación e importación de activos fijos, y los dos certificados.

**Recomiendo sumar:** importador masivo de saldos por Excel, reapertura/reversión de cierre, amortización de diferidos, provisiones recurrentes, cálculo y contabilización de depreciación, baja/venta de activos, validación previa de exógena, y recálculo de saldos. Son los que cierran los huecos operativos que esa pantalla deja abiertos.
