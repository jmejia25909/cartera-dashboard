import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import "./App.css";
import { fmtMoney } from "./utils/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const isWeb = !window.api;

// Tipos
type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
};

type Empresa = {
  nombre: string;
  ruc?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  administrador?: string;
  meta_mensual?: number;
};

type Documento = {
  id: number;
  cliente: string;
  razon_social?: string;
  tipo_documento: string;
  documento: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  vendedor?: string;
  total: number;
  dias_vencidos?: number;
};

type Stats = {
  fechaCorte: string;
  totalSaldo: number;
  totalCobrado: number;
  vencidaSaldo: number;
  percentVencida: number;
  mora90Saldo: number;
  percentMora90: number;
  docsPendientes: number;
  clientesConSaldo: number;
  aging: {
    porVencer: number;
    d30: number;
    d60: number;
    d90: number;
    d120: number;
    d120p: number;
  };
  percentTop10: number;
  npl: number;
  dso: number;
  recuperacionMesActual: number;
  metaMensual: number;
  percentMetaCumplida: number;
  tasaCumplimientoPromesas: number;
};

type Cliente = {
  cliente: string;
  razon_social: string;
};

type Gestion = {
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
};

type Campana = {
  id: number;
  nombre: string;
  descripcion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  responsable?: string;
};

type TopCliente = {
  razon_social: string;
  total: number;
};

type AnalisisRiesgo = {
  razon_social: string;
  total_deuda: number;
  deuda_vencida: number;
  max_dias_mora: number;
  score: number;
};

type MotivoImpago = {
  label: string;
  count: number;
  total: number;
};

type ProductividadGestor = {
  usuario: string;
  total_gestiones: number;
  promesas: number;
  pagos: number;
  tasa_promesa: number;
  saldo_recuperable: number;
};

type SegmentacionRiesgo = {
  id: number;
  nombre: string;
  saldo: number;
  documentos: number;
  riesgo: string;
};

type Alerta = {
  cliente: string;
  documento: string;
  monto: number;
  diasVencidos: number;
  severidad: string;
};

type Pronostico = {
  periodo: string;
  fechaHasta: string;
  flujoEsperado: number;
  confianza: number;
};

type TendenciaMes = {
  mes: string;
  documentos: number;
  emision: number;
  cobrado: number;
  vencidos: number;
};

type Disputa = {
  id: number;
  documento: string;
  cliente: string;
  monto: number;
  motivo?: string;
  estado: string;
  fecha_creacion: string;
  fecha_resolucion?: string;
  observacion?: string;
};

type CuentaAplicar = {
  id: number;
  documento?: string;
  cliente: string;
  monto: number;
  tipo: string;
  estado: string;
  fecha_recepcion: string;
  fecha_aplicacion?: string;
  documento_aplicado?: string;
  observacion?: string;
};

export default function App() {
  const [tab, setTab] = useState<"dashboard" | "gestion" | "reportes" | "crm" | "campanas" | "analisis" | "alertas" | "tendencias" | "disputas" | "cuentas" | "config">("dashboard");
  const [empresa, setEmpresa] = useState<Empresa>({ nombre: "Cartera Dashboard" });
  const [stats, setStats] = useState<Stats | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [promesas, setPromesas] = useState<Gestion[]>([]);
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [analisisRiesgo, setAnalisisRiesgo] = useState<AnalisisRiesgo[]>([]);
  const [motivosData, setMotivosData] = useState<MotivoImpago[]>([]);
  const [productividadData, setProductividadData] = useState<ProductividadGestor[]>([]);
  const [segmentacionRiesgo, setSegmentacionRiesgo] = useState<SegmentacionRiesgo[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [pronosticos, setPronosticos] = useState<Pronostico[]>([]);
  const [tendencias, setTendencias] = useState<TendenciaMes[]>([]);
  const [disputas, setDisputas] = useState<Disputa[]>([]);
  const [cuentasAplicar, setCuentasAplicar] = useState<CuentaAplicar[]>([]);
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [tunnelUrl, setTunnelUrl] = useState<string>("");
  const [tunnelActive, setTunnelActive] = useState(false);
  const [localUrlHealthy, setLocalUrlHealthy] = useState(true);
  const [tunnelUrlHealthy, setTunnelUrlHealthy] = useState(false);
  const [primaryUrl, setPrimaryUrl] = useState<"local" | "tunnel">("local");
  
  // Estados para búsqueda y filtros
  const [searchDocumentos, setSearchDocumentos] = useState("");
  const [searchGestiones, setSearchGestiones] = useState("");
  const [filtroEstadoGestion, setFiltroEstadoGestion] = useState("Todos");
  const [searchAlertas, setSearchAlertas] = useState("");
  const [filtroSeveridad, setFiltroSeveridad] = useState("Todos");
  const [searchDisputas, setSearchDisputas] = useState("");
  const [filtroEstadoDisputa, setFiltroEstadoDisputa] = useState("Todos");
  const [searchCuentas, setSearchCuentas] = useState("");
  const [filtroEstadoCuenta, setFiltroEstadoCuenta] = useState("Todos");
  
  // Estado para notificaciones
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastIdRef = useRef(0);
  
  // Función helper para agregar notificaciones
  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info", duration = 3000) => {
      const id = toastIdRef.current++;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  // Función para copiar URL al clipboard
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast("� URL seguro copiado! Acepta el certificado al abrir", "success", 4000);
    }).catch(() => {
      addToast("Error al copiar URL", "error", 2000);
    });
  }, [addToast]);

  // Función para iniciar/cerrar LocalTunnel
  const toggleLocalTunnel = useCallback(async () => {
    try {
      if (tunnelActive) {
        // Cerrar túnel
        const result = await window.api.closeTunnel();
        if (result.ok) {
          setTunnelActive(false);
          setTunnelUrl("");
          setTunnelUrlHealthy(false);
          setPrimaryUrl("local");
          addToast("🌐 LocalTunnel cerrado", "info", 2000);
        }
      } else {
        // Iniciar túnel
        const result = await window.api.startLocalTunnel();
        if (result.ok) {
          setTunnelUrl(result.url);
          setTunnelActive(true);
          addToast(`✅ ${result.message}`, "success", 3000);
        } else {
          addToast(`❌ ${result.message}`, "error", 3000);
        }
      }
    } catch (e) {
      console.error("Error en LocalTunnel:", e);
      addToast("Error al gestionar LocalTunnel", "error", 2000);
    }
  }, [tunnelActive, addToast]);

  // Health check para ambas URLs
  const checkUrlHealth = useCallback(async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout
      
      // Para LocalTunnel, cualquier respuesta HTTP es válida (incluye página de bypass)
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "manual", // No seguir redirecciones automáticamente
      });
      clearTimeout(timeout);
      
      // LocalTunnel responde con 200 (bypass page) o 3xx (redirección)
      // Ambos indican que el túnel está UP
      return response.status >= 200 && response.status < 500;
    } catch {
      return false;
    }
  }, []);

  // Effect para health check periódico
  useEffect(() => {
    const healthCheckInterval = setInterval(async () => {
      // Verificar salud de URL local
      if (repoUrl) {
        const localHealthy = await checkUrlHealth(repoUrl);
        setLocalUrlHealthy(localHealthy);
      }

      // Verificar salud de túnel
      if (tunnelUrl && tunnelActive) {
        const tunnelHealthy = await checkUrlHealth(tunnelUrl);
        setTunnelUrlHealthy(tunnelHealthy);
      }
    }, 5000); // Cada 5 segundos

    return () => clearInterval(healthCheckInterval);
  }, [repoUrl, tunnelUrl, tunnelActive, checkUrlHealth]);

  // Effect para determinar URL primaria basado en salud
  useEffect(() => {
    // PRIORIDAD INTELIGENTE:
    // 1. Si túnel está activo Y saludable → usar túnel
    if (tunnelActive && tunnelUrlHealthy) {
      setPrimaryUrl("tunnel");
    }
    // 2. Si túnel está activo pero NO saludable → FALLBACK a local
    else if (tunnelActive && !tunnelUrlHealthy && localUrlHealthy) {
      setPrimaryUrl("local");
    }
    // 3. Si túnel está activo pero ambos están caídos → mantener túnel (último recurso)
    else if (tunnelActive) {
      setPrimaryUrl("tunnel");
    }
    // 4. Si túnel está desactivado → usar local
    else {
      setPrimaryUrl("local");
    }
  }, [tunnelActive, tunnelUrlHealthy, localUrlHealthy]);

  // Effect para auto-iniciar LocalTunnel al cargar la aplicación
  useEffect(() => {
    const autoStartTunnel = async () => {
      // Esperar 2 segundos para que cargue la app
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Solo iniciar si no está activo ya
      if (!tunnelActive) {
        try {
          const result = await window.api.startLocalTunnel();
          if (result.ok) {
            setTunnelUrl(result.url);
            setTunnelActive(true);
            addToast("🌍 LocalTunnel iniciado automáticamente", "success", 3000);
          }
        } catch (e) {
          console.log("No se pudo auto-iniciar LocalTunnel:", e);
        }
      }
    };

    autoStartTunnel();
  }, [addToast, tunnelActive]); // Solo ejecutar una vez al montar
  
  // Estados para formularios
  const [showModalGestion, setShowModalGestion] = useState(false);
  const [showModalCampana, setShowModalCampana] = useState(false);
  const [showModalEmpresa, setShowModalEmpresa] = useState(false);
  const [gestionForm, setGestionForm] = useState({
    tipo: "Llamada",
    resultado: "Contactado",
    observacion: "",
    motivo: "",
    fecha_promesa: "",
    monto_promesa: 0
  });
  const [campanaForm, setCampanaForm] = useState({
    nombre: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    responsable: ""
  });
  const [showModalDisputa, setShowModalDisputa] = useState(false);
  const [showModalCuenta, setShowModalCuenta] = useState(false);
  const [showModalLimpiar, setShowModalLimpiar] = useState(false);
  const [disputaForm, setDisputaForm] = useState({
    documento: "",
    cliente: "",
    monto: 0,
    motivo: "",
    observacion: ""
  });
  const [cuentaForm, setCuentaForm] = useState({
    documento: "",
    cliente: "",
    monto: 0,
    tipo: "Adelanto",
    observacion: ""
  });
  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    if (isWeb) return;

    try {
      const [empData, statsData, filtros, top, promData, campData, riesgo, motivos, productividad, segmento, alertasData, pronostData, tendData, disputasData, cuentasData] = await Promise.all([
        window.api.empresaObtener(),
        window.api.statsObtener(),
        window.api.filtrosListar(),
        window.api.topClientes(10),
        window.api.gestionesListar(""),
        window.api.campanasListar?.() || { ok: true, rows: [] },
        window.api.clientesAnalisis?.() || { ok: true, rows: [] },
        window.api.motivosImpago?.() || [],
        window.api.productividadGestor?.() || [],
        window.api.segmentacionRiesgo?.() || [],
        window.api.alertasIncumplimiento?.() || [],
        window.api.pronosticoFlujoCaja?.() || [],
        window.api.tendenciasHistoricas?.() || [],
        window.api.disputasListar?.() || [],
        window.api.cuentasAplicarListar?.() || []
      ]);

      // Obtener URL del repositorio remoto Git
      if (window.api.getGitRemoteUrl) {
        try {
          const remoteUrl = await window.api.getGitRemoteUrl();
          if (remoteUrl?.url) setRepoUrl(remoteUrl.url);
        } catch (e) {
          console.log("No se pudo obtener URL remoto:", e);
        }
      }

      if (empData) setEmpresa(empData as Empresa);
      if (statsData) setStats(statsData as unknown as Stats);
      if (filtros) {
        const f = filtros as { clientes?: Array<{ cliente: string; razon_social: string }>; vendedores?: string[] };
        setClientes(f.clientes || []);
        setVendedores(f.vendedores || []);
      }
      const topData = top as { rows?: unknown[] } | unknown[];
      const topList = Array.isArray(topData) ? topData : (topData?.rows || []);
      setTopClientes(topList as unknown as TopCliente[]);
      if (promData) setPromesas((promData as Gestion[]).filter((g: Gestion) => g.resultado?.includes("Promesa")));
      const campDataTyped = campData as { ok?: boolean; rows?: unknown[] };
      if (campDataTyped?.ok) setCampanas((campDataTyped.rows || []) as unknown as Campana[]);
      const riesgoTyped = riesgo as { ok?: boolean; rows?: unknown[] };
      if (riesgoTyped?.ok) setAnalisisRiesgo((riesgoTyped.rows || []) as unknown as AnalisisRiesgo[]);
      if (motivos) setMotivosData(motivos as MotivoImpago[]);
      if (productividad) setProductividadData(productividad as ProductividadGestor[]);
      if (segmento) setSegmentacionRiesgo(segmento as unknown as SegmentacionRiesgo[]);
      if (alertasData) setAlertas(alertasData as Alerta[]);
      if (pronostData) setPronosticos(pronostData as unknown as Pronostico[]);
      if (tendData) setTendencias(tendData as TendenciaMes[]);
      if (disputasData) setDisputas(disputasData as Disputa[]);
      if (cuentasData) setCuentasAplicar(cuentasData as CuentaAplicar[]);
    } catch (e) {
      console.error("Error cargando datos:", e);
    }
  }

  // Funciones de filtrado
  const filteredDocumentos = docs.filter((d: Documento) => {
    const search = searchDocumentos.toLowerCase();
    return !search || d.cliente.toLowerCase().includes(search) || d.documento.toLowerCase().includes(search);
  });

  const filteredGestiones = gestiones.filter((g: Gestion) => {
    const search = searchGestiones.toLowerCase();
    const matchSearch = !search || g.cliente.toLowerCase().includes(search) || g.observacion.toLowerCase().includes(search);
    const matchEstado = filtroEstadoGestion === "Todos" || (g.resultado?.includes(filtroEstadoGestion) || false);
    return matchSearch && matchEstado;
  });

  const filteredAlertas = alertas.filter((a: Alerta) => {
    const search = searchAlertas.toLowerCase();
    const matchSearch = !search || a.cliente.toLowerCase().includes(search) || a.documento.toLowerCase().includes(search);
    const matchSeveridad = filtroSeveridad === "Todos" || a.severidad === filtroSeveridad;
    return matchSearch && matchSeveridad;
  });

  const filteredDisputas = disputas.filter((d: Disputa) => {
    const search = searchDisputas.toLowerCase();
    const matchSearch = !search || d.cliente.toLowerCase().includes(search) || d.documento.toLowerCase().includes(search);
    const matchEstado = filtroEstadoDisputa === "Todos" || d.estado === filtroEstadoDisputa;
    return matchSearch && matchEstado;
  });

  const filteredCuentas = cuentasAplicar.filter((c: CuentaAplicar) => {
    const search = searchCuentas.toLowerCase();
    const matchSearch = !search || c.cliente.toLowerCase().includes(search) || (c.documento || "").toLowerCase().includes(search);
    const matchEstado = filtroEstadoCuenta === "Todos" || c.estado === filtroEstadoCuenta;
    return matchSearch && matchEstado;
  });

  async function cargarDocumentos() {
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
  }

  async function cargarGestiones() {
    if (isWeb || !selectedCliente) return;
    try {
      const data = await window.api.gestionesListar(selectedCliente);
      if (data) setGestiones(data as Gestion[]);
    } catch (e) {
      console.error("Error cargando gestiones:", e);
    }
  }

  const cargarDocumentosCallback = useCallback(cargarDocumentos, [selectedCliente, selectedVendedor]);
  const cargarGestionesCallback = useCallback(cargarGestiones, [selectedCliente]);

  useEffect(() => {
    cargarDocumentosCallback();
  }, [cargarDocumentosCallback]);

  useEffect(() => {
    if (selectedCliente) cargarGestionesCallback();
  }, [cargarGestionesCallback, selectedCliente]);

  async function guardarGestion() {
    if (isWeb || !selectedCliente) return;
    try {
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
      await cargarGestiones();
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
      await cargarGestiones();
      await cargarDatos();
    } catch (e) {
      addToast("Error eliminando gestión", "error");
      console.error("Error eliminando gestión:", e);
    }
  }

  async function guardarDisputa() {
    if (isWeb) return;
    try {
      await window.api.disputaCrear(disputaForm);
      setShowModalDisputa(false);
      setDisputaForm({ documento: "", cliente: "", monto: 0, motivo: "", observacion: "" });
      addToast("Disputa creada exitosamente", "success");
      await cargarDatos();
    } catch (e) {
      addToast("Error creando disputa", "error");
      console.error("Error guardando disputa:", e);
    }
  }

  async function guardarCuenta() {
    if (isWeb) return;
    try {
      await window.api.cuentaAplicarCrear(cuentaForm);
      setShowModalCuenta(false);
      setCuentaForm({ documento: "", cliente: "", monto: 0, tipo: "Adelanto", observacion: "" });
      addToast("Cuenta creada exitosamente", "success");
      await cargarDatos();
    } catch (e) {
      addToast("Error creando cuenta", "error");
      console.error("Error guardando cuenta por aplicar:", e);
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

  async function guardarCampana() {
    if (isWeb) return;
    try {
      await window.api.campanaCrear?.(campanaForm);
      setShowModalCampana(false);
      setCampanaForm({
        nombre: "",
        descripcion: "",
        fecha_inicio: "",
        fecha_fin: "",
        responsable: ""
      });
      addToast("Campaña guardada exitosamente", "success");
      await cargarDatos();
    } catch (e) {
      addToast("Error guardando campaña", "error");
      console.error("Error guardando campaña:", e);
    }
  }

  async function eliminarCampana(id: number) {
    if (isWeb) return;
    try {
      await window.api.campanaEliminar?.(id);
      addToast("Campaña eliminada", "success");
      await cargarDatos();
    } catch (e) {
      addToast("Error eliminando campaña", "error");
      console.error("Error eliminando campaña:", e);
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

  const deudaCliente = useMemo(() => {
    if (!selectedCliente) return { total: 0, vencido: 0 };
    const clienteDocs = docs.filter(d => d.razon_social === selectedCliente || d.cliente === selectedCliente);
    const total = clienteDocs.reduce((s, d) => s + d.total, 0);
    const vencido = clienteDocs.filter(d => new Date(d.fecha_vencimiento) < new Date()).reduce((s, d) => s + d.total, 0);
    return { total, vencido };
  }, [docs, selectedCliente]);

  const agingData = useMemo(() => {
    if (!stats?.aging) return null;
    return [
      { name: "Por Vencer", saldo: stats.aging.porVencer },
      { name: "1-30", saldo: stats.aging.d30 },
      { name: "31-60", saldo: stats.aging.d60 },
      { name: "61-90", saldo: stats.aging.d90 },
      { name: "91-120", saldo: stats.aging.d120 },
      { name: ">120", saldo: stats.aging.d120p }
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
    if (tab === "dashboard") {
      return (
        <div className="dashboard-grid">
          {/* SECCIÓN 1: 5 KPIs CRÍTICOS */}
          <div className="card">
            <div className="card-title">📊 KPIs Críticos</div>
            <div className="kpis-grid">
              <div className="kpi-card">
                <div className="kpi-title">NPL (Morosidad %)</div>
                <div className={`kpi-value ${stats && stats.npl > 30 ? 'kpi-negative' : 'kpi-positive'}`}>
                  {stats?.npl?.toFixed(2)}%
                </div>
                <div className="kpi-subtitle">% Cartera vencida</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">DSO (Días)</div>
                <div className="kpi-value">{stats?.dso || 0}</div>
                <div className="kpi-subtitle">Días promedio de cobro</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Recuperación Mes</div>
                <div className="kpi-value">{fmtMoney(stats?.recuperacionMesActual || 0)}</div>
                <div className="kpi-subtitle">Meta: {fmtMoney(stats?.metaMensual || 0)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Cumplimiento Promesas</div>
                <div className={`kpi-value ${stats && stats.tasaCumplimientoPromesas >= 70 ? 'kpi-positive' : 'kpi-warning'}`}>
                  {stats?.tasaCumplimientoPromesas || 0}%
                </div>
                <div className="kpi-subtitle">Promesas pagadas</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Cobrado</div>
                <div className="kpi-value kpi-positive">{fmtMoney(stats?.totalCobrado || 0)}</div>
                <div className="kpi-subtitle">Mes actual</div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: 5 KPIs GENERALES */}
          <div className="card">
            <div className="card-title">💰 KPIs Generales</div>
            <div className="kpis-grid">
              <div className="kpi-card">
                <div className="kpi-title">Saldo Total</div>
                <div className="kpi-value">{fmtMoney(stats?.totalSaldo || 0)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Vencido</div>
                <div className="kpi-value kpi-negative">{fmtMoney(stats?.vencidaSaldo || 0)}</div>
                <div className="kpi-subtitle">{stats?.percentVencida?.toFixed(1)}% del total</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Mora +90</div>
                <div className="kpi-value kpi-negative">{fmtMoney(stats?.mora90Saldo || 0)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Documentos</div>
                <div className="kpi-value">{stats?.docsPendientes || 0}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Clientes</div>
                <div className="kpi-value">{stats?.clientesConSaldo || 0}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Aging de Cartera</div>
            {agingData && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agingData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="colorAmber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="colorDark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#991b1b" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#7f1d1d" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '0.8rem' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '0.75rem' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
                  <Bar dataKey="saldo" fill="url(#colorGreen)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="card-title">👥 Top 10 Clientes por Saldo</div>
            {topClientesData ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topClientesData} layout="vertical" margin={{ top: 10, right: 20, left: 200, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#9ca3af" style={{ fontSize: '0.75rem' }} />
                  <YAxis dataKey="name" type="category" width={195} stroke="#9ca3af" style={{ fontSize: '0.75rem' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
                  <Bar dataKey="saldo" radius={[0, 8, 8, 0]}>
                    {topClientesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <p>No hay clientes con saldo pendiente</p>
              </div>
            )}
          </div>

          {promesas.length > 0 && (
            <div className="card card-urgent">
              <div className="card-title">⚠️ Promesas de Pago Pendientes ({promesas.length})</div>
              <div className="promesas-lista">
                {promesas.slice(0, 5).map(p => (
                  <div key={p.id} className="promesa-item">
                    <div className="promesa-main">
                      <div className="promesa-info">{p.razon_social || p.cliente}</div>
                      <div className="promesa-fecha">📅 {p.fecha_promesa}</div>
                      <div className="promesa-monto">{fmtMoney(p.monto_promesa || 0)}</div>
                    </div>
                    <button className="btn secondary" onClick={() => cumplirPromesa(p.id)}>✓ Cumplida</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ALERTAS RESUMIDAS */}
          {alertas.length > 0 && (
            <div className="card">
              <div className="card-title">🚨 Top 5 Alertas de Incumplimiento</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart 
                  data={alertas.slice(0, 5).map(a => ({
                    cliente: a.cliente.substring(0, 20),
                    dias: a.diasVencidos,
                    fill: a.severidad === "Crítico" ? "#ef4444" : a.severidad === "Alto" ? "#f59e0b" : "#3b82f6"
                  }))} 
                  layout="vertical" 
                  margin={{ top: 10, right: 20, left: 150, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="colorCritico" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="colorAlto" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="colorMedio" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#9ca3af" style={{ fontSize: '0.75rem' }} label={{ value: 'Días Vencidos', position: 'insideBottom', offset: -5 }} />
                  <YAxis dataKey="cliente" type="category" width={145} stroke="#9ca3af" style={{ fontSize: '0.7rem' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.85rem' }} />
                  <Bar dataKey="dias" radius={[0, 8, 8, 0]}>
                    {alertas.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.severidad === "Crítico" ? "url(#colorCritico)" : entry.severidad === "Alto" ? "url(#colorAlto)" : "url(#colorMedio)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <button className="btn primary alertas-btn alertas-btn-margin" onClick={() => setTab("alertas")}>Ver todas las alertas →</button>
            </div>
          )}
        </div>
      );
    }

    if (tab === "gestion") {
      return (
        <div className="dashboard-grid">
          <div className="card">
            <div className="card-title">Buscar Cliente</div>
            <label className="field">
              <span>Cliente</span>
              <select value={selectedCliente} onChange={e => setSelectedCliente(e.target.value)}>
                <option value="">-- Seleccione --</option>
                {clientes.map(c => (
                  <option key={c.cliente} value={c.razon_social}>{c.razon_social}</option>
                ))}
              </select>
            </label>

            {selectedCliente && (
              <>
                <div className="kpis-grid">
                  <div className="kpi-card">
                    <div className="kpi-title">Deuda Total</div>
                    <div className="kpi-value">{fmtMoney(deudaCliente.total)}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">Vencido</div>
                    <div className="kpi-value kpi-negative">{fmtMoney(deudaCliente.vencido)}</div>
                  </div>
                </div>
                <button className="btn primary" onClick={() => setShowModalGestion(true)}>+ Nueva Gestión</button>
              </>
            )}
          </div>

          {selectedCliente && (
            <>
              <div className="card">
                <div className="card-title">Documentos del Cliente</div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>F. Vencimiento</th>
                        <th className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.slice(0, 10).map(d => (
                        <tr key={d.id}>
                          <td>{d.documento}</td>
                          <td>{d.fecha_vencimiento}</td>
                          <td className="num">{fmtMoney(d.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-title">Historial de Gestiones</div>
                <div className="row">
                  <label className="field">
                    <span>Buscar</span>
                    <input type="text" value={searchGestiones} onChange={e => setSearchGestiones(e.target.value)} placeholder="Buscar por cliente u observación..." />
                  </label>
                  <label className="field">
                    <span>Estado</span>
                    <select value={filtroEstadoGestion} onChange={e => setFiltroEstadoGestion(e.target.value)}>
                      <option value="Todos">Todos</option>
                      <option value="Contactado">Contactado</option>
                      <option value="Promesa">Promesa</option>
                      <option value="Pagado">Pagado</option>
                      <option value="No contesta">No contesta</option>
                    </select>
                  </label>
                </div>
                <div className="promesas-lista">
                  {filteredGestiones.length > 0 ? (
                    filteredGestiones.map(g => (
                      <div key={g.id} className="promesa-item">
                        <div className="promesa-main">
                          <div className="promesa-info">{g.tipo} - {g.resultado}</div>
                          <div className="promesa-fecha">{g.fecha}</div>
                          <div>{g.observacion}</div>
                        </div>
                        <button className="promesa-eliminar" onClick={() => eliminarGestion(g.id)}>✕</button>
                      </div>
                    ))
                  ) : (
                    <p className="promesa-vacia">Sin gestiones registradas</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    if (tab === "reportes") {
      return (
        <div className="card">
          <div className="card-title">Reporte de Documentos</div>
          <div className="row">
            <label className="field">
              <span>Cliente</span>
              <select value={selectedCliente} onChange={e => setSelectedCliente(e.target.value)}>
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
          </div>
          <div className="row">
            <label className="field">
              <span>Búsqueda</span>
              <input type="text" value={searchDocumentos} onChange={e => setSearchDocumentos(e.target.value)} placeholder="Buscar por cliente o documento..." />
            </label>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Vendedor</th>
                  <th>F. Vencimiento</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocumentos.length > 0 ? (
                  filteredDocumentos.map(d => (
                    <tr key={d.id}>
                      <td>{d.razon_social}</td>
                      <td>{d.documento}</td>
                      <td>{d.vendedor}</td>
                      <td>{d.fecha_vencimiento}</td>
                      <td className="num">{fmtMoney(d.total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5}>No hay resultados</td></tr>
                )}
              </tbody>
            </table>
            <p className="table-footnote">Mostrando {filteredDocumentos.length} de {docs.length} documentos</p>
          </div>
        </div>
      );
    }

    if (tab === "crm") {
      return (
        <div className="card">
          <div className="card-title">Gestión de Promesas de Pago</div>
          <div className="promesas-lista">
            {promesas.map(p => (
              <div key={p.id} className="promesa-item">
                <div className="promesa-main">
                  <div className="promesa-info">{p.razon_social || p.cliente}</div>
                  <div className="promesa-fecha">📅 {p.fecha_promesa}</div>
                  <div className="promesa-monto">{fmtMoney(p.monto_promesa || 0)}</div>
                  <div>{p.observacion}</div>
                </div>
                <div>
                  <button className="btn primary" onClick={() => cumplirPromesa(p.id)}>✓ Cumplida</button>
                  <button className="promesa-eliminar" onClick={() => eliminarGestion(p.id)}>✕</button>
                </div>
              </div>
            ))}
            {promesas.length === 0 && <p className="promesa-vacia">No hay promesas de pago pendientes</p>}
          </div>
        </div>
      );
    }

    if (tab === "campanas") {
      return (
        <div className="card">
          <div className="card-title">
            Campañas de Cobranza
            <button className="btn primary" onClick={() => setShowModalCampana(true)}>+ Nueva Campaña</button>
          </div>
          <div className="promesas-lista">
            {campanas.map(c => (
              <div key={c.id} className="promesa-item">
                <div className="promesa-main">
                  <div className="promesa-info">{c.nombre}</div>
                  <div>{c.descripcion}</div>
                  <div className="promesa-fecha">{c.fecha_inicio} → {c.fecha_fin}</div>
                  <div>Responsable: {c.responsable}</div>
                </div>
                <button className="promesa-eliminar" onClick={() => eliminarCampana(c.id)}>✕</button>
              </div>
            ))}
            {campanas.length === 0 && <p className="promesa-vacia">No hay campañas creadas</p>}
          </div>
        </div>
      );
    }

    if (tab === "analisis") {
      return (
        <div>
          <div className="card">
            <div className="card-title">Motivos de Impago</div>
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
                  }) : <tr><td colSpan={4}>Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Productividad por Gestor</div>
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
                  )) : <tr><td colSpan={6}>Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Segmentación de Riesgo</div>
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
                  )) : <tr><td colSpan={4}>Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Análisis de Riesgo de Clientes</div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="num">Deuda Total</th>
                    <th className="num">Deuda Vencida</th>
                    <th className="num">Días Mora</th>
                    <th className="num">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {analisisRiesgo.map((a, i) => (
                    <tr key={i}>
                      <td>{a.razon_social}</td>
                      <td className="num">{fmtMoney(a.total_deuda)}</td>
                      <td className="num">{fmtMoney(a.deuda_vencida)}</td>
                      <td className="num">{a.max_dias_mora}</td>
                      <td className="num">
                        <span className={a.score < 50 ? "kpi-negative" : ""}>{a.score}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (tab === "alertas") {
      return (
        <div>
          <div className="card">
            <div className="card-title">🚨 Alertas de Incumplimiento</div>
            <div className="row">
              <label className="field">
                <span>Búsqueda</span>
                <input type="text" value={searchAlertas} onChange={e => setSearchAlertas(e.target.value)} placeholder="Buscar por cliente o documento..." />
              </label>
              <label className="field">
                <span>Severidad</span>
                <select value={filtroSeveridad} onChange={e => setFiltroSeveridad(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Crítico">Crítico</option>
                  <option value="Alto">Alto</option>
                  <option value="Medio">Medio</option>
                  <option value="Bajo">Bajo</option>
                </select>
              </label>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="num">Documento</th>
                    <th className="num">Monto</th>
                    <th className="num">Días Vencido</th>
                    <th className="num">Severidad</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlertas.length > 0 ? filteredAlertas.map((a, i) => (
                    <tr key={i}>
                      <td>{a.cliente}</td>
                      <td className="num">{a.documento}</td>
                      <td className="num">{fmtMoney(a.monto)}</td>
                      <td className="num">{a.diasVencidos}</td>
                      <td className="num">
                        <span className={a.severidad === "Crítico" ? "kpi-negative" : a.severidad === "Alto" ? "kpi-warning" : ""}>
                          {a.severidad}
                        </span>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={5}>No hay alertas</td></tr>}
                </tbody>
              </table>
              <p className="table-footnote">Mostrando {filteredAlertas.length} de {alertas.length} alertas</p>
            </div>
          </div>

          <div className="card">
            <div className="card-title">💰 Pronóstico de Flujo de Caja</div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th className="num">Hasta</th>
                    <th className="num">Flujo Esperado</th>
                    <th className="num">Confianza</th>
                  </tr>
                </thead>
                <tbody>
                  {pronosticos.length > 0 ? pronosticos.map((p, i) => (
                    <tr key={i}>
                      <td>{p.periodo}</td>
                      <td className="num">{p.fechaHasta}</td>
                      <td className="num">{fmtMoney(p.flujoEsperado)}</td>
                      <td className="num">{p.confianza}%</td>
                    </tr>
                  )) : <tr><td colSpan={4}>Sin pronósticos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (tab === "tendencias") {
      return (
        <div className="card">
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
                    <td>{t.mes}</td>
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
      );
    }

    if (tab === "disputas") {
      return (
        <div>
          <div className="card">
            <div className="card-title">⚖️ Gestión de Disputas</div>
            <button className="btn primary" onClick={() => setShowModalDisputa(true)}>+ Nueva Disputa</button>
            <div className="row row-spaced">
              <label className="field">
                <span>Búsqueda</span>
                <input type="text" value={searchDisputas} onChange={e => setSearchDisputas(e.target.value)} placeholder="Buscar por cliente o documento..." />
              </label>
              <label className="field">
                <span>Estado</span>
                <select value={filtroEstadoDisputa} onChange={e => setFiltroEstadoDisputa(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Abierta">Abierta</option>
                  <option value="Resuelta">Resuelta</option>
                </select>
              </label>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Cliente</th>
                    <th className="num">Monto</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDisputas.length > 0 ? filteredDisputas.map((d, i) => (
                    <tr key={i}>
                      <td>{d.documento}</td>
                      <td>{d.cliente}</td>
                      <td className="num">{fmtMoney(d.monto)}</td>
                      <td>{d.motivo}</td>
                      <td><span className={d.estado === "Abierta" ? "kpi-negative" : "kpi-positive"}>{d.estado}</span></td>
                    </tr>
                  )) : <tr><td colSpan={5}>No hay disputas</td></tr>}
                </tbody>
              </table>
              <p className="table-footnote">Mostrando {filteredDisputas.length} de {disputas.length} disputas</p>
            </div>
          </div>
        </div>
      );
    }

    if (tab === "cuentas") {
      return (
        <div>
          <div className="card">
            <div className="card-title">💳 Cuentas por Aplicar</div>
            <button className="btn primary" onClick={() => setShowModalCuenta(true)}>+ Nueva Cuenta</button>
            <div className="row row-spaced">
              <label className="field">
                <span>Búsqueda</span>
                <input type="text" value={searchCuentas} onChange={e => setSearchCuentas(e.target.value)} placeholder="Buscar por cliente o documento..." />
              </label>
              <label className="field">
                <span>Estado</span>
                <select value={filtroEstadoCuenta} onChange={e => setFiltroEstadoCuenta(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Aplicada">Aplicada</option>
                </select>
              </label>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Cliente</th>
                    <th className="num">Monto</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCuentas.length > 0 ? filteredCuentas.map((c, i) => (
                    <tr key={i}>
                      <td>{c.documento}</td>
                      <td>{c.cliente}</td>
                      <td className="num">{fmtMoney(c.monto)}</td>
                      <td>{c.tipo}</td>
                      <td><span className={c.estado === "Pendiente" ? "kpi-warning" : "kpi-positive"}>{c.estado}</span></td>
                    </tr>
                  )) : <tr><td colSpan={5}>No hay cuentas</td></tr>}
                </tbody>
              </table>
              <p className="table-footnote">Mostrando {filteredCuentas.length} de {cuentasAplicar.length} cuentas</p>
            </div>
          </div>
        </div>
      );
    }

    if (tab === "config") {
      return (
        <div className="card">
          <div className="card-title">Configuración</div>
          <button className="btn primary" onClick={() => setShowModalEmpresa(true)}>⚙️ Datos de Empresa</button>
          <button className="btn primary" onClick={importarExcel}>📥 Importar desde Excel</button>
          <button className="btn secondary" onClick={cargarDatos}>🔄 Recargar Datos</button>
          <button className="btn danger" onClick={async () => {
            const result = await window.api.reiniciarEstructuraExcel?.();
            if (result?.ok) {
              addToast(result.message || "Estructura reiniciada", "success");
            } else {
              addToast(result?.message || "Error reiniciando estructura", "error");
            }
          }}>🔄 Reiniciar Estructura Excel</button>
          <button className="btn danger" onClick={() => setShowModalLimpiar(true)}>🧹 Limpiar Base de Datos</button>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>💰 Cartera Dashboard</h1>
          <span className="badge">{empresa.nombre}</span>
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
          {/* URL unificada que alterna entre Local y Túnel */}
          {(repoUrl || tunnelUrl) && (
            <div 
              className={`header-info header-info-clickable url-primary`}
              onClick={() => copyToClipboard(primaryUrl === "tunnel" && tunnelUrl ? tunnelUrl : repoUrl)} 
              title={`📍 URL COMPARTIBLE - ${primaryUrl === "tunnel" ? "LocalTunnel (remoto)" : "Red Local"} - Clic para copiar`}
            >
              <span className="info-label">
                {primaryUrl === "tunnel" && tunnelUrlHealthy ? "🌍" : 
                 primaryUrl === "tunnel" && !tunnelUrlHealthy ? "🔴" : "🟢"}
              </span>
              <span className="info-value info-url url-max-width">
                {primaryUrl === "tunnel" && tunnelUrl ? tunnelUrl : repoUrl}
              </span>
              {primaryUrl === "tunnel" && !tunnelUrlHealthy && <span className="health-badge">⚠️</span>}
            </div>
          )}
          {/* Control de activación de túnel */}
          <div 
            className={`header-info header-info-clickable ${tunnelActive ? 'tunnel-active' : ''}`}
            onClick={() => {
              if (tunnelActive && tunnelUrl) {
                // Si está activo, copiar la URL
                copyToClipboard(tunnelUrl);
              } else {
                // Si está inactivo, activar
                toggleLocalTunnel();
              }
            }}
            title={tunnelActive ? "LocalTunnel ACTIVO - Clic para copiar URL" : "Clic para activar LocalTunnel (acceso remoto)"}
          >
            <span className="info-label">{tunnelActive ? "🔗" : "🌍"}</span>
            <span className={`info-value ${tunnelActive ? "tunnel-on" : "tunnel-off"}`}>
              {tunnelActive ? "Túnel ON" : "Activar Túnel"}
            </span>
          </div>
          <div className="header-info">
            <span className="info-label">💾</span>
            <span className="info-value info-path">{isWeb ? "Modo Web" : "C:\\Users\\...\\cartera.db"}</span>
          </div>
        </div>
      </header>

      <nav className="nav-bar">
        <button className={tab === "dashboard" ? "nav-item active" : "nav-item"} onClick={() => setTab("dashboard")}>📊 Dashboard</button>
        <button className={tab === "gestion" ? "nav-item active" : "nav-item"} onClick={() => setTab("gestion")}>📋 Gestión</button>
        <button className={tab === "reportes" ? "nav-item active" : "nav-item"} onClick={() => setTab("reportes")}>📄 Reportes</button>
        <button className={tab === "crm" ? "nav-item active" : "nav-item"} onClick={() => setTab("crm")}>👥 CRM</button>
        <button className={tab === "campanas" ? "nav-item active" : "nav-item"} onClick={() => setTab("campanas")}>📢 Campañas</button>
        <button className={tab === "analisis" ? "nav-item active" : "nav-item"} onClick={() => setTab("analisis")}>🔍 Análisis</button>
        <button className={tab === "alertas" ? "nav-item active" : "nav-item"} onClick={() => setTab("alertas")}>🚨 Alertas</button>
        <button className={tab === "tendencias" ? "nav-item active" : "nav-item"} onClick={() => setTab("tendencias")}>📈 Tendencias</button>
        <button className={tab === "disputas" ? "nav-item active" : "nav-item"} onClick={() => setTab("disputas")}>⚖️ Disputas</button>
        <button className={tab === "cuentas" ? "nav-item active" : "nav-item"} onClick={() => setTab("cuentas")}>💳 Cuentas</button>
        <button className={tab === "config" ? "nav-item active" : "nav-item"} onClick={() => setTab("config")}>⚙️</button>
      </nav>

      <main className="content">
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
                <input value={gestionForm.observacion} onChange={e => setGestionForm({...gestionForm, observacion: e.target.value})} />
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

      {/* Modal Campaña */}
      {showModalCampana && (
        <div className="modal-overlay" onClick={() => setShowModalCampana(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">Nueva Campaña</div>
            <div className="modal-body">
              <label className="field">
                <span>Nombre</span>
                <input value={campanaForm.nombre} onChange={e => setCampanaForm({...campanaForm, nombre: e.target.value})} />
              </label>
              <label className="field">
                <span>Descripción</span>
                <input value={campanaForm.descripcion} onChange={e => setCampanaForm({...campanaForm, descripcion: e.target.value})} />
              </label>
              <label className="field">
                <span>Fecha Inicio</span>
                <input type="date" value={campanaForm.fecha_inicio} onChange={e => setCampanaForm({...campanaForm, fecha_inicio: e.target.value})} />
              </label>
              <label className="field">
                <span>Fecha Fin</span>
                <input type="date" value={campanaForm.fecha_fin} onChange={e => setCampanaForm({...campanaForm, fecha_fin: e.target.value})} />
              </label>
              <label className="field">
                <span>Responsable</span>
                <input value={campanaForm.responsable} onChange={e => setCampanaForm({...campanaForm, responsable: e.target.value})} />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowModalCampana(false)}>Cancelar</button>
              <button className="btn primary" onClick={guardarCampana}>Crear</button>
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
                <input value={empresa.direccion || ""} onChange={e => setEmpresa({...empresa, direccion: e.target.value})} />
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
                <span>Meta Mensual $</span>
                <input type="number" value={empresa.meta_mensual || 100000} onChange={e => setEmpresa({...empresa, meta_mensual: Number(e.target.value)})} />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowModalEmpresa(false)}>Cancelar</button>
              <button className="btn primary" onClick={guardarEmpresa}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Disputa */}
      {showModalDisputa && (
        <div className="modal-overlay" onClick={() => setShowModalDisputa(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">Nueva Disputa</div>
            <div className="modal-body">
              <label className="field">
                <span>Documento</span>
                <input value={disputaForm.documento} onChange={e => setDisputaForm({...disputaForm, documento: e.target.value})} placeholder="Ej: DOC-001" />
              </label>
              <label className="field">
                <span>Cliente</span>
                <input value={disputaForm.cliente} onChange={e => setDisputaForm({...disputaForm, cliente: e.target.value})} placeholder="Nombre del cliente" />
              </label>
              <label className="field">
                <span>Monto</span>
                <input type="number" step="0.01" value={disputaForm.monto} onChange={e => setDisputaForm({...disputaForm, monto: parseFloat(e.target.value) || 0})} placeholder="0.00" />
              </label>
              <label className="field">
                <span>Motivo</span>
                <select value={disputaForm.motivo} onChange={e => setDisputaForm({...disputaForm, motivo: e.target.value})}>
                  <option value="">-- Seleccionar --</option>
                  <option value="Mercancía no recibida">Mercancía no recibida</option>
                  <option value="Mercancía defectuosa">Mercancía defectuosa</option>
                  <option value="Duplicado">Duplicado</option>
                  <option value="Precio incorrecto">Precio incorrecto</option>
                  <option value="Calidad">Calidad</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>
              <label className="field">
                <span>Observación</span>
                <textarea value={disputaForm.observacion} onChange={e => setDisputaForm({...disputaForm, observacion: e.target.value})} placeholder="Detalles de la disputa" rows={3} />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowModalDisputa(false)}>Cancelar</button>
              <button className="btn primary" onClick={guardarDisputa}>Guardar Disputa</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cuenta por Aplicar */}
      {showModalCuenta && (
        <div className="modal-overlay" onClick={() => setShowModalCuenta(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">Nueva Cuenta por Aplicar</div>
            <div className="modal-body">
              <label className="field">
                <span>Documento</span>
                <input value={cuentaForm.documento} onChange={e => setCuentaForm({...cuentaForm, documento: e.target.value})} placeholder="Ej: DOC-001" />
              </label>
              <label className="field">
                <span>Cliente</span>
                <input value={cuentaForm.cliente} onChange={e => setCuentaForm({...cuentaForm, cliente: e.target.value})} placeholder="Nombre del cliente" />
              </label>
              <label className="field">
                <span>Monto</span>
                <input type="number" step="0.01" value={cuentaForm.monto} onChange={e => setCuentaForm({...cuentaForm, monto: parseFloat(e.target.value) || 0})} placeholder="0.00" />
              </label>
              <label className="field">
                <span>Tipo</span>
                <select value={cuentaForm.tipo} onChange={e => setCuentaForm({...cuentaForm, tipo: e.target.value})}>
                  <option value="">-- Seleccionar --</option>
                  <option value="Adelanto">Adelanto</option>
                  <option value="Abono sin factura">Abono sin factura</option>
                  <option value="Nota crédito">Nota crédito</option>
                </select>
              </label>
              <label className="field">
                <span>Observación</span>
                <textarea value={cuentaForm.observacion} onChange={e => setCuentaForm({...cuentaForm, observacion: e.target.value})} placeholder="Detalles de la cuenta" rows={3} />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowModalCuenta(false)}>Cancelar</button>
              <button className="btn primary" onClick={guardarCuenta}>Guardar Cuenta</button>
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
                <li>Disputas</li>
                <li>Cuentas por aplicar</li>
                <li>Historial de abonos</li>
                <li>Campañas</li>
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
                    await cargarDatos();
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

