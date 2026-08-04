# CREDIT-POLICY-UI-PACK-001

## Alcance

- Nueva pestaña **Crédito**.
- Lista de clientes pendientes y configurados.
- Filtros y búsqueda.
- Políticas de contado o crédito de 0 a 365 días.
- Presets 0, 15, 30, 45, 60 y 90.
- Aplicación solo a futuras importaciones.
- Recalculo opcional de documentos pendientes.
- Confirmación previa con cantidad de documentos.
- Resolución de alerta cuando ya no quedan documentos pendientes.

## Seguridad

El módulo solo recalcula documentos con `credito_pendiente = 1` del cliente
seleccionado. Los documentos con fechas válidas provenientes de Contífico no se
modifican.
