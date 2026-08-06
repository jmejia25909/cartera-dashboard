# GESTION-FINAL-LAYOUT-STICKY-FIX-PACK-025-FIX-001

Corrige el error TypeScript:

```text
TS17001: JSX elements cannot have multiple attributes with the same name
```

El PACK 025 agregó `gestion-data-table` sobre una etiqueta `<table>` que ya tenía `className`, generando dos atributos iguales.

Este correctivo:

- detecta todos los atributos `className` de la tabla;
- fusiona sus clases sin duplicados;
- conserva `gestion-data-table`;
- continúa con `typecheck`, `lint`, `build`, commit y push;
- permite ejecutarse sobre el estado parcial dejado por el PACK 025.
