# COLLECTION-HISTORY-PAGINATION-PACK-034-FIX-001

Correctivo del PACK 034.

## Causa del fallo original

El PACK 034 intentaba localizar todo el handler `abonosListar` mediante una
expresión regular demasiado rígida.

El código real sí contiene:

```sql
FROM abonos a
LEFT JOIN documentos d ON a.documento = d.documento
ORDER BY a.fecha DESC
LIMIT 50
```

pero el patrón completo no coincidió con el formato real del archivo.

## FIX-001

Este correctivo:

1. localiza `abonosListar` por el inicio del handler;
2. usa `clientesListar` como límite estructural posterior;
3. elimina `LIMIT 50` únicamente dentro de ese segmento;
4. verifica que `ORDER BY a.fecha DESC` permanezca;
5. agrega paginación local de 50 filas en la auditoría;
6. calcula conteo y monto sobre todo el conjunto filtrado;
7. muestra `Mostrando X-Y de Z movimientos`;
8. muestra `Página N de M`;
9. reinicia página al cambiar tipo, búsqueda o fechas;
10. no modifica otros `LIMIT 50` del sistema.
