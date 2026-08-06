# GESTION-PANELS-PACK-006

Extrae los contenedores superiores del módulo Gestión:

- `GestionKpisPanel`
- `GestionToolbarPanel`

Los cálculos, controles, eventos y valores existentes se conservan dentro de `App.tsx` como hijos temporales. Esta separación prepara la extracción segura de filtros y acciones en el siguiente paquete.
