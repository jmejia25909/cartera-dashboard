# COLLECTION-RECONCILIATION-PACK-001

## Reglas

- `Abono detectado por cambio de total`: se conserva cuando el valor es positivo.
- `Cobro Total: Documento ya no aparece en cartera (Cancelado)`: representa `PAGO_TOTAL_POR_DESAPARICION`.
- `Abono detectado por documento no presente en importacion`: se revierte cuando existe el pago total del mismo documento.
- Movimientos con valor `<= 0`: se revierten.
- Movimientos ya reversados no deben sumar en recaudación.
- Los documentos anulados ya tienen sus abonos reversados por el módulo de anulaciones.

No se eliminan registros físicamente.
