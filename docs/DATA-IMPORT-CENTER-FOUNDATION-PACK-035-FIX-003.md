# DATA-IMPORT-CENTER-FOUNDATION-PACK-035-FIX-003

## Causa

FIX-002 dejó el bloque sintácticamente válido, pero TypeScript informó:

- `limit` declarado y no utilizado;
- `clause` declarado y no utilizado.

Eso indica que el SQL dinámico no quedó conectado correctamente al resultado
de la función después de los escapes previos.

## Solución

FIX-003 reconstruye por completo `listImportHistory` y los handlers del Centro
de Importaciones usando SQL parametrizado y sin template literals dinámicos.

Se usan dos consultas explícitas:

- con filtro `tipo`;
- sin filtro `tipo`.

Ambas usan `LIMIT ?`, por lo que `limit` participa realmente en la consulta.

Después ejecuta:

- verificación estructural;
- typecheck;
- lint;
- build;
- commit;
- push.
