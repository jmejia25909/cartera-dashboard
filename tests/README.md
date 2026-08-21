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

## Suite de regresión autocontenida

`pnpm test:integration` compila y ejecuta los 19 escenarios del dominio de
conciliación usando exclusivamente bases SQLite y archivos Excel sintéticos
creados bajo el directorio temporal del sistema operativo.

La suite clasifica cada escenario como:

- `PASS`: comportamiento actual conforme a la regla de negocio.
- `EXPECTED FAIL`: defecto funcional conocido y documentado por la auditoría.
- `UNEXPECTED FAIL`: fallo de infraestructura o comportamiento no explicado.

Los `EXPECTED FAIL` no hacen fallar el proceso. Cualquier `UNEXPECTED FAIL`
produce un código de salida distinto de cero. La suite no usa bases QA externas,
rutas absolutas, datos de producción ni `%APPDATA%/cartera-dashboard/data/cartera.db`.
