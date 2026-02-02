
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import "./App.css";

// Definición global para evitar errores de TypeScript con window.api
declare global {
  interface Window {
    api: any;
  }
}

// Interfaces necesarias para TypeScript
interface Documento {
  id: number;
  documento: string;
  numero?: string;
  cliente: string;
  razon_social?: string;
  vendedor?: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  total: number;
  saldo?: number;
  valor_documento?: number;
  dias_vencidos?: number;
  por_vencer?: number;
  retenciones?: number;
  centro_costo?: string;
  aging?: string;
}

interface Gestion {
  id: number;
  cliente: string;
  razon_social?: string;
  fecha: string;
  tipo: string;
  resultado: string;
  observacion: string;
  motivo?: string;
  fecha_promesa?: string;
  monto_promesa?: number;
}

interface Alerta {
  cliente: string;
  documento: string;
  monto: number;
  diasVencidos: number;
  severidad: string;
}

// Utilidades básicas restauradas
const fmtMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const fmtMoneyCompact = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact" }).format(amount);

// Componente RankingList restaurado (versión simplificada)
const RankingList = ({ title, items, barColor }: any) => (
  <div style={{ padding: 10 }}>
    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#64748b' }}>{title}</h4>
    {items.map((item: any, i: number) => (
      <div key={i} style={{ marginBottom: 6, fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontWeight: 500 }}>{item.label}</span>
          <span style={{ fontWeight: 600 }}>{fmtMoney(item.value)}</span>
        </div>
        <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${Math.min(100, (item.value / (items[0]?.value || 1)) * 100)}%`, background: item.color || barColor, borderRadius: 2 }}></div>
        </div>
      </div>
    ))}
  </div>
);

export default function App() {
  // --- ESTADOS RESTAURADOS ---
  const [tab, setTab] = useState("dashboard");
  const [theme, setTheme] = useState("claro");
  const [pendingTheme, setPendingTheme] = useState("claro");
  const [isWeb, setIsWeb] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [hasWritePermissions, setHasWritePermissions] = useState(true);
  
  // Datos principales
  const [docs, setDocs] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [topClientes, setTopClientes] = useState<any[]>([]);
  const [gestiones, setGestiones] = useState<any[]>([]);
  const [allGestiones, setAllGestiones] = useState<any[]>([]);
  const [tendencias, setTendencias] = useState<any[]>([]);
  const [abonos, setAbonos] = useState<any[]>([]);
  const [cuentasAplicar, setCuentasAplicar] = useState<any[]>([]);
  const [promesas, setPromesas] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  // Filtros y Búsquedas
  const [searchDocumentos, setSearchDocumentos] = useState("");
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [filtroCentroCosto, setFiltroCentroCosto] = useState("Todos");
  const [filtroAging, setFiltroAging] = useState("Todos");
  const [searchAlertas, setSearchAlertas] = useState("");
  const [filtroSeveridad, setFiltroSeveridad] = useState("Todos");
  const [filtroFecha, setFiltroFecha] = useState("Todas");
  const [filtroMonto, setFiltroMonto] = useState("Todos");
  const [filtroVistaGestion, setFiltroVistaGestion] = useState("Todos");
  const [vistaAgrupada, setVistaAgrupada] = useState(false);
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [vistaAnalisis, setVistaAnalisis] = useState("motivos");

  // UI y Modales
  const [showModalGestion, setShowModalGestion] = useState(false);
  const [showModalEmpresa, setShowModalEmpresa] = useState(false);
  const [showModalLimpiar, setShowModalLimpiar] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const [gestionForm, setGestionForm] = useState({ tipo: "Llamada", resultado: "Contactado", observacion: "", motivo: "", fecha_promesa: "", monto_promesa: 0 });
  
  // Configuración
  const [empresa, setEmpresa] = useState<any>({});
  const [remoteUrl, setRemoteUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [remoteUrlHealthy, setRemoteUrlHealthy] = useState(false);
  const [localUrlHealthy, setLocalUrlHealthy] = useState(false);
  const [centrosCosto, setCentrosCosto] = useState<string[]>([]);
  const [clientesGestionados, setClientesGestionados] = useState<string[]>([]);

  // Placeholders para datos derivados
  const [motivosData, setMotivosData] = useState<any[]>([]);
  const [productividadData, setProductividadData] = useState<any[]>([]);
  const [segmentacionRiesgo, setSegmentacionRiesgo] = useState<any[]>([]);
  const [analisisRiesgo, setAnalisisRiesgo] = useState<any[]>([]);

  // Funciones auxiliares básicas
  const addToast = (message: string, type = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast("Copiado", "success");
  };

  const loadJsPDF = async () => { return { jsPDF: (await import('jspdf')).default, autoTable: (await import('jspdf-autotable')).default }; };
  const loadXLSX = async () => { return await import('xlsx'); };
  const checkPermissions = async () => {
    if (window.api && window.api.hasWritePermissions) {
      try {
        const canWrite = await window.api.hasWritePermissions();
        setHasWritePermissions(canWrite);
      } catch {
        setHasWritePermissions(false);
      }
    } else {
      setHasWritePermissions(false);
    }
  }; 
  const registrarGestion = async (g: any) => { setAllGestiones(prev => [g, ...prev]); };

  const tabsConfig = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "gestion", label: "Gestión", icon: "📋" },
    { id: "reportes", label: "Reportes", icon: "📑" },
    { id: "crm", label: "CRM", icon: "🤝" },
    { id: "analisis", label: "Análisis", icon: "📈" },
    { id: "alertas", label: "Alertas", icon: "🚨" },
    { id: "tendencias", label: "Tendencias", icon: "📉" },
    { id: "cuentas", label: "Cuentas", icon: "💰" },
    { id: "config", label: "Configuración", icon: "⚙️" }
  ];

  // Variables derivadas restauradas
  const clientesConVencidos = useMemo(() => Array.from(new Set(docs.filter(d => (d.dias_vencidos || 0) > 0).map(d => d.cliente))), [docs]);
  const todosDocsVencidos = useMemo(() => docs.filter(d => (d.dias_vencidos || 0) > 0), [docs]);
  const docsVencidosCliente = useMemo(() => (!selectedCliente || selectedCliente === "Todos") ? [] : todosDocsVencidos.filter(d => d.razon_social === selectedCliente || d.cliente === selectedCliente), [todosDocsVencidos, selectedCliente]);
  const totalVencidoCliente = useMemo(() => docsVencidosCliente.reduce((sum, d) => sum + d.total, 0), [docsVencidosCliente]);
  const gestionesFiltradasPorFecha = useMemo(() => {
    let gestiones = allGestiones;
    if (filtroFechaDesde) {
      gestiones = gestiones.filter(g => g.fecha && g.fecha >= filtroFechaDesde);
    }
    if (filtroFechaHasta) {
      const hasta = filtroFechaHasta.length === 10 ? filtroFechaHasta + 'T23:59:59' : filtroFechaHasta;
      gestiones = gestiones.filter(g => g.fecha && g.fecha <= hasta);
    }
    return gestiones;
  }, [allGestiones, filtroFechaDesde, filtroFechaHasta]);
  const clientesUnicos = useMemo(() => (selectedCliente && selectedCliente !== "Todos") ? [selectedCliente] : clientesConVencidos, [clientesConVencidos, selectedCliente]);
  const filteredGestiones = useMemo(() => allGestiones, [allGestiones]);

  // Effect para detectar tamaño de pantalla
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Effect para cargar configuración remota (IP local, etc)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        const config = await response.json();
        if (config.ok && config.remoteUrl) {
          console.log(`📡 URL remota desde servidor: ${config.remoteUrl}`);
          setRemoteUrl(config.remoteUrl);
        }
      } catch (error) {
        console.log("Error cargando configuración remota:", error);
      }
    };
    
    fetchConfig();
    // Cargar configuración cada 30 segundos en caso de cambios de IP
    const interval = setInterval(fetchConfig, 30000);
    return () => clearInterval(interval);
  }, []);

  // Effect para detectar cambios de IP automáticamente
  useEffect(() => {
    const ipCheckInterval = setInterval(async () => {
      if (!window.api?.getGitRemoteUrl) return;
      try {
        const result = await window.api.getGitRemoteUrl();
        if (result.ok && result.url && result.url !== repoUrl) {
          // La IP cambió - actualizar
          console.log(`📡 IP local actualizada: ${repoUrl} -> ${result.url}`);
          setRepoUrl(result.url);
          // addToast(`🔄 IP actualizada: ${result.url}`, "info", 5000); // Desactivado: ya hay indicador visual
        }
      } catch (error) {
        console.error("Error verificando IP:", error);
      }
    }, 30000);

    checkPermissions();
    console.log('[DEBUG] Llamando cargarDatos() al montar App');
    cargarDatos();
    
    // Log para depuración de gestiones
    setTimeout(() => {
      console.log('[DEBUG] allGestiones:', allGestiones);
    }, 3000);
    // Cargar URL remota (ngrok) al iniciar
    if (!isWeb && window.api?.getRemoteUrl) {
      (async () => {
        try {
          const result = await window.api.getRemoteUrl();
          if (result.ok && result.url) {
            setRemoteUrl(result.url);
            setRemoteUrlHealthy(true);
          }
        } catch (error) {
          console.error("Error cargando URL remota:", error);
        }
      })();
    }
    return () => clearInterval(ipCheckInterval);
  }, []);

  async function cargarDatos() {
    if (!window.api) return;
    try {
      const [empData, statsData, filtros, top, gestionesData, alertasData, tendData, cuentasData, abonosData] = await Promise.all([
        window.api.empresaObtener(),
        window.api.statsObtener(),
        window.api.filtrosListar(),
        window.api.topClientes(),
        window.api.gestionesListar(),
        window.api.alertasIncumplimiento(),
        window.api.tendenciasHistoricas(),
        window.api.cuentasAplicarListar(),
        window.api.abonosListar()
      ]);

      if (empData) setEmpresa(empData);
      if (statsData) setStats(statsData);
      if (top) setTopClientes(top);
      if (gestionesData) {
          setAllGestiones(gestionesData);
          setPromesas(gestionesData.filter((g: any) => g.resultado?.includes('Promesa')));
      }
      if (alertasData) setAlertas(alertasData);
      if (tendData) setTendencias(tendData);
      if (cuentasData) setCuentasAplicar(cuentasData);
      if (abonosData) setAbonos(abonosData);

      // Cargar documentos iniciales
      const docsResult = await window.api.documentosListar({});
      if (docsResult?.rows) setDocs(docsResult.rows);

      // Obtener URL del repositorio remoto Git
      if (window.api.getGitRemoteUrl) {
        try {
          const remoteUrl = await window.api.getGitRemoteUrl();
          if (remoteUrl?.url) setRepoUrl(remoteUrl.url);
        } catch (e) {
          console.log("No se pudo obtener URL remoto:", e);
        }
      }
    } catch (e) {
      console.error("Error cargando datos:", e);
    }
  }

  // Funciones de filtrado optimizadas con useMemo
  const filteredDocumentos = useMemo(() => 
    docs.filter(d => {
      const search = searchDocumentos.toLowerCase();
      const matchSearch = !search || 
        (d.cliente && d.cliente.toLowerCase().includes(search)) || 
        (d.razon_social && d.razon_social.toLowerCase().includes(search)) || 
        (d.documento && d.documento.toLowerCase().includes(search));
      
      const matchCliente = !selectedCliente || selectedCliente === "Todos" || d.razon_social === selectedCliente || d.cliente === selectedCliente;
      const matchVendedor = !selectedVendedor || selectedVendedor === "Todos" || d.vendedor === selectedVendedor;
      const matchCentro = filtroCentroCosto === "Todos" || d.centro_costo === filtroCentroCosto;
      
      let matchAging = true;
      if (filtroAging !== "Todos") {
          const dias = d.dias_vencidos || 0;
          if (filtroAging === "Vencidos") matchAging = dias > 0;
          else if (filtroAging === "Por vencer") matchAging = dias <= 0;
          else if (filtroAging === "30") matchAging = dias > 0 && dias <= 30;
          else if (filtroAging === "60") matchAging = dias > 30 && dias <= 60;
          else if (filtroAging === "90") matchAging = dias > 60 && dias <= 90;
          else if (filtroAging === "120") matchAging = dias > 90 && dias <= 120;
          else if (filtroAging === "+120") matchAging = dias > 120;
      }

      return matchSearch && matchCliente && matchVendedor && matchCentro && matchAging;
    }),
    [docs, searchDocumentos, selectedCliente, selectedVendedor, filtroCentroCosto, filtroAging]
  );

  // Datos derivados para Gestión (Memoizados para rendimiento)

  // Paginación para Reportes
  // Eliminado: paginatedDocumentos y paginación no se usan

  const filteredAlertas = useMemo(() => alertas.filter((a: Alerta) => {
      const search = searchAlertas.toLowerCase();
      const matchSearch = !search || a.cliente.toLowerCase().includes(search) || a.documento.toLowerCase().includes(search);
      const matchSeveridad = filtroSeveridad === "Todos" || a.severidad === filtroSeveridad;
      return matchSearch && matchSeveridad;
    }),
    [alertas, searchAlertas, filtroSeveridad]
  );

  // NUEVOS CÁLCULOS BASADOS EN IMPORTACIÓN

  // 3. Eficiencia de Cobranza Real (MOVER ARRIBA para que esté disponible en renderContent)
  const eficienciaCobranza = useMemo(() => {
    const safeDocs = docs || [];
    const totalEmitido = safeDocs.reduce((sum, d) => sum + (d?.valor_documento || 0), 0);
    const totalCobrado = safeDocs.reduce((sum, d) => sum + ((d?.valor_documento || 0) - (d?.total || 0)), 0);
    const totalPendiente = safeDocs.reduce((sum, d) => sum + (d?.total || 0), 0);
    // DSO = (Saldo Total / Ventas últimos 90 días) × 90
    // Aproximación: usar total emitido como ventas
    const dsoReal = totalEmitido > 0 ? Math.round((totalPendiente / totalEmitido) * 90) : 0;
    const porcentajeCobrado = totalEmitido > 0 ? (totalCobrado / totalEmitido) * 100 : 0;
    return {
      totalEmitido,
      totalCobrado,
      totalPendiente,
      porcentajeCobrado,
      dsoReal
    };
  }, [docs]);

  // 1. Proyección de Vencimientos (próximos 7 y 30 días)
  const vencimientosProximos = useMemo(() => {
    const hoy = new Date();
    const en7Dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
    const en30Dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
    const vencen7Dias = (docs || []).filter(d => {
      if (!d || !d.fecha_vencimiento || d.total <= 0) return false;
      const fvenc = new Date(d.fecha_vencimiento);
      return fvenc >= hoy && fvenc <= en7Dias && d.por_vencer > 0;
    });
    const vencen30Dias = (docs || []).filter(d => {
      if (!d || !d.fecha_vencimiento || d.total <= 0) return false;
      const fvenc = new Date(d.fecha_vencimiento);
      return fvenc >= hoy && fvenc <= en30Dias && d.por_vencer > 0;
    });
    return {
      dias7: vencen7Dias,
      monto7: vencen7Dias.reduce((sum, d) => sum + (d.por_vencer || 0), 0),
      dias30: vencen30Dias,
      monto30: vencen30Dias.reduce((sum, d) => sum + (d.por_vencer || 0), 0),
      docs7: vencen7Dias.length,
      docs30: vencen30Dias.length
    };
  }, [docs]);

  // 2. Análisis de Retenciones
  const analisisRetenciones = useMemo(() => {
    const safeDocs = docs || [];
    const totalRetenido = safeDocs.reduce((sum, d) => sum + (d?.retenciones || 0), 0);
    const docsConRetencion = safeDocs.filter(d => d && (d.retenciones || 0) > 0);
    return {
      totalRetenido,
      cantidadDocs: docsConRetencion.length,
      promedioPorDoc: docsConRetencion.length > 0 ? totalRetenido / docsConRetencion.length : 0,
      detalles: docsConRetencion.map(d => ({
        documento: d.documento,
        cliente: d.razon_social || d.cliente,
        monto: d.retenciones || 0,
        total: d.total
      }))
    };
  }, [docs]);

  // 4. Análisis por Vendedor
  const analisisPorVendedor = useMemo(() => {
    const vendedorMap = new Map<string, {
      vendedor: string;
      totalFacturado: number;
      totalCobrado: number;
      totalPendiente: number;
      totalVencido: number;
      documentos: number;
      clientes: Set<string>;
    }>();
    
    (docs || []).forEach(d => {
      if (!d) return;
      const vendedor = d.vendedor || 'Sin Vendedor';
      if (!vendedorMap.has(vendedor)) {
        vendedorMap.set(vendedor, {
          vendedor,
          totalFacturado: 0,
          totalCobrado: 0,
          totalPendiente: 0,
          totalVencido: 0,
          documentos: 0,
          clientes: new Set<string>()
        });
      }
      
      const v = vendedorMap.get(vendedor)!;
      v.totalFacturado += (d.valor_documento || 0);
      v.totalCobrado += ((d.valor_documento || 0) - (d.total || 0));
      v.totalPendiente += (d.total || 0);
      
      if ((d.dias_vencidos || 0) > 0) {
        v.totalVencido += (d.total || 0);
      }
      v.documentos++;
      v.clientes.add(d.cliente);
    });
    
    return Array.from(vendedorMap.values()).map(v => ({
      ...v,
      cantidadClientes: v.clientes.size,
      porcentajeMorosidad: v.totalPendiente > 0 ? (v.totalVencido / v.totalPendiente) * 100 : 0,
      porcentajeCobrado: v.totalFacturado > 0 ? (v.totalCobrado / v.totalFacturado) * 100 : 0
    })).sort((a, b) => b.totalPendiente - a.totalPendiente);
  }, [docs]);

  // 5. Top Deudores Crónicos
  const deudoresCronicos = useMemo(() => {
    const clienteMap = new Map<string, {
      cliente: string;
      razon_social: string;
      totalDeuda: number;
      totalVencido: number;
      documentosVencidos: number;
      dias_promedio: number;
      vendedor: string;
    }>();
    
    (docs || []).forEach(d => {
      if (!d) return;
      const dias = d.dias_vencidos || 0;
      
      if (dias > 0) {
        if (!clienteMap.has(d.cliente)) {
          clienteMap.set(d.cliente, {
            cliente: d.cliente,
            razon_social: d.razon_social || d.cliente,
            totalDeuda: 0,
            totalVencido: 0,
            documentosVencidos: 0,
            dias_promedio: 0,
            vendedor: d.vendedor || 'N/A'
          });
        }
        
        const c = clienteMap.get(d.cliente)!;
        c.totalDeuda += (d.total || 0);
        c.totalVencido += (d.total || 0);
        c.documentosVencidos++;
        
        // Calcular días promedio ponderado
        if (dias > 90) {
          c.dias_promedio = Math.max(c.dias_promedio, dias);
        }
      }
    });
    
    return Array.from(clienteMap.values())
      .filter(c => c.dias_promedio >= 90) // Solo clientes con mora >90 días
      .sort((a, b) => b.totalVencido - a.totalVencido)
      .slice(0, 20); // Top 20
  }, [docs]);

  // 6. Extraer centros de costo únicos
  useEffect(() => {
    const centros = Array.from(new Set((docs || []).map(d => d?.centro_costo).filter(Boolean))).sort();
    setCentrosCosto(centros as string[]);
  }, [docs]);

  const cargarDocumentos = useCallback(async () => {
    if (isWeb) return;
    try {
      const result = await window.api.documentosListar({
        cliente: selectedCliente || undefined,
        vendedor: selectedVendedor || undefined
      });
      const resultTyped = result as { ok?: boolean; rows?: unknown[] };
      if (resultTyped?.rows) setDocs(resultTyped.rows as unknown as Documento[]);
    } catch (e) {
      console.error("Error cargando documentos:", e);
    }
  }, [selectedCliente, selectedVendedor]);

  const cargarGestiones = useCallback(async (selectedCliente: string) => {
    if (isWeb || !selectedCliente) return;
    try {
      const data = await window.api.gestionesListar(selectedCliente);
      if (data) setGestiones(data as Gestion[]);
    } catch (e) {
      console.error("Error cargando gestiones:", e);
    }
  }, []);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  useEffect(() => {
    if (selectedCliente) cargarGestiones(selectedCliente);
  }, [cargarGestiones, selectedCliente]);

  async function guardarGestion() {
    if (isWeb || !selectedCliente) return;
    try {
      // Construir la nueva gestión igual que registrarGestion
      const nuevaGestion = {
        id: Date.now(),
        cliente: selectedCliente,
        razon_social: selectedCliente,
        fecha: new Date().toISOString(),
        ...gestionForm
      };
      setAllGestiones(prev => [nuevaGestion, ...prev]);
      await window.api.gestionGuardar({
        cliente: selectedCliente,
        ...gestionForm
      });
      setShowModalGestion(false);
      setGestionForm({
        tipo: "Llamada",
        resultado: "Contactado",
        observacion: "",
        motivo: "",
        fecha_promesa: "",
        monto_promesa: 0
      });
      addToast("Gestión guardada exitosamente", "success");
      if (typeof cargarGestiones === "function") {
        await cargarGestiones(selectedCliente);
      }
      await cargarDatos();
    } catch (e) {
      addToast("Error guardando gestión", "error");
      console.error("Error guardando gestión:", e);
    }
  }

  async function eliminarGestion(id: number) {
    if (isWeb) return;
    try {
      await window.api.gestionEliminar(id);
      addToast("Gestión eliminada", "success");
      await cargarGestiones(selectedCliente);
      await cargarDatos();
    } catch (e) {
      addToast("Error eliminando gestión", "error");
      console.error("Error eliminando gestión:", e);
    }
  }

  async function cumplirPromesa(id: number) {
    if (isWeb) return;
    try {
      await window.api.gestionCumplir(id);
      addToast("Promesa cumplida", "success");
      await cargarDatos();
    } catch (e) {
      addToast("Error cumpliendo promesa", "error");
      console.error("Error cumpliendo promesa:", e);
    }
  }

  async function guardarEmpresa() {
    if (isWeb) return;
    try {
      await window.api.empresaGuardar(empresa);
      setShowModalEmpresa(false);
      addToast("Datos de empresa guardados", "success");
      await cargarDatos();
    } catch (e) {
      addToast("Error guardando empresa", "error");
      console.error("Error guardando empresa:", e);
    }
  }

  async function importarExcel() {
    if (isWeb) return;
    try {
      const result = await window.api.importarContifico();
      const resultTyped = result as { ok?: boolean; insertedDocs?: number; message?: string };
      if (resultTyped?.ok) {
        addToast(`Importación exitosa: ${resultTyped.insertedDocs} documentos`, "success");
        await cargarDatos();
        await cargarDocumentos();
      } else {
        const errorMsg = resultTyped?.message || "Error desconocido";
        addToast("Error en importación: " + errorMsg, "error", 6000);
        console.error("Error importando (backend):", errorMsg);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      addToast("Error importando Excel: " + errorMsg, "error", 6000);
      console.error("Error importando (frontend):", e);
    }
  }

  async function exportarBackup() {
    if (isWeb) {
      addToast("Esta función solo está disponible en la versión de escritorio", "info");
      return;
    }
    try {
      const result = await window.api.exportarBackup();
      if (result.ok) {
        addToast("Respaldo exportado correctamente", "success");
      } else {
        addToast("Error: " + result.message, "error");
      }
    } catch (e) {
      console.error(e);
      addToast("Error al exportar respaldo", "error");
    }
  }

  async function cambiarLogo() {
    if (isWeb) {
      addToast("Solo disponible en la versión de escritorio", "info");
      return;
    }
    try {
      const result = await window.api.cambiarLogo();
      if (result.ok) {
        addToast("Logotipo actualizado correctamente", "success");
        // Actualizar estado local inmediatamente
        setEmpresa(prev => ({ ...prev, logo: result.logo }));
      }
      else if (result.message !== "Cancelado") addToast("Error: " + result.message, "error");
    } catch (e) {
      console.error(e);
    }
  }

  const agingData = useMemo(() => {
    if (!stats?.aging) return null;
    // Calcular acumulado para >240 días (sumando todos los rangos posteriores)
    const mas240 = (stats.aging.d270 || 0) + (stats.aging.d300 || 0) + (stats.aging.d330 || 0) + (stats.aging.d360 || 0) + (stats.aging.d360p || 0);

    return [
      { name: "Por Vencer", saldo: stats.aging.porVencer || 0, fill: "#10b981" },
      { name: "30", saldo: stats.aging.d30 || 0, fill: "#3b82f6" },
      { name: "60", saldo: stats.aging.d60 || 0, fill: "#f59e0b" },
      { name: "90", saldo: stats.aging.d90 || 0, fill: "#ef4444" },
      { name: "120", saldo: stats.aging.d120 || 0, fill: "#dc2626" },
      { name: "150", saldo: stats.aging.d150 || 0, fill: "#b91c1c" },
      { name: "180", saldo: stats.aging.d180 || 0, fill: "#991b1b" },
      { name: "210", saldo: stats.aging.d210 || 0, fill: "#7f1d1d" },
      { name: "240", saldo: stats.aging.d240 || 0, fill: "#6b1515" },
      { name: ">240", saldo: mas240, fill: "#5c0e0e" }
    ];
  }, [stats]);

  const topClientesData = useMemo(() => {
    if (!topClientes.length) return null;
    
    // Función para interpolar entre verde (bajo saldo) y rojo (alto saldo)
    const interpolateColor = (percentage: number): string => {
      // Verde: rgb(34, 197, 94), Rojo: rgb(239, 68, 68)
      const green = [34, 197, 94];
      const red = [239, 68, 68];
      
      // Clamp percentage entre 0 y 1
      const p = Math.max(0, Math.min(1, percentage));
      
      const r = Math.round(green[0] + (red[0] - green[0]) * p);
      const g = Math.round(green[1] + (red[1] - green[1]) * p);
      const b = Math.round(green[2] + (red[2] - green[2]) * p);
      
      return `rgb(${r}, ${g}, ${b})`;
    };
    
    // Encontrar el máximo saldo para calcular porcentajes
    const maxTotal = Math.max(...topClientes.map(c => c.total || 0));
    
    // Retornar datos en formato Recharts con color
    return topClientes.map(c => {
      const percentage = maxTotal > 0 ? (c.total || 0) / maxTotal : 0;
      const color = interpolateColor(percentage);
      return {
        name: c.razon_social?.substring(0, 18) || 'Cliente',
        saldo: c.total || 0,
        fill: color
      };
    });
  }, [topClientes]);

  // Renderizado condicional por tab
  function renderContent() {
    const gridTwoCol = {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '16px',
      alignItems: 'stretch'
    };

    if (tab === "dashboard") {
      return (
        <div style={{ 
          width: '100%', 
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          
          {/* FILA 1: 6 KPIs ULTRA COMPACTOS - MÁS GRANDES */}
          <div style={{ 
            flex: '0 0 auto',
            display: 'grid', 
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
            gap: '12px',
          }}>
            <div className="card" style={{ padding: '12px 8px', minHeight: 90, textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.75rem)', color: 'rgba(255,255,255,0.85)', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap' }}>CARTERA TOTAL</div>
              <div style={{ fontSize: 'clamp(1rem, 1.6vw, 1.5rem)', fontWeight: 'bold', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap' }}>{fmtMoney(stats?.totalSaldo || 0)}</div>
              <div style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.7rem)', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Saldo total pendiente</div>
            </div>
            <div className="card" style={{ padding: '12px 8px', minHeight: 90, textAlign: 'center', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.75rem)', color: 'rgba(255,255,255,0.85)', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap' }}>VENCIDO</div>
              <div style={{ fontSize: 'clamp(1rem, 1.6vw, 1.5rem)', fontWeight: 'bold', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap' }}>{fmtMoney(stats?.vencidaSaldo || 0)}</div>
              <div style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.7rem)', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Monto de facturas vencidas</div>
            </div>
            <div className="card" style={{ padding: '12px 8px', minHeight: 90, textAlign: 'center', background: stats && stats.npl > 30 ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' : 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.75rem)', color: 'rgba(255,255,255,0.85)', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap' }}>NPL</div>
              <div style={{ fontSize: 'clamp(1rem, 1.6vw, 1.5rem)', fontWeight: 'bold', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap' }}>{stats?.npl?.toFixed(1)}%</div>
              <div style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.7rem)', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Morosidad sobre cartera total</div>
            </div>
            <div className="card" style={{ padding: '12px 8px', minHeight: 90, textAlign: 'center', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.75rem)', color: 'rgba(255,255,255,0.85)', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap' }}>DSO DÍAS</div>
              <div style={{ fontSize: 'clamp(1rem, 1.6vw, 1.5rem)', fontWeight: 'bold', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap' }}>{eficienciaCobranza.dsoReal}</div>
              <div style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.7rem)', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Días promedio de cobro</div>
            </div>
            <div className="card" style={{ padding: '12px 8px', minHeight: 90, textAlign: 'center', background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.75rem)', color: 'rgba(255,255,255,0.85)', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap' }}>CLIENTES</div>
              <div style={{ fontSize: 'clamp(1rem, 1.6vw, 1.5rem)', fontWeight: 'bold', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap' }}>{stats?.clientesConSaldo || 0}</div>
              <div style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.7rem)', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Clientes con saldo activo</div>
            </div>
            <div className="card" style={{ padding: '12px 8px', minHeight: 90, textAlign: 'center', background: 'linear-gradient(135deg, #fa8bff 0%, #2bd2ff 90%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.75rem)', color: 'rgba(255,255,255,0.85)', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap' }}>% COBRADO</div>
              <div style={{ fontSize: 'clamp(1rem, 1.6vw, 1.5rem)', fontWeight: 'bold', color: '#fff', marginBottom: '2px', whiteSpace: 'nowrap' }}>{eficienciaCobranza.porcentajeCobrado.toFixed(1)}%</div>
              <div style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.7rem)', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Porcentaje cobrado este mes</div>
            </div>
          </div>


          {/* FILA 2: 6 KPIs SECUNDARIOS */}
          <div style={{ 
            flex: '0 0 auto',
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px'
          }}>
            <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>DOCS</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{stats?.docsPendientes || 0}</div>
            </div>
            <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>VENCE 7D</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f59e0b' }}>{fmtMoneyCompact(vencimientosProximos.monto7)}</div>
            </div>
            <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>VENCE 30D</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f97316' }}>{fmtMoneyCompact(vencimientosProximos.monto30)}</div>
            </div>
            <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>RETENCIONES</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{fmtMoney(analisisRetenciones.totalRetenido)}</div>
            </div>
            <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>COBRADO MES</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#10b981' }}>{fmtMoney(stats?.totalCobrado || 0)}</div>
            </div>
            <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>CRÓNICOS</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ef4444' }}>{deudoresCronicos.length}</div>
            </div>
          </div>

          {/* FILA 3: 4 GRÁFICOS HORIZONTALES - BARRAS MUY FINAS Y COMPACTAS */}
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
              height: '100%',
              alignItems: 'stretch',
            }}>
            
            {/* AGING - BARRAS HORIZONTALES FINAS */}
            <div className="card" style={{ padding: '10px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <RankingList
                title="Aging de Cartera"
                items={Array.isArray(agingData) ? agingData.map((a) => ({
                  label: a.name,
                  value: a.saldo,
                  color: a.fill
                })) : []}
                valuePrefix={''}
                valueSuffix={''}
                maxItems={10}
                barColor="#10b981"
                decimals={2}
              />
            </div>

            {/* TOP CLIENTES - BARRAS FINAS */}
            <div className="card" style={{ padding: '10px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <RankingList
                title="Top Clientes"
                items={Array.isArray(topClientesData) ? topClientesData.slice(0, 10).map((c) => ({
                  label: c.name,
                  value: c.saldo,
                  color: c.fill
                })) : []}
                valuePrefix={''}
                valueSuffix={''}
                maxItems={10}
                barColor="#a855f7"
                decimals={2}
              />
            </div>

            {/* VENDEDORES - BARRAS FINAS */}
            <div className="card" style={{ padding: '10px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <RankingList
                title="Por Vendedor"
                items={Array.isArray(analisisPorVendedor) ? analisisPorVendedor.slice(0, 10).map((v) => ({
                  label: v.vendedor,
                  value: v.totalPendiente,
                  color: v.porcentajeMorosidad > 30 ? '#ef4444' : v.porcentajeMorosidad > 15 ? '#f59e0b' : '#3b82f6'
                })) : []}
                valuePrefix={''}
                valueSuffix={''}
                maxItems={10}
                barColor="#3b82f6"
                decimals={2}
              />
            </div>

            {/* DEUDORES CRÓNICOS - BARRAS FINAS */}
            <div className="card" style={{ padding: '10px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <RankingList
                title="Deudores Crónicos"
                items={Array.isArray(deudoresCronicos) ? deudoresCronicos.slice(0, 10).map((d) => ({
                  label: d.cliente,
                  value: d.totalVencido,
                  color: '#dc2626'
                })) : []}
                valuePrefix={''}
                valueSuffix={''}
                maxItems={10}
                barColor="#dc2626"
                decimals={2}
              />
            </div>


            </div>
          </div>

        </div>
      );
    }

    if (tab === "gestion") {
      // VISTA FUSIONADA COMPLETA: Gestión + Estados de Cuenta
      
      // KPIs globales
      const totalVencidoSistema = todosDocsVencidos.reduce((s, d) => s + d.total, 0);
      
      // Calcular gestiones de hoy
      const hoy = new Date().toISOString().split('T')[0];
      const gestionesHoy = gestiones.filter(g => g.fecha && g.fecha.startsWith(hoy)).length;
      
      // PDFs generados (placeholder - requiere tracking)
      const pdfsGenerados = 0;
      
      // Función para exportar PDF
      const exportarEstadoDeCuenta = async (clienteNombre: string) => {
        if (!clienteNombre || clienteNombre === "Todos") {
          addToast("Selecciona un cliente específico para generar su estado de cuenta", "info");
          return;
        }
        
        // Obtener SOLO documentos VENCIDOS con saldo del cliente
        const docsCliente = docs.filter(d => 
          (d.razon_social === clienteNombre || d.cliente === clienteNombre) && 
          (d.saldo || d.total) > 0.01 &&
          (d.dias_vencidos || 0) > 0
        ).sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());

        if (docsCliente.length === 0) {
          addToast("Este cliente no tiene documentos vencidos", "info");
          return;
        }

        const totalDeuda = docsCliente.reduce((sum, d) => sum + d.total, 0);
        const totalVencido = docsCliente.filter(d => (d.dias_vencidos || 0) > 0).reduce((sum, d) => sum + d.total, 0);
        const totalPorVencer = totalDeuda - totalVencido;
        
        try {
          const { jsPDF, autoTable } = await loadJsPDF();
          const doc = new jsPDF();
          const pageWidth = doc.internal.pageSize.getWidth();
          const margin = 15;
          // --- CABECERA MODERNA ---
          doc.setFillColor(248, 250, 252); // Slate 50
          doc.rect(0, 0, pageWidth, 55, 'F');
          if (empresa.logo) {
            try {
              doc.addImage(empresa.logo, 'PNG', margin, 10, 25, 25, undefined, 'FAST');
            } catch (e) { console.warn("Error cargando logo", e); }
          }
          doc.setFontSize(16);
          doc.setTextColor(30, 41, 59); // Slate 800
          doc.setFont("helvetica", "bold");
          const titleX = empresa.logo ? margin + 35 : margin;
          doc.text(empresa.nombre || "Mi Empresa", titleX, 18);
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105); // Slate 600
          let yPos = 24;
          if (empresa.ruc) { doc.text(`RUC: ${empresa.ruc}`, titleX, yPos); yPos += 5; }
          if (empresa.email) { doc.text(empresa.email, titleX, yPos); yPos += 5; }
          if (empresa.telefono) { doc.text(empresa.telefono, titleX, yPos); }
          doc.setFontSize(22);
          doc.setTextColor(37, 99, 235); // Blue 600
          doc.setFont("helvetica", "bold");
          doc.text("ESTADO DE CUENTA", pageWidth - margin, 20, { align: 'right' });
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139); // Slate 500
          doc.setFont("helvetica", "normal");
          doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin, 30, { align: 'right' });
          if (empresa.administrador) {
            doc.text(`Responsable: ${empresa.administrador}`, pageWidth - margin, 35, { align: 'right' });
          }
          // --- INFORMACIÓN DEL CLIENTE ---
          const startYInfo = 65;
          doc.setDrawColor(226, 232, 240);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(margin, startYInfo, pageWidth - (margin * 2), 25, 2, 2, 'FD');
          doc.setFontSize(9);
          doc.setTextColor(148, 163, 184); // Slate 400
          doc.text("CLIENTE", margin + 6, startYInfo + 8);
          doc.setFontSize(12);
          doc.setTextColor(15, 23, 42); // Slate 900
          doc.setFont("helvetica", "bold");
          doc.text(clienteNombre, margin + 6, startYInfo + 17);
          // --- KPIs ---
          const startYKpi = startYInfo + 35;
          const kpiWidth = (pageWidth - (margin * 2) - 10) / 3;
          const drawKpi = (x: number, label: string, value: number, color: [number, number, number]) => {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(x, startYKpi, kpiWidth, 22, 2, 2, 'FD');
            doc.setFillColor(...color);
            doc.rect(x, startYKpi, 3, 22, 'F'); // Barra lateral
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "normal");
            doc.text(label, x + 8, startYKpi + 8);
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.text(fmtMoney(value), x + 8, startYKpi + 17);
          };
          drawKpi(margin, "TOTAL DEUDA", totalDeuda, [59, 130, 246]);
          drawKpi(margin + kpiWidth + 5, "VENCIDO", totalVencido, [239, 68, 68]);
          drawKpi(margin + (kpiWidth + 5) * 2, "POR VENCER", totalPorVencer, [16, 185, 129]);
          // --- TABLA ---
          const tableData = docsCliente.map(d => {
            const dias = d.dias_vencidos || 0;
            return [
              d.documento || d.numero,
              d.fecha_emision,
              d.fecha_vencimiento,
              dias > 0 ? `${dias} días` : 'Vigente',
              fmtMoney(d.total)
            ];
          });
          autoTable(doc, {
            head: [['Documento', 'Emisión', 'Vencimiento', 'Estado', 'Saldo']],
            body: tableData,
            startY: startYKpi + 32
          });
          doc.save(`Estado_Cuenta_${clienteNombre.replace(/[^a-z0-9]/gi, '_')}.pdf`);
          addToast("Estado de cuenta generado", "success");
          // Registrar gestión automática de PDF
          registrarGestion({
            cliente: clienteNombre,
            tipo: "PDF",
            resultado: "Generado",
            observacion: "Estado de cuenta generado en PDF",
          });
        } catch (e) {
          console.error(e);
          addToast("Error generando PDF", "error");
        }
      };

      const enviarEmail = (clienteNombre: string) => {
        const empresaNombre = empresa?.nombre || "[Nombre Empresa]";
        const fechaHoy = new Date().toLocaleDateString();
        const docsCliente = todosDocsVencidos.filter(d => (d.razon_social === clienteNombre || d.cliente === clienteNombre));
        const totalCliente = docsCliente.reduce((sum, d) => sum + d.total, 0);
        
        const asunto = `Estado de Cuenta - ${empresaNombre}`;
        const lineas = [
          `Estimado cliente *${clienteNombre}*,`,
          '',
          `Adjunto el estado de cuenta al ${fechaHoy}.`,
          `Total Vencido: ${fmtMoney(totalCliente)}`,
          '',
          'Saludos cordiales.'
        ];
        const cuerpo = encodeURIComponent(lineas.join('\r\n'));
        window.open(`mailto:?subject=${asunto}&body=${cuerpo}`, '_blank');

        // Registrar gestión automática de Email
        registrarGestion({
          cliente: clienteNombre,
          tipo: "Email",
          resultado: "Enviado",
          observacion: "Recordatorio de pago enviado por correo",
        });
        addToast("Gestión de Email registrada", "success");
      };

      // Función para generar Reporte de Gestión (Evidencia)
      const exportarReporteGestion = async () => {
        // Filtrar gestiones por fecha si hay filtro
        let gestionesFiltradas = filteredGestiones;
        if (filtroFechaDesde) {
          gestionesFiltradas = gestionesFiltradas.filter(g => g.fecha && g.fecha >= filtroFechaDesde);
        }
        if (filtroFechaHasta) {
          // Incluir todo el día hasta 23:59:59
          const hasta = filtroFechaHasta.length === 10 ? filtroFechaHasta + 'T23:59:59' : filtroFechaHasta;
          gestionesFiltradas = gestionesFiltradas.filter(g => g.fecha && g.fecha <= hasta);
        }
        if (gestionesFiltradas.length === 0) {
          addToast("No hay gestiones para reportar en el rango seleccionado", "info");
          return;
        }
        try {
          const { jsPDF, autoTable } = await loadJsPDF();
          const doc = new jsPDF();

          // Header
          doc.setFillColor(241, 245, 249);
          doc.rect(0, 0, 210, 40, 'F');

          doc.setFontSize(18);
          doc.setTextColor(30, 41, 59);
          doc.text("REPORTE DE GESTIÓN DE COBRANZA", 14, 18);

          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(`Empresa: ${empresa.nombre || 'Mi Empresa'}`, 14, 26);
          doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, 14, 32);
          doc.text(`Alcance: ${selectedCliente === "Todos" || !selectedCliente ? "General (Todos los clientes)" : selectedCliente}`, 14, 38);

          // Construir filas detalladas (una por gestión) para el reporte
          const tableData = gestionesFiltradas.map(g => [
            g.razon_social || g.cliente,
            g.fecha ? g.fecha.replace('T', ' ').substring(0, 16) : '-',
            ['Llamada', 'Visita'].some(t => g.tipo.includes(t)) ? 'X' : '',
            g.tipo.includes('Email') ? 'X' : '',
            g.tipo.includes('WhatsApp') ? 'X' : '',
            g.tipo.includes('PDF') ? 'X' : '',
            g.resultado,
            g.observacion || '-',
            g.monto_promesa ? fmtMoney(g.monto_promesa) : '-'
          ]);

          autoTable(doc, {
            startY: 45,
            head: [['Cliente', 'Fecha', 'Telf', 'Mail', 'WApp', 'PDF', 'Resultado', 'Observación', 'Promesa']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
            headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', halign: 'center' },
            columnStyles: {
              0: { cellWidth: 40 }, // Cliente
              1: { cellWidth: 25 }, // Fecha
              2: { cellWidth: 10, halign: 'center' }, // Telf
              3: { cellWidth: 10, halign: 'center' }, // Mail
              4: { cellWidth: 10, halign: 'center' }, // WApp
              5: { cellWidth: 10, halign: 'center' }, // PDF
              6: { cellWidth: 25 }, // Resultado
              7: { cellWidth: 'auto' }, // Obs
              8: { cellWidth: 20, halign: 'right' } // Promesa
            },
            alternateRowStyles: { fillColor: [248, 250, 252] }
          });

          const safeName = (selectedCliente === "Todos" || !selectedCliente ? "General" : selectedCliente).replace(/[^a-z0-9]/gi, '_');
          doc.save(`Reporte_Gestion_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
          addToast("✅ Reporte de gestión generado", "success");
        } catch (e) {
          console.error(e);
          addToast("Error generando reporte", "error");
        }
      };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={gridTwoCol}>
          {/* KPIs de Gestión */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">📊 KPIs de Gestión</div>
            <div className="kpis-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div className="kpi-card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div className="kpi-title">Clientes con Vencidos</div>
                <div className="kpi-value">{clientesConVencidos.length}</div>
              </div>
              <div className="kpi-card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div className="kpi-title">Total por Gestionar</div>
                <div className="kpi-value kpi-negative">{fmtMoney(totalVencidoSistema)}</div>
              </div>
              <div className="kpi-card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div className="kpi-title">Contactados Hoy</div>
                <div className="kpi-value">{gestionesHoy}</div>
              </div>
              <div className="kpi-card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div className="kpi-title">PDFs Generados</div>
                <div className="kpi-value">{pdfsGenerados}</div>
              </div>
            </div>
          </div>
          
          {/* Filtros y Acciones */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">🔍 Filtros y Acciones</div>
            <div className="row">
              <label className="field">
                <span>Cliente</span>
                <select
                  value={selectedCliente}
                  onChange={e => {
                    const value = e.target.value;
                    if (value === 'Todos') {
                      setSelectedCliente('');
                    } else {
                      setSelectedCliente(value);
                    }
                  }}
                >
                  <option value="Todos">Todos</option>
                  {clientes.map(c => (
                    <option key={c.cliente || c.razon_social} value={c.cliente || c.razon_social}>
                      {c.razon_social || c.cliente}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Estado</span>
                <select value={filtroVistaGestion} onChange={e => setFiltroVistaGestion(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Con Vencidos">Con Vencidos</option>
                  <option value="Mayor Deuda">Mayor Deuda</option>
                  <option value="Más Días Vencidos">Más Días Vencidos</option>
                </select>
              </label>
            </div>
            
            <div className="flex-row" style={{ flexWrap: 'wrap' }}>
              <button className="btn secondary" onClick={() => addToast("Función de acción masiva en desarrollo", "info")} disabled={!hasWritePermissions}>
                📞 Acción Masiva
              </button>
              <button className="btn secondary" onClick={() => addToast("Función de envío masivo en desarrollo", "info")} disabled={!hasWritePermissions}>
                📧 Enviar Estados
              </button>
              <button className="btn primary" onClick={() => exportarEstadoDeCuenta(selectedCliente)} disabled={!selectedCliente || selectedCliente === "Todos"}>
                📥 PDF Estado de Cuenta
              </button>
            </div>
          </div>
          </div>
          
          {/* Tabla Checklist de Gestión */}
          <div className="card">
            <div className="card-title">📋 Tabla de Gestión - Clientes</div>
            <div className="table-wrapper">
              <div style={{overflowX: 'auto', width: '100%', padding: 0, margin: 0}}>
                <table className="data-table" style={{minWidth: 1100, width: '100%', tableLayout: 'fixed'}}>
                  <thead>
                    <tr>
                      <th style={{width: '40px'}}>✓</th>
                      <th>Cliente</th>
                      <th className="num">Vencido $</th>
                      <th>📞 Llamada</th>
                      <th className="text-center">📧 Email</th>
                      <th className="text-center">💬 WhatsApp</th>
                      <th className="text-center">📄 PDF</th>
                      <th>🎯 Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesUnicos.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{textAlign: 'center', color: '#9ca3af', padding: '20px'}}>
                          No se encontraron clientes con los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      [...clientesUnicos]
                        .map(cliente => {
                          const docsCliente = todosDocsVencidos.filter(d => d.razon_social === cliente || d.cliente === cliente);
                          const totalCliente = docsCliente.reduce((sum, d) => sum + d.total, 0);
                          return { cliente, docsCliente, totalCliente };
                        })
                        .sort((a, b) => b.totalCliente - a.totalCliente)
                        .map(({ cliente, docsCliente, totalCliente }) => {
                          const maxDias = docsCliente.length > 0 ? Math.max(...docsCliente.map(d => d.dias_vencidos || 0)) : 0;
                        
                        // Buscar historial
                        // Usar allGestiones para que el registro sea inmediato y consistente
                        const gestionesCliente = allGestiones.filter(g => (g.razon_social || g.cliente) === cliente);
                        const lastCall = gestionesCliente.find(g => g.tipo === 'Llamada' || g.tipo === 'Visita');
                        const lastEmail = gestionesCliente.find(g => g.tipo === 'Email');
                        const lastWhatsapp = gestionesCliente.find(g => g.tipo === 'WhatsApp');
                        const lastPdf = gestionesCliente.find(g => g.tipo === 'PDF');

                        const colorIndicador = maxDias > 90 ? '#ef4444' : maxDias > 60 ? '#f59e0b' : '#10b981';
                        const isSelected = selectedCliente === cliente;

                        return (
                          <tr
                            key={cliente}
                            style={{
                              borderLeft: `4px solid ${colorIndicador}`,
                              background: isSelected ? 'rgba(168, 85, 247, 0.10)' : undefined
                            }}
                          >
                            <td style={{textAlign: 'center', minWidth: 40}}>
                              <input
                                type="checkbox"
                                checked={clientesGestionados.includes(cliente)}
                                onChange={e => {
                                  setClientesGestionados(prev =>
                                    e.target.checked
                                      ? [...prev, cliente]
                                      : prev.filter(c => c !== cliente)
                                  );
                                }}
                              />
                            </td>
                            <td style={{maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                              <a href="#" style={{fontWeight: 700, color: '#7c3aed'}} onClick={(e) => { e.preventDefault(); setSelectedCliente(cliente); }}>{cliente}</a>
                            </td>
                            <td className="num" style={{minWidth: 100, textAlign: 'right', fontWeight: 600}}>{fmtMoney(totalCliente)}</td>
                            <td className="text-center">
                              {lastCall ? <><span style={{color:'#10b981'}}>✓</span> <span style={{fontSize:'0.8em',color:'#888'}}>{lastCall.fecha ? lastCall.fecha.replace('T',' ').substring(0,16) : ''}</span></> : '•'}
                            </td>
                            <td className="text-center">
                              {lastEmail ? <><span style={{color:'#3b82f6'}}>✓</span> <span style={{fontSize:'0.8em',color:'#888'}}>{lastEmail.fecha ? lastEmail.fecha.replace('T',' ').substring(0,16) : ''}</span></> : '•'}
                            </td>
                            <td className="text-center">
                              {lastWhatsapp ? <><span style={{color:'#22c55e'}}>✓</span> <span style={{fontSize:'0.8em',color:'#888'}}>{lastWhatsapp.fecha ? lastWhatsapp.fecha.replace('T',' ').substring(0,16) : ''}</span></> : '•'}
                            </td>
                            <td className="text-center">
                              {lastPdf ? <><span style={{color:'#6366f1'}}>✓</span> <span style={{fontSize:'0.8em',color:'#888'}}>{lastPdf.fecha ? lastPdf.fecha.replace('T',' ').substring(0,16) : ''}</span></> : '•'}
                            </td>
                            <td>
                              <button className="btn secondary" onClick={() => exportarEstadoDeCuenta(cliente)}>
                                📄 PDF
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {clientesConVencidos.length > 50 && (
              <p className="table-footnote">Mostrando 50 de {clientesConVencidos.length} clientes</p>
            )}
          </div>
          
          {/* Panel de Gestión Rápida (cuando se selecciona un cliente) */}
          {selectedCliente && selectedCliente !== "Todos" && (
            <div className="card">
              <div className="card-title">💬 Panel de Gestión Rápida - {selectedCliente}</div>
              <div className="flex-row" style={{ flexWrap: 'wrap' }}>
                <button className="btn secondary" onClick={() => setShowModalGestion(true)} disabled={!hasWritePermissions}>
                  📞 Registrar Llamada
                </button>
                <button className="btn secondary" onClick={() => enviarEmail(selectedCliente)}>
                  📧 Enviar Email
                </button>
                <button
                  className="btn secondary"
                  onClick={async () => {
                    const empresaNombre = empresa?.nombre || "[Nombre de tu Empresa]";
                    const fechaHoy = new Date().toLocaleDateString();
                    const docsCliente = todosDocsVencidos.filter(d => (d.razon_social === selectedCliente || d.cliente === selectedCliente));
                    const totalCliente = docsCliente.reduce((sum, d) => sum + d.total, 0);
                    const lineas = [
                      `Hola *${selectedCliente}*,`,
                      '',
                      `Te saluda el Departamento de Cobranzas de *${empresaNombre}*.`,
                      '',
                      `*Recordatorio de Pago* al ${fechaHoy}`,
                      `*Total Vencido:* ${fmtMoney(totalCliente)}`,
                      '',
                      `Adjunto el detalle en PDF para tu revisión.`,
                      '',
                      `Por favor, ayúdanos con la confirmación del pago a la brevedad posible. Si ya fue realizado, envíanos el comprobante por este medio.`,
                      '',
                      `Cualquier duda, quedo atenta.`,
                      '',
                      `¡Saludos!`
                    ];
                    const mensaje = encodeURIComponent(lineas.join('\n'));
                    window.open(`https://wa.me/?text=${mensaje}`, '_blank');
                    // Registrar gestión automática de WhatsApp
                    registrarGestion({
                      cliente: selectedCliente,
                      tipo: "WhatsApp",
                      resultado: "Enviado",
                      observacion: "Recordatorio enviado por WhatsApp",
                    });
                    addToast("Gestión de WhatsApp registrada", "success");
                  }}
                >
                  💬 WhatsApp
                </button>
                <button className="btn secondary" onClick={() => setShowModalGestion(true)} disabled={!hasWritePermissions}>
                  💬 Nueva Gestión
                </button>
                <button className="btn primary" onClick={() => exportarEstadoDeCuenta(selectedCliente)}>
                  📄 Generar PDF
                </button>
              </div>
              {/* Documentos Vencidos del Cliente */}
              {docsVencidosCliente.length > 0 && (
                <div style={{marginTop: '16px'}}>
                  <h4 style={{margin: '16px 0 8px 0', color: 'var(--text-main)'}}>📄 Documentos Vencidos ({docsVencidosCliente.length})</h4>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Documento</th>
                          <th>Emisión</th>
                          <th>Vencimiento</th>
                          <th className="num">Días Venc.</th>
                          <th className="num">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docsVencidosCliente.map(d => (
                          <tr key={d.id}>
                            <td>{d.documento || d.numero}</td>
                            <td>{d.fecha_emision}</td>
                            <td>{d.fecha_vencimiento}</td>
                            <td className="num">
                              <span className={`kpi-${(d.dias_vencidos || 0) > 90 ? 'negative' : (d.dias_vencidos || 0) > 60 ? 'warning' : 'negative'}`}>
                                {d.dias_vencidos || 0}
                              </span>
                            </td>
                            <td className="num">{fmtMoney(d.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{padding: '12px 16px', backgroundColor: 'var(--bg-nav)', borderTop: '1px solid var(--border)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between'}}>
                      <span>TOTAL VENCIDO:</span>
                      <span style={{color: '#ef4444'}}>{fmtMoney(totalVencidoCliente)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Historial de Gestiones UNIFICADO */}
          <div className="card">
            <div className="card-title" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 12, flexWrap: 'wrap', gap: '10px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <span style={{fontSize: '1.5rem'}}>📋</span>
                <span style={{fontWeight: 700, fontSize: '1.15rem', color: '#374151'}}>
                  Historial de Gestiones {selectedCliente && selectedCliente !== "Todos" ? `- ${selectedCliente}` : "(General)"}
                </span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
                {(!selectedCliente || selectedCliente === "Todos") && (
                  <>
                    <label style={{fontSize: '0.9rem', color: '#374151', display: 'flex', alignItems: 'center'}}>Desde:
                      <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} style={{marginLeft: 4, marginRight: 8, padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db'}} />
                    </label>
                    <label style={{fontSize: '0.9rem', color: '#374151', display: 'flex', alignItems: 'center'}}>Hasta:
                      <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} style={{marginLeft: 4, marginRight: 8, padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db'}} />
                    </label>
                  </>
                )}
                <button className="btn primary" style={{fontSize: '0.9rem', padding: '6px 12px'}} onClick={exportarReporteGestion}>
                  📄 Generar Reporte PDF
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="data-table" style={{fontSize: '0.85rem'}}>
                <thead>
                  <tr>
                    {(!selectedCliente || selectedCliente === "Todos") && <th>Cliente</th>}
                    <th>Fecha</th>
                    <th className="text-center" title="Llamada/Visita">📞</th>
                    <th className="text-center" title="Email">📧</th>
                    <th className="text-center" title="WhatsApp">💬</th>
                    <th className="text-center" title="PDF Generado">📄</th>
                    <th>Resultado</th>
                    <th>Observación</th>
                    <th className="num">Promesa</th>
                    <th style={{width: '30px'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let dataToShow = [];
                    if (selectedCliente && selectedCliente !== "Todos") {
                       dataToShow = allGestiones.filter(g => g.cliente === selectedCliente || g.razon_social === selectedCliente);
                    } else {
                       dataToShow = gestionesFiltradasPorFecha;
                    }
                    
                    dataToShow.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
                    
                    if (dataToShow.length === 0) {
                      return (
                        <tr>
                          <td colSpan={(!selectedCliente || selectedCliente === "Todos") ? 7 : 6} style={{textAlign: 'center', padding: '24px', color: '#9ca3af'}}>
                            No hay gestiones registradas
                          </td>
                        </tr>
                      );
                    }

                    return dataToShow.slice(0, 50).map(g => (
                      <tr key={g.id}>
                        {(!selectedCliente || selectedCliente === "Todos") && (
                          <td><strong>{g.razon_social || g.cliente}</strong></td>
                        )}
                        <td>{g.fecha ? g.fecha.replace('T', ' ').substring(0, 16) : '-'}</td>
                        <td className="text-center">{['Llamada', 'Visita'].some(t => g.tipo.includes(t)) ? '✓' : ''}</td>
                        <td className="text-center">{g.tipo.includes('Email') ? '✓' : ''}</td>
                        <td className="text-center">{g.tipo.includes('WhatsApp') ? '✓' : ''}</td>
                        <td className="text-center">{g.tipo.includes('PDF') ? '✓' : ''}</td>
                        <td>{g.resultado}</td>
                        <td style={{maxWidth: '250px', whiteSpace: 'normal'}}>{g.observacion || '-'}</td>
                        <td className="num">
                          {g.fecha_promesa ? (
                            <span className="status-color-warning" style={{fontSize: '0.85rem'}}>
                              {g.fecha_promesa} - {fmtMoney(g.monto_promesa || 0)}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          <button className="promesa-eliminar" style={{position: 'static', transform: 'none', marginLeft: 0}} onClick={() => eliminarGestion(g.id)} disabled={!hasWritePermissions} title="Eliminar">✕</button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            {gestionesFiltradasPorFecha.length > 50 && (!selectedCliente || selectedCliente === "Todos") && (
               <p className="table-footnote" style={{textAlign: 'center'}}>Mostrando las últimas 50 gestiones</p>
            )}
          </div>
        </div>
      );
    }

    if (tab === "config") {
      return (
        <div>
        <div className="config-container">
          <h2 style={{ marginBottom: 10, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.8rem' }}>Configuración</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Administra las preferencias generales y el sistema</p>

          <div className="config-grid">
            
            {/* TARJETA 1: PERSONALIZACIÓN (FULL WIDTH) */}
            <div className="config-card" style={{background: 'linear-gradient(to right, var(--bg-surface), var(--bg-main))'}}>
              <div className="config-header">
                <div className="config-icon-box">🎨</div>
                <div className="config-title">
                  <h3>Personalización Visual</h3>
                  <p>Elige el tema que mejor se adapte a tu estilo</p>
                </div>
              </div>
              
              <div className="theme-section">
                <div className="theme-options">
                  {[
                    { id: 'claro', name: 'Clásico', class: 'theme-preview-claro' },
                    { id: 'azul', name: 'Corporativo', class: 'theme-preview-azul' },
                    { id: 'pastel', name: 'Suave', class: 'theme-preview-pastel' },
                    { id: 'oscuro', name: 'Noche', class: 'theme-preview-oscuro' },
                    { id: 'nature', name: 'Nature', class: 'theme-preview-nature' }
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`theme-btn ${t.class} ${pendingTheme === t.id ? 'active' : ''}`}
                      data-name={t.name}
                      onClick={() => setPendingTheme(t.id)}
                      title={`Seleccionar tema ${t.name}`}
                    >
                      {pendingTheme === t.id && <span className="theme-check">✓</span>}
                    </div>
                  ))}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '25px' }}>
                  <button 
                    className="btn primary" 
                    style={{ padding: '12px 32px', fontSize: '1rem', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}
                    onClick={async () => {
                      setTheme(pendingTheme);
                      if (!isWeb) {
                        try {
                          await window.api.empresaGuardar({ ...empresa, tema: pendingTheme });
                          addToast("Tema guardado y aplicado", "success");
                        } catch(e) {
                            console.error(e);
                            addToast("Error guardando tema", "error");
                        }
                      } else {
                          addToast("Tema aplicado (local)", "success");
                      }
                    }}
                  >
                    💾 Guardar y Aplicar Tema
                  </button>
                </div>
              </div>
            </div>

            {/* TARJETA 2: EMPRESA */}
            <div className="config-card">
              <div className="config-header">
                <div className="config-icon-box">🏢</div>
                <div className="config-title">
                  <h3>Empresa</h3>
                  <p>Información legal y marca</p>
                </div>
              </div>
              <div className="config-actions">
                <button className="config-btn" onClick={() => setShowModalEmpresa(true)} disabled={!hasWritePermissions}>
                  <span><span className="config-btn-icon">⚙️</span> Editar datos generales</span>
                  <span className="config-btn-arrow">→</span>
                </button>
                <button className="config-btn" onClick={cambiarLogo} disabled={!hasWritePermissions}>
                  <span><span className="config-btn-icon">🖼️</span> Cambiar logotipo</span>
                  <span className="config-btn-arrow">→</span>
                </button>
              </div>
            </div>

            {/* TARJETA 3: DATOS */}
            <div className="config-card">
              <div className="config-header">
                <div className="config-icon-box">💾</div>
                <div className="config-title">
                  <h3>Gestión de Datos</h3>
                  <p>Importación y respaldos</p>
                </div>
              </div>
              <div className="config-actions">
                <button className="config-btn" onClick={importarExcel} disabled={!hasWritePermissions}>
                  <span><span className="config-btn-icon">📥</span> Importar Excel Contifico</span>
                  <span className="config-btn-arrow">→</span>
                </button>
                <button className="config-btn" onClick={exportarBackup}>
                  <span><span className="config-btn-icon">📤</span> Exportar respaldo completo</span>
                  <span className="config-btn-arrow">→</span>
                </button>
                <button className="config-btn" onClick={() => setShowModalLimpiar(true)} style={{color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2'}}>
                  <span><span className="config-btn-icon">🗑️</span> Limpiar base de datos</span>
                  <span className="config-btn-arrow">→</span>
                </button>
              </div>
            </div>

            {/* TARJETA 4: USUARIOS Y SEGURIDAD */}
            <div className="config-card">
              <div className="config-header">
                <div className="config-icon-box">🛡️</div>
                <div className="config-title">
                  <h3>Seguridad</h3>
                  <p>Usuarios y accesos</p>
                </div>
              </div>
              <div className="config-actions">
                <button className="config-btn" onClick={() => addToast("Módulo de Usuarios en desarrollo", "info")}>
                  <span><span className="config-btn-icon">👤</span> Administrar usuarios</span>
                  <span className="config-btn-arrow">→</span>
                </button>
                <button className="config-btn" onClick={() => addToast("Cambio de contraseña en desarrollo", "info")}>
                  <span><span className="config-btn-icon">🔒</span> Cambiar contraseña</span>
                  <span className="config-btn-arrow">→</span>
                </button>
                <button className="config-btn" onClick={() => addToast("Gestión de Roles en desarrollo", "info")}>
                  <span><span className="config-btn-icon">🔑</span> Roles y permisos</span>
                  <span className="config-btn-arrow">→</span>
                </button>
              </div>
            </div>

            {/* TARJETA 5: SISTEMA */}
            <div className="config-card">
              <div className="config-header">
                <div className="config-icon-box">🔧</div>
                <div className="config-title">
                  <h3>Sistema</h3>
                  <p>Mantenimiento y ayuda</p>
                </div>
              </div>
              <div className="config-actions">
                <button className="config-btn" onClick={() => addToast("Documentación próximamente", "info")}>
                  <span><span className="config-btn-icon">📖</span> Documentación</span>
                  <span className="config-btn-arrow">→</span>
                </button>
                <button className="config-btn" onClick={() => addToast("Historial disponible en próximas versiones", "info")}>
                  <span><span className="config-btn-icon">📝</span> Historial de cambios</span>
                  <span className="config-btn-arrow">→</span>
                </button>
              </div>
            </div>

          </div>
        </div>
        </div>
      );
    }

    if (tab === "reportes") {
      const exportarExcel = async () => {
        try {
          const XLSX = await loadXLSX();
          const dataExport = docs.map((d: any) => {
            // Calcular aging si no existe
            let aging = d.aging;
            if (!aging) {
               const dias = d.dias_vencidos || 0;
               if (dias <= 0) aging = 'Por Vencer';
               else if (dias <= 30) aging = '30';
               else if (dias <= 60) aging = '60';
               else if (dias <= 90) aging = '90';
               else if (dias <= 120) aging = '120';
               else aging = '+120';
            }
            return {
            'Documento': d.numero || d.documento,
            'Cliente': d.cliente,
            'Vendedor': d.vendedor,
            'Emisión': d.fecha_emision,
            'Vencimiento': d.fecha_vencimiento,
            'Días Vencidos': d.dias_vencidos || 0,
            'Aging': aging,
            'Monto Total': d.total,
            'Saldo': d.saldo
          }});
          
          const ws = XLSX.utils.json_to_sheet(dataExport);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Cartera');
          XLSX.writeFile(wb, `Cartera_${new Date().toISOString().split('T')[0]}.xlsx`);
          addToast('✅ Reporte Excel generado', 'success');
        } catch (error) {
          addToast('❌ Error al generar Excel', 'error');
        }
      };

      const exportarPDF = async () => {
        try {
          const { jsPDF, autoTable } = await loadJsPDF();
          const doc = new jsPDF();
          doc.setFontSize(16);
          doc.text('Reporte de Cartera', 14, 15);
          doc.setFontSize(10);
          doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 14, 22);
          
          const tableData = docs.map((d: any) => {
            let aging = d.aging;
            if (!aging) {
               const dias = d.dias_vencidos || 0;
               if (dias <= 0) aging = 'Por Vencer';
               else if (dias <= 30) aging = '30';
               else if (dias <= 60) aging = '60';
               else if (dias <= 90) aging = '90';
               else if (dias <= 120) aging = '120';
               else aging = '+120';
            }
            return [
            d.numero || d.documento,
            d.cliente,
            d.dias_vencidos || 0,
            aging,
            fmtMoney(d.total)
          ]});
          
          autoTable(doc, {
            head: [['Documento', 'Cliente', 'Días Venc.', 'Aging', 'Saldo']],
            body: tableData,
            startY: 28,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] }
          });
          
          doc.save(`Cartera_${new Date().toISOString().split('T')[0]}.pdf`);
          addToast('✅ Reporte PDF generado', 'success');
        } catch (error) {
          addToast('❌ Error al generar PDF', 'error');
        }
      };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <div className="card-title">📊 Resumen Ejecutivo</div>
            <div className="kpis-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div className="kpi-card">
                <div className="kpi-title">Total Documentos</div>
                <div className="kpi-value">{docs.length}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Monto Total</div>
                <div className="kpi-value">{fmtMoney(docs.reduce((sum: number, d: any) => sum + (d.total || 0), 0))}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Docs Vencidos</div>
                <div className="kpi-value kpi-negative">{docs.filter((d: any) => (d.dias_vencidos || 0) > 0).length}</div>
                <div className="kpi-subtitle">{docs.length > 0 ? ((docs.filter((d: any) => (d.dias_vencidos || 0) > 0).length / docs.length) * 100).toFixed(1) : 0}% del total</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Monto Vencido</div>
                <div className="kpi-value kpi-negative">{fmtMoney(docs.filter((d: any) => (d.dias_vencidos || 0) > 0).reduce((sum: number, d: any) => sum + (d.total || 0), 0))}</div>
                <div className="kpi-subtitle">{docs.length > 0 ? ((docs.filter((d: any) => (d.dias_vencidos || 0) > 0).reduce((sum: number, d: any) => sum + (d.total || 0), 0) / docs.reduce((sum: number, d: any) => sum + (d.total || 0), 0)) * 100).toFixed(1) : 0}% del total</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Clientes Únicos</div>
                <div className="kpi-value">{new Set(docs.map((d: any) => d.cliente)).size}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">📋 Reporte de Documentos</div>
            <div className="row">
              <label className="field">
                <span>Cliente</span>
                <select
                  value={selectedCliente}
                  onChange={e => {
                    const value = e.target.value;
                    if (value === 'Todos') {
                      setSelectedCliente("");
                    } else {
                      setSelectedCliente(value);
                    }
                  }}>
                  <option value="">Todos</option>
                  {clientes.map(c => (
                    <option key={c.cliente} value={c.razon_social}>{c.razon_social}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Vendedor</span>
                <select value={selectedVendedor} onChange={e => setSelectedVendedor(e.target.value)}>
                  <option value="">Todos</option>
                  {vendedores.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Centro de Costo</span>
                <select value={filtroCentroCosto} onChange={e => setFiltroCentroCosto(e.target.value)}>
                  <option value="Todos">Todos</option>
                  {centrosCosto.map(cc => (
                    <option key={cc} value={cc}>{cc}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Aging</span>
                <select value={filtroAging} onChange={e => setFiltroAging(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Vencidos">Vencidos (Todos)</option>
                  <option value="Por vencer">Por vencer</option>
                  <option value="30">30</option>
                  <option value="60">60</option>
                  <option value="90">90</option>
                  <option value="120">120</option>
                  <option value="+120">+120</option>
                </select>
              </label>
            </div>
            <div className="row">
              <label className="field">
                <span>Búsqueda</span>
                <input type="text" value={searchDocumentos} onChange={e => setSearchDocumentos(e.target.value)} placeholder="Buscar por cliente o documento..." />
              </label>
              <label className="field field-wrapper">
                <input type="checkbox" checked={vistaAgrupada} onChange={e => setVistaAgrupada(e.target.checked)} />
                <span>Vista Agrupada con Subtotales</span>
              </label>
            </div>
            <div className="flex-row" style={{ flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={exportarExcel}>📥 Exportar a Excel</button>
              <button className="btn primary" onClick={exportarPDF}>📄 Exportar a PDF</button>
              <button className="btn secondary" onClick={() => alert('Comparativa mensual: función en desarrollo')}>📈 Comparar Períodos</button>
            </div>

            {!vistaAgrupada ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Documento</th>
                      <th>Vendedor</th>
                      <th className="th-fvenc">F. Vencimiento</th>
                      <th>Aging</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.length > 0 ? (
                      docs.map((d: any) => (
                        <tr key={d.id}>
                          <td>{d.razon_social}</td>
                          <td>{d.documento}</td>
                          <td>{d.vendedor}</td>
                          <td>{d.fecha_vencimiento}</td>
                          <td>
                            <span className={((d.dias_vencidos || 0) > 90) ? 'kpi-negative' : ((d.dias_vencidos || 0) > 60) ? 'kpi-warning' : ''}>
                              {d.aging
                                ? d.aging
                                : d.dias_vencidos !== undefined
                                  ? d.dias_vencidos > 360 ? '>360'
                                    : d.dias_vencidos > 330 ? '360'
                                    : d.dias_vencidos > 300 ? '330'
                                    : d.dias_vencidos > 270 ? '300'
                                    : d.dias_vencidos > 240 ? '270'
                                    : d.dias_vencidos > 210 ? '240'
                                    : d.dias_vencidos > 180 ? '210'
                                    : d.dias_vencidos > 150 ? '180'
                                    : d.dias_vencidos > 120 ? '150'
                                    : d.dias_vencidos > 90 ? '120'
                                    : d.dias_vencidos > 60 ? '90'
                                    : d.dias_vencidos > 30 ? '60'
                                    : d.dias_vencidos > 0 ? '30'
                                    : 'Por Vencer'
                                  : '-'}
                            </span>
                          </td>
                          <td className="num">{fmtMoney(typeof d.total === 'number' ? d.total : (d.valor_documento || 0))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6}>No hay resultados</td></tr>
                    )}
                  </tbody>
                </table>
                <p className="table-footnote">Mostrando {docs.length} de {docs.length} documentos</p>
              </div>
            ) : (
              <div className="table-wrapper">
                {/* Aquí puedes agregar el renderizado de agrupados si lo necesitas en el futuro */}
              </div>
            )}
          </div>

          <div style={analisisRetenciones.cantidadDocs > 0 ? gridTwoCol : {}}>
          {/* NUEVO: Análisis por Vendedor */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">👤 Análisis por Vendedor</div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th className="num">Documentos</th>
                    <th className="num">Clientes</th>
                    <th className="num">Total Facturado</th>
                    <th className="num">Cobrado</th>
                    <th className="num">Pendiente</th>
                    <th className="num">% Morosidad</th>
                  </tr>
                </thead>
                <tbody>
                  {analisisPorVendedor.length > 0 ? (
                    analisisPorVendedor.map((v, idx) => (
                      <tr key={idx}>
                        <td>{v.vendedor}</td>
                        <td className="num">{v.documentos}</td>
                        <td className="num">{v.cantidadClientes}</td>
                        <td className="num">{fmtMoney(v.totalFacturado)}</td>
                        <td className="num">{fmtMoney(v.totalCobrado)}</td>
                        <td className="num">{fmtMoney(v.totalPendiente)}</td>
                        <td className="num">
                          <span className={v.porcentajeMorosidad > 30 ? 'kpi-negative' : v.porcentajeMorosidad > 15 ? 'kpi-warning' : 'kpi-positive'}>
                            {v.porcentajeMorosidad.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7}>No hay datos de vendedores</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* NUEVO: Retenciones Detalladas */}
          {analisisRetenciones.cantidadDocs > 0 && (
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-title">💵 Detalle de Retenciones</div>
              <div className="kpis-grid" style={{marginBottom: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}>
                <div className="kpi-card">
                  <div className="kpi-title">Total Retenido</div>
                  <div className="kpi-value">{fmtMoney(analisisRetenciones.totalRetenido)}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-title">Documentos con Retención</div>
                  <div className="kpi-value">{analisisRetenciones.cantidadDocs}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-title">Promedio por Doc</div>
                  <div className="kpi-value">{fmtMoney(analisisRetenciones.promedioPorDoc)}</div>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Cliente</th>
                      <th className="num">Total Documento</th>
                      <th className="num">Retención</th>
                      <th className="num">% Retención</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analisisRetenciones.detalles.slice(0, 20).map((r, idx) => (
                      <tr key={idx}>
                        <td>{r.documento}</td>
                        <td>{r.cliente}</td>
                        <td className="num">{fmtMoney(r.total)}</td>
                        <td className="num">{fmtMoney(r.monto)}</td>
                        <td className="num">{r.total > 0 ? ((r.monto / r.total) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        </div>
      );
    }

    if (tab === "crm") {
      const hoy = new Date();
      const promesasFiltradas = promesas.filter(p => {
        const fechaPromesa = new Date(p.fecha_promesa || '');
        const diffDias = Math.ceil((fechaPromesa.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        
        let cumpleFecha = true;
        if (filtroFecha === "Hoy") cumpleFecha = diffDias === 0;
        else if (filtroFecha === "Esta Semana") cumpleFecha = diffDias >= 0 && diffDias <= 7;
        else if (filtroFecha === "Vencidas") cumpleFecha = diffDias < 0;
        
        let cumpleMonto = true;
        if (filtroMonto === "Menor 1000") cumpleMonto = (p.monto_promesa || 0) < 1000;
        else if (filtroMonto === "1000-5000") cumpleMonto = (p.monto_promesa || 0) >= 1000 && (p.monto_promesa || 0) <= 5000;
        else if (filtroMonto === "Mayor 5000") cumpleMonto = (p.monto_promesa || 0) > 5000;
        
        return cumpleFecha && cumpleMonto;
      });

      const getSemaforo = (fechaPromesa: string | undefined) => {
        if (!fechaPromesa) return { color: '#9ca3af', label: 'Sin fecha' };
        const fecha = new Date(fechaPromesa);
        const diffDias = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDias < 0) return { color: '#e63946', label: '🔴 Vencida' };
        if (diffDias === 0) return { color: '#f59e0b', label: '🟡 Hoy' };
        if (diffDias <= 3) return { color: '#f59e0b', label: '🟡 Próxima' };
        return { color: '#2ea44f', label: '🟢 Vigente' };
      };

      const totalPromesas = promesas.length;
      const montoTotal = promesas.reduce((sum, p) => sum + (p.monto_promesa || 0), 0);
      const vencidas = promesas.filter(p => {
        const diffDias = Math.ceil((new Date(p.fecha_promesa || '').getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        return diffDias < 0;
      }).length;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={gridTwoCol}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">💼 Resumen</div>
            <div className="kpis-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div className="kpi-card">
                <div className="kpi-title">Total Promesas</div>
                <div className="kpi-value">{totalPromesas}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Monto Total</div>
                <div className="kpi-value">{fmtMoney(montoTotal)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Vencidas</div>
                <div className="kpi-value kpi-negative">{vencidas}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Vigentes</div>
                <div className="kpi-value kpi-positive">{totalPromesas - vencidas}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Tasa Cumplimiento</div>
                <div className="kpi-value kpi-positive">{stats?.tasaCumplimientoPromesas || 0}%</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">🔍 Filtros</div>
            <div className="row" style={{ marginTop: '10px' }}>
              <label className="field">
                <span>Filtrar por Fecha</span>
                <select value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}>
                  <option value="Todas">Todas</option>
                  <option value="Hoy">Hoy</option>
                  <option value="Esta Semana">Esta Semana</option>
                  <option value="Vencidas">Vencidas</option>
                </select>
              </label>
              <label className="field">
                <span>Filtrar por Monto</span>
                <select value={filtroMonto} onChange={e => setFiltroMonto(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Menor 1000">&lt; 1,000</option>
                  <option value="1000-5000">1,000 - 5,000</option>
                  <option value="Mayor 5000">&gt; 5,000</option>
                </select>
              </label>
            </div>
          </div>
          </div>

          <div className="card">
            <div className="card-title">📅 Gestión de Promesas de Pago</div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Fecha Promesa</th>
                    <th className="num">Monto</th>
                    <th>Estado</th>
                    <th>Observación</th>
                    <th style={{textAlign: 'center'}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {promesasFiltradas.length > 0 ? (
                    promesasFiltradas.map(p => {
                      const semaforo = getSemaforo(p.fecha_promesa);
                      return (
                        <tr key={p.id} style={{ borderLeft: `4px solid ${semaforo.color}` }}>
                          <td><strong>{p.razon_social || p.cliente}</strong></td>
                          <td>{p.fecha_promesa}</td>
                          <td className="num" style={{ fontWeight: 'bold' }}>{fmtMoney(p.monto_promesa || 0)}</td>
                          <td>
                            <span className="status-label" style={{ color: semaforo.color, background: 'var(--bg-nav)', padding: '2px 8px', borderRadius: '4px' }}>
                              {semaforo.label}
                            </span>
                          </td>
                          <td style={{ maxWidth: '300px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.observacion || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="action-buttons" style={{ justifyContent: 'center' }}>
                              <button className="btn primary" style={{ padding: '4px 8px' }} onClick={() => cumplirPromesa(p.id)} disabled={!hasWritePermissions} title="Marcar como cumplida">✓</button>
                              <button className="btn secondary" style={{ padding: '4px 8px' }} onClick={() => alert('Recordatorio configurado (simulado)')} title="Agregar recordatorio">🔔</button>
                              <button className="promesa-eliminar" onClick={() => eliminarGestion(p.id)} disabled={!hasWritePermissions} title="Eliminar">✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                        No hay promesas de pago {filtroFecha !== 'Todas' ? `para: ${filtroFecha}` : 'pendientes'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (tab === "analisis") {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <div className="card-title">📊 Panel de Análisis</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button className={`btn ${vistaAnalisis === 'motivos' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('motivos')}>Motivos Impago</button>
              <button className={`btn ${vistaAnalisis === 'productividad' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('productividad')}>Productividad</button>
              <button className={`btn ${vistaAnalisis === 'segmentacion' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('segmentacion')}>Segmentación</button>
              <button className={`btn ${vistaAnalisis === 'riesgo' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('riesgo')}>Análisis Riesgo</button>
              <button className={`btn ${vistaAnalisis === 'cronicos' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('cronicos')}>⚠️ Deudores Crónicos</button>
            </div>

            {vistaAnalisis === 'motivos' && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Motivo</th>
                      <th className="num">Casos</th>
                      <th className="num">Monto Total</th>
                      <th className="num">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {motivosData.length > 0 ? motivosData.map((m, i) => {
                      const total = motivosData.reduce((sum, x) => sum + x.total, 0);
                      return (
                        <tr key={i}>
                          <td>{m.label}</td>
                          <td className="num">{m.count}</td>
                          <td className="num">{fmtMoney(m.total)}</td>
                          <td className="num">{total > 0 ? ((m.total / total * 100).toFixed(1)) : '0'}%</td>
                        </tr>
                      );
                    }) : <tr><td colSpan={4} style={{textAlign: 'center', color: '#888', fontSize: '1.1rem'}}><b>Motivos de Impago</b><br/><span style={{fontWeight: 'normal'}}>Sin datos</span></td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {vistaAnalisis === 'productividad' && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Gestor</th>
                      <th className="num">Gestiones</th>
                      <th className="num">Promesas</th>
                      <th className="num">Pagos</th>
                      <th className="num">Tasa Promesa</th>
                      <th className="num">Saldo Recuperable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productividadData.length > 0 ? productividadData.map((p, i) => (
                      <tr key={i}>
                        <td>{p.usuario}</td>
                        <td className="num">{p.total_gestiones}</td>
                        <td className="num">{p.promesas}</td>
                        <td className="num">{p.pagos}</td>
                        <td className="num">{p.tasa_promesa}%</td>
                        <td className="num">{fmtMoney(p.saldo_recuperable)}</td>
                      </tr>
                    )) : <tr><td colSpan={6} style={{textAlign: 'center', color: '#888', fontSize: '1.1rem'}}><b>Productividad de Gestores</b><br/><span style={{fontWeight: 'normal'}}>Sin datos</span></td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {vistaAnalisis === 'segmentacion' && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th className="num">Saldo</th>
                      <th className="num">Documentos</th>
                      <th className="num">Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segmentacionRiesgo.length > 0 ? segmentacionRiesgo.map((s, i) => (
                      <tr key={i}>
                        <td>{s.nombre}</td>
                        <td className="num">{fmtMoney(s.saldo)}</td>
                        <td className="num">{s.documentos}</td>
                        <td className="num">
                          <span className={s.riesgo === "Alto" ? "kpi-negative" : s.riesgo === "Medio" ? "kpi-warning" : ""}>
                            {s.riesgo}
                          </span>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={4} style={{textAlign: 'center', color: '#888', fontSize: '1.1rem'}}><b>Segmentación de Riesgo</b><br/><span style={{fontWeight: 'normal'}}>Sin datos</span><div style={{marginTop: '16px'}}><svg width="120" height="80"><rect x="10" y="30" width="100" height="20" rx="8" fill="#e5e7eb"/><text x="60" y="45" textAnchor="middle" fill="#bbb" fontSize="14">Gráfica</text></svg></div></td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {vistaAnalisis === 'riesgo' && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th className="num">Deuda Total</th>
                      <th className="num">Deuda Vencida</th>
                      <th className="num">Días Mora</th>
                      <th className="num">Score</th>
                      <th className="num">Predicción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analisisRiesgo.map((a, i) => {
                      const prediccion = a.score < 30 ? '🔴 Alto Riesgo' : a.score < 60 ? '🟡 Riesgo Medio' : '🟢 Bajo Riesgo';
                      return (
                        <tr key={i}>
                          <td>{a.razon_social}</td>
                          <td className="num">{fmtMoney(a.total_deuda)}</td>
                          <td className="num">{fmtMoney(a.deuda_vencida)}</td>
                          <td className="num">{a.max_dias_mora}</td>
                          <td className="num">
                            <span className={a.score < 50 ? "kpi-negative" : ""}>{a.score}</span>
                          </td>
                          <td>{prediccion}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {vistaAnalisis === 'cronicos' && (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th className="num">Deuda Total</th>
                      <th className="num">Vencido +90 días</th>
                      <th className="num">Docs Vencidos</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={7} style={{textAlign: 'center', color: '#9ca3af'}}>
                        No hay datos
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
        </div>
        </div>
      );
    }

    if (tab === "alertas") {
      return (
        <div className="card">
          <div className="card-title">🚨 Alertas de Incumplimiento</div>
          <div className="row">
            <label className="field">
              <span>Búsqueda</span>
              <input type="text" value={searchAlertas} onChange={e => setSearchAlertas(e.target.value)} placeholder="Buscar cliente o documento..." />
            </label>
            <label className="field">
              <span>Severidad</span>
              <select value={filtroSeveridad} onChange={e => setFiltroSeveridad(e.target.value)}>
                <option value="Todos">Todas</option>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </label>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th className="num">Monto</th>
                  <th className="num">Días Vencido</th>
                  <th>Severidad</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlertas.length > 0 ? (
                  filteredAlertas.map((a, i) => (
                    <tr key={i}>
                      <td>{a.cliente}</td>
                      <td>{a.documento}</td>
                      <td className="num">{fmtMoney(a.monto)}</td>
                      <td className="num">{a.diasVencidos}</td>
                      <td>
                        <span className={`kpi-${a.severidad === 'Alta' ? 'negative' : a.severidad === 'Media' ? 'warning' : 'positive'}`}>
                          {a.severidad}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} style={{textAlign: 'center', padding: '20px', color: '#9ca3af'}}>No hay alertas activas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (tab === "tendencias") {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="card-title">📈 Tendencias Históricas (12 meses)</div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Documentos</th>
                  <th className="num">Emisión</th>
                  <th className="num">Cobrado</th>
                  <th className="num">Vencidos</th>
                </tr>
              </thead>
              <tbody>
                {tendencias.length > 0 ? tendencias.map((t, i) => (
                  <tr key={i}>
                    <td><strong>{t.mes}</strong></td>
                    <td className="num">{t.documentos}</td>
                    <td className="num">{fmtMoney(t.emision)}</td>
                    <td className="num">{fmtMoney(t.cobrado)}</td>
                    <td className="num">{t.vencidos}</td>
                  </tr>
                )) : <tr><td colSpan={5}>Sin datos</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      );
    }

    if (tab === "cuentas") {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="card-title">📜 Historial de Abonos Detectados</div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha Detección</th>
                  <th>Documento</th>
                  <th className="num">Saldo Anterior</th>
                  <th className="num">Pago Aplicado</th>
                  <th className="num">Nuevo Saldo</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {abonos.length > 0 ? (
                  abonos.map(a => (
                    <tr key={a.id}>
                      <td>{a.fecha.split('T')[0]}</td>
                      <td><strong>{a.documento}</strong></td>
                      <td className="num">{fmtMoney(a.total_anterior)}</td>
                      <td className="num kpi-positive">{fmtMoney(a.total_anterior - a.total_nuevo)}</td>
                      <td className="num">{fmtMoney(a.total_nuevo)}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{a.observacion || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
                      <div style={{ fontSize: '1rem', marginBottom: '8px' }}>No hay abonos detectados aún</div>
                      <div style={{ fontSize: '0.85rem' }}>Importa el Excel para detectar cambios en los saldos</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      );
    }

    if (tab === "config") {
      const themes: Record<string, { '--bg-gradient': string; '--text': string }> = {
        pastel: { '--bg-gradient': 'linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%)', '--text': '#1f2937' },
        lavanda: { '--bg-gradient': 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', '--text': '#1f2937' },
        coral: { '--bg-gradient': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%)', '--text': '#1f2937' },
        azul: { '--bg-gradient': 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)', '--text': '#1e3a8a' },
        gris: { '--bg-gradient': 'linear-gradient(135deg, #f3f4f6 0%, #9ca3af 100%)', '--text': '#111827' }
      };

      return (
        <div style={{ maxWidth: 700, margin: '32px auto', padding: '24px', background: 'var(--bg-surface)', borderRadius: 16, boxShadow: '0 2px 16px 0 rgba(0,0,0,0.07)' }}>
          <h2 style={{ marginBottom: 18, fontWeight: 700, color: 'var(--text-main)' }}>Configuración y Administración</h2>

          {/* Sección: Datos de Empresa */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#2563eb', marginBottom: 8 }}>Datos de Empresa</h3>
            <button className="btn primary" style={{ marginRight: 8 }} onClick={() => setShowModalEmpresa(true)} disabled={!hasWritePermissions}>⚙️ Editar datos</button>
            <button className="btn secondary" style={{ marginRight: 8 }}>🖼️ Cambiar logo</button>
          </div>

          {/* Sección: Usuarios y Permisos */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#2563eb', marginBottom: 8 }}>Usuarios y Permisos</h3>
            <button className="btn primary" style={{ marginRight: 8 }}>👤 Administrar usuarios</button>
            <button className="btn secondary" style={{ marginRight: 8 }}>🔑 Roles y permisos</button>
          </div>

          {/* Sección: Importación/Exportación */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#2563eb', marginBottom: 8 }}>Importación y Exportación</h3>
            <button className="btn primary" style={{ marginRight: 8 }} onClick={importarExcel} disabled={!hasWritePermissions}>📥 Importar Excel</button>
            <button className="btn secondary" style={{ marginRight: 8 }}>📤 Exportar respaldo</button>
            <button className="btn secondary" style={{ marginRight: 8 }}>📄 Descargar plantilla</button>
          </div>

          {/* Sección: Sincronización y Backup */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#2563eb', marginBottom: 8 }}>Sincronización y Backup</h3>
            <button className="btn primary" style={{ marginRight: 8 }}>🔄 Sincronizar</button>
            <button className="btn secondary" style={{ marginRight: 8 }}>💾 Backup manual</button>
            <button className="btn secondary" style={{ marginRight: 8 }}>♻️ Restaurar backup</button>
          </div>

          {/* Sección: Personalización y Temas */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#2563eb', marginBottom: 8 }}>Personalización y Temas</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className={`btn theme${theme === 'pastel' ? ' selected' : ''}`} style={{ background: themes.pastel['--bg-gradient'], color: themes.pastel['--text'], border: theme === 'pastel' ? '2px solid #2563eb' : 'none' }} onClick={() => setTheme('pastel')}>🌸 Femenino Pastel</button>
              <button className={`btn theme${theme === 'lavanda' ? ' selected' : ''}`} style={{ background: themes.lavanda['--bg-gradient'], color: themes.lavanda['--text'], border: theme === 'lavanda' ? '2px solid #2563eb' : 'none' }} onClick={() => setTheme('lavanda')}>💜 Femenino Lavanda</button>
              <button className={`btn theme${theme === 'coral' ? ' selected' : ''}`} style={{ background: themes.coral['--bg-gradient'], color: themes.coral['--text'], border: theme === 'coral' ? '2px solid #2563eb' : 'none' }} onClick={() => setTheme('coral')}>🌷 Femenino Coral</button>
              <button className={`btn theme${theme === 'azul' ? ' selected' : ''}`} style={{ background: themes.azul['--bg-gradient'], color: themes.azul['--text'], border: theme === 'azul' ? '2px solid #2563eb' : 'none' }} onClick={() => setTheme('azul')}>🟦 Masculino Azul</button>
              <button className={`btn theme${theme === 'gris' ? ' selected' : ''}`} style={{ background: themes.gris['--bg-gradient'], color: themes.gris['--text'], border: theme === 'gris' ? '2px solid #2563eb' : 'none' }} onClick={() => setTheme('gris')}>🟫 Masculino Gris</button>
            </div>
            <span style={{ fontSize: '0.95rem', color: '#6b7280' }}>Elige un tema para todo el sistema. Los cambios se aplicarán automáticamente.</span>
          </div>

          {/* Sección: Seguridad */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: 'var(--accent)', marginBottom: 8 }}>Seguridad</h3>
            <button className="btn secondary" style={{ marginRight: 8, background: 'var(--card)', color: 'var(--text)' }}>🔒 Cambiar contraseña</button>
            <button className="btn secondary" style={{ marginRight: 8, background: 'var(--card)', color: 'var(--text)' }}>🔐 Autenticación 2 pasos</button>
          </div>

          {/* Sección: Soporte y Ayuda */}
          <div style={{ marginBottom: 0 }}>
            <h3 style={{ color: 'var(--accent)', marginBottom: 8 }}>Soporte y Ayuda</h3>
            <button className="btn secondary" style={{ marginRight: 8, background: 'var(--card)', color: 'var(--text)' }}>📖 Ver documentación</button>
            <button className="btn secondary" style={{ marginRight: 8, background: 'var(--card)', color: 'var(--text)' }}>💬 Contactar soporte</button>
            <button className="btn secondary" style={{ marginRight: 8, background: 'var(--card)', color: 'var(--text)' }}>📝 Historial de cambios</button>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <div style={{
              width: '42px',
              height: '42px',
              background: empresa.logo ? 'transparent' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
              overflow: 'hidden'
            }}>
              {empresa.logo ? (
                <img src={empresa.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <img src="/logo-freeplastic.png" alt="Logo FreePlastic" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
            </div>
            <div>
              <h1 style={{margin: 0, fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)'}}>
                {empresa.nombre || 'Cartera Dashboard'}
              </h1>
              {empresa.administrador && (
                <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px'}}>
                  👤 {empresa.administrador}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="header-info">
            <span className="info-label">🔧</span>
            <span className="info-value">React + Electron + SQLite</span>
          </div>
          <div className="header-info">
            <span className="info-label">📦</span>
            <span className="info-value">Contifico Import</span>
          </div>
          <div className="header-info">
            <span className="info-label">🔗</span>
            <span className="info-value info-ok">Detectado</span>
          </div>
          
          {/* Botón 1: Cloudflare Tunnel (PRIMARIA) */}
          <div 
            className={`header-info header-info-clickable url-button cloudflare-button ${remoteUrl ? '' : 'disabled'}`}
            onClick={() => remoteUrl && copyToClipboard(remoteUrl)} 
            title={remoteUrl ? `Acceso Remoto (ngrok) - ${remoteUrl} - Clic para copiar` : "Acceso Remoto - Iniciando..."}
          >
            <span className="info-label">
              {!remoteUrl ? "🔌" : remoteUrlHealthy ? "🌐" : "🔴"}
            </span>
            <span className="info-value info-url url-max-width">
              Remoto
            </span>
            {remoteUrl && !remoteUrlHealthy && <span className="health-badge">⚠️</span>}
          </div>

          {/* Botón 2: URL Local (SECUNDARIA) - SIEMPRE VISIBLE */}
          <div 
            className={`header-info header-info-clickable url-button local-button ${repoUrl ? '' : 'disabled'}`}
            onClick={() => repoUrl && copyToClipboard(repoUrl)} 
            title={repoUrl ? `Red Local - ${repoUrl} - Clic para copiar` : "Red Local - Conectando..."}
          >
            <span className="info-label">
              {!repoUrl ? "🔌" : localUrlHealthy ? "🟢" : "🔴"}
            </span>
            <span className="info-value info-url url-max-width">
              Local
            </span>
            {repoUrl && !localUrlHealthy && <span className="health-badge">⚠️</span>}
            {!repoUrl && <span className="health-badge">⏳</span>}
          </div>
          
          <div className="header-info">
            <span className="info-label">💾</span>
            <span className="info-value info-path">{isWeb ? "Modo Web" : "C:\\Users\\...\\cartera.db"}</span>
          </div>
          <div className="header-info">
            <button
              className="refresh-btn"
              style={{ padding: '4px 12px', borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginLeft: 8 }}
              title="Refrescar todo el sistema"
              onClick={() => window.location.reload()}
            >🔄 Refrescar</button>
          </div>
        </div>
      </header>

      <nav className="nav-bar">
        {tabsConfig.map(t => (
          <button 
            key={t.id} 
            className={`nav-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id as any)}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content" style={{ overflowX: 'hidden', overflowY: tab === 'dashboard' ? 'hidden' : 'auto' }}>
        {renderContent()}
      </main>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* Modal Gestión */}
      {showModalGestion && (
        <div className="modal-overlay" onClick={() => setShowModalGestion(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">Nueva Gestión</div>
            <div className="modal-body">
              <label className="field">
                <span>Tipo</span>
                <select value={gestionForm.tipo} onChange={e => setGestionForm({...gestionForm, tipo: e.target.value})}>
                  <option>Llamada</option>
                  <option>WhatsApp</option>
                  <option>Email</option>
                  <option>Visita</option>
                </select>
              </label>
              <label className="field">
                <span>Resultado</span>
                <select value={gestionForm.resultado} onChange={e => setGestionForm({...gestionForm, resultado: e.target.value})}>
                  <option>Contactado</option>
                  <option>No contesta</option>
                  <option>Promesa de Pago</option>
                  <option>Rechazado</option>
                </select>
              </label>
              <label className="field">
                <span>Motivo (si aplica)</span>
                <select value={gestionForm.motivo} onChange={e => setGestionForm({...gestionForm, motivo: e.target.value})}>
                  <option value="">-- Seleccionar --</option>
                  <option>Falta de liquidez</option>
                  <option>Disputa comercial</option>
                  <option>Olvido/Descuido</option>
                  <option>Producto defectuoso</option>
                  <option>Error administrativo</option>
                  <option>En reclamo</option>
                  <option>Cambio de facturación</option>
                  <option>Otros</option>
                </select>
              </label>
              <label className="field">
                <span>Observación</span>
                <textarea value={gestionForm.observacion} onChange={e => setGestionForm({...gestionForm, observacion: e.target.value})} rows={3} placeholder="Detalles de la gestión..." />
              </label>
              {gestionForm.resultado === "Promesa de Pago" && (
                <>
                  <label className="field">
                    <span>Fecha Promesa</span>
                    <input type="date" value={gestionForm.fecha_promesa} onChange={e => setGestionForm({...gestionForm, fecha_promesa: e.target.value})} />
                  </label>
                  <label className="field">
                    <span>Monto Promesa</span>
                    <input type="number" value={gestionForm.monto_promesa} onChange={e => setGestionForm({...gestionForm, monto_promesa: Number(e.target.value)})} />
                  </label>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowModalGestion(false)}>Cancelar</button>
              <button className="btn primary" onClick={guardarGestion}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Empresa */}
      {showModalEmpresa && (
        <div className="modal-overlay" onClick={() => setShowModalEmpresa(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">Datos de Empresa</div>
            <div className="modal-body">
              <label className="field">
                <span>Nombre</span>
                <input value={empresa.nombre} onChange={e => setEmpresa({...empresa, nombre: e.target.value})} />
              </label>
              <label className="field">
                <span>RUC</span>
                <input value={empresa.ruc || ""} onChange={e => setEmpresa({...empresa, ruc: e.target.value})} />
              </label>
              <label className="field">
                <span>Dirección</span>
                <textarea value={empresa.direccion || ""} onChange={e => setEmpresa({...empresa, direccion: e.target.value})} rows={2} />
              </label>
              <label className="field">
                <span>Teléfono</span>
                <input value={empresa.telefono || ""} onChange={e => setEmpresa({...empresa, telefono: e.target.value})} />
              </label>
              <label className="field">
                <span>Email</span>
                <input value={empresa.email || ""} onChange={e => setEmpresa({...empresa, email: e.target.value})} />
              </label>
              <label className="field">
                <span>Gestor de Cobranza</span>
                <input value={empresa.administrador || ""} onChange={e => setEmpresa({...empresa, administrador: e.target.value})} placeholder="Ej: Lic. Alba Mayorga L" />
              </label>
              <label className="field">
                <span>Meta Mensual $</span>
                <input type="number" value={empresa.meta_mensual ?? ''} onChange={e => setEmpresa({...empresa, meta_mensual: Number(e.target.value)})} />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowModalEmpresa(false)}>Cancelar</button>
              <button className="btn primary" onClick={guardarEmpresa}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Limpiar Base */}
      {showModalLimpiar && (
        <div className="modal-overlay" onClick={() => setShowModalLimpiar(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">⚠️ Limpiar Base de Datos</div>
            <div className="modal-body">
              <p>¿Seguro que deseas limpiar la base de datos?</p>
              <p><strong>Se borrarán:</strong></p>
              <ul>
                <li>Documentos importados</li>
                <li>Gestiones y promesas</li>
                <li>Historial de abonos</li>
              </ul>
              <p><strong>Se preservarán:</strong></p>
              <ul>
                <li>Configuración de empresa (nombre, RUC, teléfono, email)</li>
                <li>Porcentaje IVA</li>
                <li>Meta mensual</li>
                <li>Datos de clientes</li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowModalLimpiar(false)}>Cancelar</button>
              <button className="btn danger" onClick={async () => {
                try {
                  const result = await window.api.limpiarBaseDatos?.();
                  if (result?.ok) {
                    setShowModalLimpiar(false);
                    addToast(result.message || "Base limpia exitosamente", "success");
                    // Limpiar estado sin cargar datos de prueba
                    setDocs([]);
                    setClientes([]);
                    setVendedores([]);
                    setTopClientes([]);
                    setGestiones([]);
                    setTendencias([]);
                    setCuentasAplicar([]);
                    setAbonos([]);
                    setStats({
                      fechaCorte: "",
                      totalSaldo: 0,
                      totalCobrado: 0,
                      vencidaSaldo: 0,
                      percentVencida: 0,
                      mora90Saldo: 0,
                      percentMora90: 0,
                      docsPendientes: 0,
                      clientesConSaldo: 0,
                      aging: { porVencer: 0, d30: 0, d60: 0, d90: 0, d120: 0, d150: 0, d180: 0, d210: 0, d240: 0, d270: 0, d300: 0, d330: 0, d360: 0, d360p: 0 },
                      percentTop10: 0,
                      npl: 0,
                      dso: 0,
                      recuperacionMesActual: 0,
                      metaMensual: 50000,
                      percentMetaCumplida: 0,
                      tasaCumplimientoPromesas: 0
                    });
                  } else {
                    addToast(result?.message || "Error limpiando base", "error");
                  }
                } catch (e) {
                  addToast("Error limpiando base de datos", "error");
                  console.error(e);
                }
              }}>Sí, limpiar ahora</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
