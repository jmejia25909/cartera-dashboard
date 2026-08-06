# GESTION-CLIENTS-TABLE-PACK-009-FIX-001

Correctivo del PACK 009.

La versión inicial esperaba una etiqueta `table` con una forma exacta. Este correctivo:

- detecta la tabla aunque tenga atributos adicionales;
- busca dentro de `GestionClientsTableShell`;
- tolera archivos pendientes del intento fallido;
- conserva `thead`, `tbody`, filas, eventos y cálculos;
- valida, compila, crea commit y hace push.
