import { useState, useEffect, useMemo, useCallback } from "react";
import "./App.css";
import {
  AppHeader,
  AppNavigation,
  ChangeHistoryModal,
  ClearDatabaseModal,
  DocumentationModal,
  ToastContainer,
} from "./components";
import { AlertsPage, DashboardPage, PromisesPage, ReportsPage } from "./pages";
import {
  createPdfContext,
  generateAbonosReport,
  generateAlertasReport,
  generateAnalisisReport,
  generateCarteraReport,
  generateEstadoCuentaReport,
  generateGestionReport,
  generatePromesasReport,
  generateTendenciasReport,
} from "./pdf";

import type { Alerta, Documento } from "./types";
import {
  fmtMoney,
  getDocAmount,
} from "./utils";
import {
  useAlertFilters,
  useDocumentFilters,
  usePromiseFilters,
} from "./hooks";
import {
  buildAnalisisRiesgo,
  calculateAnalisisPorVendedor,
  calculateAnalisisRetenciones,
  calculateDeudoresCronicos,
  calculateEficienciaCobranza,
  calculateVencimientosProximos,
  getClientesConVencidos,
  getDocumentosVencidos,
  getResumenVencidos,
} from "./services";
import {
  checkHttpApiAvailable,
  createHttpApiClient,
  getElectronApi,
} from "./app/api";
import { createDemoData } from "./app/demoData";
import { APP_NAVIGATION_TABS } from "./app/config/navigation";

export default function App() {
  // --- ESTADOS RESTAURADOS ---
  const [tab, setTab] = useState("dashboard");
  const [theme, setTheme] = useState("claro");
  const [pendingTheme, setPendingTheme] = useState("claro");
  const [density, setDensity] = useState<'normal' | 'compact'>(() => (localStorage.getItem('cartera_density') as 'normal' | 'compact') || 'normal');
  const [autoDark, setAutoDark] = useState<boolean>(() => localStorage.getItem('cartera_auto_dark') === '1');
  const [isWeb, setIsWeb] = useState(() => typeof window !== 'undefined' && !getElectronApi());
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
  const [limpiandoBase, setLimpiandoBase] = useState(false);
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

  // Sprint 005: filtros y estado derivado desacoplados de App.tsx
  const docsFiltrados = useDocumentFilters(docs as Documento[], {
    selectedCliente,
    selectedVendedor,
    filtroCentroCosto,
    filtroAging,
    searchDocumentos,
    soloPendientes,
  });

  const filteredAlertas = useAlertFilters(
    alertas as Alerta[],
    searchAlertas,
    filtroSeveridad
  );

  const {
    promesasFiltradas,
    totalPromesas,
    montoTotal,
    vencidas,
    calcularDiasDiferencia,
  } = usePromiseFilters(promesas, filtroFecha, filtroMonto);

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

  // Aplicar densidad (compacta/normal)
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    try {
      localStorage.setItem('cartera_density', density);
    } catch (e) {
      console.error('Error guardando densidad en localStorage:', e);
    }
  }, [density]);

  // Tema automático: oscurecer por preferencia del sistema u horario si está activado
  useEffect(() => {
    if (!autoDark) return;
    const applyAutoTheme = () => {
      try {
        const hour = new Date().getHours();
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldDark = prefersDark || hour >= 19 || hour < 7;
        setTheme(shouldDark ? 'oscuro' : (pendingTheme || 'claro'));
      } catch {
        // El tema automático es opcional; se conserva el tema vigente.
      }
    };
    applyAutoTheme();
    const timer = setInterval(applyAutoTheme, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [autoDark, pendingTheme]);

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

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  };

  const checkPermissions = async () => {
    const api = getElectronApi();
    if (api?.hasWritePermissions) {
      try {
        const canWrite = await api.hasWritePermissions();
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
    const api = getElectronApi();
    if (isWeb || !api?.gestionGuardar) return;
    try {
      const targetCliente = (g?.cliente || selectedCliente || '').trim();
      const payload = { cliente: targetCliente, ...g };
      await api.gestionGuardar(payload);
      // No recargar - confiar solo en estado local
    } catch (e) {
      console.error("Error registrando gestión automática:", e);
    }
  };


  // Variables derivadas restauradas
  const clientesConVencidos = useMemo(
    () => getClientesConVencidos(docs as Documento[]),
    [docs]
  );
  const todosDocsVencidos = useMemo(
    () => getDocumentosVencidos(docs as Documento[]),
    [docs]
  );
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
    const api = getElectronApi();
    if (!api) {
      // Intentar conectar a la API HTTP
      checkHttpApiAvailable().then(available => {
        if (!available) {
          const demo = createDemoData();
          setIsWeb(true);
          setHasWritePermissions(false);
          setEmpresa({ nombre: 'Mi Empresa' });
          setDocs(demo.docs);
          setClientes(demo.clientes as any[]);
          setVendedores(demo.vendedores);
          setTopClientes(demo.topClientes as any[]);
          setAllGestiones(demo.gestiones as any[]);
          setAlertas(demo.alertas as any[]);
          setTendencias(demo.tendencias as any[]);
          setAbonos(demo.abonos as any[]);
          setPromesas(demo.gestiones.filter((g: any) => g.resultado?.includes('Promesa')) as any[]);
          setStats(demo.stats);
          setAnalisisRiesgo(demo.analisisRiesgo as any[]);
        } else {
          cargarDatos();
        }
      });
      return;
    }
    // Verificar permisos y cargar datos al montar
    checkPermissions();
    console.log('[DEBUG] Llamando cargarDatos() al montar App');
    cargarDatos();

    if (api?.getUpdateInfo) {
      api.getUpdateInfo()
        .then((info: any) => setUpdateInfo(info))
        .catch(() => setUpdateInfo(null));
    }
    
    // Log para depuración de gestiones después de 3 segundos
    setTimeout(() => {
      console.log('[DEBUG] allGestiones:', allGestiones);
    }, 3000);

    // Verificar IP cada 30 segundos (desde API Electron, no desde servidor HTTP)
    const ipCheckInterval = setInterval(async () => {
      const api = getElectronApi();
      if (!api?.getGitRemoteUrl) return;
      try {
        const result = await api.getGitRemoteUrl();
        if (result.ok && result.url && result.url !== repoUrl) {
          console.log(`📡 IP local actualizada: ${repoUrl} -> ${result.url}`);
          setRepoUrl(result.url);
        }
      } catch (error) {
        console.error("Error verificando IP:", error);
      }
    }, 30000);

    // Cargar URL remota (ngrok) al iniciar desde API Electron
    if (!isWeb && api?.getRemoteUrl) {
      (async () => {
        try {
          const result = await api.getRemoteUrl();
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
    const api = getElectronApi();
    const httpApi = createHttpApiClient();
    const httpAvailable = api ? true : await checkHttpApiAvailable();

    if (!api && !httpAvailable) {
      const demo = createDemoData();
      setIsWeb(true);
      setHasWritePermissions(false);
      setEmpresa({ nombre: 'Mi Empresa' });
      setDocs(demo.docs);
      setClientes(demo.clientes as any[]);
      setVendedores(demo.vendedores);
      setTopClientes(demo.topClientes as any[]);
      setAllGestiones(demo.gestiones as any[]);
      setAlertas(demo.alertas as any[]);
      setTendencias(demo.tendencias as any[]);
      setAbonos(demo.abonos as any[]);
      setPromesas(demo.gestiones.filter((g: any) => g.resultado?.includes('Promesa')) as any[]);
      setStats(demo.stats);
      setAnalisisRiesgo(demo.analisisRiesgo as any[]);
      return;
    }

    // const apiToUse = api || httpApi;

    try {
      const [empData, statsData, filtros, top, gestionesData, alertasData, tendData, cuentasData, abonosData] = await Promise.all([
        api ? api.empresaObtener() : httpApi.empresaObtener(),
        api ? api.statsObtener() : httpApi.statsObtener(),
        api ? api.filtrosListar() : httpApi.filtrosListar(),
        api ? api.topClientes() : httpApi.topClientes(),
        api ? api.gestionesListar("") : httpApi.gestionesListar(""),
        api ? api.alertasIncumplimiento() : httpApi.alertasIncumplimiento(),
        api ? api.tendenciasHistoricas() : httpApi.tendenciasHistoricas(),
        api ? api.cuentasAplicarListar() : httpApi.cuentasAplicarListar(),
        api ? api.abonosListar() : httpApi.abonosListar()
      ]);

      setIsWeb(!api);
      
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
        if (filtros.clientes) setClientes(filtros.clientes);
        if (filtros.vendedores) setVendedores(filtros.vendedores);
      }
      if (gestionesData) {
          let gestionesLocales: any[] = [];
          try {
            const stored = localStorage.getItem('cartera_gestiones_locales');
            if (stored) gestionesLocales = JSON.parse(stored);
          } catch (e) {
            console.error("Error cargando localStorage:", e);
          }
          
          const gestionesBackend = Array.isArray(gestionesData) ? gestionesData : [];
          
          const deduplicateGestiones = (backend: any[], local: any[]) => {
            const deduped = [...backend];
            const localNoSincronizadas: any[] = [];
            
            for (const localGestion of local) {
              const found = backend.some((bg) => {
                const sameClient = bg.cliente === localGestion.cliente;
                const sameType = bg.tipo === localGestion.tipo;
                const sameObs = bg.observacion === localGestion.observacion;
                
                let sameDateish = false;
                try {
                  if (localGestion.fecha && bg.fecha) {
                    const localTime = new Date(localGestion.fecha).getTime();
                    const bgTime = new Date(bg.fecha).getTime();
                    if (!isNaN(localTime) && !isNaN(bgTime)) {
                      sameDateish = Math.abs(localTime - bgTime) < 10000;
                    }
                  }
                } catch (e) {
                  sameDateish = false;
                }
                
                return sameClient && sameType && sameObs && sameDateish;
              });
              
              if (!found) {
                deduped.push(localGestion);
                localNoSincronizadas.push(localGestion);
              }
            }
            
            try {
              localStorage.setItem('cartera_gestiones_locales', JSON.stringify(localNoSincronizadas));
            } catch (e) {
              console.error("Error actualizando localStorage:", e);
            }
            
            return deduped.sort((a: any, b: any) => {
              const dateA = new Date(a.fecha).getTime();
              const dateB = new Date(b.fecha).getTime();
              return dateB - dateA;
            });
          };
          
          const gestionesMerged = deduplicateGestiones(gestionesBackend, gestionesLocales);
          setAllGestiones(gestionesMerged);
          const promesasPendientes = gestionesMerged.filter((g: any) => 
            g.resultado?.includes('Promesa') && !g.resultado?.includes('Cumplida') && g.fecha_promesa
          );
          setPromesas(promesasPendientes);
      }
      if (alertasData) setAlertas(alertasData as any[]);
      if (tendData) setTendencias(tendData as any[]);
      if (cuentasData) setCuentasAplicar(cuentasData);
      if (abonosData) setAbonos(abonosData);

      // Cargar documentos
      const docsPromise = api ? api.documentosListar({}) : httpApi.documentosListar({});
      const docsResult = await docsPromise;
      if (docsResult?.rows) {
        const rows = docsResult.rows as Documento[];
        setDocs(rows);
        setAnalisisRiesgo(buildAnalisisRiesgo(rows));
      }

      if ((api || httpAvailable) && (api?.getGitRemoteUrl)) {
        try {
          const remoteUrl = await api!.getGitRemoteUrl();
          if (remoteUrl?.url) setRepoUrl(remoteUrl.url);
        } catch (e) {
          console.log("No se pudo obtener URL remoto:", e);
        }
      }

      if (!isWeb && (api?.getDbPath)) {
        try {
          const path = await api!.getDbPath();
          if (path) setDbPath(path);
        } catch (e) {
          console.log("No se pudo obtener ruta de BD:", e);
        }
      }

      try {
        if ((api || httpAvailable) && (api?.motivosImpago)) {
          const motivosResult = await api!.motivosImpago();
          if (motivosResult) setMotivosData(motivosResult as any[]);
        }
      } catch (e) {
        console.log("Error cargando Motivos de Impago:", e);
      }

      try {
        if ((api || httpAvailable) && (api?.productividadGestor)) {
          const productividadResult = await api!.productividadGestor();
          if (productividadResult) setProductividadData(productividadResult as any[]);
        }
      } catch (e) {
        console.log("Error cargando Productividad:", e);
      }

    } catch (e) {
      console.error("Error cargando datos:", e);
    }
  }

  // Datos derivados para Gestión (Memoizados para rendimiento)

  // Paginación para Reportes
  // Eliminado: paginatedDocumentos y paginación no se usan

  const resumenVencidos = useMemo(
    () => getResumenVencidos(todosDocsVencidos as Documento[]),
    [todosDocsVencidos]
  );

  // Cálculos de negocio centralizados en services
  const eficienciaCobranza = useMemo(
    () => calculateEficienciaCobranza(docs as Documento[]),
    [docs]
  );

  const vencimientosProximos = useMemo(
    () => calculateVencimientosProximos(docs as Documento[]),
    [docs]
  );

  const analisisRetenciones = useMemo(
    () => calculateAnalisisRetenciones(docs as Documento[]),
    [docs]
  );

  const analisisPorVendedor = useMemo(
    () => calculateAnalisisPorVendedor(docs as Documento[]),
    [docs]
  );

  const deudoresCronicos = useMemo(
    () => calculateDeudoresCronicos(docs as Documento[]),
    [docs]
  );

  // 6. Extraer centros de costo únicos
  useEffect(() => {
    const centros = Array.from(new Set((docs || []).map(d => d?.centro_costo).filter(Boolean))).sort();
    setCentrosCosto(centros as string[]);
  }, [docs]);

  const cargarDocumentos = useCallback(async () => {
    const api = getElectronApi();
    if (isWeb || !api?.documentosListar) return;
    try {
      const result = await api.documentosListar({
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



  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  async function guardarGestion() {
    const api = getElectronApi();
    if (isWeb || !selectedCliente || !api?.gestionGuardar) return;
    try {
      // Convertir monto_promesa a número si es una promesa de pago
      const gestionParaGuardar = {
        ...gestionForm,
        ...(gestionForm.resultado === "Promesa de Pago" && { monto_promesa: gestionForm.monto_promesa ? Number(gestionForm.monto_promesa) : 0 })
      };
      
      // Guardar en backend
      const result = await api.gestionGuardar({
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
    const api = getElectronApi();
    if (isWeb || !api?.gestionEliminar) return;
    try {
      await api.gestionEliminar(id);
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
    const api = getElectronApi();
    if (isWeb || !api?.gestionCumplir) return;
    try {
      await api.gestionCumplir(id);
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
    const api = getElectronApi();
    if (isWeb || !api?.empresaGuardar) return;
    try {
      await api.empresaGuardar(empresa);
      setShowModalEmpresa(false);
      addToast("Datos de empresa guardados", "success");
      await cargarDatos();
    } catch (e) {
      addToast("Error guardando empresa", "error");
      console.error("Error guardando empresa:", e);
    }
  }

  const [descuadresDetectados, setDescuadresDetectados] = useState<number>(0);

  async function importarExcel() {
  const api = getElectronApi();
  if (isWeb || !api?.importarContifico) return;
  try {
    const result = await api.importarContifico();
    const resultTyped = result as { 
      ok?: boolean; 
      insertedDocs?: number; 
      descuadresDetectados?: number; 
      message?: string 
    };

    if (resultTyped?.ok) {
      const descuadres = resultTyped.descuadresDetectados || 0;
      setDescuadresDetectados(descuadres);

      if (descuadres > 0) {
        addToast(`⚠️ Importado: ${resultTyped.insertedDocs} docs (${descuadres} con descuadres en tramos)`, "warning");
      } else {
        addToast(`✅ Importación exitosa: ${resultTyped.insertedDocs} documentos perfectamente cuadrados`, "success");
      }

      await cargarDatos();
      await cargarDocumentos();
    } else {
      const errorMsg = resultTyped?.message || "Error desconocido";
      addToast("Error en importación: " + errorMsg, "error");
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    addToast("Error importando Excel: " + errorMsg, "error");
  }
}

  const exportarAbonosPDF = async (): Promise<void> => {
    let abonosFiltrados = abonos;

    if (abonosFechaDesde) {
      abonosFiltrados = abonosFiltrados.filter(
        (abono) => abono.fecha && abono.fecha >= abonosFechaDesde
      );
    }

    if (abonosFechaHasta) {
      const hasta =
        abonosFechaHasta.length === 10
          ? `${abonosFechaHasta}T23:59:59`
          : abonosFechaHasta;

      abonosFiltrados = abonosFiltrados.filter(
        (abono) => abono.fecha && abono.fecha <= hasta
      );
    }

    if (abonosFiltrados.length === 0) {
      addToast(
        "No hay abonos para reportar en el rango seleccionado",
        "info"
      );
      return;
    }

    try {
      await generateAbonosReport({
        abonos: abonosFiltrados,
        context: createPdfContext(empresa),
      });

      addToast("✅ Reporte de abonos generado", "success");
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      addToast(`Error generando reporte de abonos: ${message}`, "error");
    }
  };

  const canExportAnalisis = useMemo(() => {
    if (vistaAnalisis === 'motivos') return motivosData.length > 0;
    if (vistaAnalisis === 'productividad') return productividadData.length > 0;
    if (vistaAnalisis === 'riesgo') return analisisRiesgo.length > 0;
    return deudoresCronicos.length > 0;
  }, [
    vistaAnalisis,
    motivosData,
    productividadData,
    analisisRiesgo,
    deudoresCronicos,
  ]);

  const exportarAnalisisPDF = async (): Promise<void> => {
    try {
      await generateAnalisisReport({
        vista: vistaAnalisis,
        motivos: motivosData,
        productividad: productividadData,
        riesgos: analisisRiesgo,
        deudoresCronicos,
        context: createPdfContext(empresa),
      });

      addToast('✅ Reporte de análisis generado', 'success');
    } catch (error: unknown) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : 'Error desconocido al generar el reporte';

      addToast(
        `Error generando reporte de análisis: ${message}`,
        'error'
      );
    }
  };


  async function exportarBackup() {
    const api = getElectronApi();
    if (isWeb || !api?.exportarBackup) {
      addToast("Esta función solo está disponible en la versión de escritorio", "info");
      return;
    }
    try {
      const result = await api.exportarBackup();
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
    const api = getElectronApi();
    if (isWeb || !api?.cambiarLogo) {
      addToast("Solo disponible en la versión de escritorio", "info");
      return;
    }
    try {
      const result = await api.cambiarLogo();
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
        <DashboardPage
          isMobile={isMobile}
          descuadresDetectados={descuadresDetectados}
          stats={stats}
          agingData={agingData}
          topClientesData={topClientesData}
          eficienciaCobranza={eficienciaCobranza}
          vencimientosProximos={vencimientosProximos}
          analisisRetenciones={analisisRetenciones}
          analisisPorVendedor={analisisPorVendedor}
          deudoresCronicos={deudoresCronicos}
          onOpenReports={() => setTab("reportes")}
        />
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
      const exportarEstadoDeCuenta = async (
        clienteNombre: string
      ): Promise<void> => {
        if (!clienteNombre || clienteNombre === "Todos") {
          addToast(
            "Selecciona un cliente específico para generar su estado de cuenta",
            "info"
          );
          return;
        }

        const docsCliente = docs
          .filter(
            (documento) =>
              (documento.razon_social === clienteNombre ||
                documento.cliente === clienteNombre) &&
              getDocAmount(documento) > 0.01
          )
          .sort(
            (a, b) =>
              (b.dias_vencidos || 0) - (a.dias_vencidos || 0)
          );

        if (docsCliente.length === 0) {
          addToast("Este cliente no tiene documentos pendientes", "info");
          return;
        }

        try {
          await generateEstadoCuentaReport({
            clienteNombre,
            documentos: docsCliente,
            context: createPdfContext(empresa),
          });

          addToast("Estado de cuenta generado", "success");

          registrarGestion({
            id: `pdf_${Date.now()}`,
            cliente: clienteNombre,
            tipo: "PDF",
            resultado: "Generado",
            observacion: "Estado de cuenta generado en PDF",
            fecha: new Date().toISOString(),
          });
        } catch (error: unknown) {
          console.error(error);
          const message =
            error instanceof Error ? error.message : "Error desconocido";
          addToast(`Error generando estado de cuenta: ${message}`, "error");
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

      // Función para generar Reporte de Gestión (Evidencia)
      const exportarReporteGestion = async (): Promise<void> => {
        let gestionesFiltradas = filteredGestiones;

        if (filtroFechaDesde) {
          gestionesFiltradas = gestionesFiltradas.filter(
            (gestion) => gestion.fecha && gestion.fecha >= filtroFechaDesde
          );
        }

        if (filtroFechaHasta) {
          const hasta =
            filtroFechaHasta.length === 10
              ? `${filtroFechaHasta}T23:59:59`
              : filtroFechaHasta;

          gestionesFiltradas = gestionesFiltradas.filter(
            (gestion) => gestion.fecha && gestion.fecha <= hasta
          );
        }

        if (gestionesFiltradas.length === 0) {
          addToast(
            "No hay gestiones para reportar en el rango seleccionado",
            "info"
          );
          return;
        }

        try {
          const alcance =
            selectedCliente === "Todos" || !selectedCliente
              ? "General (Todos los clientes)"
              : selectedCliente;

          await generateGestionReport({
            gestiones: gestionesFiltradas,
            alcance,
            context: createPdfContext(empresa),
          });

          addToast("✅ Reporte de gestión generado", "success");
        } catch (error: unknown) {
          console.error(error);
          const message =
            error instanceof Error ? error.message : "Error desconocido";
          addToast(`Error generando reporte: ${message}`, "error");
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
                    { id: 'corporativo', name: 'Azul Pro', class: 'theme-preview-corporativo' },
                    { id: 'pastel', name: 'Suave', class: 'theme-preview-pastel' },
                    { id: 'oscuro', name: 'Noche', class: 'theme-preview-oscuro' },
                    { id: 'oscuro-pro', name: 'Oscuro Pro', class: 'theme-preview-oscuro-pro' },
                    { id: 'contraste', name: 'Alto Contraste', class: 'theme-preview-contraste' },
                    { id: 'nature', name: 'Nature', class: 'theme-preview-nature' }
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`theme-btn ${t.class} ${pendingTheme === t.id ? 'active' : ''}`}
                      data-name={t.name}
                      onClick={() => setPendingTheme(t.id as any)}
                      title={`Seleccionar tema ${t.name}`}
                    >
                      {pendingTheme === t.id && <span className="theme-check">✅</span>}
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                    <label className="field field-wrapper" style={{ width: 'auto', marginBottom: 0 }}>
                      <input type="checkbox" checked={density === 'compact'} onChange={e => setDensity(e.target.checked ? 'compact' : 'normal')} />
                      <span>Modo compacto</span>
                    </label>
                    <label className="field field-wrapper" style={{ width: 'auto', marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={autoDark}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setAutoDark(enabled);

                          try {
                            localStorage.setItem(
                              'cartera_auto_dark',
                              enabled ? '1' : '0'
                            );
                          } catch {
                            // localStorage puede estar restringido por el entorno.
                          }
                        }}
                      />
                      <span>Auto Oscuro (según horario/SO)</span>
                    </label>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                  <button 
                    className="btn primary" 
                    style={{ padding: '8px 24px', fontSize: '0.9rem', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    onClick={async () => {
                      setTheme(pendingTheme);
                      if (!isWeb) {
                        const api = getElectronApi();
                        try {
                          if (api?.empresaGuardar) {
                            await api.empresaGuardar({ ...empresa, tema: pendingTheme });
                            addToast("Tema guardado y aplicado", "success");
                          } else {
                            addToast("Tema aplicado (local)", "success");
                          }
                        } catch (e) {
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
      const exportarReporteCarteraPdf = async (): Promise<void> => {
        if (docsFiltrados.length === 0) {
          addToast('No hay documentos para generar el reporte PDF', 'info');
          return;
        }

        try {
          await generateCarteraReport({
            documentos: docsFiltrados,
            filtros: {
              cliente: selectedCliente,
              vendedor: selectedVendedor,
            },
            context: createPdfContext(empresa),
          });

          addToast('✅ Reporte PDF generado correctamente', 'success');
        } catch (error: unknown) {
          console.error('Error generando reporte PDF:', error);
          const mensaje =
            error instanceof Error ? error.message : 'Error desconocido';
          addToast(`❌ Error al generar PDF: ${mensaje}`, 'error');
        }
      };

      return (
        <ReportsPage
          isMobile={isMobile}
          documentos={docsFiltrados}
          clientes={clientes}
          vendedores={vendedores}
          centrosCosto={centrosCosto}
          selectedCliente={selectedCliente}
          setSelectedCliente={setSelectedCliente}
          selectedVendedor={selectedVendedor}
          setSelectedVendedor={setSelectedVendedor}
          filtroCentroCosto={filtroCentroCosto}
          setFiltroCentroCosto={setFiltroCentroCosto}
          filtroAging={filtroAging}
          setFiltroAging={setFiltroAging}
          searchDocumentos={searchDocumentos}
          setSearchDocumentos={setSearchDocumentos}
          vistaAgrupada={vistaAgrupada}
          setVistaAgrupada={setVistaAgrupada}
          soloPendientes={soloPendientes}
          setSoloPendientes={setSoloPendientes}
          analisisPorVendedor={analisisPorVendedor}
          analisisRetenciones={analisisRetenciones}
          onExportPdf={exportarReporteCarteraPdf}
          onNotify={addToast}
        />
      );
    }

    if (tab === "crm") {
      const exportarReportePromesas = async (): Promise<void> => {
        if (promesasFiltradas.length === 0) {
          addToast("No hay promesas para reportar con los filtros seleccionados", "info");
          return;
        }

        try {
          await generatePromesasReport({
            promesas,
            promesasFiltradas,
            context: createPdfContext(empresa),
          });

          addToast("✅ Reporte de promesas generado", "success");
        } catch (error: unknown) {
          console.error("Error generando reporte de promesas:", error);
          const message = error instanceof Error ? error.message : "Error desconocido";
          addToast(`❌ Error generando reporte: ${message}`, "error");
        }
      };

      return (
        <PromisesPage
          promesasFiltradas={promesasFiltradas}
          totalPromesas={totalPromesas}
          montoTotal={montoTotal}
          vencidas={vencidas}
          tasaCumplimiento={stats?.tasaCumplimientoPromesas || 0}
          filtroFecha={filtroFecha}
          setFiltroFecha={setFiltroFecha}
          filtroMonto={filtroMonto}
          setFiltroMonto={setFiltroMonto}
          calcularDiasDiferencia={calcularDiasDiferencia}
          hasWritePermissions={hasWritePermissions}
          isMobile={isMobile}
          onExportPdf={exportarReportePromesas}
          onCumplirPromesa={cumplirPromesa}
          onEditarPromesa={(promesa) => {
            setPromesaEditando(promesa);
            setShowModalEditarPromesa(true);
          }}
          onEliminarPromesa={eliminarGestion}
        />
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
      const exportarAlertas = async (): Promise<void> => {
        if (filteredAlertas.length === 0) {
          addToast("No hay alertas para exportar", "info");
          return;
        }

        try {
          await generateAlertasReport({
            alertas: filteredAlertas,
            context: createPdfContext(empresa),
          });

          addToast("PDF exportado exitosamente", "success");
        } catch (error: unknown) {
          console.error(error);
          const message =
            error instanceof Error ? error.message : "Error desconocido";
          addToast(`Error al exportar PDF: ${message}`, "error");
        }
      };

      return (
        <AlertsPage
          alertas={filteredAlertas}
          searchAlertas={searchAlertas}
          setSearchAlertas={setSearchAlertas}
          filtroSeveridad={filtroSeveridad}
          setFiltroSeveridad={setFiltroSeveridad}
          onExportPdf={exportarAlertas}
        />
      );
    }

    if (tab === "tendencias") {
      const maxEmision = Math.max(1, ...tendencias.map((t: any) => t.emision || 0));
      const maxCobrado = Math.max(1, ...tendencias.map((t: any) => t.cobrado || 0));
      
      const exportarReporteTendencias = async (): Promise<void> => {
        if (tendencias.length === 0) {
          addToast("No hay datos de tendencias para exportar", "info");
          return;
        }

        try {
          await generateTendenciasReport({
            tendencias,
            context: createPdfContext(empresa),
          });

          addToast("✅ Reporte de tendencias generado", "success");
        } catch (error: unknown) {
          console.error(error);
          const message =
            error instanceof Error ? error.message : "Error desconocido";
          addToast(`Error generando reporte de tendencias: ${message}`, "error");
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

  const limpiarBaseDatos = async (): Promise<void> => {
    if (limpiandoBase) return;

    setLimpiandoBase(true);

    try {
      console.log("🧹 Limpiando almacenamiento local...");

      try {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.removeItem("cartera_gestiones_locales");
        localStorage.removeItem("cartera_theme");
        localStorage.removeItem("electron_data");
        console.log("✅ Almacenamiento local limpio");
      } catch (storageError) {
        console.error("Error limpiando almacenamiento local:", storageError);
      }

      console.log("🗑️ Limpiando base de datos...");
      const api = getElectronApi();
      const result = await api?.limpiarBaseDatos?.();

      if (!result?.ok) {
        addToast(result?.message || "Error limpiando base", "error");
        return;
      }

      setShowModalLimpiar(false);
      addToast(
        "Base de datos y caché local limpiados completamente. Recargando sistema...",
        "success"
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
      window.location.reload();
    } catch (error: unknown) {
      console.error("Error limpiando base de datos:", error);
      addToast("Error limpiando base de datos", "error");
    } finally {
      setLimpiandoBase(false);
    }
  };

  return (
    <div className="app">
      <AppHeader
        empresa={empresa}
        isWeb={isWeb}
        remoteUrl={remoteUrl}
        remoteUrlHealthy={remoteUrlHealthy}
        repoUrl={repoUrl}
        localUrlHealthy={localUrlHealthy}
        onCopyUrl={copyToClipboard}
        onRefresh={() => window.location.reload()}
      />

      <AppNavigation
        tabs={APP_NAVIGATION_TABS}
        activeTab={tab}
        onChange={setTab}
      />

      <main className="content" style={{ overflowX: 'hidden', overflowY: tab === 'dashboard' ? 'hidden' : 'auto' }}>
        {renderContent()}
      </main>

      <ToastContainer toasts={toasts} />

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
                <span>Usuario responsable de reportes</span>
                <input value={empresa.administrador || ""} onChange={e => setEmpresa({...empresa, administrador: e.target.value})} placeholder="Ej: Lic. Alba Mayorga L." />
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

      <DocumentationModal
        open={showModalDocumentacion}
        onClose={() => setShowModalDocumentacion(false)}
      />

      <ChangeHistoryModal
        open={showModalHistorial}
        onClose={() => setShowModalHistorial(false)}
      />

      <ClearDatabaseModal
        open={showModalLimpiar}
        loading={limpiandoBase}
        onClose={() => setShowModalLimpiar(false)}
        onConfirm={limpiarBaseDatos}
      />
    </div>
  );
}
