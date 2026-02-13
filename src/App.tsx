
import { useState, useEffect, useMemo, useCallback } from "react";
import "./App.css";

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

const compactLabel = (label: string, maxChars = 22) => {
  const clean = label.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars)}...` : clean;
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, '');
  if (cleaned.includes('.') && cleaned.includes(',')) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return Number(cleaned.replace(',', '.')) || 0;
  }
  return Number(cleaned) || 0;
};

const getDocAmount = (d: Documento) => toNumber(d.total ?? d.saldo ?? d.valor_documento ?? 0);

const getAgingLabel = (d: Documento) => {
  const dias = d.dias_vencidos ?? 0;
  if (dias <= 0) return 'Por Vencer';
  if (dias > 360) return '>360';
  if (dias > 330) return '360';
  if (dias > 300) return '330';
  if (dias > 270) return '300';
  if (dias > 240) return '270';
  if (dias > 210) return '240';
  if (dias > 180) return '210';
  if (dias > 150) return '180';
  if (dias > 120) return '150';
  if (dias > 90) return '120';
  if (dias > 60) return '90';
  if (dias > 30) return '60';
  return '30';
};

const normalizeSeveridad = (raw?: string) => {
  const value = (raw || '').trim().toLowerCase();
  if (value === 'critico' || value === 'crítico' || value === 'critica' || value === 'crítica' || value === 'critical') {
    return { label: 'Crítico', level: 'critical' };
  }
  if (value === 'alta' || value === 'alto' || value === 'high') {
    return { label: 'Alta', level: 'high' };
  }
  if (value === 'media' || value === 'medio' || value === 'medium') {
    return { label: 'Media', level: 'medium' };
  }
  if (value === 'baja' || value === 'bajo' || value === 'low') {
    return { label: 'Baja', level: 'low' };
  }
  if (!value) return { label: 'Sin datos', level: 'normal' };
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  return { label, level: 'normal' };
};

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
  const [isWeb, _setIsWeb] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [hasWritePermissions, setHasWritePermissions] = useState(true);
  
  // Datos principales
  const [docs, setDocs] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [topClientes, setTopClientes] = useState<any[]>([]);
  const [allGestiones, setAllGestiones] = useState<any[]>([]);
  
  // Filtros y Búsquedas
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedVendedor, setSelectedVendedor] = useState("");
  
  // Filtrar gestiones del cliente seleccionado desde allGestiones
  const gestiones = useMemo(() => {
    if (!selectedCliente || selectedCliente === 'Todos') return allGestiones;
    return allGestiones.filter(g => g.cliente === selectedCliente || g.razon_social === selectedCliente);
  }, [allGestiones, selectedCliente]);
  
  const [tendencias, setTendencias] = useState<any[]>([]);
  const [abonos, setAbonos] = useState<any[]>([]);
  const [_cuentasAplicar, setCuentasAplicar] = useState<any[]>([]);
  const [promesas, setPromesas] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [searchDocumentos, setSearchDocumentos] = useState("");
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
  const [abonosFechaDesde, setAbonosFechaDesde] = useState("");
  const [abonosFechaHasta, setAbonosFechaHasta] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [vistaAnalisis, setVistaAnalisis] = useState("motivos");
  const [mostrarGraficaTendencias, setMostrarGraficaTendencias] = useState(false);

  // UI y Modales
  const [showModalGestion, setShowModalGestion] = useState(false);
  const [showModalEmpresa, setShowModalEmpresa] = useState(false);
  const [showModalLimpiar, setShowModalLimpiar] = useState(false);
  const [showModalDocumentacion, setShowModalDocumentacion] = useState(false);
  const [showModalHistorial, setShowModalHistorial] = useState(false);
  const [showModalEditarPromesa, setShowModalEditarPromesa] = useState(false);
  const [promesaEditando, setPromesaEditando] = useState<any>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const [gestionForm, setGestionForm] = useState({ tipo: "Llamada", resultado: "Contactado", observacion: "", motivo: "", fecha_promesa: "", monto_promesa: "" });
  
  // Configuración
  const [empresa, setEmpresa] = useState<any>({});
  const [remoteUrl, setRemoteUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [remoteUrlHealthy, setRemoteUrlHealthy] = useState(false);
  const [localUrlHealthy, setLocalUrlHealthy] = useState(false);
  const [centrosCosto, setCentrosCosto] = useState<string[]>([]);
  const [_clientesGestionados, _setClientesGestionados] = useState<string[]>([]);
  const [dbPath, setDbPath] = useState("");
  const [updateInfo, setUpdateInfo] = useState<{ updateCount: number; currentVersion?: string; lastVersion?: string; updatedAt?: string; firstRunAt?: string } | null>(null);

  // Placeholders para datos derivados
  const [motivosData, setMotivosData] = useState<any[]>([]);
  const [productividadData, setProductividadData] = useState<any[]>([]);
  const [analisisRiesgo, setAnalisisRiesgo] = useState<any[]>([]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('cartera_theme');
    if (storedTheme) {
      setTheme(storedTheme);
      setPendingTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    const appliedTheme = theme || 'claro';
    document.documentElement.setAttribute('data-theme', appliedTheme);
    document.body.setAttribute('data-theme', appliedTheme);
    try {
      localStorage.setItem('cartera_theme', appliedTheme);
    } catch (e) {
      console.error('Error guardando tema en localStorage:', e);
    }
  }, [theme]);

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

  const formatUpdateDate = (value?: string) => {
    if (!value) return "N/A";
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? value : dt.toLocaleString();
  };

  const loadJsPDF = async () => { return { jsPDF: (await import('jspdf')).default, autoTable: (await import('jspdf-autotable')).default }; };
  const renderPdfHeader = (
    doc: any,
    params: { title: string; lines: string[] }
  ) => {
    const headerHeight = 42;
    const headerAccent = [59, 130, 246] as [number, number, number];
    const headerMuted = [100, 116, 139] as [number, number, number];
    const headerText = [15, 23, 42] as [number, number, number];
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentLeft = 14;

    doc.setFillColor(241, 245, 249);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    doc.setFillColor(headerAccent[0], headerAccent[1], headerAccent[2]);
    doc.rect(0, 0, pageWidth, 3, 'F');

    doc.setFillColor(219, 234, 254);
    doc.circle(pageWidth - 28, 12, 18, 'F');
    doc.setFillColor(191, 219, 254);
    doc.circle(pageWidth - 50, 30, 24, 'F');

    if (empresa.logo) {
      try {
        doc.addImage(empresa.logo, 'PNG', contentLeft, 9, 22, 22, undefined, 'FAST');
      } catch (e) {
        console.warn("Error cargando logo", e);
      }
    }

    const titleX = empresa.logo ? contentLeft + 28 : contentLeft;
    doc.setFontSize(16);
    doc.setTextColor(headerText[0], headerText[1], headerText[2]);
    doc.setFont("helvetica", "bold");
    doc.text(params.title, titleX, 16);

    doc.setFontSize(9);
    doc.setTextColor(headerMuted[0], headerMuted[1], headerMuted[2]);
    doc.setFont("helvetica", "normal");
    const baseY = 22;
    params.lines.filter(Boolean).slice(0, 3).forEach((line, idx) => {
      doc.text(line, titleX, baseY + (idx * 5));
    });

    return { headerHeight, contentLeft, pageWidth, headerAccent, headerMuted, headerText };
  };
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
  const registrarGestion = async (g: any) => {
    const nuevasGestiones = [g, ...allGestiones];
    setAllGestiones(nuevasGestiones);
    // Persistir en localStorage
    try {
      localStorage.setItem('cartera_gestiones_locales', JSON.stringify(nuevasGestiones));
    } catch (e) {
      console.error("Error guardando en localStorage:", e);
    }
    if (isWeb || !window.api?.gestionGuardar) return;
    try {
      const targetCliente = (g?.cliente || selectedCliente || '').trim();
      const payload = { cliente: targetCliente, ...g };
      await window.api.gestionGuardar(payload);
      // No recargar - confiar solo en estado local
    } catch (e) {
      console.error("Error registrando gestión automática:", e);
    }
  };

  const buildAnalisisRiesgo = (docsInput: Documento[]) => {
    const clienteMap = new Map<string, {
      razon_social: string;
      total_deuda: number;
      deuda_vencida: number;
      max_dias_mora: number;
    }>();

    (docsInput || []).forEach(d => {
      if (!d) return;
      const cliente = d.razon_social || d.cliente;
      const saldo = (d.total ?? d.saldo ?? 0) as number;
      const dias = d.dias_vencidos ?? 0;

      if (!clienteMap.has(cliente)) {
        clienteMap.set(cliente, {
          razon_social: cliente,
          total_deuda: 0,
          deuda_vencida: 0,
          max_dias_mora: 0
        });
      }

      const c = clienteMap.get(cliente)!;
      c.total_deuda += saldo;
      if (dias > 0) c.deuda_vencida += saldo;
      if (dias > c.max_dias_mora) c.max_dias_mora = dias;
    });

    return Array.from(clienteMap.values())
      .map(c => {
        const ratio = c.total_deuda > 0 ? (c.deuda_vencida / c.total_deuda) * 100 : 0;
        const mora = Math.min(100, (c.max_dias_mora / 180) * 100);
        const score = Math.max(0, Math.round(100 - (mora * 0.6 + ratio * 0.4)));
        return { ...c, score };
      })
      .sort((a, b) => b.deuda_vencida - a.deuda_vencida);
  };

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
  const clientesConVencidos = useMemo(() => Array.from(new Set(docs.filter(d => (d.dias_vencidos || 0) > 0 && (getDocAmount(d) > 0)).map(d => d.cliente))), [docs]);
  const todosDocsVencidos = useMemo(() => docs.filter(d => (d.dias_vencidos || 0) > 0 && (getDocAmount(d) > 0)), [docs]);
  const docsVencidosCliente = useMemo(() => (!selectedCliente || selectedCliente === "Todos") ? [] : todosDocsVencidos.filter(d => d.razon_social === selectedCliente || d.cliente === selectedCliente), [todosDocsVencidos, selectedCliente]);
  const totalVencidoCliente = useMemo(() => docsVencidosCliente.reduce((sum, d) => sum + getDocAmount(d), 0), [docsVencidosCliente]);
  const clientesUnicos = useMemo(() => (selectedCliente && selectedCliente !== "Todos") ? [selectedCliente] : clientesConVencidos, [clientesConVencidos, selectedCliente]);
  const filteredGestiones = useMemo(() => {
    if (!selectedCliente || selectedCliente === "Todos") return allGestiones;
    return allGestiones.filter(g => g.cliente === selectedCliente || g.razon_social === selectedCliente);
  }, [allGestiones, selectedCliente]);

  const getWeekStartMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const weekStartMonday = getWeekStartMonday(new Date());
  const isInCurrentWeek = (fecha?: string) => {
    if (!fecha) return false;
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return false;
    return date >= weekStartMonday;
  };

  // Effect para detectar tamaño de pantalla
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Effect para detectar cambios de IP y cargar configuración al montar - REMOVIDO fetch(/api/config) que causaba errores

  // Effect para detectar cambios de IP y cargar datos al montar
  useEffect(() => {
    // Verificar permisos y cargar datos al montar
    checkPermissions();
    console.log('[DEBUG] Llamando cargarDatos() al montar App');
    cargarDatos();

    if (window.api?.getUpdateInfo) {
      window.api.getUpdateInfo()
        .then(info => setUpdateInfo(info))
        .catch(() => setUpdateInfo(null));
    }
    
    // Log para depuración de gestiones después de 3 segundos
    setTimeout(() => {
      console.log('[DEBUG] allGestiones:', allGestiones);
    }, 3000);

    // Verificar IP cada 30 segundos (desde API Electron, no desde servidor HTTP)
    const ipCheckInterval = setInterval(async () => {
      if (!window.api?.getGitRemoteUrl) return;
      try {
        const result = await window.api.getGitRemoteUrl();
        if (result.ok && result.url && result.url !== repoUrl) {
          console.log(`📡 IP local actualizada: ${repoUrl} -> ${result.url}`);
          setRepoUrl(result.url);
        }
      } catch (error) {
        console.error("Error verificando IP:", error);
      }
    }, 30000);

    // Cargar URL remota (ngrok) al iniciar desde API Electron
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

  // Marcar la URL local como disponible cuando exista un valor
  useEffect(() => {
    setLocalUrlHealthy(Boolean(repoUrl));
  }, [repoUrl]);

  async function cargarDatos() {
    if (!window.api) return;
    try {
      const [empData, statsData, filtros, top, gestionesData, alertasData, tendData, cuentasData, abonosData] = await Promise.all([
        window.api.empresaObtener(),
        window.api.statsObtener(),
        window.api.filtrosListar(),
        window.api.topClientes(),
        window.api.gestionesListar(""),
        window.api.alertasIncumplimiento(),
        window.api.tendenciasHistoricas(),
        window.api.cuentasAplicarListar(),
        window.api.abonosListar()
      ]);

      if (empData) {
        setEmpresa(empData);
        if (empData.tema) {
          setTheme(empData.tema);
          setPendingTheme(empData.tema);
        }
      }
      if (statsData) setStats(statsData);
      if (top) setTopClientes(top);
      if (filtros) {
        // Cargar clientes y vendedores desde filtros
        if (filtros.clientes) setClientes(filtros.clientes);
        if (filtros.vendedores) setVendedores(filtros.vendedores);
      }
      if (gestionesData) {
          // Cargar gestiones locales desde localStorage
          let gestionesLocales: any[] = [];
          try {
            const stored = localStorage.getItem('cartera_gestiones_locales');
            if (stored) gestionesLocales = JSON.parse(stored);
          } catch (e) {
            console.error("Error cargando localStorage:", e);
          }
          
          // Backend es la fuente de verdad - deduplicar contra él
          const gestionesBackend = Array.isArray(gestionesData) ? gestionesData : [];
          
          // Función para deduplicar: compara cliente + tipo + observación (exacto)
          // También compara fecha con tolerancia de ±10 segundos (backends pueden tener pequeños offsets)
          const deduplicateGestiones = (backend: any[], local: any[]) => {
            const deduped = [...backend];
            const localNoSincronizadas: any[] = [];
            
            for (const localGestion of local) {
              // Buscar coincidencia en backend
              const found = backend.some((bg) => {
                const sameClient = bg.cliente === localGestion.cliente;
                const sameType = bg.tipo === localGestion.tipo;
                // Observación exacta es el identificador más confiable
                const sameObs = bg.observacion === localGestion.observacion;
                
                // Comparar fechas con tolerancia: ±10 segundos
                let sameDateish = false;
                try {
                  if (localGestion.fecha && bg.fecha) {
                    const localTime = new Date(localGestion.fecha).getTime();
                    const bgTime = new Date(bg.fecha).getTime();
                    // Si ambas fechas son válidas, compararlas con tolerancia
                    if (!isNaN(localTime) && !isNaN(bgTime)) {
                      sameDateish = Math.abs(localTime - bgTime) < 10000; // ±10 segundos
                    }
                  }
                } catch (e) {
                  // Si hay error al parsear fechas, ignorar comparación de fecha
                  sameDateish = false;
                }
                
                // Criterio de duplicado: mismo cliente + tipo + observacion + fecha cercana
                return sameClient && sameType && sameObs && sameDateish;
              });
              
              // Solo incluir local si NO está en backend
              if (!found) {
                deduped.push(localGestion);
                localNoSincronizadas.push(localGestion);
              }
            }
            
            // Limpiar localStorage de gestiones ya sincronizadas
            try {
              localStorage.setItem('cartera_gestiones_locales', JSON.stringify(localNoSincronizadas));
            } catch (e) {
              console.error("Error actualizando localStorage:", e);
            }
            
            // Ordenar por fecha descendente
            return deduped.sort((a: any, b: any) => {
              const dateA = new Date(a.fecha).getTime();
              const dateB = new Date(b.fecha).getTime();
              return dateB - dateA;
            });
          };
          
          const gestionesMerged = deduplicateGestiones(gestionesBackend, gestionesLocales);
          setAllGestiones(gestionesMerged);
          // Filtrar promesas: buscar registros con "Promesa" en el resultado y que NO tengan "Cumplida"
          const promesasPendientes = gestionesMerged.filter((g: any) => 
            g.resultado?.includes('Promesa') && !g.resultado?.includes('Cumplida') && g.fecha_promesa
          );
          setPromesas(promesasPendientes);
      }
      if (alertasData) setAlertas(alertasData as any[]);
      if (tendData) setTendencias(tendData as any[]);
      if (cuentasData) setCuentasAplicar(cuentasData);
      if (abonosData) setAbonos(abonosData);

      // Cargar documentos iniciales
      const docsResult = await window.api.documentosListar({});
      if (docsResult?.rows) {
        const rows = docsResult.rows as Documento[];
        setDocs(rows);
        setAnalisisRiesgo(buildAnalisisRiesgo(rows));
      }

      // Obtener URL del repositorio remoto Git
      if (window.api.getGitRemoteUrl) {
        try {
          const remoteUrl = await window.api.getGitRemoteUrl();
          if (remoteUrl?.url) setRepoUrl(remoteUrl.url);
        } catch (e) {
          console.log("No se pudo obtener URL remoto:", e);
        }
      }

      // Ruta de base de datos para respaldo/actualizaciones manuales
      if (!isWeb && window.api.getDbPath) {
        try {
          const path = await window.api.getDbPath();
          if (path) setDbPath(path);
        } catch (e) {
          console.log("No se pudo obtener ruta de BD:", e);
        }
      }

      // Cargar datos de Análisis (Motivos, Productividad, Segmentación) - Protegido
      try {
        if (window.api.motivosImpago) {
          const motivosResult = await window.api.motivosImpago();
          if (motivosResult) setMotivosData(motivosResult as any[]);
        }
      } catch (e) {
        console.log("Error cargando Motivos de Impago:", e);
      }

      try {
        if (window.api.productividadGestor) {
          const productividadResult = await window.api.productividadGestor();
          if (productividadResult) setProductividadData(productividadResult as any[]);
        }
      } catch (e) {
        console.log("Error cargando Productividad:", e);
      }

      // Para "Análisis Riesgo" usamos clientesConVencidos que ya se calcula arriba
      // No necesita carga adicional, se devuelva de gestionesData

      // Para "Deudores Crónicos" usamos la tabla de documentos ya cargada
      // No necesita carga adicional, se filtra de docs

    } catch (e) {
      console.error("Error cargando datos:", e);
    }
  }

  // Datos derivados para Gestión (Memoizados para rendimiento)

  // Paginación para Reportes
  // Eliminado: paginatedDocumentos y paginación no se usan

  const filteredAlertas = useMemo(() => alertas.filter((a: Alerta) => {
      const search = searchAlertas.toLowerCase();
      const matchSearch = !search || a.cliente.toLowerCase().includes(search) || a.documento.toLowerCase().includes(search);
      const sevInfo = normalizeSeveridad(a.severidad);
      const matchSeveridad = filtroSeveridad === "Todos" || sevInfo.label === filtroSeveridad;
      return matchSearch && matchSeveridad;
    }),
    [alertas, searchAlertas, filtroSeveridad]
  );

  const resumenVencidos = useMemo(() => {
    const resumen = new Map<string, number>();
    (todosDocsVencidos || []).forEach(d => {
      const cliente = d.razon_social || d.cliente || 'Sin cliente';
      const saldo = (d.total ?? d.saldo ?? 0) as number;
      resumen.set(cliente, (resumen.get(cliente) || 0) + saldo);
    });
    return Array.from(resumen.entries())
      .map(([cliente, total]) => ({ cliente, total }))
      .sort((a, b) => b.total - a.total);
  }, [todosDocsVencidos]);

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
      return fvenc >= hoy && fvenc <= en7Dias && (d.total > 0);
    });
    const vencen30Dias = (docs || []).filter(d => {
      if (!d || !d.fecha_vencimiento || d.total <= 0) return false;
      const fvenc = new Date(d.fecha_vencimiento);
      return fvenc >= hoy && fvenc <= en30Dias && (d.total > 0);
    });
    return {
      dias7: vencen7Dias,
      monto7: vencen7Dias.reduce((sum, d) => sum + (d.total || 0), 0),
      dias30: vencen30Dias,
      monto30: vencen30Dias.reduce((sum, d) => sum + (d.total || 0), 0),
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
      if (resultTyped?.rows) {
        const rows = resultTyped.rows as unknown as Documento[];
        setDocs(rows);
        setAnalisisRiesgo(buildAnalisisRiesgo(rows));
      }
    } catch (e) {
      console.error("Error cargando documentos:", e);
    }
  }, [selectedCliente, selectedVendedor]);

  const cargarGestiones = useCallback(async (selectedCliente: string) => {
    // Ya no se utiliza - gestiones está en useMemo filtrado de allGestiones
    if (isWeb || !selectedCliente) return;
  }, []);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  async function guardarGestion() {
    if (isWeb || !selectedCliente) return;
    try {
      // Convertir monto_promesa a número si es una promesa de pago
      const gestionParaGuardar = {
        ...gestionForm,
        ...(gestionForm.resultado === "Promesa de Pago" && { monto_promesa: gestionForm.monto_promesa ? Number(gestionForm.monto_promesa) : 0 })
      };
      
      // Guardar en backend
      const result = await window.api.gestionGuardar({
        cliente: selectedCliente,
        ...gestionParaGuardar
      });
      
      if (result?.ok) {
        addToast("Gestión guardada exitosamente", "success");
        
        // Agregar gestión al estado local con ID único
        const nuevaGestion = {
          id: `manual_${Date.now()}`,
          cliente: selectedCliente,
          fecha: new Date().toISOString(),
          ...gestionParaGuardar
        };
        const nuevasGestiones = [nuevaGestion, ...allGestiones];
        setAllGestiones(nuevasGestiones);
        
        // Persistir en localStorage
        try {
          localStorage.setItem('cartera_gestiones_locales', JSON.stringify(nuevasGestiones));
        } catch (e) {
          console.error("Error guardando en localStorage:", e);
        }
        
        // Limpiar formulario
        setShowModalGestion(false);
        setGestionForm({
          tipo: "Llamada",
          resultado: "Contactado",
          observacion: "",
          motivo: "",
          fecha_promesa: "",
          monto_promesa: ""
        });
      } else {
        addToast(result?.message || "Error guardando gestión", "error");
      }
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
      
      // Actualizar solo estado local
      const nuevasGestiones = allGestiones.filter(g => g.id !== id);
      setAllGestiones(nuevasGestiones);
      
      // Persistir en localStorage
      try {
        localStorage.setItem('cartera_gestiones_locales', JSON.stringify(nuevasGestiones));
      } catch (e) {
        console.error("Error guardando en localStorage:", e);
      }
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
      
      // Actualizar solo estado local
      const nuevasGestiones = allGestiones.map(g => 
        g.id === id ? { ...g, resultado: 'Promesa Cumplida' } : g
      );
      setAllGestiones(nuevasGestiones);
      setPromesas(prev => prev.filter(p => p.id !== id));
      
      // Persistir en localStorage
      try {
        localStorage.setItem('cartera_gestiones_locales', JSON.stringify(nuevasGestiones));
      } catch (e) {
        console.error("Error guardando en localStorage:", e);
      }
    } catch (e) {
      addToast("Error cumpliendo promesa", "error");
      console.error("Error cumpliendo promesa:", e);
    }
  }

  async function actualizarPromesa(promesaActualizada: any) {
    if (isWeb) return;
    try {
      // Actualizar promesa en estado local
      const nuevasPromesas = promesas.map(p => 
        p.id === promesaActualizada.id ? promesaActualizada : p
      );
      setPromesas(nuevasPromesas);
      setShowModalEditarPromesa(false);
      setPromesaEditando(null);
      addToast("Promesa actualizada correctamente", "success");
      
      // Persistir en localStorage
      try {
        localStorage.setItem('cartera_promesas_locales', JSON.stringify(nuevasPromesas));
      } catch (e) {
        console.error("Error guardando en localStorage:", e);
      }
    } catch (e) {
      addToast("Error actualizando promesa", "error");
      console.error("Error actualizando promesa:", e);
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
        addToast("Error en importación: " + errorMsg, "error");
        console.error("Error importando (backend):", errorMsg);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      addToast("Error importando Excel: " + errorMsg, "error");
      console.error("Error importando (frontend):", e);
    }
  }

  const exportarAbonosPDF = async () => {
    let abonosFiltrados = abonos;
    if (abonosFechaDesde) {
      abonosFiltrados = abonosFiltrados.filter(a => a.fecha && a.fecha >= abonosFechaDesde);
    }
    if (abonosFechaHasta) {
      const hasta = abonosFechaHasta.length === 10 ? `${abonosFechaHasta}T23:59:59` : abonosFechaHasta;
      abonosFiltrados = abonosFiltrados.filter(a => a.fecha && a.fecha <= hasta);
    }
    if (abonosFiltrados.length === 0) {
      addToast("No hay abonos para reportar en el rango seleccionado", "info");
      return;
    }
    try {
      const { jsPDF, autoTable } = await loadJsPDF();
      const doc = new jsPDF();
      const accent = [59, 130, 246] as [number, number, number];
      const muted = [100, 116, 139] as [number, number, number];
      const text = [15, 23, 42] as [number, number, number];

      const { headerHeight, contentLeft, pageWidth } = renderPdfHeader(doc, {
        title: 'Reporte de Abonos Detectados',
        lines: [
          `Empresa: ${empresa.nombre || 'Mi Empresa'}`,
          `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
          empresa.ruc ? `RUC: ${empresa.ruc}` : ''
        ]
      });
      
      const cardY = headerHeight + 6;
      const cardH = 16;
      const cardGap = 4;
      const availableWidth = pageWidth - (contentLeft * 2);
      const cardW = (availableWidth - (cardGap * 2)) / 3;
      const startX = contentLeft;
      
      // Calcular KPIs
      const totalAbonos = abonosFiltrados.length;
      const montoTotalAbonado = abonosFiltrados.reduce((sum, a) => sum + ((a.total_anterior || 0) - (a.total_nuevo || 0)), 0);
      const documentosUnicos = new Set(abonosFiltrados.map(a => a.documento)).size;
      
      const cards = [
        { label: 'Total Abonos', value: `${totalAbonos}`, color: [59, 130, 246] as [number, number, number], soft: [219, 234, 254] as [number, number, number] },
        { label: 'Monto Total', value: fmtMoney(montoTotalAbonado), color: [16, 185, 129] as [number, number, number], soft: [209, 250, 229] as [number, number, number] },
        { label: 'Documentos', value: `${documentosUnicos}`, color: [107, 114, 128] as [number, number, number], soft: [243, 244, 246] as [number, number, number] }
      ];
      
      cards.forEach((item, idx) => {
        const x = startX + idx * (cardW + cardGap);
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(item.soft[0], item.soft[1], item.soft[2]);
        doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD');
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.rect(x, cardY, cardW, 1.2, 'F');
        doc.setFontSize(7);
        doc.setTextColor(muted[0], muted[1], muted[2]);
        doc.text(item.label.toUpperCase(), x + 4, cardY + 6);
        doc.setFontSize(10);
        doc.setTextColor(item.color[0], item.color[1], item.color[2]);
        doc.text(item.value, x + 4, cardY + 12);
      });
      
      const tableData = abonosFiltrados.map(a => ([
        a.fecha ? a.fecha.split('T')[0] : '-',
        a.cliente || a.razon_social || '-',
        a.documento || '-',
        fmtMoney(a.total_anterior || 0),
        fmtMoney((a.total_anterior || 0) - (a.total_nuevo || 0)),
        fmtMoney(a.total_nuevo || 0),
        a.observacion || '-'
      ]));

      autoTable(doc, {
        head: [['Fecha', 'Cliente', 'Documento', 'Saldo Anterior', 'Pago', 'Nuevo Saldo', 'Observación']],
        body: tableData,
        startY: cardY + cardH + 8,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2, textColor: text, lineColor: [226, 232, 240], lineWidth: 0.2 },
        headStyles: { 
          fillColor: [219, 234, 254],
          textColor: accent,
          fontStyle: 'bold',
          halign: 'left',
          lineColor: accent,
          lineWidth: 0.5
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251]
        },
        margin: { left: contentLeft, right: contentLeft },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right', textColor: [16, 185, 129] },
          5: { halign: 'right' }
        },
        pageBreak: 'auto',
        rowPageBreak: 'avoid'
      });

      // Pie de página
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      const totalPages = (doc as any).internal.getNumberOfPages?.() || 1;
      
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(contentLeft, pageHeight - 14, pageWidth - contentLeft, pageHeight - 14);
        
        doc.setFontSize(7);
        doc.setTextColor(muted[0], muted[1], muted[2]);
        doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, contentLeft, pageHeight - 10);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - contentLeft - 25, pageHeight - 10);
      }

      doc.save(`Abonos_${new Date().toISOString().split('T')[0]}.pdf`);
      addToast("✅ Reporte de abonos generado", "success");
    } catch (e) {
      console.error(e);
      addToast("Error generando reporte de abonos", "error");
    }
  };

  const getAnalisisReportConfig = () => {
    if (vistaAnalisis === 'motivos') {
      const total = motivosData.reduce((sum, x) => sum + (x.total || 0), 0);
      return {
        key: 'motivos_impago',
        title: 'Motivos de Impago',
        head: ['Motivo', 'Casos', 'Monto Total', '%'],
        alignRightIndices: [1, 2, 3],
        rows: motivosData.map((m: any) => ([
          m.label || '-',
          `${m.count ?? 0}`,
          fmtMoney(m.total || 0),
          `${total > 0 ? ((m.total / total) * 100).toFixed(1) : '0'}%`
        ]))
      };
    }

    if (vistaAnalisis === 'productividad') {
      return {
        key: 'productividad',
        title: 'Productividad de Gestores',
        head: ['Gestor', 'Gestiones', 'Promesas', 'Pagos', 'Tasa Promesa', 'Saldo Recuperable'],
        alignRightIndices: [1, 2, 3, 4, 5],
        rows: productividadData.map((p: any) => ([
          p.usuario || '-',
          `${p.total_gestiones ?? 0}`,
          `${p.promesas ?? 0}`,
          `${p.pagos ?? 0}`,
          `${p.tasa_promesa ?? 0}%`,
          fmtMoney(p.saldo_recuperable || 0)
        ]))
      };
    }

    if (vistaAnalisis === 'riesgo') {
      return {
        key: 'riesgo',
        title: 'Analisis de Riesgo',
        head: ['Cliente', 'Deuda Total', 'Deuda Vencida', 'Dias Mora', 'Score', 'Prediccion'],
        alignRightIndices: [1, 2, 3, 4],
        rows: analisisRiesgo.map((a: any) => {
          const prediccion = a.score < 30 ? 'Alto Riesgo' : a.score < 60 ? 'Riesgo Medio' : 'Bajo Riesgo';
          return [
            a.razon_social || '-',
            fmtMoney(a.total_deuda || 0),
            fmtMoney(a.deuda_vencida || 0),
            `${a.max_dias_mora ?? 0}`,
            `${a.score ?? 0}`,
            prediccion
          ];
        })
      };
    }

    return {
      key: 'deudores_cronicos',
      title: 'Deudores Cronicos',
      head: ['#', 'Cliente', 'Vendedor', 'Deuda Total', 'Vencido (+90 dias)', 'Docs Vencidos'],
      alignRightIndices: [0, 3, 4, 5],
      rows: deudoresCronicos.map((d: any, idx: number) => ([
        `${idx + 1}`,
        d.razon_social || '-',
        d.vendedor || '-',
        fmtMoney(d.totalDeuda || 0),
        fmtMoney(d.totalVencido || 0),
        `${d.documentosVencidos ?? 0}`
      ]))
    };
  };

  const canExportAnalisis = useMemo(() => {
    if (vistaAnalisis === 'motivos') return motivosData.length > 0;
    if (vistaAnalisis === 'productividad') return productividadData.length > 0;
    if (vistaAnalisis === 'riesgo') return analisisRiesgo.length > 0;
    return deudoresCronicos.length > 0;
  }, [vistaAnalisis, motivosData, productividadData, analisisRiesgo, deudoresCronicos]);

  const getAnalisisSummary = () => {
    if (vistaAnalisis === 'motivos') {
      const totalCasos = motivosData.reduce((sum, x) => sum + (x.count || 0), 0);
      const totalMonto = motivosData.reduce((sum, x) => sum + (x.total || 0), 0);
      const topMotivo = motivosData[0]?.label || 'Sin datos';
      return [
        { label: 'Casos', value: `${totalCasos}` },
        { label: 'Monto Total', value: fmtMoney(totalMonto) },
        { label: 'Top Motivo', value: compactLabel(topMotivo, 20) }
      ];
    }

    if (vistaAnalisis === 'productividad') {
      const totalGestiones = productividadData.reduce((sum, x) => sum + (x.total_gestiones || 0), 0);
      const totalPromesas = productividadData.reduce((sum, x) => sum + (x.promesas || 0), 0);
      const tasaPromesa = totalGestiones > 0 ? ((totalPromesas / totalGestiones) * 100).toFixed(1) : '0.0';
      return [
        { label: 'Gestiones', value: `${totalGestiones}` },
        { label: 'Promesas', value: `${totalPromesas}` },
        { label: 'Tasa Promesa', value: `${tasaPromesa}%` }
      ];
    }

    if (vistaAnalisis === 'riesgo') {
      const clientes = analisisRiesgo.length;
      const deudaTotal = analisisRiesgo.reduce((sum, x) => sum + (x.total_deuda || 0), 0);
      const deudaVencida = analisisRiesgo.reduce((sum, x) => sum + (x.deuda_vencida || 0), 0);
      return [
        { label: 'Clientes', value: `${clientes}` },
        { label: 'Deuda Total', value: fmtMoney(deudaTotal) },
        { label: 'Deuda Vencida', value: fmtMoney(deudaVencida) }
      ];
    }

    const totalCronicos = deudoresCronicos.length;
    const deudaTotal = deudoresCronicos.reduce((sum, x) => sum + (x.totalDeuda || 0), 0);
    const deudaVencida = deudoresCronicos.reduce((sum, x) => sum + (x.totalVencido || 0), 0);
    return [
      { label: 'Deudores', value: `${totalCronicos}` },
      { label: 'Deuda Total', value: fmtMoney(deudaTotal) },
      { label: 'Vencido +90', value: fmtMoney(deudaVencida) }
    ];
  };

  const exportarAnalisisPDF = async () => {
    const config = getAnalisisReportConfig();
    if (!config.rows.length) {
      addToast('No hay datos para reportar en esta vista', 'info');
      return;
    }

    try {
      const paletteBySection: Record<string, { accent: [number, number, number]; soft: [number, number, number] }> = {
        motivos: { accent: [59, 130, 246], soft: [219, 234, 254] },
        productividad: { accent: [16, 185, 129], soft: [209, 250, 229] },
        riesgo: { accent: [239, 68, 68], soft: [254, 226, 226] },
        cronicos: { accent: [220, 38, 38], soft: [254, 226, 226] }
      };
      const sectionPalette = paletteBySection[vistaAnalisis] || paletteBySection.motivos;
      const { jsPDF, autoTable } = await loadJsPDF();
      const doc = new jsPDF();

      const accent = sectionPalette.accent;
      const muted = [100, 116, 139] as [number, number, number];
      const text = [15, 23, 42] as [number, number, number];

      renderPdfHeader(doc, {
        title: 'Panel de Analisis',
        lines: [
          `Empresa: ${empresa.nombre || 'Mi Empresa'}`,
          `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
          `Seccion: ${config.title}`
        ]
      });

      const summary = getAnalisisSummary();
      const cardY = 46;
      const cardH = 16;
      const cardW = 58;
      const cardGap = 6;

      summary.forEach((item, idx) => {
        const x = 14 + idx * (cardW + cardGap);
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD');
        doc.setFillColor(accent[0], accent[1], accent[2]);
        doc.rect(x, cardY, cardW, 1.2, 'F');
        doc.setFontSize(7);
        doc.setTextColor(muted[0], muted[1], muted[2]);
        doc.text(item.label.toUpperCase(), x + 4, cardY + 6);
        doc.setFontSize(10);
        doc.setTextColor(accent[0], accent[1], accent[2]);
        doc.text(item.value, x + 4, cardY + 12);
      });

      const columnStyles = (config.alignRightIndices || []).reduce((acc: Record<number, any>, idx: number) => {
        acc[idx] = { halign: 'right' };
        return acc;
      }, {});

      autoTable(doc, {
        startY: cardY + cardH + 8,
        head: [config.head],
        body: config.rows,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2, textColor: text },
        headStyles: {
          fillColor: sectionPalette.soft,
          textColor: accent,
          fontStyle: 'bold',
          halign: 'left'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles,
        didParseCell: (data) => {
          if (data.section !== 'body') return;

          if (vistaAnalisis === 'riesgo') {
            const score = analisisRiesgo[data.row.index]?.score ?? 0;
            const riskColor = score < 30 ? [254, 226, 226] : score < 60 ? [254, 243, 199] : [220, 252, 231];
            data.cell.styles.fillColor = riskColor as any;
            if (data.column.index === 5) {
              data.cell.styles.textColor = score < 30 ? [185, 28, 28] : score < 60 ? [180, 83, 9] : [22, 101, 52];
              data.cell.styles.fontStyle = 'bold';
            }
          }

          if (vistaAnalisis === 'cronicos') {
            data.cell.styles.fillColor = [254, 226, 226] as any;
            if (data.column.index === 4) {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      const filename = `Reporte_Analisis_${config.key}_${new Date().toISOString().split('T')[0]}.pdf`;
      try {
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {
        console.warn('No se pudo abrir la vista previa del PDF:', e);
      }
      doc.save(filename);
      addToast('✅ Reporte de analisis generado', 'success');
    } catch (e) {
      console.error(e);
      addToast('Error generando reporte de analisis', 'error');
    }
  };

  async function exportarBackup() {
    if (isWeb) {
      addToast("Esta función solo está disponible en la versión de escritorio", "info");
      return;
    }
    try {
      const result = await window.api!.exportarBackup();
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
      const result = await window.api!.cambiarLogo();
      if (result.ok) {
        addToast("Logotipo actualizado correctamente", "success");
        // Actualizar estado local inmediatamente
        setEmpresa((prev: any) => ({ ...prev, logo: result.logo }));
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
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f59e0b' }}>{fmtMoney(vencimientosProximos.monto7)}</div>
            </div>
            <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>VENCE 30D</div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f97316' }}>{fmtMoney(vencimientosProximos.monto30)}</div>
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
            <div className="card" style={{ 
              padding: '8px', 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'flex-start',
              borderTop: '5px solid #10b981',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 4px 16px rgba(16,185,129,0.1)',
              transition: 'all 0.3s ease'
            }}>
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
            <div className="card" style={{ 
              padding: '8px', 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'flex-start',
              borderTop: '5px solid #a855f7',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 4px 16px rgba(168,85,247,0.1)',
              transition: 'all 0.3s ease'
            }}>
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
            <div className="card" style={{ 
              padding: '8px', 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'flex-start',
              borderTop: '5px solid #3b82f6',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 4px 16px rgba(59,130,246,0.1)',
              transition: 'all 0.3s ease'
            }}>
              <RankingList
                title="Por Vendedor"
                items={Array.isArray(analisisPorVendedor) ? analisisPorVendedor.slice(0, 10).map((v) => ({
                  label: compactLabel(v.vendedor),
                  fullLabel: v.vendedor,
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
            <div className="card" style={{ 
              padding: '8px', 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'flex-start',
              borderTop: '5px solid #dc2626',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 4px 16px rgba(220,38,38,0.1)',
              transition: 'all 0.3s ease'
            }}>
              <RankingList
                title="Deudores Crónicos"
                items={Array.isArray(deudoresCronicos) ? deudoresCronicos.slice(0, 10).map((d) => ({
                  label: compactLabel(d.cliente),
                  fullLabel: d.cliente,
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
      const totalVencidoSistema = todosDocsVencidos.reduce((s, d) => s + getDocAmount(d), 0);
      const totalPorGestionar = (selectedCliente && selectedCliente !== "Todos")
        ? docsVencidosCliente.reduce((sum, d) => sum + getDocAmount(d), 0)
        : totalVencidoSistema;
      
      // Calcular gestiones de hoy
      const hoy = new Date().toISOString().split('T')[0];
      
      // EN GENERAL: clientes únicos / EN INDIVIDUAL: total de gestiones
      const gestionesHoy = (selectedCliente && selectedCliente !== "Todos")
        ? gestiones.filter(g => g.fecha && g.fecha.startsWith(hoy)).length  // Individual: todas las gestiones del cliente
        : allGestiones
            .filter(g => g.fecha && g.fecha.startsWith(hoy))
            .map(g => g.cliente || g.razon_social)
            .filter((cliente, index, arr) => arr.indexOf(cliente) === index)  // General: clientes únicos
            .length;
      
      // PDFs generados hoy
      // EN GENERAL: clientes únicos / EN INDIVIDUAL: total de PDFs
      const pdfsGenerados = (selectedCliente && selectedCliente !== "Todos")
        ? gestiones.filter(g => g.fecha && g.fecha.startsWith(hoy) && g.tipo === "PDF").length  // Individual: total de PDFs del cliente
        : allGestiones
            .filter(g => g.fecha && g.fecha.startsWith(hoy) && g.tipo === "PDF")
            .map(g => g.cliente || g.razon_social)
            .filter((cliente, index, arr) => arr.indexOf(cliente) === index)  // General: clientes únicos con PDF
            .length;
      
      // Función para exportar PDF
      const exportarEstadoDeCuenta = async (clienteNombre: string) => {
        if (!clienteNombre || clienteNombre === "Todos") {
          addToast("Selecciona un cliente específico para generar su estado de cuenta", "info");
          return;
        }
        
        // Obtener documentos con saldo (vencidos y vigentes)
        const docsCliente = docs.filter(d => 
          (d.razon_social === clienteNombre || d.cliente === clienteNombre) && 
          (d.saldo || d.total) > 0.01
        ).sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());

        if (docsCliente.length === 0) {
          addToast("Este cliente no tiene documentos vencidos", "info");
          return;
        }

        const totalDeuda = docsCliente.reduce((sum, d) => sum + getDocAmount(d), 0);
        const totalVencido = docsCliente.filter(d => (d.dias_vencidos || 0) > 0).reduce((sum, d) => sum + getDocAmount(d), 0);
        const totalPorVencer = totalDeuda - totalVencido;
        
        try {
          const { jsPDF, autoTable } = await loadJsPDF();
          const doc = new jsPDF();
          const margin = 15;
          const { pageWidth } = renderPdfHeader(doc, {
            title: 'ESTADO DE CUENTA',
            lines: [
              `Empresa: ${empresa.nombre || 'Mi Empresa'}`,
              `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
              empresa.ruc ? `RUC: ${empresa.ruc}` : ''
            ]
          });
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
          // --- TABLA (SOLO DOCUMENTOS VENCIDOS) ---
          const tableData = docsCliente
            .filter(d => (d.dias_vencidos || 0) > 0)  // Solo vencidos para la tabla
            .map(d => {
              const dias = d.dias_vencidos || 0;
              return [
                d.documento || d.numero,
                d.fecha_emision,
                d.fecha_vencimiento,
                `${dias} días`,
                fmtMoney(getDocAmount(d))
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
            id: `pdf_${Date.now()}`,
            cliente: clienteNombre,
            tipo: "PDF",
            resultado: "Generado",
            observacion: "Estado de cuenta generado en PDF",
            fecha: new Date().toISOString()
          });
        } catch (e) {
          console.error(e);
          addToast("Error generando estado de cuenta", "error");
        }
      };

      const enviarEmail = (clienteNombre: string) => {
        const empresaNombre = empresa?.nombre || "[Nombre Empresa]";
        const fechaHoy = new Date().toLocaleDateString();
        const docsCliente = todosDocsVencidos.filter(d => (d.razon_social === clienteNombre || d.cliente === clienteNombre));
        const totalCliente = docsCliente.reduce((sum, d) => sum + getDocAmount(d), 0);
        
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
          id: `email_${Date.now()}`,
          cliente: clienteNombre,
          tipo: "Email",
          resultado: "Enviado",
          observacion: "Recordatorio de pago enviado por correo",
          fecha: new Date().toISOString()
        });
        addToast("Gestión de Email registrada", "success");
      };

      // Función para generar Reporte de Gestión (Evidencia) - VISTA AGRUPADA COMPACTA
      const exportarReporteGestion = async () => {
        // Filtrar gestiones por fecha si hay filtro
        let gestionesFiltradas = filteredGestiones;
        if (filtroFechaDesde) {
          gestionesFiltradas = gestionesFiltradas.filter(g => g.fecha && g.fecha >= filtroFechaDesde);
        }
        if (filtroFechaHasta) {
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

          const accent = [59, 130, 246] as [number, number, number];
          const muted = [100, 116, 139] as [number, number, number];
          const text = [15, 23, 42] as [number, number, number];
          const { headerHeight, contentLeft, pageWidth } = renderPdfHeader(doc, {
            title: 'Reporte de Gestion de Cobranza',
            lines: [
              `Empresa: ${empresa.nombre || 'Mi Empresa'}`,
              `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
              `Alcance: ${selectedCliente === "Todos" || !selectedCliente ? "General (Todos los clientes)" : selectedCliente}`
            ]
          });

          const totalGestiones = gestionesFiltradas.length;
          const totalContactos = gestionesFiltradas.filter(g =>
            ['Llamada', 'Visita'].some(t => g.tipo.includes(t)) || g.resultado?.includes('Contactado')
          ).length;
          const totalPromesas = gestionesFiltradas.filter(g => g.promesa || g.monto_promesa).length;
          const totalPdfs = gestionesFiltradas.filter(g => g.tipo.includes('PDF')).length;

          const cardY = headerHeight + 6;
          const cardH = 16;
          const cardGap = 4;
          const availableWidth = pageWidth - (contentLeft * 2);
          const cardW = (availableWidth - (cardGap * 3)) / 4;
          const cards = [
            { label: 'Gestiones', value: `${totalGestiones}`, color: [59, 130, 246] as [number, number, number], soft: [219, 234, 254] as [number, number, number] },
            { label: 'Contactos', value: `${totalContactos}`, color: [14, 116, 144] as [number, number, number], soft: [204, 251, 241] as [number, number, number] },
            { label: 'Promesas', value: `${totalPromesas}`, color: [245, 158, 11] as [number, number, number], soft: [254, 243, 199] as [number, number, number] },
            { label: 'PDFs', value: `${totalPdfs}`, color: [99, 102, 241] as [number, number, number], soft: [224, 231, 255] as [number, number, number] }
          ];

          cards.forEach((item, idx) => {
            const x = contentLeft + idx * (cardW + cardGap);
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(item.soft[0], item.soft[1], item.soft[2]);
            doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD');
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.rect(x, cardY, cardW, 1.2, 'F');
            doc.setFontSize(7);
            doc.setTextColor(muted[0], muted[1], muted[2]);
            doc.text(item.label.toUpperCase(), x + 4, cardY + 6);
            doc.setFontSize(10);
            doc.setTextColor(item.color[0], item.color[1], item.color[2]);
            doc.text(item.value, x + 4, cardY + 12);
          });

          // Agrupar gestiones por cliente
          const clientesMap = new Map<string, any[]>();
          gestionesFiltradas.forEach(g => {
            const cliente = g.razon_social || g.cliente;
            if (!clientesMap.has(cliente)) clientesMap.set(cliente, []);
            clientesMap.get(cliente)!.push(g);
          });

          // Ordenar clientes alfabéticamente
          const clientesSorted = Array.from(clientesMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

          // Función para obtener color según resultado y fecha alternada - COLORES ALTERNADOS POR FECHA
          const getResultadoColorWithDate = (resultado: string, dateIndex: number) => {
            // Dos sets de colores alternados por fecha
            const colorMap = {
              0: { // Fechas pares - Colores normales (más saturados)
                Contactado: [187, 247, 208],
                Promesa: [253, 224, 71],
                NoContesta: [252, 165, 165],
                Enviado: [191, 219, 255],
                Default: [248, 250, 252]
              },
              1: { // Fechas impares - Colores más claros/suaves
                Contactado: [210, 248, 225],
                Promesa: [254, 235, 131],
                NoContesta: [253, 195, 195],
                Enviado: [212, 230, 255],
                Default: [240, 245, 250]
              }
            };

            const colors = colorMap[dateIndex % 2];
            if (resultado?.includes('Contactado')) return colors.Contactado;
            if (resultado?.includes('Promesa')) return colors.Promesa;
            if (resultado?.includes('No Contesta')) return colors.NoContesta;
            if (resultado?.includes('Enviado') || resultado?.includes('Generado')) return colors.Enviado;
            return colors.Default;
          };

          let startY = cardY + cardH + 18;

          // Crear tabla separada por cada cliente
          clientesSorted.forEach(([cliente, gestiones], clienteIdx) => {
            // Ordenar gestiones por fecha y crear mapa de índices
            const gestionesOrdenadas = [...gestiones].sort((a, b) => {
              const dateA = a.fecha ? a.fecha.split('T')[0] : '';
              const dateB = b.fecha ? b.fecha.split('T')[0] : '';
              return dateB.localeCompare(dateA); // Más recientes primero
            });

            // Crear mapa de fecha -> índice para alternar colores
            const fechaIndexMap = new Map<string, number>();
            let fechaCounter = 0;
            gestionesOrdenadas.forEach(g => {
              const fecha = g.fecha ? g.fecha.split('T')[0] : 'sin-fecha';
              if (!fechaIndexMap.has(fecha)) {
                fechaIndexMap.set(fecha, fechaCounter);
                fechaCounter++;
              }
            });

            // Calcular subtotales del cliente
            const totalClienteGestiones = gestionesOrdenadas.length;
            const totalClientePromesas = gestionesOrdenadas.filter(g => g.promesa || g.monto_promesa).length;
            const totalMontoPromesas = gestionesOrdenadas.reduce((sum, g) => sum + (g.monto_promesa || 0), 0);
            const contactosCliente = gestionesOrdenadas.filter(g =>
              ['Llamada', 'Visita'].some(t => g.tipo.includes(t)) || g.resultado?.includes('Contactado')
            ).length;

            // Construir datos para este cliente
            const clienteTableData: any[] = [];

            // Filas de gestiones del cliente - CON COLORES ALTERNADOS POR FECHA
            gestionesOrdenadas.forEach(g => {
              const fechaKey = g.fecha ? g.fecha.split('T')[0] : 'sin-fecha';
              const dateIndex = fechaIndexMap.get(fechaKey) || 0;
              const bgColor = getResultadoColorWithDate(g.resultado, dateIndex);

              clienteTableData.push([
                { content: g.fecha ? g.fecha.replace('T', ' ').substring(0, 16) : '-', styles: { fillColor: bgColor } },
                { content: ['Llamada', 'Visita'].some(t => g.tipo.includes(t)) ? 'X' : '', styles: { halign: 'center', fillColor: bgColor } },
                { content: g.tipo.includes('Email') ? 'X' : '', styles: { halign: 'center', fillColor: bgColor } },
                { content: g.tipo.includes('WhatsApp') ? 'X' : '', styles: { halign: 'center', fillColor: bgColor } },
                { content: g.tipo.includes('PDF') ? 'X' : '', styles: { halign: 'center', fillColor: bgColor } },
                { content: g.resultado || '-', styles: { fillColor: bgColor } },
                { content: g.observacion || '-', styles: { fillColor: bgColor } },
                { content: g.monto_promesa ? fmtMoney(g.monto_promesa) : '-', styles: { fontStyle: g.monto_promesa ? 'bold' : 'normal', halign: 'right', textColor: g.monto_promesa ? [245, 158, 11] : text, fillColor: bgColor } }
              ]);
            });

            // Subtotal por cliente - FILA COMPACTA
            const montoStr = totalMontoPromesas > 0 ? fmtMoney(totalMontoPromesas) : '-';
            clienteTableData.push([
              { content: `SUBTOTAL: ${totalClienteGestiones} gest. | ${contactosCliente} contactos | ${totalClientePromesas} promesas | ${montoStr}`, styles: { fontStyle: 'bold', fontSize: 7, textColor: text, fillColor: [243, 244, 246], cellPadding: [2, 4] }, colSpan: 8 }
            ]);

            // Crear tabla para este cliente con encabezado arriba
            const clienteHead = [
              [{ content: `${cliente.toUpperCase()}`, styles: { fontStyle: 'bold', fontSize: 8, textColor: accent, fillColor: [219, 234, 254], cellPadding: [3, 4], halign: 'center' }, colSpan: 8 }],
              ['Fecha', 'Telf', 'Mail', 'WApp', 'PDF', 'Resultado', 'Observación', 'Monto']
            ];

            autoTable(doc, {
              startY: startY,
              head: clienteHead,
              body: clienteTableData,
              theme: 'plain',
              styles: { fontSize: 8, cellPadding: [2, 3], valign: 'middle', textColor: text },
              headStyles: { fillColor: [219, 234, 254], textColor: accent, fontStyle: 'bold', halign: 'center', fontSize: 8 },
              margin: { left: contentLeft, right: contentLeft },
              columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 14, halign: 'center' },
                2: { cellWidth: 14, halign: 'center' },
                3: { cellWidth: 14, halign: 'center' },
                4: { cellWidth: 14, halign: 'center' },
                5: { cellWidth: 35 },
                6: { cellWidth: 56 },
                7: { cellWidth: 21, halign: 'right' }
              }
            });

            // Actualizar startY para la siguiente tabla
            startY = (doc as any).lastAutoTable.finalY + 8;
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
          <div className="card" style={{ marginBottom: 0, padding: '10px' }}>
            <div className="card-title" style={{fontSize: '0.95rem', marginBottom: '8px'}}>📊 KPIs de Gestión</div>
            <div className="kpis-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div className="kpi-card" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 10px' }}>
                <div className="kpi-title" style={{fontSize: '0.7rem', fontWeight: '600', lineHeight: '1.2', color: '#666'}}>Clientes con Vencidos</div>
                <div className="kpi-value" style={{fontSize: '1.8rem', marginTop: '4px', fontWeight: '700'}}>{clientesConVencidos.length}</div>
              </div>
              <div className="kpi-card" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 10px' }}>
                <div className="kpi-title" style={{fontSize: '0.7rem', fontWeight: '600', lineHeight: '1.2', color: '#666'}}>Total por Gestionar</div>
                <div className="kpi-value kpi-negative" style={{fontSize: '1.8rem', marginTop: '4px', fontWeight: '700'}}>{fmtMoney(totalPorGestionar)}</div>
              </div>
              <div className="kpi-card" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 10px' }}>
                <div className="kpi-title" style={{fontSize: '0.7rem', fontWeight: '600', lineHeight: '1.2', color: '#666'}}>Contactados Hoy</div>
                <div className="kpi-value" style={{fontSize: '1.8rem', marginTop: '4px', fontWeight: '700'}}>{gestionesHoy}</div>
              </div>
              <div className="kpi-card" style={{ alignItems: 'center', textAlign: 'center', padding: '12px 10px' }}>
                <div className="kpi-title" style={{fontSize: '0.7rem', fontWeight: '600', lineHeight: '1.2', color: '#666'}}>PDFs Generados</div>
                <div className="kpi-value" style={{fontSize: '1.8rem', marginTop: '4px', fontWeight: '700'}}>{pdfsGenerados}</div>
              </div>
            </div>
          </div>
          
          {/* Filtros y Acciones */}
          <div className="card" style={{ marginBottom: 0, marginTop: '16px', padding: '12px' }}>
            <div className="card-title" style={{fontSize: '0.95rem', marginBottom: '10px', textAlign: 'center'}}>🔍 Filtros y Acciones</div>
            
            {/* Fila 1: Filtros principales - CENTRADA */}
            <div style={{display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap'}}>
              <label className="field" style={{marginBottom: 0, minWidth: '150px'}}>
                <span style={{fontSize: '0.8rem'}}>Cliente</span>
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
                  style={{width: '100%', fontSize: '0.8rem', padding: '5px 6px'}}
                >
                  <option value="Todos">Todos</option>
                  {clientes.map(c => (
                    <option key={c.cliente || c.razon_social} value={c.cliente || c.razon_social}>
                      {c.razon_social || c.cliente}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{marginBottom: 0, minWidth: '150px'}}>
                <span style={{fontSize: '0.8rem'}}>Estado</span>
                <select value={filtroVistaGestion} onChange={e => setFiltroVistaGestion(e.target.value)} style={{width: '100%', fontSize: '0.8rem', padding: '5px 6px'}}>
                  <option value="Todos">Todos</option>
                  <option value="Con Vencidos">Con Vencidos</option>
                  <option value="Mayor Deuda">Mayor Deuda</option>
                  <option value="Más Días Vencidos">Más Días Vencidos</option>
                </select>
              </label>
            </div>

            {/* Separador visual */}
            <div style={{height: '1px', backgroundColor: '#e5e7eb', margin: '8px 0'}}></div>

            {/* Fila 2: Reportes - CENTRADA */}
            <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap'}}>
              <span style={{fontSize: '0.85rem', fontWeight: '500', color: '#475569', whiteSpace: 'nowrap'}}>📅 Fechas:</span>
              <input 
                type="date" 
                value={filtroFechaDesde} 
                onChange={e => setFiltroFechaDesde(e.target.value)}
                style={{
                  padding: '4px 6px',
                  borderRadius: '3px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem'
                }}
              />
              <span style={{color: '#94a3b8', fontSize: '0.75rem'}}>•</span>
              <input 
                type="date" 
                value={filtroFechaHasta} 
                onChange={e => setFiltroFechaHasta(e.target.value)}
                style={{
                  padding: '4px 6px',
                  borderRadius: '3px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem'
                }}
              />
              <button 
                className="btn primary"
                onClick={exportarReporteGestion}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                📊 Reporte
              </button>
            </div>

            {/* Separador visual */}
            <div style={{height: '1px', backgroundColor: '#e5e7eb', margin: '8px 0'}}></div>

            {/* Fila 3: Acciones Masivas - CENTRADA */}
            <div style={{display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap'}}>
              <button
                className="btn secondary"
                onClick={() => {
                  if (resumenVencidos.length === 0) {
                    addToast("No hay clientes con vencidos", "info");
                    return;
                  }
                  const top = resumenVencidos.slice(0, 50);
                  const lines = top.map(r => `${r.cliente}: ${fmtMoney(r.total)}`);
                  copyToClipboard(lines.join('\r\n'));
                  addToast("Lista masiva copiada al portapapeles", "success");
                }}
                disabled={!hasWritePermissions}
                style={{padding: '4px 10px', fontSize: '0.8rem'}}
              >
                📞 Masiva
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  if (resumenVencidos.length === 0) {
                    addToast("No hay clientes con vencidos", "info");
                    return;
                  }
                  const top = resumenVencidos.slice(0, 30);
                  const lines = [
                    `Resumen de vencidos - ${new Date().toLocaleDateString()}`,
                    '',
                    ...top.map(r => `- ${r.cliente}: ${fmtMoney(r.total)}`)
                  ];
                  const cuerpo = encodeURIComponent(lines.join('\r\n'));
                  window.open(`mailto:?subject=Resumen%20de%20Vencidos&body=${cuerpo}`, '_blank');
                  addToast("Resumen masivo listo para enviar", "success");
                }}
                disabled={!hasWritePermissions}
                style={{padding: '4px 10px', fontSize: '0.8rem'}}
              >
                📧 Estados
              </button>
            </div>
          </div>
          </div>
          
          {/* GESTOR INTEGRADO DE CLIENTE - UNA SOLA INTERFAZ FUNCIONAL */}
          {selectedCliente && selectedCliente !== "Todos" ? (
            <div className="card" style={{marginTop: '20px'}}>
              {/* HEADER DEL CLIENTE */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '2px solid #e5e7eb',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <h2 style={{margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 700, color: '#1f2937'}}>
                    👤 {selectedCliente}
                  </h2>
                  <div style={{
                    display: 'flex',
                    gap: '24px',
                    fontSize: '0.9rem',
                    color: '#6b7280',
                    flexWrap: 'wrap'
                  }}>
                    <span>💰 Vencido: <strong style={{color: '#ef4444', fontSize: '1.1rem'}}>{fmtMoney(totalVencidoCliente)}</strong></span>
                    {todosDocsVencidos.find(d => d.razon_social === selectedCliente || d.cliente === selectedCliente) && (
                      <span>⏰ Máx Días Venc.: <strong style={{color: '#f59e0b', fontSize: '1.1rem'}}>{Math.max(...todosDocsVencidos.filter(d => d.razon_social === selectedCliente || d.cliente === selectedCliente).map(d => d.dias_vencidos || 0))} días</strong></span>
                    )}
                    {gestiones.filter(g => isInCurrentWeek(g.fecha)).length > 0 && (
                      <span>📞 Última contacto: <strong style={{color: '#3b82f6'}}>{gestiones.find(g => isInCurrentWeek(g.fecha))?.fecha ? gestiones.find(g => isInCurrentWeek(g.fecha))?.fecha.substring(0, 10) : 'N/A'}</strong></span>
                    )}
                  </div>
                </div>
                <button 
                  className="btn secondary"
                  style={{padding: '8px 16px', fontSize: '0.9rem'}}
                  onClick={() => setSelectedCliente(null)}
                  title="Volver a lista de clientes"
                >
                  🔙 Volver
                </button>
              </div>

              {/* ACCIONES RÁPIDAS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <button 
                  className="btn secondary"
                  style={{
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => setShowModalGestion(true)}
                  disabled={!hasWritePermissions}
                >
                  <span style={{fontSize: '1.4rem'}}>📞</span>
                  Registrar Llamada
                </button>

                <button 
                  className="btn secondary"
                  style={{
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => enviarEmail(selectedCliente)}
                >
                  <span style={{fontSize: '1.4rem'}}>📧</span>
                  Enviar Email
                </button>

                <button 
                  className="btn secondary"
                  style={{
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={async () => {
                    const empresaNombre = empresa?.nombre || "[Nombre de tu Empresa]";
                    const fechaHoy = new Date().toLocaleDateString();
                    const docsCliente = todosDocsVencidos.filter(d => (d.razon_social === selectedCliente || d.cliente === selectedCliente));
                    const totalCliente = docsCliente.reduce((sum, d) => sum + getDocAmount(d), 0);
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
                      `Por favor, ayúdanos con la confirmación del pago a la brevedad posible.`,
                      '',
                      `¡Saludos!`
                    ];
                    const mensaje = encodeURIComponent(lineas.join('\n'));
                    window.open(`https://wa.me/?text=${mensaje}`, '_blank');
                    registrarGestion({
                      id: `whatsapp_${Date.now()}`,
                      cliente: selectedCliente,
                      tipo: "WhatsApp",
                      resultado: "Enviado",
                      observacion: "Recordatorio enviado por WhatsApp",
                      fecha: new Date().toISOString()
                    });
                    addToast("Gestión de WhatsApp registrada", "success");
                  }}
                >
                  <span style={{fontSize: '1.4rem'}}>💬</span>
                  WhatsApp
                </button>

                <button 
                  className="btn primary"
                  style={{
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => exportarEstadoDeCuenta(selectedCliente)}
                >
                  <span style={{fontSize: '1.4rem'}}>📄</span>
                  Estado de Cuenta
                </button>
              </div>

              {/* DOCUMENTOS VENCIDOS DEL CLIENTE */}
              {docsVencidosCliente.length > 0 && (
                <div style={{marginBottom: '24px'}}>
                  <h3 style={{fontSize: '1.1rem', fontWeight: '700', marginBottom: '12px', color: '#1f2937'}}>
                    📋 Documentos Vencidos ({docsVencidosCliente.length})
                  </h3>
                  <div className="table-wrapper">
                    <table className="data-table" style={{fontSize: '0.85rem', marginBottom: 0}}>
                      <thead>
                        <tr>
                          <th>Documento</th>
                          <th>Emisión</th>
                          <th>Vencimiento</th>
                          <th className="num">Días Vencidos</th>
                          <th className="num">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docsVencidosCliente.slice(0, 10).map(d => (
                          <tr key={d.id}>
                            <td style={{fontWeight: '600'}}>{d.documento || d.numero}</td>
                            <td>{d.fecha_emision}</td>
                            <td>{d.fecha_vencimiento}</td>
                            <td className="num">
                              <span style={{
                                backgroundColor: (d.dias_vencidos || 0) > 90 ? '#fee2e2' : (d.dias_vencidos || 0) > 60 ? '#fef3c7' : '#e0e7ff',
                                color: (d.dias_vencidos || 0) > 90 ? '#dc2626' : (d.dias_vencidos || 0) > 60 ? '#d97706' : '#4f46e5',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: '600',
                                fontSize: '0.9rem'
                              }}>
                                {d.dias_vencidos || 0}
                              </span>
                            </td>
                            <td className="num" style={{fontWeight: '600'}}>{fmtMoney(d.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* HISTORIAL DE GESTIONES */}
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <h3 style={{fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#1f2937'}}>
                    📞 Historial de Gestiones ({gestiones.length})
                  </h3>
                  {gestiones.length > 0 && (
                    <button 
                      className="btn secondary"
                      style={{padding: '6px 12px', fontSize: '0.85rem'}}
                      onClick={exportarReporteGestion}
                    >
                      📊 Generar Reporte
                    </button>
                  )}
                </div>

                <div className="table-wrapper">
                  <table className="data-table" style={{fontSize: '0.85rem', marginBottom: 0}}>
                    <thead>
                      <tr>
                        <th style={{minWidth: '120px'}}>Fecha</th>
                        <th style={{minWidth: '100px'}}>Tipo</th>
                        <th>Resultado</th>
                        <th>Observación</th>
                        <th className="num">Monto Promesa</th>
                        <th style={{width: '40px'}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {gestiones.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{textAlign: 'center', padding: '24px', color: '#9ca3af'}}>
                            📭 Sin gestiones registradas. ¡Comienza registrando una!
                          </td>
                        </tr>
                      ) : (
                        gestiones.slice(0, 20).map(g => (
                          <tr key={g.id} style={{
                            borderLeft: g.resultado?.includes('Promesa') && !g.resultado?.includes('Cumplida') ? '4px solid #3b82f6' : '',
                            paddingLeft: '8px'
                          }}>
                            <td style={{fontWeight: '600', color: '#374151'}}>
                              {g.fecha ? g.fecha.replace('T', ' ').substring(0, 16) : '-'}
                            </td>
                            <td>
                              <span style={{
                                backgroundColor: 
                                  g.tipo?.includes('Llamada') ? '#dcfce7' :
                                  g.tipo?.includes('Email') ? '#dbeafe' :
                                  g.tipo?.includes('WhatsApp') ? '#dcfce7' :
                                  g.tipo?.includes('PDF') ? '#f3e8ff' : '#f3f4f6',
                                color:
                                  g.tipo?.includes('Llamada') ? '#166534' :
                                  g.tipo?.includes('Email') ? '#1e40af' :
                                  g.tipo?.includes('WhatsApp') ? '#166534' :
                                  g.tipo?.includes('PDF') ? '#7e22ce' : '#374151',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                fontWeight: '600'
                              }}>
                                {g.tipo || 'N/A'}
                              </span>
                            </td>
                            <td style={{fontWeight: '600', color: g.resultado?.includes('Promesa') ? '#3b82f6' : '#374151'}}>
                              {g.resultado || '-'}
                            </td>
                            <td style={{fontSize: '0.8rem', maxWidth: '250px', color: '#6b7280'}}>
                              {g.observacion ? (g.observacion.length > 40 ? g.observacion.substring(0, 40) + '...' : g.observacion) : '-'}
                            </td>
                            <td className="num">
                              {g.fecha_promesa ? (
                                <span style={{
                                  backgroundColor: '#fef3c7',
                                  color: '#d97706',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  fontWeight: '600'
                                }}>
                                  {g.fecha_promesa} ${(g.monto_promesa || 0).toLocaleString()}
                                </span>
                              ) : '-'}
                            </td>
                            <td style={{textAlign: 'center'}}>
                              <button 
                                className="promesa-eliminar"
                                style={{position: 'static', transform: 'none', marginLeft: 0, fontSize: '1rem'}}
                                onClick={() => eliminarGestion(g.id)}
                                disabled={!hasWritePermissions}
                                title="Eliminar gestión"
                              >
                                ❌
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {gestiones.length > 20 && (
                  <p style={{textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem', marginTop: '8px', marginBottom: 0}}>
                    Mostrando últimas 20 de {gestiones.length} gestiones
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* TABLA DE CLIENTES PARA SELECCIONAR */
            <div className="card" style={{marginTop: '20px'}}>
              <div className="card-title">📋 Clientes con Vencimientos - Selecciona uno para gestionar</div>
              <div className="table-wrapper">
                <div style={{overflowX: 'auto', width: '100%', padding: 0, margin: 0}}>
                  <table className="data-table" style={{minWidth: 900, width: '100%', tableLayout: 'auto'}}>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th className="num">Vencido</th>
                        <th className="text-center" title="Última llamada">📞</th>
                        <th className="text-center" title="Último email">📧</th>
                        <th className="text-center" title="Último WhatsApp">💬</th>
                        <th className="text-center" title="Último estado de cuenta">📄</th>
                        <th style={{width: '100px'}}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesUnicos.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{textAlign: 'center', color: '#9ca3af', padding: '24px'}}>
                            No se encontraron clientes con vencimientos
                          </td>
                        </tr>
                      ) : (
                        [...clientesUnicos]
                          .map(cliente => {
                            const docsCliente = todosDocsVencidos.filter(d => d.razon_social === cliente || d.cliente === cliente);
                            const totalCliente = docsCliente.reduce((sum, d) => sum + getDocAmount(d), 0);
                            return { cliente, docsCliente, totalCliente };
                          })
                          .sort((a, b) => b.totalCliente - a.totalCliente)
                          .map(({ cliente, docsCliente, totalCliente }) => {
                            const maxDias = docsCliente.length > 0 ? Math.max(...docsCliente.map(d => d.dias_vencidos || 0)) : 0;
                            const gestionesSemana = allGestiones.filter(g =>
                              (g.razon_social || g.cliente) === cliente && isInCurrentWeek(g.fecha)
                            );
                            const lastCall = gestionesSemana.find(g => g.tipo === 'Llamada' || g.tipo === 'Visita');
                            const lastEmail = gestionesSemana.find(g => g.tipo === 'Email');
                            const lastWhatsapp = gestionesSemana.find(g => g.tipo === 'WhatsApp');
                            const lastPdf = gestionesSemana.find(g => g.tipo === 'PDF');
                            const colorIndicador = maxDias > 90 ? '#ef4444' : maxDias > 60 ? '#f59e0b' : '#10b981';

                            return (
                              <tr
                                key={cliente}
                                style={{
                                  borderLeft: `4px solid ${colorIndicador}`,
                                  cursor: 'pointer'
                                }}
                              >
                                <td style={{fontWeight: '600', color: '#7c3aed'}}>{cliente}</td>
                                <td className="num" style={{fontWeight: '700', fontSize: '0.95rem'}}>{fmtMoney(totalCliente)}</td>
                                <td className="text-center" title={lastCall ? lastCall.fecha : 'Sin contacto'}>
                                  {lastCall ? <span style={{color:'#10b981', fontSize: '1.1rem'}}>✅</span> : '○'}
                                </td>
                                <td className="text-center" title={lastEmail ? lastEmail.fecha : 'Sin envío'}>
                                  {lastEmail ? <span style={{color:'#3b82f6', fontSize: '1.1rem'}}>✅</span> : '○'}
                                </td>
                                <td className="text-center" title={lastWhatsapp ? lastWhatsapp.fecha : 'Sin envío'}>
                                  {lastWhatsapp ? <span style={{color:'#22c55e', fontSize: '1.1rem'}}>✅</span> : '○'}
                                </td>
                                <td className="text-center" title={lastPdf ? lastPdf.fecha : 'Sin estado de cuenta'}>
                                  {lastPdf ? <span style={{color:'#6366f1', fontSize: '1.1rem'}}>✅</span> : '○'}
                                </td>
                                <td>
                                  <button 
                                    className="btn secondary"
                                    style={{padding: '6px 12px', fontSize: '0.85rem', width: '100%'}}
                                    onClick={() => setSelectedCliente(cliente)}
                                  >
                                    Gestionar →
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
            </div>
          )}
        </div>
      );
    }

    if (tab === "config") {
      return (
        <div>
        <div className="config-container">
          <h2 style={{ marginBottom: 6, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.4rem' }}>Configuración</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 14, fontSize: '0.85rem' }}>Administra las preferencias generales y el sistema</p>

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
                      {pendingTheme === t.id && <span className="theme-check">✅</span>}
                    </div>
                  ))}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                  <button 
                    className="btn primary" 
                    style={{ padding: '8px 24px', fontSize: '0.9rem', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
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

            {/* TARJETA 4: SISTEMA */}
            <div className="config-card">
              <div className="config-header">
                <div className="config-icon-box">🔧</div>
                <div className="config-title">
                  <h3>Sistema</h3>
                  <p>Mantenimiento y ayuda</p>
                </div>
              </div>
              <div className="config-actions">
                <button className="config-btn" onClick={() => setShowModalDocumentacion(true)}>
                  <span><span className="config-btn-icon">📖</span> Documentación</span>
                  <span className="config-btn-arrow">→</span>
                </button>
                <button className="config-btn" onClick={() => setShowModalHistorial(true)}>
                  <span><span className="config-btn-icon">📝</span> Historial de cambios</span>
                  <span className="config-btn-arrow">→</span>
                </button>
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: '0.7rem', color: '#1e40af', lineHeight: '1.3' }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.75rem' }}>📋 Información Legal</div>
                <div style={{ marginBottom: 3 }}>© 2026 Jhon Franklin Mejia Castro</div>
                <div style={{ marginBottom: 3 }}>RUC: 0950998104001</div>
                <div style={{ fontSize: '0.65rem', marginTop: 4, fontStyle: 'italic', color: '#3730a3' }}>Prohibida reproducción no autorizada.</div>
              </div>
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-main)', borderRadius: 8, border: '1px dashed var(--border)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span>Versión</span>
                  <strong style={{ color: 'var(--text-main)' }}>{updateInfo?.currentVersion || 'N/A'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 4 }}>
                  <span>Actualizaciones</span>
                  <strong style={{ color: 'var(--text-main)' }}>{updateInfo?.updateCount ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 4 }}>
                  <span>Última actualización</span>
                  <strong style={{ color: 'var(--text-main)' }}>{formatUpdateDate(updateInfo?.updatedAt)}</strong>
                </div>
              </div>
            </div>

          </div>
        </div>
        </div>
      );
    }

    if (tab === "reportes") {
      const normalizedSearch = searchDocumentos.trim().toLowerCase();
      const docsFiltrados = docs.filter((d: Documento) => {
        const clienteNombre = d.razon_social || d.cliente || '';
        const matchCliente = !selectedCliente || d.cliente === selectedCliente || d.razon_social === selectedCliente;
        const matchVendedor = !selectedVendedor || d.vendedor === selectedVendedor;
        const matchCentro = filtroCentroCosto === "Todos" || d.centro_costo === filtroCentroCosto;
        const matchPendiente = !soloPendientes || getDocAmount(d) > 0;

        let matchAging = true;
        const dias = d.dias_vencidos ?? 0;
        if (filtroAging === "Vencidos") matchAging = dias > 0;
        else if (filtroAging === "Por vencer" || filtroAging === "Por Vencer") matchAging = dias <= 0;
        else if (filtroAging === "+120") matchAging = dias > 120;
        else if (filtroAging !== "Todos") matchAging = getAgingLabel(d) === filtroAging;

        const matchSearch = !normalizedSearch
          || clienteNombre.toLowerCase().includes(normalizedSearch)
          || (d.cliente || '').toLowerCase().includes(normalizedSearch)
          || (d.documento || d.numero || '').toLowerCase().includes(normalizedSearch);

        return matchCliente && matchVendedor && matchCentro && matchAging && matchSearch && matchPendiente;
      });

      const exportarExcel = async () => {
        try {
          const XLSX = await loadXLSX();
          const dataExport = docsFiltrados.map((d: any) => {
            const aging = d.aging || getAgingLabel(d);
            return {
            'Documento': d.documento,
            'Cliente': d.cliente,
            'Razón Social': d.razon_social,
            'Vendedor': d.vendedor || '-',
            'Emisión': d.fecha_emision,
            'Vencimiento': d.fecha_vencimiento,
            'Días Vencidos': d.dias_vencidos || 0,
            'Aging': aging,
            'Total': d.total,
            'Valordocumento': d.valor_documento,
            'Retenciones': d.retenciones || 0
          }});
          
          const ws = XLSX.utils.json_to_sheet(dataExport);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Cartera');
          
          // Nombre del archivo según tipo de reporte
          let nombreArchivoExcel = 'Cartera_GENERAL';
          if (selectedVendedor) {
            nombreArchivoExcel = `Cartera_${selectedVendedor.replace(/[^a-z0-9]/gi, '_')}`;
          } else if (selectedCliente && selectedCliente !== 'Todos') {
            nombreArchivoExcel = `Cartera_${selectedCliente.replace(/[^a-z0-9]/gi, '_')}`;
          }
          
          XLSX.writeFile(wb, `${nombreArchivoExcel}_${new Date().toISOString().split('T')[0]}.xlsx`);
          addToast('✅ Reporte Excel generado', 'success');
        } catch (error) {
          addToast('❌ Error al generar Excel', 'error');
        }
      };

      const exportarPDF = async () => {
        try {
          const { jsPDF, autoTable } = await loadJsPDF();
          const doc = new jsPDF();
          const accent = [59, 130, 246] as [number, number, number];
          const muted = [100, 116, 139] as [number, number, number];
          const text = [15, 23, 42] as [number, number, number];
          // Título con diferenciación: GENERAL, CLIENTE o VENDEDOR
          let tituloReporte = 'Reporte de Cartera - GENERAL';
          if (selectedVendedor) {
            tituloReporte = `Reporte de Cartera ${selectedVendedor}`;
          } else if (selectedCliente && selectedCliente !== 'Todos') {
            tituloReporte = `Reporte de Cartera - ${selectedCliente}`;
          }

          const { headerHeight, contentLeft, pageWidth } = renderPdfHeader(doc, {
            title: tituloReporte,
            lines: [
              `Empresa: ${empresa.nombre || 'Mi Empresa'}`,
              `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
              empresa.ruc ? `RUC: ${empresa.ruc}` : ''
            ]
          });

          const totalDocs = docsFiltrados.length;
          const totalMonto = docsFiltrados.reduce((sum: number, d: any) => sum + getDocAmount(d), 0);
          const docsVencidos = docsFiltrados.filter((d: any) => (d.dias_vencidos || 0) > 0);
          const totalVencido = docsVencidos.reduce((sum: number, d: any) => sum + getDocAmount(d), 0);

          const cardY = headerHeight + 6;
          const cardH = 16;
          const cardGap = 4;
          const availableWidth = pageWidth - (contentLeft * 2);
          const cardW = (availableWidth - (cardGap * 3)) / 4;
          const startX = contentLeft;
          const cards = [
            { label: 'Documentos', value: `${totalDocs}`, color: [59, 130, 246] as [number, number, number], soft: [219, 234, 254] as [number, number, number] },
            { label: 'Monto Total', value: fmtMoney(totalMonto), color: [14, 116, 144] as [number, number, number], soft: [204, 251, 241] as [number, number, number] },
            { label: 'Docs Vencidos', value: `${docsVencidos.length}`, color: [245, 158, 11] as [number, number, number], soft: [254, 243, 199] as [number, number, number] },
            { label: 'Monto Vencido', value: fmtMoney(totalVencido), color: [239, 68, 68] as [number, number, number], soft: [254, 226, 226] as [number, number, number] }
          ];

          cards.forEach((item, idx) => {
            const x = startX + idx * (cardW + cardGap);
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(item.soft[0], item.soft[1], item.soft[2]);
            doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD');
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.rect(x, cardY, cardW, 1.2, 'F');
            doc.setFontSize(7);
            doc.setTextColor(muted[0], muted[1], muted[2]);
            doc.text(item.label.toUpperCase(), x + 4, cardY + 6);
            doc.setFontSize(10);
            doc.setTextColor(item.color[0], item.color[1], item.color[2]);
            doc.text(item.value, x + 4, cardY + 12);
          });
          
          const groupedRows: Array<[string, string, string | number, string, string]> = [];
          const rowMeta: Array<{ isGroup: boolean; doc?: Documento }> = [];
          const grouped = new Map<string, Documento[]>();
          docsFiltrados.forEach((d: any) => {
            const key = d.razon_social || d.cliente || '-';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(d as Documento);
          });

          Array.from(grouped.entries()).forEach(([clienteNombre, docsCliente]) => {
            const subtotal = docsCliente.reduce((sum, d) => sum + getDocAmount(d), 0);
            groupedRows.push(['', clienteNombre, '', '', fmtMoney(subtotal)]);
            rowMeta.push({ isGroup: true });

            docsCliente.forEach((d) => {
              const aging = (d as any).aging || getAgingLabel(d);
              groupedRows.push([
                d.documento || d.numero || '-',
                '',
                d.dias_vencidos || 0,
                aging,
                fmtMoney(getDocAmount(d))
              ]);
              rowMeta.push({ isGroup: false, doc: d });
            });
          });
          
          const getRowFill = (agingValue: string, dias: number) => {
            if (dias > 180 || agingValue === '>360' || agingValue === '360') return [254, 226, 226];
            if (dias > 90 || agingValue === '180' || agingValue === '150' || agingValue === '120') return [254, 243, 199];
            if (dias > 0) return [220, 252, 231];
            return [248, 250, 252];
          };

          autoTable(doc, {
            head: [['Documento', 'Cliente', 'Dias Venc.', 'Aging', 'Saldo']],
            body: groupedRows,
            startY: cardY + cardH + 8,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2, textColor: text },
            headStyles: { fillColor: [219, 234, 254], textColor: accent, fontStyle: 'bold' },
            margin: { left: contentLeft, right: contentLeft },
            columnStyles: {
              2: { halign: 'right' },
              4: { halign: 'right' }
            },
            didParseCell: (data) => {
              if (data.section !== 'body') return;
              const meta = rowMeta[data.row.index];
              if (meta?.isGroup) {
                data.cell.styles.fillColor = [241, 245, 249] as any;
                data.cell.styles.fontStyle = 'bold';
                if (data.column.index === 4) {
                  data.cell.styles.textColor = accent as any;
                }
                return;
              }
              const rowDoc = meta?.doc;
              const dias = rowDoc?.dias_vencidos || 0;
              const agingValue = (rowDoc as any)?.aging || (rowDoc ? getAgingLabel(rowDoc) : '');
              data.cell.styles.fillColor = getRowFill(agingValue, dias) as any;
            }
          });
          
          // Nombre del archivo según tipo de reporte
          let nombreArchivo = 'Cartera_GENERAL';
          if (selectedVendedor) {
            nombreArchivo = `Cartera_${selectedVendedor.replace(/[^a-z0-9]/gi, '_')}`;
          } else if (selectedCliente && selectedCliente !== 'Todos') {
            nombreArchivo = `Cartera_${selectedCliente.replace(/[^a-z0-9]/gi, '_')}`;
          }
          
          doc.save(`${nombreArchivo}_${new Date().toISOString().split('T')[0]}.pdf`);
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
                <div className="kpi-value">{docsFiltrados.length}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Monto Total</div>
                <div className="kpi-value">{fmtMoney(docsFiltrados.reduce((sum: number, d: any) => sum + (d.total || 0), 0))}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Docs Vencidos</div>
                <div className="kpi-value kpi-negative">{docsFiltrados.filter((d: any) => (d.dias_vencidos || 0) > 0).length}</div>
                <div className="kpi-subtitle">{docsFiltrados.length > 0 ? ((docsFiltrados.filter((d: any) => (d.dias_vencidos || 0) > 0).length / docsFiltrados.length) * 100).toFixed(1) : 0}% del total</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Monto Vencido</div>
                <div className="kpi-value kpi-negative">{fmtMoney(docsFiltrados.filter((d: any) => (d.dias_vencidos || 0) > 0).reduce((sum: number, d: any) => sum + (d.total || 0), 0))}</div>
                <div className="kpi-subtitle">{docsFiltrados.length > 0 ? ((docsFiltrados.filter((d: any) => (d.dias_vencidos || 0) > 0).reduce((sum: number, d: any) => sum + (d.total || 0), 0) / docsFiltrados.reduce((sum: number, d: any) => sum + (d.total || 0), 0)) * 100).toFixed(1) : 0}% del total</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Clientes Únicos</div>
                <div className="kpi-value">{new Set(docsFiltrados.map((d: any) => d.cliente)).size}</div>
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
                    <option key={c.cliente} value={c.cliente}>{c.razon_social || c.cliente}</option>
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
              <label className="field field-wrapper">
                <input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} />
                <span>Solo saldo pendiente</span>
              </label>
            </div>
            <div className="flex-row" style={{ flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={exportarExcel}>📥 Exportar a Excel</button>
              <button className="btn primary" onClick={exportarPDF}>📄 Exportar a PDF</button>
              <button className="btn secondary" onClick={() => alert('Comparativa mensual: función en desarrollo')}>📈 Comparar Períodos</button>
            </div>

            {!vistaAgrupada ? (
              <div className="table-wrapper">
                <table className="data-table retenciones-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Documento</th>
                      <th>Vendedor</th>
                      <th className="th-fvenc">Fecha Vencimiento</th>
                      <th>Aging</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docsFiltrados.length > 0 ? (
                      docsFiltrados.map((d: any) => (
                        <tr key={d.id}>
                          <td>{d.razon_social}</td>
                          <td>{d.documento}</td>
                          <td>{d.vendedor}</td>
                          <td>{d.fecha_vencimiento}</td>
                          <td>
                            <span className={((d.dias_vencidos || 0) > 90) ? 'kpi-negative' : ((d.dias_vencidos || 0) > 60) ? 'kpi-warning' : ''}>
                              {d.aging ? d.aging : getAgingLabel(d)}
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
                <p className="table-footnote">Mostrando {docsFiltrados.length} de {docsFiltrados.length} documentos</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Documento</th>
                      <th>Vendedor</th>
                      <th className="th-fvenc">Fecha Vencimiento</th>
                      <th>Aging</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docsFiltrados.length > 0 ? (
                      Object.entries(
                        docsFiltrados.reduce((acc: Record<string, { cliente: string; total: number; rows: Documento[] }>, d) => {
                          const key = d.razon_social || d.cliente || 'Sin cliente';
                          if (!acc[key]) acc[key] = { cliente: key, total: 0, rows: [] };
                          acc[key].rows.push(d);
                          acc[key].total += (d.total ?? d.saldo ?? 0);
                          return acc;
                        }, {})
                      )
                        .map(([, group]) => group)
                        .sort((a, b) => b.total - a.total)
                        .flatMap(group => [
                          (
                            <tr key={`group-${group.cliente}`} style={{ background: '#f8fafc' }}>
                              <td colSpan={5} style={{ fontWeight: 700 }}>
                                {group.cliente}
                              </td>
                              <td className="num" style={{ fontWeight: 700 }}>
                                {fmtMoney(group.total)}
                              </td>
                            </tr>
                          ),
                          ...group.rows.map(row => (
                            <tr key={row.id}>
                              <td></td>
                              <td>{row.documento}</td>
                              <td>{row.vendedor}</td>
                              <td>{row.fecha_vencimiento}</td>
                              <td>{row.aging ? row.aging : getAgingLabel(row)}</td>
                              <td className="num">{fmtMoney(typeof row.total === 'number' ? row.total : (row.valor_documento || 0))}</td>
                            </tr>
                          ))
                        ])
                    ) : (
                      <tr><td colSpan={6}>No hay resultados</td></tr>
                    )}
                  </tbody>
                </table>
                <p className="table-footnote">Mostrando {docsFiltrados.length} de {docsFiltrados.length} documentos</p>
              </div>
            )}
          </div>

          <div style={analisisRetenciones.cantidadDocs > 0 ? gridTwoCol : {}}>
          {/* NUEVO: Análisis por Vendedor */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">👤 Análisis por Vendedor</div>
            <div className="table-wrapper wide-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th className="num">Docs</th>
                    <th className="num">Clientes</th>
                    <th className="num">Facturado</th>
                    <th className="num">Cobrado</th>
                    <th className="num">Pendiente</th>
                    <th className="num">% Mora</th>
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
              <div className="table-wrapper wide-table">
                <table className="data-table retenciones-table">
                  <thead>
                    <tr>
                      <th>Doc</th>
                      <th>Cliente</th>
                      <th className="num">Total</th>
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
      // Normalizar hoy a las 00:00:00
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      // Función para calcular diferencia en días correctamente
      const calcularDiasDiferencia = (fechaStr: string): number => {
        const [año, mes, día] = fechaStr.split('-').map(Number);
        const fecha = new Date(año, mes - 1, día, 0, 0, 0, 0);
        const diffMs = fecha.getTime() - hoy.getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      };
      
      const promesasFiltradas = promesas.filter(p => {
        if (!p.fecha_promesa) return true;
        const diffDias = calcularDiasDiferencia(p.fecha_promesa);
        
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
        const diffDias = calcularDiasDiferencia(fechaPromesa);
        
        if (diffDias < 0) return { color: '#e63946', label: '🔴 Vencida' };
        if (diffDias === 0) return { color: '#f59e0b', label: '🟡 Hoy' };
        if (diffDias <= 3) return { color: '#f59e0b', label: '🟡 Próxima' };
        return { color: '#2ea44f', label: '🟢 Vigente' };
      };

      const totalPromesas = promesas.length;
      const montoTotal = promesas.reduce((sum, p) => sum + (p.monto_promesa || 0), 0);
      const vencidas = promesas.filter(p => {
        if (!p.fecha_promesa) return false;
        const diffDias = calcularDiasDiferencia(p.fecha_promesa);
        return diffDias < 0;
      }).length;

      const exportarReportePromesas = async () => {
        try {
          const { jsPDF, autoTable } = await loadJsPDF();
          const doc = new jsPDF();
          const accent = [59, 130, 246] as [number, number, number];
          const muted = [100, 116, 139] as [number, number, number];
          const text = [15, 23, 42] as [number, number, number];

          const { headerHeight, contentLeft, pageWidth } = renderPdfHeader(doc, {
            title: 'Reporte de Promesas de Pago',
            lines: [
              `Empresa: ${empresa.nombre || 'Mi Empresa'}`,
              `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
              empresa.ruc ? `RUC: ${empresa.ruc}` : ''
            ]
          });
          
          const cardY = headerHeight + 6;
          const cardH = 16;
          const cardGap = 4;
          const availableWidth = pageWidth - (contentLeft * 2);
          const cardW = (availableWidth - (cardGap * 3)) / 4;
          const startX = contentLeft;
          
          const cards = [
            { label: 'Total Promesas', value: `${totalPromesas}`, color: [59, 130, 246] as [number, number, number], soft: [219, 234, 254] as [number, number, number] },
            { label: 'Monto Total', value: fmtMoney(montoTotal), color: [14, 116, 144] as [number, number, number], soft: [204, 251, 241] as [number, number, number] },
            { label: 'Vencidas', value: `${vencidas}`, color: [239, 68, 68] as [number, number, number], soft: [254, 226, 226] as [number, number, number] },
            { label: 'Vigentes', value: `${totalPromesas - vencidas}`, color: [16, 185, 129] as [number, number, number], soft: [209, 250, 229] as [number, number, number] }
          ];
          
          cards.forEach((item, idx) => {
            const x = startX + idx * (cardW + cardGap);
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(item.soft[0], item.soft[1], item.soft[2]);
            doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD');
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.rect(x, cardY, cardW, 1.2, 'F');
            doc.setFontSize(7);
            doc.setTextColor(muted[0], muted[1], muted[2]);
            doc.text(item.label.toUpperCase(), x + 4, cardY + 6);
            doc.setFontSize(10);
            doc.setTextColor(item.color[0], item.color[1], item.color[2]);
            doc.text(item.value, x + 4, cardY + 12);
          });
          
          const tableData = promesasFiltradas.map(p => {
            const montoPagado = p.monto_pagado || 0;
            const montoPrometido = p.monto_promesa || 0;
            const falta = montoPrometido - montoPagado;
            const difDias = p.fecha_promesa ? calcularDiasDiferencia(p.fecha_promesa) : 0;
            
            const rawEstado = p.estado_promesa || '';
            const estadoLimpio = rawEstado.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
            let estadoLabel = estadoLimpio || 'Pendiente';
            if (!estadoLimpio) {
              if (difDias < 0) estadoLabel = 'Vencida';
              else if (difDias === 0) estadoLabel = 'Hoy';
              else if (difDias > 0 && difDias <= 3) estadoLabel = 'Proxima';
              else estadoLabel = 'Vigente';
            }
            
            return [
              p.razon_social || p.cliente,
              p.fecha_promesa,
              fmtMoney(montoPrometido),
              fmtMoney(montoPagado),
              fmtMoney(falta),
              estadoLabel,
              p.observacion || '-'
            ];
          });
          
          autoTable(doc, {
            head: [['Cliente', 'Fecha Promesa', 'Prometido', 'Pagado', 'Falta', 'Estado', 'Observación']],
            body: tableData,
            startY: cardY + cardH + 8,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2, textColor: text },
            headStyles: { fillColor: [219, 234, 254], textColor: accent, fontStyle: 'bold' },
            margin: { left: contentLeft, right: contentLeft },
            columnStyles: {
              2: { halign: 'right' },
              3: { halign: 'right' },
              4: { halign: 'right' }
            }
          });
          
          doc.save(`Promesas_${new Date().toISOString().split('T')[0]}.pdf`);
          addToast("✅ Reporte de promesas generado", "success");
        } catch (e) {
          console.error(e);
          addToast("❌ Error generando reporte", "error");
        }
      };

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
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button 
                className="btn primary" 
                onClick={exportarReportePromesas}
                style={{ padding: '6px 12px' }}
              >
                📊 Generar Reporte PDF
              </button>
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
                    <th className="num">Prometido</th>
                    <th className="num">Pagado</th>
                    <th className="num">Falta</th>
                    <th>Estado</th>
                    <th>Observación</th>
                    <th style={{textAlign: 'center'}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {promesasFiltradas.length > 0 ? (
                    promesasFiltradas.map(p => {
                      const semaforo = getSemaforo(p.fecha_promesa);
                      const montoPagado = p.monto_pagado || 0;
                      const montoPrometido = p.monto_promesa || 0;
                      const falta = montoPrometido - montoPagado;
                      const difDias = p.fecha_promesa ? calcularDiasDiferencia(p.fecha_promesa) : 0;
                      
                      // Determinar estado sin emojis y limpiar texto corrupto
                      let estadoPromesa = 'Pendiente';
                      let colorEstado = '#9ca3af';
                      const rawEstado = p.estado_promesa || '';
                      const estadoLimpio = rawEstado.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
                      const estadoNormalizado = estadoLimpio || '';

                      if (!estadoNormalizado) {
                        if (difDias < 0) {
                          estadoPromesa = 'Vencida';
                          colorEstado = '#ef4444';
                        } else if (difDias === 0) {
                          estadoPromesa = 'Hoy';
                          colorEstado = '#f59e0b';
                        } else if (difDias > 0 && difDias <= 3) {
                          estadoPromesa = 'Proxima';
                          colorEstado = '#f59e0b';
                        } else {
                          estadoPromesa = 'Vigente';
                          colorEstado = '#10b981';
                        }
                      } else {
                        estadoPromesa = estadoNormalizado;
                        if (estadoNormalizado === 'Cumplida' || falta <= 0) {
                          colorEstado = '#10b981';
                        } else if (estadoNormalizado === 'Parcialmente Cumplida') {
                          colorEstado = '#f59e0b';
                        } else if (estadoNormalizado === 'Incumplida') {
                          colorEstado = '#ef4444';
                        } else if (estadoNormalizado === 'Reprogramada') {
                          colorEstado = '#3b82f6';
                        } else if (estadoNormalizado === 'Vencida') {
                          colorEstado = '#ef4444';
                        } else if (estadoNormalizado === 'Hoy' || estadoNormalizado === 'Proxima') {
                          colorEstado = '#f59e0b';
                        } else if (estadoNormalizado === 'Vigente') {
                          colorEstado = '#10b981';
                        }
                      }
                      
                      return (
                        <tr key={p.id} style={{ borderLeft: `4px solid ${colorEstado}` }}>
                          <td><strong>{p.razon_social || p.cliente}</strong></td>
                          <td>{p.fecha_promesa}</td>
                          <td className="num" style={{ fontWeight: 'bold', color: '#3b82f6' }}>{fmtMoney(montoPrometido)}</td>
                          <td className="num" style={{ fontWeight: 'bold', color: '#10b981' }}>{fmtMoney(montoPagado)}</td>
                          <td className="num" style={{ fontWeight: 'bold', color: falta > 0 ? '#ef4444' : '#10b981' }}>{fmtMoney(falta)}</td>
                          <td>
                            <span className="status-label" style={{ color: colorEstado, background: 'var(--bg-nav)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colorEstado, display: 'inline-block' }}></span>
                              {estadoPromesa}
                            </span>
                          </td>
                          <td style={{ maxWidth: '300px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.observacion || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="action-buttons" style={{ justifyContent: 'center', gap: '4px' }}>
                              <button className="btn primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => cumplirPromesa(p.id)} disabled={!hasWritePermissions} title="Marcar como cumplida">✓</button>
                              <button className="btn secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => { setPromesaEditando(p); setShowModalEditarPromesa(true); }} title="Editar promesa">✏️</button>
                              <button className="promesa-eliminar" onClick={() => eliminarGestion(p.id)} disabled={!hasWritePermissions} title="Eliminar">✕</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className={`btn ${vistaAnalisis === 'motivos' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('motivos')}>Motivos Impago</button>
                <button className={`btn ${vistaAnalisis === 'productividad' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('productividad')}>Productividad</button>
                <button className={`btn ${vistaAnalisis === 'riesgo' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('riesgo')}>Análisis Riesgo</button>
                <button className={`btn ${vistaAnalisis === 'cronicos' ? 'primary' : 'secondary'}`} onClick={() => setVistaAnalisis('cronicos')}>⚠️ Deudores Crónicos</button>
              </div>
              <button className="btn primary" onClick={exportarAnalisisPDF} disabled={!canExportAnalisis}>
                Generar reporte
              </button>
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
                    {analisisRiesgo.length > 0 ? (
                      analisisRiesgo.map((a, i) => {
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
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} style={{textAlign: 'center', color: '#9ca3af', padding: '20px'}}>
                          Sin datos de riesgo
                        </td>
                      </tr>
                    )}
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
                      <th className="num">Vencido (+90 días)</th>
                      <th className="num">Docs Vencidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deudoresCronicos.length > 0 ? (
                      deudoresCronicos.map((d, idx) => (
                        <tr key={idx} style={{ borderLeft: '4px solid #dc2626' }}>
                          <td><strong>{idx + 1}</strong></td>
                          <td>{d.razon_social}</td>
                          <td>{d.vendedor}</td>
                          <td className="num">{fmtMoney(d.totalDeuda)}</td>
                          <td className="num kpi-negative">{fmtMoney(d.totalVencido)}</td>
                          <td className="num">{d.documentosVencidos}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{textAlign: 'center', color: '#9ca3af', padding: '20px'}}>
                          ✅ No hay deudores crónicos (mora mayor a 90 días)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
        </div>
        </div>
      );
    }

    if (tab === "alertas") {
      const exportarAlertas = async () => {
        if (filteredAlertas.length === 0) {
          addToast("No hay alertas para exportar", "info");
          return;
        }
        try {
          const { jsPDF, autoTable } = await loadJsPDF();
          const doc = new jsPDF();
          const accent = [59, 130, 246] as [number, number, number];
          const muted = [100, 116, 139] as [number, number, number];
          const text = [15, 23, 42] as [number, number, number];

          const { headerHeight, contentLeft, pageWidth } = renderPdfHeader(doc, {
            title: 'Alertas de Incumplimiento',
            lines: [
              `Empresa: ${empresa.nombre || 'Mi Empresa'}`,
              `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
              empresa.ruc ? `RUC: ${empresa.ruc}` : ''
            ]
          });
          
          // KPIs
          const totalVencidos = filteredAlertas.length;
          const montoVencido = filteredAlertas.reduce((sum: number, a: any) => sum + (a.monto || 0), 0);
          const promedioDias = totalVencidos > 0 ? Math.round(filteredAlertas.reduce((sum: number, a: any) => sum + (a.diasVencidos || 0), 0) / totalVencidos) : 0;
          
          const cardY = headerHeight + 6;
          const cardH = 16;
          const cardGap = 4;
          const availableWidth = pageWidth - (contentLeft * 2);
          const cardW = (availableWidth - (cardGap * 2)) / 3;
          const startX = contentLeft;
          
          const cards = [
            { label: 'Documentos Vencidos', value: String(totalVencidos), color: [239, 68, 68] as [number, number, number], soft: [254, 226, 226] as [number, number, number] },
            { label: 'Monto Vencido', value: fmtMoney(montoVencido), color: [234, 88, 12] as [number, number, number], soft: [254, 237, 213] as [number, number, number] },
            { label: 'Promedio Días', value: String(promedioDias), color: [107, 114, 128] as [number, number, number], soft: [243, 244, 246] as [number, number, number] }
          ];
          
          cards.forEach((item, idx) => {
            const x = startX + idx * (cardW + cardGap);
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(item.soft[0], item.soft[1], item.soft[2]);
            doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD');
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.rect(x, cardY, cardW, 1.2, 'F');
            doc.setFontSize(7);
            doc.setTextColor(muted[0], muted[1], muted[2]);
            doc.text(item.label.toUpperCase(), x + 4, cardY + 6);
            doc.setFontSize(10);
            doc.setTextColor(item.color[0], item.color[1], item.color[2]);
            doc.text(item.value, x + 4, cardY + 12);
          });
          
          const tableData = filteredAlertas.map((a: any) => [
            a.cliente,
            a.documento,
            fmtMoney(a.monto),
            String(a.diasVencidos),
            normalizeSeveridad(a.severidad).label
          ]);
          
          autoTable(doc, {
            head: [['Cliente', 'Documento', 'Monto', 'Días Vencido', 'Severidad']],
            body: tableData,
            startY: cardY + cardH + 8,
            theme: 'plain',
            headStyles: { fillColor: [219, 234, 254], textColor: text, fontSize: 9, fontStyle: 'bold', lineColor: [226, 232, 240], lineWidth: 0.2 },
            bodyStyles: { textColor: text, fontSize: 8, lineColor: [226, 232, 240], lineWidth: 0.2 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
            margin: { left: contentLeft, right: contentLeft }
          });
          
          doc.save(`Alertas-Incumplimiento-${new Date().toISOString().split('T')[0]}.pdf`);
          addToast("PDF exportado exitosamente", "success");
        } catch (e) {
          console.error(e);
          addToast("Error al exportar PDF", "error");
        }
      };

      // Contar por severidad para gráfico
      const conteoSeveridad = {
        'Crítico': filteredAlertas.filter(a => normalizeSeveridad(a.severidad).label === 'Crítico').length,
        'Alta': filteredAlertas.filter(a => normalizeSeveridad(a.severidad).label === 'Alta').length,
        'Media': filteredAlertas.filter(a => normalizeSeveridad(a.severidad).label === 'Media').length,
        'Baja': filteredAlertas.filter(a => normalizeSeveridad(a.severidad).label === 'Baja').length
      };
      
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="card">
          <div className="card-title">🚨 Alertas de Incumplimiento</div>
          
          {/* KPIs Resumen */}
          {filteredAlertas.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '15px' }}>
              {(() => {
                const totalVencidos = filteredAlertas.length;
                const montoVencido = filteredAlertas.reduce((sum: number, a: any) => sum + (a.monto || 0), 0);
                const promedioDias = totalVencidos > 0 ? Math.round(filteredAlertas.reduce((sum: number, a: any) => sum + (a.diasVencidos || 0), 0) / totalVencidos) : 0;

                const kpis = [
                  { label: 'Documentos Vencidos', value: String(totalVencidos), color: '#ef4444', bg: '#fee2e2' },
                  { label: 'Monto Vencido', value: fmtMoney(montoVencido), color: '#ea580c', bg: '#ffedd5' },
                  { label: 'Promedio Días', value: String(promedioDias), color: '#6b7280', bg: '#f3f4f6' }
                ];

                return kpis.map((kpi, idx) => (
                  <div key={idx} style={{ 
                    background: kpi.bg, 
                    padding: '12px 14px', 
                    borderRadius: '8px',
                    borderLeft: `4px solid ${kpi.color}`
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>
                      {kpi.label.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: kpi.color }}>
                      {kpi.value}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
          
          <div className="row">
            <label className="field">
              <span>Búsqueda</span>
              <input type="text" value={searchAlertas} onChange={e => setSearchAlertas(e.target.value)} placeholder="Buscar cliente o documento..." />
            </label>
            <label className="field">
              <span>Severidad</span>
              <select value={filtroSeveridad} onChange={e => setFiltroSeveridad(e.target.value)}>
                <option value="Todos">Todas</option>
                <option value="Crítico">Crítico</option>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </label>
            <button
              className="btn secondary"
              onClick={() => exportarAlertas()}
              disabled={filteredAlertas.length === 0}
              style={{ alignSelf: 'flex-end' }}
            >
              📄 Exportar PDF
            </button>
          </div>
          <div className="table-wrapper">
            <table className="data-table no-sticky-header">
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
                  filteredAlertas.map((a, i) => {
                    const sevInfo = normalizeSeveridad(a.severidad);
                    return (
                      <tr key={i}>
                        <td>{a.cliente}</td>
                        <td>{a.documento}</td>
                        <td className="num">{fmtMoney(a.monto)}</td>
                        <td className="num">{a.diasVencidos}</td>
                        <td>
                          <span className={`status-label status-${sevInfo.level}`}>
                            {sevInfo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={5} style={{textAlign: 'center', padding: '20px', color: '#9ca3af'}}>No hay alertas activas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      );
    }

    if (tab === "tendencias") {
      const maxEmision = Math.max(1, ...tendencias.map((t: any) => t.emision || 0));
      const maxCobrado = Math.max(1, ...tendencias.map((t: any) => t.cobrado || 0));
      
      const exportarReporteTendencias = async () => {
        if (tendencias.length === 0) {
          addToast("No hay datos de tendencias para exportar", "info");
          return;
        }
        try {
          const { jsPDF, autoTable } = await loadJsPDF();
          const doc = new jsPDF();
          const accent = [59, 130, 246] as [number, number, number];
          const muted = [100, 116, 139] as [number, number, number];
          const text = [15, 23, 42] as [number, number, number];

          const { headerHeight, contentLeft, pageWidth } = renderPdfHeader(doc, {
            title: 'Tendencias Históricas',
            lines: [
              `Empresa: ${empresa.nombre || 'Mi Empresa'}`,
              `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
              'Periodo: Ultimos 12 meses'
            ]
          });
          
          const cardY = headerHeight + 6;
          const cardH = 16;
          const cardGap = 4;
          const availableWidth = pageWidth - (contentLeft * 2);
          const cardW = (availableWidth - (cardGap * 2)) / 3;
          const startX = contentLeft;
          
          // Calcular KPIs
          const totalEmision = tendencias.reduce((sum: number, t: any) => sum + (t.emision || 0), 0);
          const totalCobrado = tendencias.reduce((sum: number, t: any) => sum + (t.cobrado || 0), 0);
          const totalDocumentos = tendencias.reduce((sum: number, t: any) => sum + (t.documentos || 0), 0);
          const totalVencidos = tendencias.reduce((sum: number, t: any) => sum + (t.vencidos || 0), 0);
          const tasaCobro = totalDocumentos > 0 ? Math.round(((totalDocumentos - totalVencidos) / totalDocumentos) * 100) : 0;
          
          const cards = [
            { label: 'Total Emitido', value: fmtMoney(totalEmision), color: [59, 130, 246] as [number, number, number], soft: [219, 234, 254] as [number, number, number] },
            { label: 'Total Cobrado', value: fmtMoney(totalCobrado), color: [16, 185, 129] as [number, number, number], soft: [209, 250, 229] as [number, number, number] },
            { label: 'Tasa de Cobro', value: `${tasaCobro}%`, color: [107, 114, 128] as [number, number, number], soft: [243, 244, 246] as [number, number, number] }
          ];
          
          cards.forEach((item, idx) => {
            const x = startX + idx * (cardW + cardGap);
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(item.soft[0], item.soft[1], item.soft[2]);
            doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD');
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.rect(x, cardY, cardW, 1.2, 'F');
            doc.setFontSize(7);
            doc.setTextColor(muted[0], muted[1], muted[2]);
            doc.text(item.label.toUpperCase(), x + 4, cardY + 6);
            doc.setFontSize(10);
            doc.setTextColor(item.color[0], item.color[1], item.color[2]);
            doc.text(item.value, x + 4, cardY + 12);
          });
          
          const tableData = tendencias.map((t: any) => {
            const tasaCobro = t.documentos > 0 ? Math.round(((t.documentos - (t.vencidos || 0)) / t.documentos) * 100) : 0;
            return [
              t.mes,
              String(t.documentos || 0),
              fmtMoney(t.emision || 0),
              fmtMoney(t.cobrado || 0),
              `${tasaCobro}%`,
              String(t.vencidos || 0)
            ];
          });

          autoTable(doc, {
            head: [['Mes', 'Documentos', 'Emisión', 'Cobrado', 'Tasa Cobro', 'Vencidos']],
            body: tableData,
            startY: cardY + cardH + 8,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2, textColor: text, lineColor: [226, 232, 240], lineWidth: 0.2 },
            headStyles: { 
              fillColor: [219, 234, 254],
              textColor: accent,
              fontStyle: 'bold',
              halign: 'center',
              lineColor: accent,
              lineWidth: 0.5
            },
            alternateRowStyles: {
              fillColor: [249, 250, 251]
            },
            margin: { left: contentLeft, right: contentLeft },
            columnStyles: {
              1: { halign: 'right' },
              2: { halign: 'right' },
              3: { halign: 'right', textColor: [16, 185, 129] },
              4: { halign: 'right' },
              5: { halign: 'right' }
            }
          });

          doc.save(`Tendencias_${new Date().toISOString().split('T')[0]}.pdf`);
          addToast("✅ Reporte de tendencias generado", "success");
        } catch (e) {
          console.error(e);
          addToast("Error generando reporte de tendencias", "error");
        }
      };
      
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="card-title">📈 Tendencias Históricas (12 meses)</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '10px' }}>
            <button
              className="btn secondary"
              onClick={() => exportarReporteTendencias()}
              disabled={tendencias.length === 0}
            >
              📄 Exportar PDF
            </button>
            <button
              className="btn secondary"
              onClick={() => setMostrarGraficaTendencias(prev => !prev)}
              disabled={tendencias.length === 0}
            >
              {mostrarGraficaTendencias ? '📋 Tabla' : '📊 Gráfica'}
            </button>
          </div>

          {/* KPIs Resumen */}
          {tendencias.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '15px' }}>
              {(() => {
                const totalEmision = tendencias.reduce((sum: number, t: any) => sum + (t.emision || 0), 0);
                const totalCobrado = tendencias.reduce((sum: number, t: any) => sum + (t.cobrado || 0), 0);
                const totalDocumentos = tendencias.reduce((sum: number, t: any) => sum + (t.documentos || 0), 0);
                const totalVencidos = tendencias.reduce((sum: number, t: any) => sum + (t.vencidos || 0), 0);
                const tasaCobro = totalDocumentos > 0 ? Math.round(((totalDocumentos - totalVencidos) / totalDocumentos) * 100) : 0;

                const kpis = [
                  { label: 'Total Emitido', value: fmtMoney(totalEmision), color: '#3b82f6', bg: '#dbeafe' },
                  { label: 'Total Cobrado', value: fmtMoney(totalCobrado), color: '#10b981', bg: '#d1fae5' },
                  { label: 'Tasa Cobro', value: `${tasaCobro}%`, color: '#6b7280', bg: '#f3f4f6' },
                  { label: 'Documentos Vencidos', value: String(totalVencidos), color: '#ef4444', bg: '#fee2e2' }
                ];

                return kpis.map((kpi, idx) => (
                  <div key={idx} style={{ 
                    background: kpi.bg, 
                    padding: '12px 14px', 
                    borderRadius: '8px',
                    borderLeft: `4px solid ${kpi.color}`
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>
                      {kpi.label.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: kpi.color }}>
                      {kpi.value}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {mostrarGraficaTendencias && tendencias.length > 0 ? (
            <div style={{ display: 'grid', gap: '10px', paddingBottom: '10px' }}>
              {tendencias.map((t: any, i: number) => {
                const widthEmision = Math.max(6, Math.round(((t.emision || 0) / maxEmision) * 100));
                const widthCobrado = Math.max(6, Math.round(((t.cobrado || 0) / maxCobrado) * 100));
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px', gap: '10px', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#334155' }}>{t.mes}</div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      <div style={{ background: '#e2e8f0', height: 8, borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${widthEmision}%`, height: '100%', background: '#3b82f6' }}></div>
                      </div>
                      <div style={{ background: '#e2e8f0', height: 8, borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${widthCobrado}%`, height: '100%', background: '#10b981' }}></div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      <div>{fmtMoney(t.emision || 0)}</div>
                      <div style={{ color: '#16a34a' }}>{fmtMoney(t.cobrado || 0)}</div>
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '12px' }}>
                <span>⬜ Emisión</span>
                <span style={{ color: '#10b981' }}>⬜ Cobrado</span>
              </div>
            </div>
          ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Documentos</th>
                  <th className="num">Emisión</th>
                  <th className="num">Cobrado</th>
                  <th className="num">Tasa Cobro</th>
                  <th className="num">Vencidos</th>
                </tr>
              </thead>
              <tbody>
                {tendencias.length > 0 ? tendencias.map((t, i) => {
                  const tasaCobro = t.documentos > 0 ? Math.round(((t.documentos - (t.vencidos || 0)) / t.documentos) * 100) : 0;
                  return (
                    <tr key={i}>
                      <td><strong>{t.mes}</strong></td>
                      <td className="num">{t.documentos}</td>
                      <td className="num">{fmtMoney(t.emision)}</td>
                      <td className="num">{fmtMoney(t.cobrado)}</td>
                      <td className="num" style={{ color: tasaCobro >= 50 ? '#10b981' : tasaCobro >= 25 ? '#f59e0b' : '#ef4444' }}>
                        <strong>{tasaCobro}%</strong>
                      </td>
                      <td className="num">{t.vencidos}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={6}>Sin datos</td></tr>}
              </tbody>
            </table>
          </div>
          )}
        </div>
        </div>
      );
    }

    if (tab === "cuentas") {
      const abonosFiltrados = abonos.filter(a => {
        if (abonosFechaDesde && (!a.fecha || a.fecha < abonosFechaDesde)) return false;
        if (abonosFechaHasta) {
          const hasta = abonosFechaHasta.length === 10 ? `${abonosFechaHasta}T23:59:59` : abonosFechaHasta;
          if (!a.fecha || a.fecha > hasta) return false;
        }
        return true;
      });
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="card-title">📜 Historial de Abonos Detectados</div>
          <div className="row" style={{ marginBottom: '10px' }}>
            <label className="field">
              <span>Desde</span>
              <input type="date" value={abonosFechaDesde} onChange={e => setAbonosFechaDesde(e.target.value)} />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input type="date" value={abonosFechaHasta} onChange={e => setAbonosFechaHasta(e.target.value)} />
            </label>
            <div className="field" style={{ alignSelf: 'flex-end' }}>
              <button className="btn secondary" onClick={exportarAbonosPDF}>
                📄 Exportar PDF
              </button>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha Detección</th>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th className="num">Saldo Anterior</th>
                  <th className="num">Pago Aplicado</th>
                  <th className="num">Nuevo Saldo</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {abonosFiltrados.length > 0 ? (
                  abonosFiltrados.map(a => (
                    <tr key={a.id}>
                      <td>{a.fecha.split('T')[0]}</td>
                      <td><strong>{a.cliente || a.razon_social || '-'}</strong></td>
                      <td><strong>{a.documento}</strong></td>
                      <td className="num">{fmtMoney(a.total_anterior)}</td>
                      <td className="num kpi-positive">{fmtMoney(a.total_anterior - a.total_nuevo)}</td>
                      <td className="num">{fmtMoney(a.total_nuevo)}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{a.observacion || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
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

          {/* Sección: Importación/Exportación */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#2563eb', marginBottom: 8 }}>Importación y Exportación</h3>
            <button className="btn primary" style={{ marginRight: 8 }} onClick={importarExcel} disabled={!hasWritePermissions}>📥 Importar Excel</button>
            <button className="btn secondary" style={{ marginRight: 8 }} onClick={exportarBackup} disabled={!hasWritePermissions}>📤 Exportar respaldo</button>
            <button className="btn secondary" style={{ marginRight: 8 }}>📄 Descargar plantilla</button>
          </div>

          {/* Sección: Sincronización y Backup */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#2563eb', marginBottom: 8 }}>Sincronización y Backup</h3>
            <button className="btn primary" style={{ marginRight: 8 }}>🔄 Sincronizar</button>
            <button className="btn secondary" style={{ marginRight: 8 }} onClick={exportarBackup} disabled={!hasWritePermissions}>💾 Backup manual</button>
            <button className="btn secondary" style={{ marginRight: 8 }} onClick={() => addToast("Restaurar backup en desarrollo", "info")}>♻️ Restaurar backup</button>
            <div style={{ marginTop: 10, fontSize: '0.9rem', color: '#64748b' }}>
              Las actualizaciones manuales no borran datos. La base se guarda en esta ruta:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 6 }}>{dbPath || "(cargando...)"}</code>
              <button className="btn secondary" onClick={() => dbPath && copyToClipboard(dbPath)} disabled={!dbPath}>📋 Copiar ruta</button>
            </div>
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
                    <input type="number" value={gestionForm.monto_promesa} onChange={e => setGestionForm({...gestionForm, monto_promesa: e.target.value})} placeholder="0" />
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

      {/* Modal Editar Promesa */}
      {showModalEditarPromesa && promesaEditando && (
        <div className="modal-overlay" onClick={() => { setShowModalEditarPromesa(false); setPromesaEditando(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">Editar Promesa de Pago</div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '4px' }}>Cliente</label>
                <div style={{ padding: '8px', background: 'var(--bg-nav)', borderRadius: '4px', fontWeight: '600' }}>
                  {promesaEditando.razon_social || promesaEditando.cliente}
                </div>
              </div>
              
              <label className="field">
                <span>Fecha Promesa</span>
                <input 
                  type="date" 
                  value={promesaEditando.fecha_promesa || ''} 
                  onChange={e => setPromesaEditando({...promesaEditando, fecha_promesa: e.target.value})}
                />
              </label>
              
              <label className="field">
                <span>Monto Prometido</span>
                <input 
                  type="number" 
                  value={promesaEditando.monto_promesa || ''} 
                  onChange={e => setPromesaEditando({...promesaEditando, monto_promesa: Number(e.target.value)})}
                  placeholder="0"
                />
              </label>
              
              <label className="field">
                <span>Monto Pagado</span>
                <input 
                  type="number" 
                  value={promesaEditando.monto_pagado || ''} 
                  onChange={e => setPromesaEditando({...promesaEditando, monto_pagado: Number(e.target.value)})}
                  placeholder="0"
                />
              </label>
              
              <label className="field">
                <span>Fecha Pago</span>
                <input 
                  type="date" 
                  value={promesaEditando.fecha_pago || ''} 
                  onChange={e => setPromesaEditando({...promesaEditando, fecha_pago: e.target.value})}
                />
              </label>
              
              <label className="field">
                <span>Estado</span>
                <select 
                  value={promesaEditando.estado_promesa || 'Pendiente'} 
                  onChange={e => setPromesaEditando({...promesaEditando, estado_promesa: e.target.value})}
                  style={{width: '100%', fontSize: '0.8rem', padding: '5px 6px'}}
                >
                  <option value="Pendiente">⏳ Pendiente</option>
                  <option value="Parcialmente Cumplida">⚠️ Parcialmente Cumplida</option>
                  <option value="Cumplida">✅ Cumplida</option>
                  <option value="Incumplida">❌ Incumplida</option>
                  <option value="Reprogramada">🔄 Reprogramada</option>
                </select>
              </label>
              
              <label className="field">
                <span>Observación</span>
                <textarea 
                  value={promesaEditando.observacion || ''} 
                  onChange={e => setPromesaEditando({...promesaEditando, observacion: e.target.value})} 
                  rows={3} 
                  placeholder="Detalles, cambios o notas..."
                />
              </label>
              
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-nav)', padding: '8px', borderRadius: '4px', marginBottom: '12px' }}>
                <strong>ℹ️ Nota:</strong> Estos cambios son solo para seguimiento. No afectan el saldo del cliente que se modifica únicamente con importaciones.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => { setShowModalEditarPromesa(false); setPromesaEditando(null); }}>Cancelar</button>
              <button className="btn primary" onClick={() => actualizarPromesa(promesaEditando)}>Guardar Cambios</button>
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

      {/* Modal Documentación */}
      {showModalDocumentacion && (
        <div className="modal-overlay" onClick={() => setShowModalDocumentacion(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">📖 Guía Rápida del Sistema</div>
            <div className="modal-body" style={{ lineHeight: 1.6 }}>
              
              <h3 style={{ color: '#2563eb', marginTop: 0 }}>🏠 Dashboard</h3>
              <p>Vista general con KPIs principales: cartera total, vencida, morosidad. Gráficos de aging y top clientes.</p>

              <h3 style={{ color: '#2563eb', marginTop: 16 }}>👥 Gestión de Clientes</h3>
              <ul style={{ marginLeft: 20 }}>
                <li><strong>Ver clientes:</strong> Lista de clientes con saldo vencido y estado de contacto</li>
                <li><strong>Registrar gestión:</strong> Llamadas, emails, WhatsApp, visitas con resultado y promesas</li>
                <li><strong>Seguimiento:</strong> Historial completo por cliente</li>
              </ul>

              <h3 style={{ color: '#2563eb', marginTop: 16 }}>📊 Reportes</h3>
              <ul style={{ marginLeft: 20 }}>
                <li><strong>Documentos:</strong> Tabla completa de facturas con filtros por cliente, vendedor, aging</li>
                <li><strong>Exportar:</strong> Excel/PDF con documentos seleccionados</li>
                <li><strong>Estados de cuenta:</strong> PDF por cliente para enviar</li>
              </ul>

              <h3 style={{ color: '#2563eb', marginTop: 16 }}>📥 Importar desde Contifico</h3>
              <ol style={{ marginLeft: 20 }}>
                <li>Ir a <strong>Configuración &gt; Gestión de Datos</strong></li>
                <li>Clic en <strong>Importar Excel Contifico</strong></li>
                <li>Seleccionar archivo de Cartera por Cobrar</li>
                <li>El sistema detecta automáticamente nuevos documentos y actualiza saldos</li>
              </ol>
              <p style={{ background: '#fef3c7', padding: 10, borderRadius: 6, fontSize: '0.9rem' }}>
                💡 <strong>Tip:</strong> Importa regularmente para mantener la cartera actualizada. Los documentos pagados se cierran automáticamente.
              </p>

              <h3 style={{ color: '#2563eb', marginTop: 16 }}>🚨 Alertas</h3>
              <p>Documentos críticos por días vencidos y monto. Usa filtros para priorizar tu cobranza.</p>

              <h3 style={{ color: '#2563eb', marginTop: 16 }}>📈 Análisis y Tendencias</h3>
              <p>Motivos de impago, productividad de gestores, tendencias históricas mensuales.</p>

              <h3 style={{ color: '#2563eb', marginTop: 16 }}>⚙️ Configuración</h3>
              <ul style={{ marginLeft: 20 }}>
                <li><strong>Empresa:</strong> Datos, logo, RUC, meta mensual</li>
                <li><strong>Temas:</strong> Personalización visual</li>
                <li><strong>Respaldos:</strong> Exporta/importa base de datos</li>
              </ul>

              <div style={{ marginTop: 20, padding: 12, background: '#dbeafe', borderRadius: 8 }}>
                <strong>📞 Soporte:</strong> j-mejiacastro1993@outlook.com | +593-962739443
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={() => setShowModalDocumentacion(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Cambios */}
      {showModalHistorial && (
        <div className="modal-overlay" onClick={() => setShowModalHistorial(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">📝 Historial de Cambios</div>
            <div className="modal-body">
              
              <div style={{ marginBottom: 20, padding: 12, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ color: '#15803d', fontSize: '1.1rem' }}>Versión 1.0.0</strong>
                  <span style={{ fontSize: '0.85rem', color: '#16a34a' }}>Actual</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#166534', marginBottom: 8 }}>Febrero 2026</div>
                <ul style={{ margin: 0, paddingLeft: 20, color: '#15803d' }}>
                  <li>✅ Sistema de gestión de carteras completo</li>
                  <li>✅ Importación automática desde Contifico</li>
                  <li>✅ Dashboard con KPIs en tiempo real</li>
                  <li>✅ Gestión de clientes y seguimiento</li>
                  <li>✅ Reportes exportables (Excel/PDF)</li>
                  <li>✅ Sistema de alertas por aging</li>
                  <li>✅ Análisis de morosidad y tendencias</li>
                  <li>✅ Estados de cuenta automatizados</li>
                  <li>✅ Protección de propiedad intelectual</li>
                  <li>✅ Contador de actualizaciones</li>
                  <li>✅ Logging de instalaciones</li>
                  <li>✅ Copyright y términos integrados</li>
                </ul>
              </div>

              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <strong style={{ color: '#475569' }}>🚀 Próximamente</strong>
                <ul style={{ margin: '8px 0 0 20px', color: '#64748b', fontSize: '0.9rem' }}>
                  <li>Integración con WhatsApp Business API</li>
                  <li>Envío automático de estados de cuenta por email</li>
                  <li>Dashboard móvil</li>
                  <li>Roles y permisos de usuario</li>
                  <li>Firma digital de documentos</li>
                </ul>
              </div>

              <div style={{ marginTop: 20, padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: '0.9rem' }}>
                💡 <strong>Nota:</strong> Las actualizaciones preservan todos tus datos. Solo reinstala el .exe encima.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={() => setShowModalHistorial(false)}>Cerrar</button>
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
              <p><strong>⛔ Se borrarán TODOS los registros:</strong></p>
              <ul>
                <li>✅ Documentos importados</li>
                <li>✅ Gestiones y promesas</li>
                <li>✅ Historial de abonos</li>
                <li>✅ Clientes y vendedores</li>
                <li>✅ Campañas de cobranza</li>
                <li>✅ Disputas y cuentas por aplicar</li>
              </ul>
              <p><strong>✅ Se preservará únicamente:</strong></p>
              <ul>
                <li>Configuración de empresa (nombre, RUC, teléfono, email)</li>
                <li>Porcentaje IVA y meta mensual</li>
              </ul>
              <p style={{color: '#ef4444', fontWeight: 'bold', marginTop: '12px'}}>⚠️ Esta acción NO se puede deshacer</p>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowModalLimpiar(false)}>Cancelar</button>
              <button className="btn danger" onClick={async () => {
                try {
                  // PRIMERO: Limpiar localStorage COMPLETAMENTE
                  console.log("🧹 Limpiando localStorage...");
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                    // Limpiar cada key individualmente como respaldo
                    localStorage.removeItem('cartera_gestiones_locales');
                    localStorage.removeItem('cartera_theme');
                    localStorage.removeItem('electron_data');
                    console.log("✅ localStorage y sessionStorage limpios");
                  } catch (e) {
                    console.error("Error limpiando almacenamiento local:", e);
                  }

                  // SEGUNDO: Limpiar BD
                  console.log("🗑️ Limpiando Base de Datos...");
                  const result = await window.api.limpiarBaseDatos?.();
                  
                  if (result?.ok) {
                    console.log("✅ Base de datos limpia");
                    setShowModalLimpiar(false);
                    addToast("Base de datos y caché local limpiados completamente. Recargando sistema...", "success");
                    
                    // Esperar 1 segundo para que se vea el mensaje
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // TERCERO: Recargar COMPLETAMENTE la página (sin caché)
                    console.log("🔄 Recargando página...");
                    window.location.href = window.location.href; // Force full reload
                  } else {
                    addToast(result?.message || "Error limpiando base", "error");
                  }
                } catch (e) {
                  console.error("Error en limpiarBaseDatos:", e);
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
