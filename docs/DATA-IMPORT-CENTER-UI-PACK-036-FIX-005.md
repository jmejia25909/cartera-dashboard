# DATA-IMPORT-CENTER-UI-PACK-036-FIX-005

## Errores corregidos

El FIX-004 logró integrar correctamente el Centro de Importaciones, pero
TypeScript detectó cuatro problemas concretos:

1. callbacks `() => undefined` sin anotación de retorno;
2. `String.replaceAll` no disponible en el target JS actual;
3. `dbPath` dejó de utilizarse en ConfigPage;
4. `onCopyDbPath` dejó de utilizarse en ConfigPage.

## Corrección

- callbacks planned pasan a `(): void => undefined`;
- `replaceAll("_", " ")` pasa a `replace(/_/g, " ")`;
- `dbPath` y `onCopyDbPath` se conservan en `ConfigPageProps` por compatibilidad,
  pero se eliminan del destructuring mientras la nueva tarjeta no los utilice;
- se conservan todas las modificaciones funcionales del PACK 036;
- se eliminan los artefactos auxiliares del FIX-004 fallido;
- se ejecutan typecheck, lint, build, commit y push.
