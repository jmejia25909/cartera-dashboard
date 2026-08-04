# DASHBOARD-EXECUTIVE-DATA-PACK-001

Crea una fuente única, tipada y auditable para el dashboard profesional.

## Endpoint

- Electron IPC: `dashboardExecutiveStats`
- HTTP local: `/api/dashboard-executive`

## Decisión sobre cobranza mensual

El endpoint no presenta los cambios detectados como cobranza bancaria oficial.

Devuelve:

- abonos parciales detectados;
- cierres por desaparición;
- otros cambios positivos;
- total detectado;
- estado `REQUIERE_CONCILIACION`;
- `valorOficial: null`.

## Calidad de datos

No genera una puntuación arbitraria. Expone:

- cobertura de política de crédito;
- coincidencia de anulaciones;
- documentos con crédito pendiente;
- documentos sin vencimiento válido;
- estado `OK`, `ATENCION` o `CRITICO`.

## Futuro

DSO, proyección, cumplimiento de meta y efectividad por gestor quedan declarados como KPI futuros sin inventar valores.
