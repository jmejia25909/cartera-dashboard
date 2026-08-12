import { ImportCenterPanel } from "./config/ImportCenterPanel";
import "./config/import-center.css";

export type DensityMode = 'normal' | 'compact';

export interface UpdateInfo {
  updateCount: number;
  currentVersion?: string;
  lastVersion?: string;
  updatedAt?: string;
  firstRunAt?: string;
}

export interface ConfigPageProps {
  pendingTheme: string;
  onPendingThemeChange: (theme: string) => void;
  density: DensityMode;
  onDensityChange: (density: DensityMode) => void;
  autoDark: boolean;
  onAutoDarkChange: (enabled: boolean) => void;
  onApplyTheme: () => Promise<void>;
  hasWritePermissions: boolean;
  onEditCompany: () => void;
  onChangeLogo: () => void;
  onImportExcel: () => void;
  onOpenCancelledImport: () => void;
  onExportBackup: () => void;
  onClearDatabase: () => void;
  onOpenDocumentation: () => void;
  onOpenHistory: () => void;
  updateInfo: UpdateInfo | null;
  formatUpdateDate: (value?: string) => string;
  dbPath: string;
  onCopyDbPath: (value: string) => void;
}

const THEME_OPTIONS = [
  { id: 'claro', name: 'Clásico', className: 'theme-preview-claro' },
  { id: 'azul', name: 'Corporativo', className: 'theme-preview-azul' },
  { id: 'corporativo', name: 'Azul Pro', className: 'theme-preview-corporativo' },
  { id: 'pastel', name: 'Suave', className: 'theme-preview-pastel' },
  { id: 'oscuro', name: 'Noche', className: 'theme-preview-oscuro' },
  { id: 'oscuro-pro', name: 'Oscuro Pro', className: 'theme-preview-oscuro-pro' },
  { id: 'contraste', name: 'Alto Contraste', className: 'theme-preview-contraste' },
  { id: 'nature', name: 'Nature', className: 'theme-preview-nature' },
] as const;

export function ConfigPage({
  pendingTheme,
  onPendingThemeChange,
  density,
  onDensityChange,
  autoDark,
  onAutoDarkChange,
  onApplyTheme,
  hasWritePermissions,
  onEditCompany,
  onChangeLogo,
  onImportExcel,
  onOpenCancelledImport,
  onExportBackup,
  onClearDatabase,
  onOpenDocumentation,
  onOpenHistory,
  updateInfo,
  formatUpdateDate,
  dbPath,
  onCopyDbPath,
}: ConfigPageProps) {
  const handleAutoDarkChange = (enabled: boolean): void => {
    onAutoDarkChange(enabled);

    try {
      localStorage.setItem('cartera_auto_dark', enabled ? '1' : '0');
    } catch {
      // localStorage puede estar restringido por el entorno.
    }
  };

  return (
    <div>
      <div className="config-container">
        <h2
          style={{
            marginBottom: 6,
            fontWeight: 800,
            color: 'var(--text-main)',
            fontSize: '1.4rem',
          }}
        >
          Configuración
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            marginBottom: 14,
            fontSize: '0.85rem',
          }}
        >
          Administra las preferencias generales y el sistema
        </p>

        <div className="config-grid">
          <div
            className="config-card"
            style={{
              background:
                'linear-gradient(to right, var(--bg-surface), var(--bg-main))',
            }}
          >
            <div className="config-header">
              <div className="config-icon-box">🎨</div>
              <div className="config-title">
                <h3>Personalización Visual</h3>
                <p>Elige el tema que mejor se adapte a tu estilo</p>
              </div>
            </div>

            <div className="theme-section">
              <div className="theme-options">
                {THEME_OPTIONS.map((theme) => (
                  <div
                    key={theme.id}
                    className={`theme-btn ${theme.className} ${
                      pendingTheme === theme.id ? 'active' : ''
                    }`}
                    data-name={theme.name}
                    onClick={() => onPendingThemeChange(theme.id)}
                    title={`Seleccionar tema ${theme.name}`}
                  >
                    {pendingTheme === theme.id && (
                      <span className="theme-check">✅</span>
                    )}
                  </div>
                ))}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                    marginTop: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <label
                    className="field field-wrapper"
                    style={{ width: 'auto', marginBottom: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={density === 'compact'}
                      onChange={(event) =>
                        onDensityChange(
                          event.target.checked ? 'compact' : 'normal'
                        )
                      }
                    />
                    <span>Modo compacto</span>
                  </label>
                  <label
                    className="field field-wrapper"
                    style={{ width: 'auto', marginBottom: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={autoDark}
                      onChange={(event) =>
                        handleAutoDarkChange(event.target.checked)
                      }
                    />
                    <span>Auto Oscuro (según horario/SO)</span>
                  </label>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: '16px',
                }}
              >
                <button
                  type="button"
                  className="btn primary"
                  style={{
                    padding: '8px 24px',
                    fontSize: '0.9rem',
                    borderRadius: '10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                  onClick={() => void onApplyTheme()}
                >
                  💾 Guardar y Aplicar Tema
                </button>
              </div>
            </div>
          </div>

          <div className="config-card">
            <div className="config-header">
              <div className="config-icon-box">🏢</div>
              <div className="config-title">
                <h3>Empresa</h3>
                <p>Información legal y marca</p>
              </div>
            </div>
            <div className="config-actions">
              <button
                type="button"
                className="config-btn"
                onClick={onEditCompany}
                disabled={!hasWritePermissions}
              >
                <span>
                  <span className="config-btn-icon">⚙️</span> Editar datos
                  generales
                </span>
                <span className="config-btn-arrow">→</span>
              </button>
              <button
                type="button"
                className="config-btn"
                onClick={onChangeLogo}
                disabled={!hasWritePermissions}
              >
                <span>
                  <span className="config-btn-icon">🖼️</span> Cambiar logotipo
                </span>
                <span className="config-btn-arrow">→</span>
              </button>
            </div>
          </div>

          <ImportCenterPanel
            hasWritePermissions={hasWritePermissions}
            onImportPortfolio={onImportExcel}
            onOpenCancelledImport={onOpenCancelledImport}
            onExportBackup={onExportBackup}
            onClearDatabase={onClearDatabase}
          />

          <div className="config-card">
            <div className="config-header">
              <div className="config-icon-box">🔧</div>
              <div className="config-title">
                <h3>Sistema</h3>
                <p>Mantenimiento y ayuda</p>
              </div>
            </div>
            <div className="config-actions">
              <button
                type="button"
                className="config-btn"
                onClick={onOpenDocumentation}
              >
                <span>
                  <span className="config-btn-icon">📖</span> Documentación
                </span>
                <span className="config-btn-arrow">→</span>
              </button>
              <button
                type="button"
                className="config-btn"
                onClick={onOpenHistory}
              >
                <span>
                  <span className="config-btn-icon">📝</span> Historial de
                  cambios
                </span>
                <span className="config-btn-arrow">→</span>
              </button>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: 'var(--bg-main)',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 5 }}>
                Base de datos activa
              </div>
              <div style={{ wordBreak: 'break-all', marginBottom: 8 }}>
                {dbPath || 'Ruta no disponible'}
              </div>
              <button
                type="button"
                className="config-btn"
                disabled={!dbPath}
                onClick={() => dbPath && onCopyDbPath(dbPath)}
              >
                Copiar ruta de la base
              </button>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: '#f0f9ff',
                borderRadius: 8,
                border: '1px solid #bfdbfe',
                fontSize: '0.7rem',
                color: '#1e40af',
                lineHeight: '1.3',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 6,
                  fontSize: '0.75rem',
                }}
              >
                📋 Información Legal
              </div>
              <div style={{ marginBottom: 3 }}>
                © 2026 Jhon Franklin Mejia Castro
              </div>
              <div style={{ marginBottom: 3 }}>RUC: 0950998104001</div>
              <div
                style={{
                  fontSize: '0.65rem',
                  marginTop: 4,
                  fontStyle: 'italic',
                  color: '#3730a3',
                }}
              >
                Prohibida reproducción no autorizada.
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                padding: '8px 10px',
                background: 'var(--bg-main)',
                borderRadius: 8,
                border: '1px dashed var(--border)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span>Versión</span>
                <strong style={{ color: 'var(--text-main)' }}>
                  {updateInfo?.currentVersion || 'N/A'}
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <span>Actualizaciones</span>
                <strong style={{ color: 'var(--text-main)' }}>
                  {updateInfo?.updateCount ?? 0}
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <span>Última actualización</span>
                <strong style={{ color: 'var(--text-main)' }}>
                  {formatUpdateDate(updateInfo?.updatedAt)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

