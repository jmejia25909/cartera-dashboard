# CARTERA-IMPORT-HISTORY-REVERSAL-PACK-037

## Objetivo

Integrar la importación de Cartera Contífico con el Centro de Importaciones.

## Comportamiento

Antes de importar una cartera:

1. calcula SHA-256 del archivo;
2. bloquea la reimportación del mismo archivo si ya fue procesado;
3. crea una sesión `CARTERA` en `importaciones`;
4. guarda un snapshot reversible de:
   - documentos;
   - abonos/movimientos inferidos;
   - alertas de crédito;
5. ejecuta el importador Contífico existente;
6. conserva la lógica actual de:
   - reducción de saldo;
   - aumento de cobros;
   - desaparición del documento;
7. ejecuta reconcileCollections;
8. marca la sesión COMPLETADA o COMPLETADA_ADVERTENCIAS.

## Reversión

El historial permite revertir una importación de Cartera.

Por seguridad:

- solo puede revertirse la última importación activa de cartera;
- si existen importaciones posteriores, se bloquea;
- la reversión restaura documentos, abonos y alertas desde el snapshot;
- no se elimina la fila del historial;
- la importación queda como REVERTIDA.

## Alcance deliberado

No se elimina la lógica de "documento desaparecido = cierre/pago total inferido".
Esa lógica continúa funcionando como DETECCIÓN.

Los futuros importadores de Cobros, Notas de Crédito y Anulados serán quienes
validen o expliquen esa inferencia.
