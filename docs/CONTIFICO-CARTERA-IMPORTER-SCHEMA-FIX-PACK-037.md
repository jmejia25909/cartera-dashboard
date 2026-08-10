# CONTIFICO CARTERA IMPORTER SCHEMA FIX PACK 037

Alinea `importContifico.ts` con el esquema vigente de `documentos`.

- Retira del INSERT de documentos: centro_costo, categoria_persona y aging estático.
- Conserva aging del Excel solo para validación de descuadres.
- Mantiene centro_costo, categoria_persona y vendedor como atributos de `clientes`.
- Agrega migraciones suaves para esos atributos en bases existentes.
- Verifica que el INSERT no vuelva a persistir columnas obsoletas.
