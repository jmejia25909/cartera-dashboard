# Cartera Dashboard — Roadmap de Arquitectura V2

## Objetivo

Reducir acoplamiento y duplicación sin modificar la idea original, reglas financieras, diseño ni flujo de usuario.

## Estado de referencia

- Motor PDF base: implementado.
- Reportes PDF: migración avanzada/completada según la actualización aplicada.
- `App.tsx`: todavía concentra UI, estado, filtros y análisis.
- Electron: funcional, pero `main.ts` concentra numerosos handlers.
- Importación Contífico: dinámica y funcional.

## Sprint 001 — Motor PDF

**Estado:** completado.

Entregables:

- contexto corporativo común;
- cabecera y pie unificados;
- usuario y RUC consistentes;
- generadores desacoplados.

## Sprint 002 — Auditoría y arquitectura

**Estado:** este paquete.

Entregables:

- CAR-ADR-0001;
- CAR-ADR-0002;
- CAR-ADR-0003;
- CAR-ADR-0004;
- roadmap y reglas de desarrollo.

## Sprint 003 — Utilidades y tipos compartidos

### Alcance

Extraer de `App.tsx`:

- `fmtMoney`;
- `toNumber`;
- `compactLabel`;
- fechas y semanas;
- clasificación aging;
- severidad;
- tipos de Documento, Gestión, Alerta y Empresa.

### Estructura

```text
src/utils/money.ts
src/utils/numbers.ts
src/utils/dates.ts
src/utils/aging.ts
src/utils/strings.ts
src/types/domain.ts
```

### Riesgo

Bajo.

## Sprint 004 — Servicios de análisis

### Alcance

Extraer:

- riesgo de clientes;
- eficiencia de cobranza;
- vencimientos próximos;
- retenciones;
- análisis por vendedor;
- deudores crónicos;
- resúmenes de vencidos.

### Estructura

```text
src/services/carteraAnalyticsService.ts
src/services/riskService.ts
src/services/reportFilterService.ts
```

### Riesgo

Medio. Los resultados deben compararse con la versión anterior.

## Sprint 005 — Página de Reportes

### Alcance

Mover el bloque `tab === "reportes"` a:

```text
src/pages/ReportesPage.tsx
src/hooks/useReportes.ts
src/excel/carteraExcelReport.ts
```

### Riesgo

Medio.

## Sprint 006 — Dashboard y Análisis

### Alcance

```text
src/pages/DashboardPage.tsx
src/pages/AnalisisPage.tsx
src/hooks/useDashboard.ts
src/hooks/useAnalisis.ts
```

### Riesgo

Medio.

## Sprint 007 — Gestión y CRM

### Alcance

Separar:

- gestión por cliente;
- historial;
- promesas;
- acciones de contacto;
- modales relacionados.

### Riesgo

Alto por el volumen de estado y acciones CRUD.

## Sprint 008 — Alertas, Tendencias, Cuentas y Configuración

### Alcance

Extraer páginas restantes y sus hooks.

### Riesgo

Medio.

## Sprint 009 — API Electron tipada

### Alcance

- consolidar `getElectronApi`;
- eliminar casts innecesarios;
- revisar `src/types/api.types.ts`;
- asegurar que preload exponga solo operaciones permitidas.

### Riesgo

Medio-alto.

## Sprint 010 — Modularización Electron

### Alcance

Separar repositorios, servicios e IPC por dominio sin cambiar nombres de canales consumidos por React.

### Riesgo

Alto. Requiere respaldo de SQLite y pruebas de regresión.

## Sprint 011 — Limpieza final

### Alcance

- eliminar código muerto;
- eliminar imports sin uso;
- resolver `any` críticos;
- ejecutar ESLint;
- actualizar documentación;
- verificar instalador.

## Métricas de éxito

- `pnpm build` sin errores en cada sprint.
- Reducción progresiva de `App.tsx`.
- Cero cambios no solicitados en la UI.
- Totales financieros idénticos.
- No pérdida de datos SQLite.
- Reportes PDF y Excel equivalentes o mejorados solo en trazabilidad.
