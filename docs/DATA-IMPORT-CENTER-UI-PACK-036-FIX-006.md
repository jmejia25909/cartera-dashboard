# DATA-IMPORT-CENTER-UI-PACK-036-FIX-006

## Problema

Electron abortaba al iniciar con:

```text
Attempted to register a second handler for 'importHistoryList'
```

La búsqueda global confirmó dos registros reales de:

- importHistoryList
- importHistoryGet
- importHistoryRevert

El primer bloque, alrededor de las líneas 1746-1800, es el bloque correcto.
El segundo bloque compacto, alrededor de las líneas 2070-2081, es un duplicado
residual dejado por los packs anteriores.

## Solución

FIX-006 elimina únicamente el segundo bloque compacto.

Después verifica que:

- exista exactamente un handler de importHistoryList;
- exista exactamente un handler de importHistoryGet;
- exista exactamente un handler de importHistoryRevert;
- no quede ningún duplicado compacto residual.

Luego ejecuta typecheck, build, commit y push.
