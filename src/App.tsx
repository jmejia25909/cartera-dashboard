import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import "./App.css";
import { fmtMoney, fmtMoneyCompact, fmtCompactNumber } from "./utils/formatters";
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
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
  // URL remota obtenida dinámicamente desde ngrok
  const [remoteUrl, setRemoteUrl] = useState<string>("");
  const [localUrlHealthy, setLocalUrlHealthy] = useState(true);
  const [remoteUrlHealthy, setRemoteUrlHealthy] = useState(false);
  

  // Estado para detectar si el cliente tiene permisos de escritura
  const [hasWritePermissions, setHasWritePermissions] = useState(true);
  
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
  
  // Estados para tab Disputas
  const [disputaSeleccionada, setDisputaSeleccionada] = useState<number | null>(null);
  const [categoriaDisputa, setCategoriaDisputa] = useState("General");
  const [estadoIntermedio, setEstadoIntermedio] = useState("Nueva");
  
  // Estados para tab Cuentas
  const [modoAplicacion, setModoAplicacion] = useState<"manual" | "sugerida" | "masiva">("manual");
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarConciliacion, setMostrarConciliacion] = useState(false);
  
  // Estados para tab Reportes
  const [filtroAging, setFiltroAging] = useState("Todos");
  const [vistaAgrupada, setVistaAgrupada] = useState(false);
  
  // Estados para tab CRM
  const [filtroFecha, setFiltroFecha] = useState("Todas");
  const [filtroMonto, setFiltroMonto] = useState("Todos");
  
  // Estados para tab Campañas
  const [campanaSeleccionada, setCampanaSeleccionada] = useState<number | null>(null);
  const [clientesCampana, setClientesCampana] = useState<string[]>([]);
  
  // Estados para tab Análisis
  const [vistaAnalisis, setVistaAnalisis] = useState<"motivos" | "productividad" | "segmentacion" | "riesgo" | "comparativa">("motivos");
  
  // Estados para tab Alertas
  const [umbralDias, setUmbralDias] = useState(30);
  const [umbralMonto, setUmbralMonto] = useState(1000);
  const [alertasActivas, setAlertasActivas] = useState(0);
  const [alertasCerradasHoy, setAlertasCerradasHoy] = useState(0);
  
  // Estados para tab Tendencias
  const [vistaTendencia, setVistaTendencia] = useState<"tabla" | "grafico">("tabla");
  
  // Estado para notificaciones
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastIdRef = useRef(0);
  
  // Actualizar contador de alertas cuando cambian los datos
  useEffect(() => {
    setAlertasActivas(alertas.length);
    setAlertasCerradasHoy(Math.floor(Math.random() * 10));
  }, [alertas.length]);
  
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

  // Health check para URLs
  const checkUrlHealth = useCallback(async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 segundos timeout
      
      // Para URLs HTTPS de Cloudflare, probar el endpoint /api/stats
      const testUrl = url.includes('https://') ? `${url}/api/stats` : url;
      
      const response = await fetch(testUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow", // Seguir redirecciones
        mode: "cors", // Permitir CORS
      });
      clearTimeout(timeout);
      
      // Considerar respuesta válida si status está en rango 200-499
      return response.status >= 200 && response.status < 500;
    } catch (error) {
      // Para Cloudflare, si hay error de red pero el túnel está corriendo, considerar como "conectando"
      console.log(`Health check failed for ${url}:`, error);
      return false;
    }
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
      try {
        const result = await window.api.getGitRemoteUrl();
        if (result.ok && result.url && result.url !== repoUrl) {
          // La IP cambió - actualizar
          console.log(`📡 IP local actualizada: ${repoUrl} -> ${result.url}`);
          setRepoUrl(result.url);
          addToast(`🔄 IP actualizada: ${result.url}`, "info", 5000);
        }
      } catch (error) {
        console.error("Error verificando IP:", error);
      }
    }, 30000); // Verificar cada 30 segundos

    return () => clearInterval(ipCheckInterval);
  }, [repoUrl, addToast]);

  // Effect para health check periódico (Local + ngrok)
  useEffect(() => {
    const healthCheckInterval = setInterval(async () => {
      // Verificar salud de URL local
      if (repoUrl) {
        const localHealthy = await checkUrlHealth(repoUrl);
        setLocalUrlHealthy(localHealthy);
      }
      
      // Verificar estado de ngrok (URL remota)
      if (remoteUrl && window.api?.checkRemoteUrl) {
        try {
          const result = await window.api.checkRemoteUrl();
          if (result.ok && result.url) {
            setRemoteUrl(result.url);
            setRemoteUrlHealthy(true);
          } else {
            setRemoteUrlHealthy(false);
          }
        } catch (error) {
          console.error("Error verificando URL remota:", error);
          setRemoteUrlHealthy(false);
        }
      }
    }, 120000); // Cada 2 minutos para ngrok

    return () => clearInterval(healthCheckInterval);
  }, [remoteUrl, repoUrl, checkUrlHealth]);

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
    // Verificar permisos al cargar
    async function checkPermissions() {
      if (!isWeb && window.api?.hasWritePermissions) {
        try {
          const canWrite = await window.api.hasWritePermissions();
          setHasWritePermissions(canWrite);
        } catch {
          // Si falla, asumimos que es cliente remoto (sin permisos)
          setHasWritePermissions(false);
        }
      } else if (isWeb) {
        // Modo web = sin permisos de escritura
        setHasWritePermissions(false);
      }
    }
    checkPermissions();
    cargarDatos();
    
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
  }, []);

  async function cargarDatos() {
    try {
      if (isWeb) {
        // Modo web: usar fetch() al servidor HTTP
        const [empData, statsData, filtros, top] = await Promise.all([
          fetch("/api/empresa").then(r => r.json()),
          fetch("/api/stats").then(r => r.json()),
          fetch("/api/filtros").then(r => r.json()),
          fetch("/api/top-clientes?limit=10").then(r => r.json())
        ]);

        setEmpresa(empData);
        setStats(statsData);
        setVendedores(filtros.vendedores || []);
        setClientes(filtros.clientes || []);
        setTopClientes(top.rows || []);
        
        // Cargar gestiones para promesas
        const promData = await fetch("/api/gestiones").then(r => r.json());
        const proms = Array.isArray(promData) ? promData.filter((g: Gestion) => g.resultado.includes("Promesa")) : [];
        setPromesas(proms);
        
        return;
      }

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
                  <YAxis stroke="#9ca3af" style={{ fontSize: '0.75rem' }} tickFormatter={isMobile ? (v: number) => fmtCompactNumber(v) : undefined} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: isMobile ? '0.8rem' : '0.9rem' }}
                    formatter={(value: number) => (isMobile ? fmtMoneyCompact(value) : fmtMoney(value))}
                  />
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
                  <XAxis type="number" stroke="#9ca3af" style={{ fontSize: '0.75rem' }} tickFormatter={isMobile ? (v: number) => fmtCompactNumber(v) : undefined} />
                  <YAxis dataKey="name" type="category" width={195} stroke="#9ca3af" style={{ fontSize: '0.75rem' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: isMobile ? '0.8rem' : '0.9rem' }} 
                    formatter={(value: number) => (isMobile ? fmtMoneyCompact(value) : fmtMoney(value))}
                  />
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
                    <button className="btn secondary" onClick={() => cumplirPromesa(p.id)} disabled={!hasWritePermissions}>✓ Cumplida</button>
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
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: isMobile ? '0.8rem' : '0.85rem' }} />
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
      const clienteGestiones = gestiones.filter(g => g.razon_social === selectedCliente || g.cliente === selectedCliente);
      const totalGestiones = clienteGestiones.length;
      const ultimaGestion = clienteGestiones[0];
      const diasSinContacto = ultimaGestion ? Math.floor((new Date().getTime() - new Date(ultimaGestion.fecha).getTime()) / (1000 * 60 * 60 * 24)) : 999;
      const gestionesExitosas = clienteGestiones.filter(g => g.resultado.includes("Contactado") || g.resultado.includes("Promesa") || g.resultado.includes("Pagado")).length;
      const efectividad = totalGestiones > 0 ? Math.round((gestionesExitosas / totalGestiones) * 100) : 0;
      
      const getProximaAccion = () => {
        if (!selectedCliente) return "";
        if (diasSinContacto > 15) return "⚠️ Contacto urgente - más de 15 días sin gestión";
        if (diasSinContacto > 7) return "📞 Llamada de seguimiento recomendada";
        if (efectividad < 50 && totalGestiones > 3) return "🔄 Cambiar estrategia de contacto";
        return "✅ Seguimiento regular";
      };

      const getTipoIcon = (tipo: string) => {
        if (tipo.includes("Llamada")) return "📞";
        if (tipo.includes("Email") || tipo.includes("Correo")) return "📧";
        if (tipo.includes("WhatsApp")) return "💬";
        if (tipo.includes("Visita")) return "🏢";
        return "📝";
      };

      return (
        <div className="dashboard-grid">
          <div className="card">
            <div className="card-title">🔍 Buscar Cliente para Gestionar</div>
            <div className="row">
              <label className="field">
                <span>Cliente</span>
                <select value={selectedCliente} onChange={e => setSelectedCliente(e.target.value)}>
                  <option value="">-- Seleccione --</option>
                  {clientes.map(c => (
                    <option key={c.cliente} value={c.razon_social}>{c.razon_social}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Filtrar por Vendedor</span>
                <select value={selectedVendedor} onChange={e => setSelectedVendedor(e.target.value)}>
                  <option value="">Todos</option>
                  {vendedores.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>

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
                  <div className="kpi-card">
                    <div className="kpi-title">Total Gestiones</div>
                    <div className="kpi-value">{totalGestiones}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">Días Sin Contacto</div>
                    <div className={`kpi-value ${diasSinContacto > 15 ? 'kpi-negative' : diasSinContacto > 7 ? 'kpi-warning' : ''}`}>
                      {diasSinContacto === 999 ? 'N/A' : diasSinContacto}
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">Efectividad</div>
                    <div className={`kpi-value ${efectividad >= 70 ? 'kpi-positive' : efectividad >= 40 ? 'kpi-warning' : 'kpi-negative'}`}>
                      {efectividad}%
                    </div>
                  </div>
                </div>

                <div style={{ background: '#fff3cd', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#856404' }}>
                  <strong>💡 Próxima Acción:</strong> {getProximaAccion()}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={() => setShowModalGestion(true)} disabled={!hasWritePermissions}>
                    ➕ Nueva Gestión
                  </button>
                  <button className="btn secondary" onClick={() => alert('Función de llamada simulada')}>
                    📞 Llamar
                  </button>
                  <button className="btn secondary" onClick={() => alert('Función de email simulada')}>
                    📧 Enviar Email
                  </button>
                  <button className="btn secondary" onClick={() => alert('Función de WhatsApp simulada')}>
                    💬 WhatsApp
                  </button>
                </div>
              </>
            )}
          </div>

          {selectedCliente && (
            <>
              <div className="card">
                <div className="card-title">📄 Documentos del Cliente</div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>F. Vencimiento</th>
                        <th className="num">Días Vencido</th>
                        <th className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.slice(0, 10).map(d => (
                        <tr key={d.id}>
                          <td>{d.documento}</td>
                          <td>{d.fecha_vencimiento}</td>
                          <td className="num">
                            <span className={d.dias_vencidos && d.dias_vencidos > 0 ? 'kpi-negative' : ''}>
                              {d.dias_vencidos || 0}
                            </span>
                          </td>
                          <td className="num">{fmtMoney(d.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-title">📋 Timeline de Gestiones</div>
                <div className="row">
                  <label className="field">
                    <span>Buscar</span>
                    <input type="text" value={searchGestiones} onChange={e => setSearchGestiones(e.target.value)} placeholder="Buscar en observaciones..." />
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
                      <div key={g.id} className="promesa-item" style={{ borderLeft: `4px solid ${g.resultado.includes('Pagado') ? '#2ea44f' : g.resultado.includes('Promesa') ? '#f59e0b' : g.resultado.includes('No') ? '#e63946' : '#3b82f6'}` }}>
                        <div className="promesa-main">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.5rem' }}>{getTipoIcon(g.tipo)}</span>
                            <div>
                              <div className="promesa-info" style={{ fontWeight: 700 }}>{g.tipo} - {g.resultado}</div>
                              <div className="promesa-fecha" style={{ fontSize: '0.85rem' }}>📅 {g.fecha}</div>
                            </div>
                          </div>
                          <div style={{ marginTop: '8px', color: '#6b7280' }}>{g.observacion}</div>
                          {g.motivo && <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#9ca3af' }}>🏷️ Motivo: {g.motivo}</div>}
                          {g.fecha_promesa && <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#f59e0b' }}>⏰ Promesa: {g.fecha_promesa} - {fmtMoney(g.monto_promesa || 0)}</div>}
                        </div>
                        <button className="promesa-eliminar" onClick={() => eliminarGestion(g.id)} disabled={!hasWritePermissions}>✕</button>
                      </div>
                    ))
                  ) : (
                    <p className="promesa-vacia">Sin gestiones registradas para este cliente</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    if (tab === "reportes") {
      const docsConAging = filteredDocumentos.map(d => {
        const dias = d.dias_vencidos || 0;
        let aging = "Por vencer";
        if (dias > 0 && dias <= 30) aging = "0-30 días";
        else if (dias > 30 && dias <= 60) aging = "30-60 días";
        else if (dias > 60 && dias <= 90) aging = "60-90 días";
        else if (dias > 90) aging = "+90 días";
        return { ...d, aging };
      });

      const docsFiltradosAging = filtroAging === "Todos" ? docsConAging : docsConAging.filter(d => d.aging === filtroAging);
      
      const totalMonto = docsFiltradosAging.reduce((sum, d) => sum + d.total, 0);
      const promedioMonto = docsFiltradosAging.length > 0 ? totalMonto / docsFiltradosAging.length : 0;
      const top5Clientes = docsFiltradosAging.reduce((acc, d) => {
        const key = d.razon_social || d.cliente;
        acc[key] = (acc[key] || 0) + d.total;
        return acc;
      }, {} as Record<string, number>);
      const concentracionTop5 = Object.values(top5Clientes).sort((a, b) => b - a).slice(0, 5).reduce((sum, v) => sum + v, 0);
      const pctConcentracion = totalMonto > 0 ? (concentracionTop5 / totalMonto * 100).toFixed(1) : 0;

      const agrupados = vistaAgrupada ? docsFiltradosAging.reduce((acc, d) => {
        const key = selectedVendedor ? d.razon_social : d.vendedor || "Sin Vendedor";
        if (!acc[key]) acc[key] = { items: [], total: 0 };
        acc[key].items.push(d);
        acc[key].total += d.total;
        return acc;
      }, {} as Record<string, { items: typeof docsFiltradosAging, total: number }>) : {};

      const exportarExcel = () => {
        const dataExport = docsFiltradosAging.map(d => ({
          'Documento': d.numero,
          'Cliente': d.cliente,
          'Vendedor': d.vendedor,
          'Emisión': d.fecha_emision,
          'Vencimiento': d.fecha_vencimiento,
          'Días Vencidos': d.dias_vencidos || 0,
          'Aging': d.aging,
          'Monto Total': d.total,
          'Saldo': d.saldo
        }));
        
        const ws = XLSX.utils.json_to_sheet(dataExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cartera');
        XLSX.writeFile(wb, `Cartera_${new Date().toISOString().split('T')[0]}.xlsx`);
        addToast('✅ Reporte Excel generado', 'success');
      };

      const exportarPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Reporte de Cartera', 14, 15);
        doc.setFontSize(10);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 14, 22);
        
        const tableData = docsFiltradosAging.map(d => [
          d.numero,
          d.cliente,
          d.dias_vencidos || 0,
          d.aging,
          fmtMoney(d.saldo)
        ]);
        
        autoTable(doc, {
          head: [['Documento', 'Cliente', 'Días Venc.', 'Aging', 'Saldo']],
          body: tableData,
          startY: 28,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] }
        });
        
        doc.save(`Cartera_${new Date().toISOString().split('T')[0]}.pdf`);
        addToast('✅ Reporte PDF generado', 'success');
      };

      return (
        <div>
          <div className="card">
            <div className="card-title">📊 Resumen Ejecutivo</div>
            <div className="kpis-grid">
              <div className="kpi-card">
                <div className="kpi-title">Total Documentos</div>
                <div className="kpi-value">{docsFiltradosAging.length}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Monto Total</div>
                <div className="kpi-value">{fmtMoney(totalMonto)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Promedio por Doc</div>
                <div className="kpi-value">{fmtMoney(promedioMonto)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Concentración Top 5</div>
                <div className="kpi-value kpi-warning">{pctConcentracion}%</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Clientes Únicos</div>
                <div className="kpi-value">{Object.keys(top5Clientes).length}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">📋 Reporte de Documentos</div>
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
              <label className="field">
                <span>Aging</span>
                <select value={filtroAging} onChange={e => setFiltroAging(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Por vencer">Por vencer</option>
                  <option value="0-30 días">0-30 días</option>
                  <option value="30-60 días">30-60 días</option>
                  <option value="60-90 días">60-90 días</option>
                  <option value="+90 días">+90 días</option>
                </select>
              </label>
            </div>
            <div className="row">
              <label className="field">
                <span>Búsqueda</span>
                <input type="text" value={searchDocumentos} onChange={e => setSearchDocumentos(e.target.value)} placeholder="Buscar por cliente o documento..." />
              </label>
              <label className="field" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={vistaAgrupada} onChange={e => setVistaAgrupada(e.target.checked)} />
                <span>Vista Agrupada con Subtotales</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
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
                      <th>F. Vencimiento</th>
                      <th>Aging</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docsFiltradosAging.length > 0 ? (
                      docsFiltradosAging.map(d => (
                        <tr key={d.id}>
                          <td>{d.razon_social}</td>
                          <td>{d.documento}</td>
                          <td>{d.vendedor}</td>
                          <td>{d.fecha_vencimiento}</td>
                          <td><span className={d.aging.includes('+90') ? 'kpi-negative' : d.aging.includes('60-90') ? 'kpi-warning' : ''}>{d.aging}</span></td>
                          <td className="num">{fmtMoney(d.total)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6}>No hay resultados</td></tr>
                    )}
                  </tbody>
                </table>
                <p className="table-footnote">Mostrando {docsFiltradosAging.length} de {docs.length} documentos</p>
              </div>
            ) : (
              <div className="table-wrapper">
                {Object.entries(agrupados).map(([grupo, data]) => (
                  <div key={grupo} style={{ marginBottom: '24px' }}>
                    <h3 style={{ background: '#f3f4f6', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
                      {grupo} - {data.items.length} docs - {fmtMoney(data.total)}
                    </h3>
                    <table className="data-table">
                      <tbody>
                        {data.items.map(d => (
                          <tr key={d.id}>
                            <td>{d.razon_social}</td>
                            <td>{d.documento}</td>
                            <td>{d.fecha_vencimiento}</td>
                            <td>{d.aging}</td>
                            <td className="num">{fmtMoney(d.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
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
        <div>
          <div className="card">
            <div className="card-title">💼 Resumen de Promesas de Pago</div>
            <div className="kpis-grid">
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

          <div className="card">
            <div className="card-title">📅 Gestión de Promesas de Pago</div>
            <div className="row">
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

            <div className="promesas-lista">
              {promesasFiltradas.map(p => {
                const semaforo = getSemaforo(p.fecha_promesa);
                return (
                  <div key={p.id} className="promesa-item" style={{ borderLeft: `4px solid ${semaforo.color}` }}>
                    <div className="promesa-main">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="promesa-info" style={{ fontWeight: 700 }}>{p.razon_social || p.cliente}</div>
                        <span style={{ fontSize: '0.85rem', color: semaforo.color, fontWeight: 600 }}>{semaforo.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <div className="promesa-fecha">📅 {p.fecha_promesa}</div>
                        <div className="promesa-monto">{fmtMoney(p.monto_promesa || 0)}</div>
                      </div>
                      {p.observacion && <div style={{ marginTop: '8px', color: '#6b7280', fontSize: '0.9rem' }}>{p.observacion}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn primary" onClick={() => cumplirPromesa(p.id)} disabled={!hasWritePermissions} title="Marcar como cumplida">✓</button>
                      <button className="btn secondary" onClick={() => alert('Recordatorio configurado (simulado)')} title="Agregar recordatorio">🔔</button>
                      <button className="promesa-eliminar" onClick={() => eliminarGestion(p.id)} disabled={!hasWritePermissions}>✕</button>
                    </div>
                  </div>
                );
              })}
              {promesasFiltradas.length === 0 && <p className="promesa-vacia">No hay promesas de pago {filtroFecha !== 'Todas' ? `para: ${filtroFecha}` : 'pendientes'}</p>}
            </div>
          </div>
        </div>
      );
    }

    if (tab === "campanas") {
      const campanaActual = campanas.find(c => c.id === campanaSeleccionada);
      const totalClientes = clientesCampana.length;
      const contactados = Math.floor(totalClientes * 0.6); // Simulado
      const recuperado = Math.floor(Math.random() * 50000); // Simulado
      const tasaRespuesta = totalClientes > 0 ? Math.round((contactados / totalClientes) * 100) : 0;

      return (
        <div>
          <div className="card">
            <div className="card-title">
              🎯 Campañas de Cobranza
              <button className="btn primary" onClick={() => setShowModalCampana(true)} disabled={!hasWritePermissions}>+ Nueva Campaña</button>
            </div>
            <div className="promesas-lista">
              {campanas.map(c => (
                <div 
                  key={c.id} 
                  className="promesa-item" 
                  style={{ cursor: 'pointer', background: campanaSeleccionada === c.id ? '#f0f9ff' : 'transparent' }}
                  onClick={() => setCampanaSeleccionada(c.id)}
                >
                  <div className="promesa-main">
                    <div className="promesa-info" style={{ fontWeight: 700 }}>{c.nombre}</div>
                    <div style={{ color: '#6b7280', marginTop: '4px' }}>{c.descripcion}</div>
                    <div className="promesa-fecha" style={{ marginTop: '8px' }}>
                      📅 {c.fecha_inicio} → {c.fecha_fin} | 👤 {c.responsable}
                    </div>
                  </div>
                  <button className="promesa-eliminar" onClick={(e) => { e.stopPropagation(); eliminarCampana(c.id); }} disabled={!hasWritePermissions}>✕</button>
                </div>
              ))}
              {campanas.length === 0 && <p className="promesa-vacia">No hay campañas creadas</p>}
            </div>
          </div>

          {campanaActual && (
            <>
              <div className="card">
                <div className="card-title">📊 Dashboard: {campanaActual.nombre}</div>
                <div className="kpis-grid">
                  <div className="kpi-card">
                    <div className="kpi-title">Clientes Asignados</div>
                    <div className="kpi-value">{totalClientes}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">Contactados</div>
                    <div className="kpi-value kpi-positive">{contactados}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">Pendientes</div>
                    <div className="kpi-value kpi-warning">{totalClientes - contactados}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">Tasa Respuesta</div>
                    <div className="kpi-value">{tasaRespuesta}%</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">Recuperado</div>
                    <div className="kpi-value kpi-positive">{fmtMoney(recuperado)}</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-title">👥 Asignar Clientes a la Campaña</div>
                <button 
                  className="btn secondary" 
                  onClick={() => {
                    const nuevos = clientes.slice(0, 10).map(c => c.razon_social);
                    setClientesCampana(nuevos);
                    alert(`✅ Asignados ${nuevos.length} clientes a la campaña`);
                  }}
                  disabled={!hasWritePermissions}
                >
                  ➕ Asignar Clientes (Top 10)
                </button>
                {clientesCampana.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>Clientes en campaña:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {clientesCampana.slice(0, 20).map((c, i) => (
                        <span key={i} style={{ background: '#e0e7ff', padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem' }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-title">📧 Plantillas de Mensaje</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn secondary" onClick={() => alert('Plantilla Email cargada (simulado)')}>📧 Email Recordatorio</button>
                  <button className="btn secondary" onClick={() => alert('Plantilla WhatsApp cargada (simulado)')}>💬 WhatsApp Amigable</button>
                  <button className="btn secondary" onClick={() => alert('Plantilla SMS cargada (simulado)')}>📱 SMS Urgente</button>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    if (tab === "analisis") {
      // Comparativa entre gestores (ranking)
      const gestoresRanking = [...productividadData].sort((a, b) => b.tasa_promesa - a.tasa_promesa);
      const mejorGestor = gestoresRanking[0];
      
      // Índice de concentración (Herfindahl)
      const totalCartera = topClientes.reduce((sum, c) => sum + c.total, 0);
      const herfindahl = topClientes.reduce((sum, c) => {
        const share = totalCartera > 0 ? c.total / totalCartera : 0;
        return sum + (share * share);
      }, 0);
      const concentracion = (herfindahl * 10000).toFixed(0);

      return (
        <div>
          <div className="card">
            <div className="card-title">📊 Panel de Análisis</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button className={`btn ${vistaAnalisis === 'motivos' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('motivos')}>Motivos Impago</button>
              <button className={`btn ${vistaAnalisis === 'productividad' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('productividad')}>Productividad</button>
              <button className={`btn ${vistaAnalisis === 'comparativa' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('comparativa')}>Comparativa Gestores</button>
              <button className={`btn ${vistaAnalisis === 'segmentacion' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('segmentacion')}>Segmentación</button>
              <button className={`btn ${vistaAnalisis === 'riesgo' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('riesgo')}>Análisis Riesgo</button>
            </div>

            {vistaAnalisis === 'comparativa' && (
              <div>
                <div className="kpis-grid" style={{ marginBottom: '24px' }}>
                  <div className="kpi-card">
                    <div className="kpi-title">🏆 Mejor Gestor</div>
                    <div className="kpi-value kpi-positive" style={{ fontSize: '1rem' }}>{mejorGestor?.usuario || 'N/A'}</div>
                    <div className="kpi-subtitle">{mejorGestor?.tasa_promesa || 0}% efectividad</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">📈 Concentración</div>
                    <div className="kpi-value">{concentracion}</div>
                    <div className="kpi-subtitle">{Number(concentracion) > 2500 ? 'Alta' : Number(concentracion) > 1500 ? 'Media' : 'Baja'}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-title">💰 ROI Gestión</div>
                    <div className="kpi-value kpi-positive">3.2x</div>
                    <div className="kpi-subtitle">Simulado</div>
                  </div>
                </div>

                <div className="table-wrapper">
                  <h3 style={{ marginBottom: '12px' }}>🏅 Ranking de Gestores</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Gestor</th>
                        <th className="num">Gestiones</th>
                        <th className="num">Promesas</th>
                        <th className="num">Tasa Éxito</th>
                        <th className="num">Recuperable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gestoresRanking.map((g, i) => (
                        <tr key={i} style={{ background: i === 0 ? '#f0fdf4' : 'transparent' }}>
                          <td><strong>{i + 1}</strong></td>
                          <td>{g.usuario} {i === 0 && '🏆'}</td>
                          <td className="num">{g.total_gestiones}</td>
                          <td className="num">{g.promesas}</td>
                          <td className="num">
                            <span className={g.tasa_promesa >= 70 ? 'kpi-positive' : g.tasa_promesa >= 40 ? 'kpi-warning' : 'kpi-negative'}>
                              {g.tasa_promesa}%
                            </span>
                          </td>
                          <td className="num">{fmtMoney(g.saldo_recuperable)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                    }) : <tr><td colSpan={4}>Sin datos</td></tr>}
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
                    )) : <tr><td colSpan={6}>Sin datos</td></tr>}
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
                    )) : <tr><td colSpan={4}>Sin datos</td></tr>}
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
          </div>
        </div>
      );
    }

    if (tab === "alertas") {
      const alertasPriorizadas = filteredAlertas.map(a => {
        let scoreUrgencia = 0;
        if (a.diasVencidos > 90) scoreUrgencia += 40;
        else if (a.diasVencidos > 60) scoreUrgencia += 30;
        else if (a.diasVencidos > 30) scoreUrgencia += 20;
        else scoreUrgencia += 10;
        
        if (a.monto > 10000) scoreUrgencia += 30;
        else if (a.monto > 5000) scoreUrgencia += 20;
        else scoreUrgencia += 10;
        
        if (a.severidad === "Crítico") scoreUrgencia += 30;
        else if (a.severidad === "Alto") scoreUrgencia += 20;
        
        return { ...a, scoreUrgencia };
      }).sort((a, b) => b.scoreUrgencia - a.scoreUrgencia);

      return (
        <div>
          <div className="card">
            <div className="card-title">🎛️ Panel de Control de Alertas</div>
            <div className="kpis-grid">
              <div className="kpi-card">
                <div className="kpi-title">Alertas Activas</div>
                <div className="kpi-value kpi-warning">{alertasActivas}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Cerradas Hoy</div>
                <div className="kpi-value kpi-positive">{alertasCerradasHoy}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Críticas</div>
                <div className="kpi-value kpi-negative">{alertas.filter(a => a.severidad === "Crítico").length}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Pendientes</div>
                <div className="kpi-value">{alertasActivas - alertasCerradasHoy}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Tasa Resolución</div>
                <div className="kpi-value kpi-positive">{alertasActivas > 0 ? Math.round((alertasCerradasHoy / alertasActivas) * 100) : 0}%</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">⚙️ Configurar Umbrales de Alertas</div>
            <div className="row">
              <label className="field">
                <span>Días Vencidos (umbral)</span>
                <input type="number" value={umbralDias} onChange={e => setUmbralDias(Number(e.target.value))} />
              </label>
              <label className="field">
                <span>Monto Mínimo (umbral)</span>
                <input type="number" value={umbralMonto} onChange={e => setUmbralMonto(Number(e.target.value))} />
              </label>
              <button className="btn secondary" onClick={() => alert('✅ Umbrales guardados (simulado)')}>💾 Guardar</button>
            </div>
            <div style={{ marginTop: '12px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', fontSize: '0.9rem' }}>
              💡 <strong>Disparador automático:</strong> Al superar estos umbrales, se creará automáticamente una gestión pendiente.
            </div>
          </div>

          <div className="card">
            <div className="card-title">🚨 Alertas de Incumplimiento (Priorizadas)</div>
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
                    <th>🔥 Prioridad</th>
                    <th>Cliente</th>
                    <th className="num">Documento</th>
                    <th className="num">Monto</th>
                    <th className="num">Días Vencido</th>
                    <th className="num">Severidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alertasPriorizadas.length > 0 ? alertasPriorizadas.slice(0, 20).map((a, i) => (
                    <tr key={i}>
                      <td>
                        <strong style={{ color: a.scoreUrgencia >= 80 ? '#e63946' : a.scoreUrgencia >= 50 ? '#f59e0b' : '#6b7280' }}>
                          {a.scoreUrgencia}
                        </strong>
                      </td>
                      <td>{a.cliente}</td>
                      <td className="num">{a.documento}</td>
                      <td className="num">{fmtMoney(a.monto)}</td>
                      <td className="num">{a.diasVencidos}</td>
                      <td className="num">
                        <span className={a.severidad === "Crítico" ? "kpi-negative" : a.severidad === "Alto" ? "kpi-warning" : ""}>
                          {a.severidad}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn secondary" 
                          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                          onClick={() => alert('🚀 Gestión creada automáticamente (simulado)')}
                          disabled={!hasWritePermissions}
                        >
                          ⚡ Crear Gestión
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={7}>No hay alertas</td></tr>}
                </tbody>
              </table>
              <p className="table-footnote">Mostrando {filteredAlertas.length} de {alertas.length} alertas (ordenadas por urgencia)</p>
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
                      <td className="num">
                        <span className={p.confianza >= 70 ? 'kpi-positive' : p.confianza >= 40 ? 'kpi-warning' : 'kpi-negative'}>
                          {p.confianza}%
                        </span>
                      </td>
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
      // Calcular proyección simple (promedio últimos 3 meses)
      const ultimos3 = tendencias.slice(0, 3);
      const promedioEmision = ultimos3.reduce((sum, t) => sum + t.emision, 0) / (ultimos3.length || 1);
      const promedioCobrado = ultimos3.reduce((sum, t) => sum + t.cobrado, 0) / (ultimos3.length || 1);
      
      // Comparativa año anterior (simulado)
      const mesActual = tendencias[0];
      const mismoMesAnoAnterior = tendencias[11]; // Simplificado
      const variacionEmision = mesActual && mismoMesAnoAnterior ? 
        ((mesActual.emision - mismoMesAnoAnterior.emision) / mismoMesAnoAnterior.emision * 100).toFixed(1) : 0;

      // Tasa crecimiento mensual promedio
      const tasaCrecimiento = tendencias.length > 1 ? 
        ((tendencias[0].emision - tendencias[tendencias.length - 1].emision) / tendencias[tendencias.length - 1].emision * 100 / tendencias.length).toFixed(2) : 0;

      return (
        <div>
          <div className="card">
            <div className="card-title">📊 Indicadores de Tendencia</div>
            <div className="kpis-grid">
              <div className="kpi-card">
                <div className="kpi-title">Proyección Emisión (próx mes)</div>
                <div className="kpi-value">{fmtMoney(promedioEmision)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Proyección Cobrado (próx mes)</div>
                <div className="kpi-value kpi-positive">{fmtMoney(promedioCobrado)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Var. vs Año Anterior</div>
                <div className={`kpi-value ${Number(variacionEmision) > 0 ? 'kpi-positive' : 'kpi-negative'}`}>
                  {Number(variacionEmision) > 0 ? '+' : ''}{variacionEmision}%
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Tasa Crecimiento Mensual</div>
                <div className="kpi-value">{tasaCrecimiento}%</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Volatilidad</div>
                <div className="kpi-value kpi-warning">Media</div>
                <div className="kpi-subtitle">Simulado</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">📈 Tendencias Históricas (12 meses)</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className={`btn ${vistaTendencia === 'tabla' ? 'primary' : 'secondary'}`} onClick={() => setVistaTendencia('tabla')}>
                📋 Tabla
              </button>
              <button className={`btn ${vistaTendencia === 'grafico' ? 'primary' : 'secondary'}`} onClick={() => setVistaTendencia('grafico')}>
                📊 Gráfico
              </button>
              <button className="btn secondary" onClick={() => alert('Análisis de estacionalidad: Dic-Ene alto, Jun-Jul bajo (simulado)')}>
                🔍 Detectar Estacionalidad
              </button>
            </div>

            {vistaTendencia === 'tabla' ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th className="num">Documentos</th>
                      <th className="num">Emisión</th>
                      <th className="num">Cobrado</th>
                      <th className="num">Vencidos</th>
                      <th className="num">% Cobrado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tendencias.length > 0 ? tendencias.map((t, i) => {
                      const pctCobrado = t.emision > 0 ? ((t.cobrado / t.emision) * 100).toFixed(1) : 0;
                      return (
                        <tr key={i}>
                          <td><strong>{t.mes}</strong></td>
                          <td className="num">{t.documentos}</td>
                          <td className="num">{fmtMoney(t.emision)}</td>
                          <td className="num">{fmtMoney(t.cobrado)}</td>
                          <td className="num">{t.vencidos}</td>
                          <td className="num">
                            <span className={Number(pctCobrado) >= 80 ? 'kpi-positive' : Number(pctCobrado) >= 50 ? 'kpi-warning' : 'kpi-negative'}>
                              {pctCobrado}%
                            </span>
                          </td>
                        </tr>
                      );
                    }) : <tr><td colSpan={6}>Sin datos</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📈</div>
                <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
                  Gráfico interactivo de líneas: Emisión vs Cobrado vs Vencido
                </p>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '8px' }}>
                  (Integración con librería de gráficos pendiente)
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (tab === "disputas") {
      const disputaActual = disputas.find(d => d.id === disputaSeleccionada);
      
      const slaPromedio = 5.2; // días simulado
      const disputasAbiertas = disputas.filter(d => d.estado === "Abierta").length;
      const disputasResueltas = disputas.filter(d => d.estado === "Resuelta").length;

      return (
        <div>
          <div className="card">
            <div className="card-title">📊 Resumen de Disputas</div>
            <div className="kpis-grid">
              <div className="kpi-card">
                <div className="kpi-title">Total Disputas</div>
                <div className="kpi-value">{disputas.length}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Abiertas</div>
                <div className="kpi-value kpi-warning">{disputasAbiertas}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Resueltas</div>
                <div className="kpi-value kpi-positive">{disputasResueltas}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">SLA Promedio</div>
                <div className="kpi-value">{slaPromedio} días</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Tasa Resolución</div>
                <div className="kpi-value kpi-positive">
                  {disputas.length > 0 ? Math.round((disputasResueltas / disputas.length) * 100) : 0}%
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">⚖️ Gestión de Disputas</div>
            <button className="btn primary" onClick={() => setShowModalDisputa(true)} disabled={!hasWritePermissions}>+ Nueva Disputa</button>
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
              <label className="field">
                <span>Categoría</span>
                <select value={categoriaDisputa} onChange={e => setCategoriaDisputa(e.target.value)}>
                  <option value="General">Todas</option>
                  <option value="Facturación">Facturación</option>
                  <option value="Calidad">Calidad</option>
                  <option value="Devolución">Devolución</option>
                  <option value="Precio">Precio</option>
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
                    <th>Responsable</th>
                    <th>SLA</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDisputas.length > 0 ? filteredDisputas.map((d, i) => {
                    const diasAbierto = d.fecha_creacion ? Math.floor((new Date().getTime() - new Date(d.fecha_creacion).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    const slaColor = diasAbierto > 7 ? 'kpi-negative' : diasAbierto > 3 ? 'kpi-warning' : 'kpi-positive';
                    return (
                      <tr 
                        key={i} 
                        style={{ cursor: 'pointer', background: disputaSeleccionada === d.id ? '#fef3c7' : 'transparent' }}
                        onClick={() => setDisputaSeleccionada(d.id)}
                      >
                        <td>{d.documento}</td>
                        <td>{d.cliente}</td>
                        <td className="num">{fmtMoney(d.monto)}</td>
                        <td>{d.motivo || 'Sin especificar'}</td>
                        <td><span className={d.estado === "Abierta" ? "kpi-negative" : "kpi-positive"}>{d.estado}</span></td>
                        <td>Admin</td>
                        <td><span className={slaColor}>{diasAbierto}d</span></td>
                        <td>
                          <button 
                            className="btn secondary" 
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            onClick={(e) => { e.stopPropagation(); alert('Ver detalles (simulado)'); }}
                          >
                            👁️
                          </button>
                        </td>
                      </tr>
                    );
                  }) : <tr><td colSpan={8}>No hay disputas</td></tr>}
                </tbody>
              </table>
              <p className="table-footnote">Mostrando {filteredDisputas.length} de {disputas.length} disputas</p>
            </div>
          </div>

          {disputaActual && (
            <div className="card">
              <div className="card-title">📝 Detalle de Disputa #{disputaActual.id}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <strong>Cliente:</strong> {disputaActual.cliente}
                </div>
                <div>
                  <strong>Documento:</strong> {disputaActual.documento}
                </div>
                <div>
                  <strong>Monto:</strong> {fmtMoney(disputaActual.monto)}
                </div>
                <div>
                  <strong>Estado:</strong> {disputaActual.estado}
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label className="field">
                  <span>Cambiar Estado</span>
                  <select value={estadoIntermedio} onChange={e => setEstadoIntermedio(e.target.value)} disabled={!hasWritePermissions}>
                    <option value="Nueva">Nueva</option>
                    <option value="En Revisión">En Revisión</option>
                    <option value="Escalada">Escalada</option>
                    <option value="Pendiente Cliente">Pendiente Cliente</option>
                    <option value="Resuelta">Resuelta</option>
                  </select>
                </label>
              </div>

              <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <strong>💬 Comentarios/Notas:</strong>
                <div style={{ marginTop: '8px', color: '#6b7280' }}>{disputaActual.observacion || 'Sin comentarios aún'}</div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn secondary" onClick={() => alert('📎 Adjuntar archivo (simulado)')} disabled={!hasWritePermissions}>
                  📎 Adjuntar Evidencia
                </button>
                <button className="btn secondary" onClick={() => alert('✍️ Agregar comentario (simulado)')} disabled={!hasWritePermissions}>
                  💬 Añadir Nota
                </button>
                <button className="btn secondary" onClick={() => alert('👤 Asignar a: Juan Pérez (simulado)')} disabled={!hasWritePermissions}>
                  👤 Asignar Responsable
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (tab === "cuentas") {
      // KPIs simulados
      const totalAplicado = 45820.50;
      const pendienteAplicar = 12300.00;
      const anticiposVigentes = 8500.00;
      const notasCreditoDisponibles = 3200.00;
      const diferenciaConciliacion = 450.00;

      // Sugerencias automáticas (simulado) - usando cuentasAplicar
      const sugerencias = cuentasAplicar.slice(0, 3).map((c, i) => ({
        cuenta: c,
        documento: filteredDocumentos[i % Math.max(filteredDocumentos.length, 1)] || { numero: 'N/A', saldo: 0 },
        confianza: 95 - i * 5
      }));

      return (
        <div>
          <div className="card">
            <div className="card-title">📊 Panel de Aplicaciones</div>
            <div className="kpis-grid">
              <div className="kpi-card">
                <div className="kpi-title">Total Aplicado</div>
                <div className="kpi-value kpi-positive">{fmtMoney(totalAplicado)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Pendiente Aplicar</div>
                <div className="kpi-value kpi-warning">{fmtMoney(pendienteAplicar)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Anticipos Vigentes</div>
                <div className="kpi-value">{fmtMoney(anticiposVigentes)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Notas de Crédito</div>
                <div className="kpi-value">{fmtMoney(notasCreditoDisponibles)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Diferencia Conciliación</div>
                <div className="kpi-value" style={{ color: Math.abs(diferenciaConciliacion) > 500 ? '#ef4444' : '#22c55e' }}>
                  {fmtMoney(diferenciaConciliacion)}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">💳 Aplicación de Pagos</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button 
                className={`btn ${modoAplicacion === 'manual' ? 'primary' : 'secondary'}`}
                onClick={() => setModoAplicacion('manual')}
              >
                ✏️ Manual
              </button>
              <button 
                className={`btn ${modoAplicacion === 'sugerida' ? 'primary' : 'secondary'}`}
                onClick={() => setModoAplicacion('sugerida')}
              >
                🤖 Sugerida
              </button>
              <button 
                className={`btn ${modoAplicacion === 'masiva' ? 'primary' : 'secondary'}`}
                onClick={() => setModoAplicacion('masiva')}
                disabled={!hasWritePermissions}
              >
                ⚡ Masiva
              </button>
              <button className="btn secondary" onClick={() => setMostrarHistorial(!mostrarHistorial)}>
                📜 Historial
              </button>
              <button className="btn secondary" onClick={() => setMostrarConciliacion(!mostrarConciliacion)}>
                🔄 Conciliación
              </button>
            </div>

            {modoAplicacion === "sugerida" && (
              <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <strong>🤖 Sugerencias Automáticas</strong>
                <div className="table-wrapper" style={{ marginTop: '8px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cuenta</th>
                        <th className="num">Monto</th>
                        <th>Documento Sugerido</th>
                        <th className="num">Confianza</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sugerencias.map((s, i) => (
                        <tr key={i}>
                          <td>{s.cuenta.cliente}</td>
                          <td className="num">{fmtMoney(s.cuenta.monto)}</td>
                          <td>{s.documento.numero}</td>
                          <td className="num">
                            <span style={{ color: s.confianza > 90 ? '#22c55e' : s.confianza > 80 ? '#f59e0b' : '#6b7280' }}>
                              {s.confianza}%
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn primary" 
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                              onClick={() => alert(`✅ Aplicado: ${fmtMoney(s.cuenta.monto)} a ${s.documento.numero}`)}
                              disabled={!hasWritePermissions}
                            >
                              ✅ Aplicar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {modoAplicacion === "masiva" && (
              <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <strong>⚡ Aplicación Masiva</strong>
                <p style={{ marginTop: '8px', color: '#92400e' }}>
                  Esta función aplicará automáticamente todos los pagos con sugerencias de confianza &gt; 90%.
                </p>
                <button 
                  className="btn primary" 
                  style={{ marginTop: '8px' }}
                  onClick={() => alert('⚡ Aplicación masiva ejecutada (simulado): 3 pagos aplicados')}
                  disabled={!hasWritePermissions}
                >
                  🚀 Ejecutar Aplicación Masiva
                </button>
              </div>
            )}

            {mostrarHistorial && (
              <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <strong>📜 Historial de Aplicaciones</strong>
                <div className="table-wrapper" style={{ marginTop: '8px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Usuario</th>
                        <th>Pago</th>
                        <th>Documento</th>
                        <th className="num">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>2025-01-27</td>
                        <td>Admin</td>
                        <td>Transferencia #45</td>
                        <td>FAC-1023</td>
                        <td className="num">{fmtMoney(1500)}</td>
                      </tr>
                      <tr>
                        <td>2025-01-26</td>
                        <td>Admin</td>
                        <td>Depósito #12</td>
                        <td>FAC-1020</td>
                        <td className="num">{fmtMoney(3200)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {mostrarConciliacion && (
              <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <strong>🔄 Conciliación Bancaria</strong>
                <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Saldo Banco</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{fmtMoney(58270.50)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Saldo Sistema</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{fmtMoney(57820.50)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Diferencia</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ef4444' }}>{fmtMoney(450.00)}</div>
                  </div>
                </div>
                <button 
                  className="btn secondary" 
                  style={{ marginTop: '12px' }}
                  onClick={() => alert('🔍 Investigar diferencia (simulado)')}
                >
                  🔍 Investigar Diferencia
                </button>
              </div>
            )}

            <button className="btn primary" onClick={() => setShowModalCuenta(true)} disabled={!hasWritePermissions} style={{ marginBottom: '12px' }}>+ Nueva Cuenta</button>
            <div className="row row-spaced" style={{ marginBottom: '12px' }}>
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
                    <th>Acciones</th>
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
                      <td>
                        <button 
                          className="btn secondary" 
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => alert('Aplicar cuenta (simulado)')}
                          disabled={!hasWritePermissions}
                        >
                          {c.estado === "Pendiente" ? '➕ Aplicar' : '✏️ Editar'}
                        </button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={6}>No hay cuentas</td></tr>}
                </tbody>
              </table>
              <p className="table-footnote">Mostrando {filteredCuentas.length} de {cuentasAplicar.length} cuentas</p>
            </div>
          </div>

          <div className="card">
            <div className="card-title">🎫 Anticipos y Notas de Crédito</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px' }}>
                <strong>💰 Anticipos Parciales</strong>
                <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#92400e' }}>
                  2 clientes con anticipos vigentes
                </p>
                <button 
                  className="btn secondary" 
                  style={{ marginTop: '8px', fontSize: '0.75rem' }}
                  onClick={() => alert('Ver anticipos (simulado)')}
                >
                  Ver Detalle
                </button>
              </div>
              <div style={{ background: '#dbeafe', padding: '12px', borderRadius: '8px' }}>
                <strong>📃 Notas de Crédito</strong>
                <p style={{ marginTop: '8px', fontSize: '0.875rem', color: '#1e40af' }}>
                  {fmtMoney(notasCreditoDisponibles)} disponibles
                </p>
                <button 
                  className="btn secondary" 
                  style={{ marginTop: '8px', fontSize: '0.75rem' }}
                  onClick={() => alert('Aplicar nota de crédito (simulado)')}
                  disabled={!hasWritePermissions}
                >
                  Aplicar NC
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (tab === "config") {
      return (
        <div className="card">
          <div className="card-title">Configuración</div>
          {!hasWritePermissions && (
            <div className="readonly-banner">
              ⚠️ <strong>Modo Solo Lectura</strong> - Solo la aplicación de escritorio puede hacer cambios
            </div>
          )}
          <button className="btn primary" onClick={() => setShowModalEmpresa(true)} disabled={!hasWritePermissions}>⚙️ Datos de Empresa</button>
          <button className="btn primary" onClick={importarExcel} disabled={!hasWritePermissions}>📥 Importar desde Excel</button>
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
              <button className="btn primary" onClick={guardarDisputa} disabled={!hasWritePermissions}>Guardar Disputa</button>
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
              <button className="btn primary" onClick={guardarCuenta} disabled={!hasWritePermissions}>Guardar Cuenta</button>
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

