# DASHBOARD-FINANCIAL-AUDIT-PACK-001

Auditoría de solo lectura para comparar los KPI actuales del dashboard con una versión corregida.

## Alcance

- Cartera pendiente
- Cartera vencida
- Mora > 90 días
- Cobros detectados del mes
- Clientes con saldo
- Documentos pendientes
- Vencimientos 0–7 y 8–30 días
- Clientes sin política
- Anulados no encontrados
- Aging
- Top clientes
- Cartera por vendedor
- Mora crítica

## Seguridad

- Abre SQLite en modo `readonly`.
- No modifica la base.
- Debe ejecutarse únicamente con la base temporal.


## Ajustes de precisión

- Las políticas de contado con 0 días se consideran configuradas.
- Los clientes sin política se identifican mediante `credito_configurado = 0`.
- Se reportan documentos con política pendiente.
- Se separan saldos no positivos.
- Los cobros detectados del mes se desglosan por tipo de movimiento.
