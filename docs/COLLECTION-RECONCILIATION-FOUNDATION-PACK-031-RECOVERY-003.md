# COLLECTION-RECONCILIATION-FOUNDATION-PACK-031-RECOVERY-003

Paquete de recuperación para el estado parcial dejado por los intentos anteriores.

No vuelve a copiar archivos internos. Utiliza directamente los dos archivos ya
creados en el repositorio:

- `electron/collectionPeriodReconciliation.ts`
- `src/types/collectionReconciliation.ts`

Completa:

- schema `conciliaciones_cobros`;
- integración con Dashboard;
- IPC backend GET/SAVE;
- limpieza de conciliaciones al limpiar la base;
- typecheck, lint, build, commit y push.

Este paquete debe ejecutarse únicamente sobre el estado parcial actual.
