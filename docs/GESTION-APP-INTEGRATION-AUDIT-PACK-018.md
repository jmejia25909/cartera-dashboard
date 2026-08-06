# GESTION-APP-INTEGRATION-AUDIT-PACK-018

Genera un inventario exacto de `src/App.tsx` antes de conectar `useGestion`.

El paquete identifica:

- estados (`useState`);
- cálculos (`useMemo`);
- callbacks (`useCallback`);
- efectos (`useEffect`);
- líneas donde se encuentran los componentes de Gestión;
- miembros probablemente relacionados con filtros, clientes, paginación, ordenamiento y selección.

El resultado queda versionado en:

- `docs/gestion-migration/app-state-inventory.json`
- `docs/gestion-migration/app-state-inventory.md`

Este inventario permite que el siguiente paquete migre lógica real sin asumir nombres ni romper funcionalidades existentes.
