# Zenith Cartera — Especificación Técnica del Motor de Conciliación

**Documento:** Arquitectura, máquina de estados y reglas de negocio  
**Propósito:** Especificación técnica para análisis, refactorización e implementación asistida por Codex  
**Sistema:** Zenith Cartera  
**Dominio:** Cartera / Conciliación / Recaudación / Anulaciones / Notas de Crédito  
**Principio rector:** La cartera determina cuánto queda pendiente; las fuentes transaccionales explican por qué cambió.

---

# 1. Objetivo del Sistema

Zenith Cartera debe implementar un motor de conciliación basado en snapshots y eventos financieros, capaz de reconstruir la evolución de cada documento por cobrar entre diferentes cargas de información.

La fuente autoritativa del saldo pendiente actual es el snapshot más reciente de cartera proveniente de Contífico.

Las demás fuentes deben explicar por qué cambió la cartera, sin volver a descontar valores que ya vienen reflejados en el snapshot.

Principio rector:

> La cartera determina cuánto queda. Los deltas determinan qué cambió. Cobros, notas de crédito y anulaciones explican por qué cambió. El ledger conserva la historia. Dashboard y reportes proyectan el resultado conciliado.

---

# 2. Fuentes de Datos — Las 4 Entradas

## 2.1 `cartera_contifico`

Representa el snapshot oficial de documentos pendientes provenientes de Contífico.

Es la fuente autoritativa del saldo vigente.

Permite detectar entre snapshots:

- documentos nuevos;
- documentos que permanecen;
- variaciones de saldo;
- documentos que desaparecen.

No debe recalcularse el saldo restando nuevamente cobros o notas de crédito si Contífico ya los refleja.

Ejemplo:

```text
Snapshot anterior: saldo = 1000
Snapshot nuevo:    saldo = 600
Cobro importado:   400

Saldo correcto = 600
NO 600 - 400
```

## 2.2 `anulados`

Representa documentos cuya anulación ha sido confirmada.

La anulación explícita tiene precedencia sobre una clasificación provisional de pago.

Regla obligatoria:

```text
PAGADO_TOTAL provisional
        |
        v
     ANULADO
```

Cuando esto ocurre deben corregirse:

- estado;
- ledger;
- recuperación atribuida;
- indicadores;
- dashboard;
- reportes;
- agregados históricos afectados.

Una anulación NO es recuperación de cartera.

## 2.3 `cobros_abonos`

Representa evidencia explícita de pagos o abonos.

Debe permitir identificar, según disponibilidad:

- documento;
- cliente;
- fecha;
- monto;
- referencia;
- forma de pago;
- origen.

Los cobros explican reducciones detectadas entre snapshots, pero NO deben volver a modificar el saldo autoritativo.

### Retenciones fiscales

Regla invariable:

```text
RETENCION_FISCAL != ABONO
RETENCION_FISCAL != COBRO
RETENCION_FISCAL != RECUPERACION_EFECTIVA
```

Ejemplo:

```text
valor movimiento = 1000
retencion        = 20
pago financiero  = 980

recuperacion = 980
```

NO 1000.

## 2.4 `notas_credito`

Representa ajustes comerciales/contables que explican reducciones de cartera.

Una nota de crédito:

- debe conservarse como evidencia;
- debe asociarse al documento original cuando sea posible;
- NO es cobro;
- NO es recuperación monetaria;
- NO debe descontarse nuevamente del snapshot.

Ejemplo:

```text
saldo anterior = 1000
NC             = 200
saldo nuevo    = 800

ajuste NC      = 200
recuperacion   = 0
saldo vigente  = 800
```

---

# 3. Máquina de Estados

Estados funcionales esperados:

```text
ACTIVO_PENDIENTE
ABONADO_PARCIAL
PAGADO_TOTAL
ANULADO
AJUSTADO_NC
```

## 3.1 `ACTIVO_PENDIENTE`

Documento vigente con saldo pendiente.

## 3.2 `ABONADO_PARCIAL`

Documento que continúa activo, pero cuyo saldo disminuyó respecto al snapshot anterior y existe evidencia compatible con pago parcial.

## 3.3 `PAGADO_TOTAL`

Documento cuyo saldo llegó a cero o que desapareció del snapshot vigente.

Si se origina solo por desaparición, debe considerarse provisional hasta reconciliar evidencia.

## 3.4 `ANULADO`

Documento confirmado por la fuente de anulados.

Tiene precedencia sobre `PAGADO_TOTAL` provisional.

## 3.5 `AJUSTADO_NC`

Documento cuya reducción o eliminación se explica total o parcialmente mediante nota de crédito.

No representa recuperación monetaria.

---

# 4. Transiciones

```text
ACTIVO_PENDIENTE
  |-- saldo disminuye + cobro --> ABONADO_PARCIAL
  |-- desaparece -------------> PAGADO_TOTAL provisional
  |-- nota de credito --------> AJUSTADO_NC
  `-- anulacion --------------> ANULADO

ABONADO_PARCIAL
  |-- nuevo abono y saldo > 0 -> ABONADO_PARCIAL
  |-- desaparece -------------> PAGADO_TOTAL provisional
  |-- nota de credito --------> AJUSTADO_NC
  `-- anulacion --------------> ANULADO

PAGADO_TOTAL provisional
  |-- evidencia de cobro -----> PAGADO_TOTAL confirmado
  |-- evidencia de NC --------> AJUSTADO_NC
  `-- evidencia anulacion ----> ANULADO
```

Precedencia mínima obligatoria:

```text
ANULADO > PAGADO_TOTAL_PROVISIONAL
```

---

# 5. Lógica de Deltas

Para un documento presente en snapshots consecutivos:

```text
delta = saldo_anterior - saldo_actual
```

Interpretación:

```text
delta > 0  -> disminucion
delta = 0  -> sin cambio
delta < 0  -> incremento / reaparicion / correccion
```

## 5.1 Sin variación

No generar recuperación ni ajuste.

## 5.2 Disminución parcial

Si:

```text
saldo_actual > 0
saldo_actual < saldo_anterior
```

Debe generarse un evento de reducción y luego explicar el delta con:

1. cobros;
2. notas de crédito;
3. otras evidencias.

No asumir automáticamente que todo delta es cobro.

## 5.3 Desaparición de cartera

Si un documento estaba en el snapshot anterior y no está en el actual:

```text
estado provisional = PAGADO_TOTAL
delta provisional   = saldo_anterior
```

La desaparición NO demuestra pago.

## 5.4 Incremento de saldo

Si:

```text
saldo_actual > saldo_anterior
```

debe conservarse trazabilidad y NO registrarse como recuperación negativa sin análisis.

---

# 6. Override por Anulación

Escenario:

```text
T0: FACT-001 saldo = 1000
T1: FACT-001 desaparece
```

Clasificación inicial:

```text
PAGADO_TOTAL provisional
```

Posteriormente:

```text
anulados contiene FACT-001
```

Clasificación definitiva:

```text
ANULADO
```

Debe revertirse cualquier recuperación previamente atribuida.

La historia no debe borrarse. Debe existir evidencia de la reclasificación.

---

# 7. Variaciones y Abonos Parciales

Ejemplo:

```text
T0 saldo = 1000
T1 saldo = 750
cobro    = 250
```

Resultado:

```text
saldo        = 750
recuperacion = 250
estado       = ABONADO_PARCIAL
```

NO volver a restar 250 al saldo del snapshot.

---

# 8. Deltas Mixtos

Una disminución puede estar explicada por múltiples causas.

Ejemplo:

```text
saldo anterior = 1000
saldo actual   = 600
delta          = 400

cobro = 300
NC    = 100
```

Resultado:

```text
recuperacion = 300
ajuste NC    = 100
```

No obligar al motor a asignar una única causa a todo el delta.

---

# 9. Identidad Documental

Todas las fuentes deben converger sobre una identidad documental estable.

Codex debe revisar la implementación real y determinar qué función construye la identidad.

No deben existir algoritmos incompatibles dispersos entre:

- importadores;
- IPC;
- servicios;
- reconciliadores;
- dashboard;
- reportes.

Debe centralizarse conceptualmente en una función equivalente a:

```text
buildDocumentKey(...)
```

---

# 10. Idempotencia

Reimportar exactamente la misma fuente NO debe duplicar:

- documentos;
- cobros;
- notas de crédito;
- anulaciones;
- eventos;
- recuperación;
- deltas;
- ledger.

El procesamiento debe ser determinístico e idempotente.

---

# 11. Importaciones Fuera de Orden

El motor debe tolerar evidencia tardía.

Ejemplo:

```text
Dia 1 -> cartera
Dia 2 -> nueva cartera
Dia 3 -> anulados del periodo anterior
```

La evidencia nueva debe poder reclasificar documentos históricos sin exigir otra carga de cartera.

La misma regla conceptual aplica a:

- cobros;
- NC;
- anulaciones.

---

# 12. Ledger / Historial

No es obligatorio Event Sourcing puro, pero sí comportamiento auditable.

No borrar eventos históricos para corregir estados.

Preferir:

```text
evento original
+
evento de reclasificacion/reversion
```

Cada evento debería poder expresar, según el modelo real:

- document key;
- tipo de evento;
- fecha;
- saldo anterior;
- saldo nuevo;
- monto;
- estado anterior;
- estado nuevo;
- fuente;
- referencia;
- importación;
- metadata.

---

# 13. Dashboard y Reportes

Dashboard y reportes deben consumir resultados conciliados.

NO deben recalcular reglas financieras de forma independiente.

Separar al menos:

```text
cartera pendiente
recuperacion monetaria
ajustes por NC
anulaciones
```

Una anulación o NC NO debe aparecer como recuperación monetaria.

---

# 14. Invariantes del Dominio

1. El saldo mostrado proviene del snapshot vigente.
2. Recuperación monetaria NO incluye notas de crédito.
3. Recuperación monetaria NO incluye anulaciones.
4. Recuperación monetaria NO incluye retenciones fiscales.
5. Desaparición NO implica pago confirmado.
6. Una anulación confirmada tiene precedencia sobre `PAGADO_TOTAL` provisional.
7. Evidencia tardía puede reclasificar eventos históricos.
8. Reimportación NO debe duplicar efectos.
9. El ledger NO debe perder trazabilidad por una reclasificación.
10. Dashboard y reportes deben proyectar resultados conciliados.

---

# 15. Casos de Negocio Obligatorios

## Caso 1 — Sin cambios

```text
T0 = 1000
T1 = 1000
```

Resultado:

```text
saldo = 1000
recuperacion = 0
```

## Caso 2 — Abono parcial

```text
T0 = 1000
T1 = 700
cobro = 300
```

Resultado:

```text
saldo = 700
recuperacion = 300
estado = ABONADO_PARCIAL
```

## Caso 3 — Pago total

```text
T0 = 1000
T1 = documento ausente
cobro = 1000
```

Resultado:

```text
saldo = 0
recuperacion = 1000
estado = PAGADO_TOTAL
```

## Caso 4 — Desaparición sin evidencia

Resultado:

```text
PAGADO_TOTAL provisional
```

## Caso 5 — Anulación posterior

Resultado:

```text
estado = ANULADO
recuperacion real = 0
```

## Caso 6 — NC parcial

```text
T0 = 1000
T1 = 800
NC = 200
```

Resultado:

```text
saldo = 800
ajuste NC = 200
recuperacion = 0
```

## Caso 7 — Delta mixto

```text
T0 = 1000
T1 = 600
cobro = 300
NC = 100
```

Resultado:

```text
recuperacion = 300
ajuste NC = 100
```

## Caso 8 — Retención fiscal

```text
pago financiero = 980
retencion = 20
```

Resultado:

```text
recuperacion = 980
```

## Caso 9 — Reimportación

Resultado:

```text
ningun evento duplicado
ninguna recuperacion duplicada
ningun ajuste duplicado
```

## Caso 10 — Anulado histórico

Resultado esperado:

```text
localizar documento historico
reclasificar correctamente
revertir recuperacion incorrecta
conservar trazabilidad
```

---

# 16. Aislamiento QA / Producción

Los datasets QA deben permanecer fuera del producto distribuido.

Incluye:

```text
*.db
*.sqlite
*.sqlite3
*.db-wal
*.db-shm
fixtures
datasets QA
Excel de pruebas
backups QA
```

En producción empaquetada:

```text
app.isPackaged === true
```

debe resolverse exclusivamente a:

```text
app.getPath("userData")/data/cartera.db
```

Una variable o ruta QA no debe redirigir silenciosamente una aplicación empaquetada.

---

# 17. Preservación durante Actualizaciones

La actualización debe ser offline, in-place y preservar `userData`.

El instalador no debe incluir una base precargada ni sobrescribir la base del usuario.

Las migraciones deben operar sobre la base persistente existente con respaldo previo y recuperación ante fallo.

---

# 18. Instrucción para Codex — Auditoría Obligatoria

Antes de modificar código, Codex debe inspeccionar el repositorio real y localizar:

1. importador de cartera Contífico;
2. importador de cobros;
3. importador de notas de crédito;
4. importador de anulados;
5. creación de snapshots;
6. comparación entre snapshots;
7. detección de desapariciones;
8. cálculo de deltas;
9. ledger/eventos;
10. reconciliador principal;
11. clasificación de `PAGADO_TOTAL`;
12. override a `ANULADO`;
13. manejo de NC;
14. cálculo de recuperación;
15. exclusión de retenciones;
16. dashboard;
17. reportes;
18. IPC;
19. repositorios/queries SQLite;
20. pruebas existentes.

Buscar especialmente en:

```text
electron/db.ts
electron/**/*.ts
src/**/*
scripts/**/*
tests/**/*
package.json
electron-builder.json5
```

Y por términos:

```text
cartera
snapshot
import
reconciliation
reconcile
ledger
delta
saldo
balance
cobro
abono
payment
nota_credito
credit_note
anulado
void
retencion
dashboard
recovery
recuperado
```

---

# 19. Matriz de Cumplimiento Esperada

Para cada regla, clasificar:

```text
IMPLEMENTADA
PARCIAL
NO IMPLEMENTADA
IMPLEMENTADA INCORRECTAMENTE
```

Cada conclusión debe incluir:

```text
archivo
funcion/clase
responsabilidad
evidencia
problema detectado
```

---

# 20. Hallazgos que Codex debe buscar

Especialmente:

- doble contabilización;
- recuperación inflada;
- NC tratadas como cobros;
- anulaciones tratadas como recuperación;
- retenciones tratadas como abonos;
- desapariciones tratadas como pago confirmado;
- falta de idempotencia;
- identidad documental inconsistente;
- lógica duplicada entre dashboard y reportes;
- lógica financiera dentro de React;
- búsqueda limitada a cartera actual para anulaciones históricas;
- falta de reconciliación retroactiva;
- pérdida de historial;
- contratos IPC inconsistentes;
- problemas de tipado;
- riesgos de migración.

---

# 21. Plan de Implementación — Reglas

Codex NO debe hacer un big-bang rewrite.

Orden recomendado:

```text
FASE A  Inspeccionar y mapear
FASE B  Crear/ajustar pruebas de regresion
FASE C  Corregir identidad documental si es necesario
FASE D  Consolidar snapshots y deltas
FASE E  Consolidar reconciliacion de evidencias
FASE F  Revisar override de anulaciones
FASE G  Revisar notas de credito
FASE H  Corregir recuperacion y retenciones
FASE I  Consolidar ledger
FASE J  Unificar agregados dashboard/reportes
FASE K  Ejecutar regresiones
```

---

# 22. Prohibiciones para Codex

NO debe:

1. recalcular saldo restando nuevamente cobros;
2. recalcular saldo restando nuevamente NC;
3. contabilizar NC como recuperación;
4. contabilizar anulaciones como recuperación;
5. contabilizar retenciones como recuperación;
6. borrar historial para corregir estados;
7. asumir que desaparición equivale a pago confirmado;
8. ignorar anulaciones históricas;
9. implementar reglas financieras directamente en React;
10. duplicar reglas entre dashboard y reportes;
11. crear distintas identidades documentales incompatibles;
12. romper idempotencia;
13. introducir `any` innecesariamente;
14. modificar esquema o IPC sin revisar consumidores;
15. reemplazar componentes funcionales sin justificación.

---

# 23. Pruebas Mínimas Requeridas

Debe existir cobertura para:

```text
snapshot unchanged
partial payment
full payment
disappearance without evidence
disappearance + later payment evidence
disappearance + later void evidence
disappearance + later credit note
partial credit note
mixed payment + credit note
tax retention exclusion
historical void
duplicate payment import
duplicate NC import
duplicate void import
duplicate portfolio import
balance increase
late evidence reconciliation
dashboard recovery reversal
report recovery reversal
```

Las pruebas deben validar:

- estado;
- saldo;
- recuperación;
- ajuste;
- anulación;
- ledger;
- agregados.

---

# 24. Salida Esperada de la Auditoría de Codex

Codex debe entregar antes de implementar:

## 24.1 Arquitectura real encontrada
Capas, componentes, tablas y dependencias.

## 24.2 Pipeline actual
Desde importación hasta dashboard/reportes.

## 24.3 Máquina de estados real
Estados encontrados, dónde se calculan y dónde se almacenan.

## 24.4 Matriz especificación vs implementación
Con evidencia por archivo y función.

## 24.5 Hallazgos críticos
Errores de lógica, duplicidades y riesgos.

## 24.6 Impacto contable/operativo
Sobre:

- cartera pendiente;
- recuperación;
- abonos;
- pagados;
- anulaciones;
- NC;
- dashboard;
- reportes.

## 24.7 Pruebas existentes
Qué cubren y qué falta.

## 24.8 Deuda técnica
Clasificar:

```text
CRITICA
ALTA
MEDIA
BAJA
```

## 24.9 Plan incremental
Con archivos afectados y pruebas necesarias.

## 24.10 Archivos que no deberían tocarse
Identificar componentes estables.

Durante esta auditoría:

```text
NO modificar archivos.
NO generar código.
NO hacer commits.
NO modificar bases de datos.
NO ejecutar procesos destructivos.
NO utilizar datos reales de producción.
```

Debe detenerse después del informe y esperar autorización.

---

# 25. Principio Arquitectónico Final

```text
CARTERA / SNAPSHOT
        |
        v
determina cuanto queda
        |
        v
DELTA ENGINE
        |
        v
determina que cambio
        |
        v
RECONCILIATION ENGINE
        |
        +-- cobros
        +-- notas de credito
        `-- anulados
        |
        v
explica por que cambio
        |
        v
LEDGER
        |
        v
conserva que ocurrio
        |
        v
DASHBOARD / REPORTES
```

Regla maestra:

> **La cartera determina cuánto queda. Los deltas determinan qué cambió. Cobros, notas de crédito y anulaciones explican por qué cambió. El ledger conserva la historia. Dashboard y reportes únicamente proyectan el resultado conciliado.**
