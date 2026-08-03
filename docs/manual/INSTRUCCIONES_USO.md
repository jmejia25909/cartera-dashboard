# 🚀 INSTRUCCIONES DE USO - CARTERA DASHBOARD CORREGIDO

**Versión:** 1.0 Corregida  
**Fecha:** 27 de Enero de 2026  
**Estado:** ✅ Producción

---

## 📱 Acceso al Sistema

### **Opción 1: Desktop (Aplicación Electron)**
```bash
# La aplicación se abre automáticamente al ejecutar:
pnpm dev

# O construir para producción:
pnpm build
pnpm preview
```

### **Opción 2: Mobile/Web (Navegador)**
```
URL: http://192.168.1.9:3000
Acceso desde cualquier dispositivo en la misma red WiFi
```

### **Opción 3: Desarrollo Local**
```
URL: http://localhost:5173
Para desarrollo con Hot Module Reload
```

---

## 🎨 Características del Diseño

### **Tema Visual**
- ✨ Gradiente suave azul-gris de fondo
- 🎯 Header oscuro futurista con degradado
- 💳 Tarjetas blancas flotantes con sombras
- 🔵 Botones azul primario y secundarios
- 📊 KPI cards con efectos hover

### **Responsividad**
- ✅ Desktop: Diseño completo
- ✅ Tablet: Adaptado a pantalla
- ✅ Mobile: Optimizado para portátiles

---

## 📊 Funcionalidades Principales

### **Dashboard (Inicio)**
- Vista general de cartera
- KPIs en tiempo real
- Gráficos de aging
- Alertas de incumplimiento

### **Cartera**
- Búsqueda avanzada de documentos
- Filtrado por cliente, documento, aging
- Vista agrupada con subtotales
- **Exportar a Excel 📊**
- **Exportar a PDF 📄**

### **Gestiones**
- Registro de contactos con clientes
- Timeline de acciones
- Seguimiento de promesas de pago
- Tipos de gestión (Llamada, Email, Visita, etc.)

### **Promesas de Pago**
- Lista de promesas por vencer
- Semáforo de cumplimiento (Verde/Amarillo/Rojo)
- Recordatorios automáticos
- Marca como cumplida

### **Campañas**
- Crear y gestionar campañas de cobranza
- Asignar clientes a campañas
- Seguimiento de resultados

### **Reportes & Análisis**
- Scoring de gestores (mejor desempeño)
- Análisis de urgencia (clientes críticos)
- Tendencias (ingresos/cobros por período)
- Conciliación de saldos

---

## 🔧 Cómo Usar Cada Función

### **Exportar a Excel**
1. Ir a pestaña "Reportes"
2. (Opcional) Filtrar documentos
3. Clic en botón "📥 Exportar a Excel"
4. Se descarga archivo: `Cartera_YYYY-MM-DD.xlsx`

### **Exportar a PDF**
1. Ir a pestaña "Reportes"
2. (Opcional) Filtrar documentos
3. Clic en botón "📄 Exportar a PDF"
4. Se descarga archivo: `Cartera_YYYY-MM-DD.pdf`

### **Crear Gestión**
1. Ir a pestaña "Gestiones"
2. Clic en botón "➕ Nueva Gestión"
3. Llenar formulario:
   - Cliente
   - Tipo (Llamada, Email, etc.)
   - Resultado (Contactado, Promesa, etc.)
   - Observación
4. Clic en "Guardar"

### **Registrar Promesa**
1. En la gestión, seleccionar resultado "Promesa"
2. Ingresar fecha de promesa
3. Ingresar monto
4. Sistema calcula automáticamente semáforo

---

## 🎯 Mejor Prácticas

### ✅ DO's
- ✅ Buscar cliente antes de crear gestión
- ✅ Registrar observaciones detalladas
- ✅ Marcar promesas como cumplidas
- ✅ Revisar alertas de incumplimiento
- ✅ Exportar reportes regularmente

### ❌ DON'Ts
- ❌ No crear duplicados de gestiones
- ❌ No olvidar marcar promesas cumplidas
- ❌ No ignorar alertas de incumplimiento
- ❌ No dejar campos vacíos importante

---

## 🔐 Autenticación

### Usuario Demo (Incluido)
```
Usuario: demo
Contraseña: demo123
Rol: Administrador
```

### Permisos
- **Admin:** Todas las funciones
- **Gestor:** Crear/editar gestiones, ver reportes
- **Lectura:** Solo visualizar (sin crear/editar)

---

## ⚙️ Configuración

### Variables de Entorno
```env
VITE_DEV_SERVER_URL=http://localhost:5173
DATABASE_URL=internal (SQLite local)
NGROK_ENABLED=false
```

### Localización
- **Idioma:** Español
- **Moneda:** USD ($)
- **Formato de fechas:** DD/MM/YYYY

---

## 🛠️ Troubleshooting

### **Problema: La aplicación no se abre**
```bash
# Solución 1: Limpiar cache
rm -rf dist/ node_modules/
pnpm install

# Solución 2: Usar puerto diferente
pnpm dev --port 3001
```

### **Problema: Conexión a móvil no funciona**
```bash
# Verificar IP local
ipconfig getifaddr en0  # macOS
ipconfig                # Windows

# Verificar que la app escuche en 0.0.0.0
pnpm dev --host
```

### **Problema: Exportación falla**
```bash
# Verificar que xlsx esté instalado
pnpm list xlsx jspdf

# Reinstalar si falta
pnpm add xlsx jspdf jspdf-autotable
```

---

## 📞 Soporte

### Documentación
- `ANALISIS_Y_CORRECCIONES.md` - Detalles técnicos
- `RESUMEN_FINAL.md` - Resumen ejecutivo
- README.md - Instrucciones del proyecto

### Logs
- **Dev:** Ver en consola (F12)
- **Build:** Ver en `dist/` y `dist-electron/`

---

## 🚀 Deployment

### Producción (Desktop)
```bash
pnpm build
# Genera ejecutable en dist-electron/
```

### Producción (Web)
```bash
pnpm build
# Archivos estáticos en dist/
# Servir con servidor web (Nginx, Apache, etc.)
```

---

## 📊 Respaldos

### Crear Respaldo Manual
```bash
cd C:\dev
robocopy cartera-dashboard respaldos\backup-manual /S
```

### Ubicación de Respaldos
```
C:\dev\respaldos\
├── cartera-dashboard_2026-01-27_16-29-57 (Original)
└── cartera-dashboard-CORREGIDO_2026-01-27_18-17-04 (Corregido)
```

---

## ✅ Checklist de Instalación

- [ ] Proyecto clonado/descargado
- [ ] Node.js v18+ instalado
- [ ] `pnpm install` ejecutado
- [ ] `pnpm dev` funciona
- [ ] Aplicación se abre en Electron
- [ ] Web accesible en `http://192.168.1.9:3000`
- [ ] Exportación Excel/PDF funciona
- [ ] Todas las gestiones se guardan

---

## 📌 Notas Importantes

1. **Base de datos:** Local (SQLite en memoria)
   - ⚠️ Los datos se pierden al cerrar la app
   - Para persistencia, implementar backend

2. **Seguridad:** Demo solo
   - ⚠️ No usar en producción sin auth real
   - Implementar JWT o similar

3. **Escalabilidad:** 
   - ⚠️ Bundle de 1.2MB (considera code-splitting)
   - Puede reducirse con lazy loading

---

## 🎓 Próximos Pasos

1. **Backend:** Implementar API REST
2. **Base de datos:** Migrar a PostgreSQL/MongoDB
3. **Auth:** Integrar sistema de autenticación real
4. **Testing:** Agregar tests unitarios e integración
5. **CI/CD:** GitHub Actions o similar

---

**Versión:** 1.0  
**Última actualización:** 27 de Enero de 2026  
**Status:** ✅ LISTA PARA USAR
