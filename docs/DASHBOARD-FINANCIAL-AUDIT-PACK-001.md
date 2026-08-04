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
