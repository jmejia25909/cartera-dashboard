# GESTION-TYPES-FOUNDATION-PACK-014-FIX-001

Corrige la migración de `GestionPanels.tsx`.

El PACK 014 migró correctamente la mayoría de componentes, pero `GestionPanels.tsx` conservó `ReactNode` y perdió el import de `GestionChildrenProps`.

Este correctivo:

- elimina el import obsoleto de `ReactNode`;
- importa `GestionChildrenProps`;
- reemplaza `GestionPanelProps`;
- conserva los cambios pendientes del PACK 014;
- ejecuta typecheck, lint y build;
- crea commit y push.
