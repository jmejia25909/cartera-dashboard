# Tests técnicos

## Estructura

- rehydrate/
  Validaciones de rehidratación de cobros, cartera fiscal y NC.

- dashboard/
  Validaciones temporales del dashboard ejecutivo.

- management/
  Reportes gerenciales y antigüedad de saldos.

- reconciliation/
  Determinismo y cadenas de reversión.

- snapshots/
  Idempotencia de snapshots.

- config/
  Configuraciones Vite usadas para compilar pruebas Node/SSR.

- .build/
  Salidas temporales de compilación. No deben versionarse.

Los tests no forman todavía parte del script estándar de package.json.
