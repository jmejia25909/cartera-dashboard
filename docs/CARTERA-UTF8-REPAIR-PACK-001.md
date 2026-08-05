# CARTERA-UTF8-REPAIR-PACK-001

## Alcance

Repara de forma controlada las secuencias de mojibake detectadas en:

- `src/App.tsx`
- `src/pdf/reports/analisisReport.ts`
- `electron/db.ts`

La reparación se aplica únicamente a líneas con patrones sospechosos y puede ejecutar varias rondas de decodificación para corregir textos doblemente codificados.

## Validaciones

- textos de Gestión;
- textos de Análisis;
- etiquetas y mensajes;
- títulos del PDF de análisis;
- comentarios y literales de migración;
- TypeScript;
- ESLint;
- build completo.
