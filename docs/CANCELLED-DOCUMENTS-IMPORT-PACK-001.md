# CANCELLED-DOCUMENTS-IMPORT-PACK-001

## Regla implementada

1. La importación de Contífico puede inferir `PAGO_TOTAL` cuando un documento deja de aparecer.
2. La importación posterior de **Documentos Anulados** tiene mayor prioridad.
3. Si el documento anulado existe:
   - se marca como `ANULADO`;
   - se excluye de saldo activo;
   - se reversan sus abonos detectados;
   - los abonos permanecen en historial;
   - no se genera crédito a favor;
   - no se reaplica dinero automáticamente;
   - se espera la siguiente importación de Contífico.
4. Si no existe, queda en el log como `NO_ENCONTRADO`.

No se eliminan físicamente documentos ni abonos.
