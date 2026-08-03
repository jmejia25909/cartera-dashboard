# CAR-ADR-0002 — Frontend Architecture

- **Estado:** Aprobado
- **Fecha:** 2026-08-02
- **Decisión:** Dividir el renderer React en páginas, componentes, hooks, servicios y utilidades.

## Estado actual observado

`src/App.tsx` supera las cuatro mil líneas en el contexto auditado y contiene:

- estados globales de múltiples módulos;
- carga inicial de datos;
- filtros y búsquedas;
- cálculos de KPIs;
- acciones CRUD;
- renderizado de todas las pestañas;
- exportación Excel;
- integración con Electron;
- datos demo y fallback HTTP;
- manejo de toasts y modales.

## Arquitectura objetivo

```text
src/
├── app/
│   ├── AppShell.tsx
│   └── navigation.ts
├── pages/
│   ├── DashboardPage.tsx
│   ├── GestionPage.tsx
│   ├── ReportesPage.tsx
│   ├── CrmPage.tsx
│   ├── AnalisisPage.tsx
│   ├── AlertasPage.tsx
│   ├── TendenciasPage.tsx
│   ├── CuentasPage.tsx
│   └── ConfiguracionPage.tsx
├── components/
│   ├── common/
│   ├── dashboard/
│   ├── gestion/
│   └── reportes/
├── hooks/
├── services/
├── utils/
├── pdf/
├── excel/
├── types/
└── App.tsx
```

## Responsabilidades

### `App.tsx`

Debe limitarse a:

- inicializar el shell;
- proveer contexto global mínimo;
- seleccionar la página activa;
- mostrar modales globales cuando sea necesario.

### Pages

Cada página recibe datos y callbacks tipados. No debe acceder directamente a SQLite ni importar `better-sqlite3`.

### Components

Componentes visuales reutilizables, sin lógica de negocio extensa.

### Hooks

Ejemplos propuestos:

```text
useCarteraData
useReportFilters
useGestionCliente
usePromesas
useAlertas
useEmpresaConfig
```

Los hooks coordinan estado y servicios, pero no contienen SQL ni generación de documentos.

### Services

Ejemplos propuestos:

```text
carteraAnalyticsService.ts
agingService.ts
riskService.ts
promesasService.ts
reportFilterService.ts
```

Deben priorizar funciones puras con entradas y salidas tipadas.

### Utils

```text
money.ts
dates.ts
numbers.ts
strings.ts
```

No deben depender de React.

## Estrategia de estado

Se mantiene `useState`, `useMemo`, `useCallback` y hooks propios. No se incorpora una librería externa de estado durante este refactor.

## Contrato con Electron

Se debe consolidar un acceso único:

```ts
const api = getElectronApi();
```

Posteriormente deberá reemplazarse el uso extensivo de `any` por la interfaz definida en `src/types/api.types.ts`.

## Regla de dependencia

```text
Page → Hook → Service → Electron API
```

No se permite:

```text
Component → SQLite
Service → React component
PDF report → UI state directo
```

## Orden de migración

1. Utilidades puras.
2. Cálculos y análisis.
3. Filtros de reportes.
4. Páginas de menor riesgo.
5. Gestión y CRM.
6. Shell final.

## Criterios de aceptación

- No cambia la navegación.
- No cambia el diseño actual.
- Cada página compila de manera aislada.
- Las funciones extraídas conservan resultados.
- `App.tsx` disminuye de forma medible en cada sprint.
