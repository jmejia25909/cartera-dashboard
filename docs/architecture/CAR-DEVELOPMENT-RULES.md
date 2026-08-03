# Cartera Dashboard — Reglas de Desarrollo

## Alcance

Estas reglas aplican únicamente a Cartera Dashboard.

## Reglas obligatorias

1. No agregar librerías sin justificar necesidad, impacto y alternativa nativa.
2. Mantener TypeScript estricto y reducir `any` progresivamente.
3. No acceder a SQLite desde React.
4. No usar posiciones fijas para importar cabeceras de Contífico.
5. No modificar reglas financieras durante un refactor.
6. No agregar lógica compleja nueva directamente en `App.tsx`.
7. Todo reporte PDF debe usar `src/pdf/core`.
8. Los generadores reciben datos y contexto; no leen estados React globales.
9. Toda migración debe conservar compatibilidad con la base de datos existente.
10. Cada sprint debe incluir rollback y pruebas.

## Flujo de entrega

```text
Backup
  ↓
Aplicar cambios
  ↓
pnpm build
  ↓
pnpm dev
  ↓
Pruebas funcionales
  ↓
Aceptar sprint
```

## Pruebas mínimas por sprint

- inicio de Electron;
- carga de datos SQLite;
- importación Contífico cuando aplique;
- filtros afectados;
- acciones CRUD afectadas;
- PDF/Excel afectados;
- reinicio de aplicación;
- persistencia de configuración.

## Criterio de código muerto

Solo se elimina la implementación antigua después de:

1. implementar la nueva;
2. compilar;
3. probar resultados;
4. confirmar que no existe ninguna referencia activa.

## Convenciones

- Archivos y funciones en inglés técnico o español consistente con el módulo; evitar mezclas dentro del mismo contrato.
- Componentes React en PascalCase.
- Hooks con prefijo `use`.
- Servicios terminados en `Service` cuando representen una unidad de aplicación.
- DTOs de reportes separados de entidades persistidas cuando tengan estructuras distintas.
