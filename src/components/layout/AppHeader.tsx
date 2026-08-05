interface EmpresaHeader {
  nombre?: string;
  administrador?: string;
  logo?: string;
}

interface AppHeaderProps {
  empresa: EmpresaHeader;
  isWeb: boolean;
  remoteUrl: string;
  remoteUrlHealthy: boolean;
  repoUrl: string;
  localUrlHealthy: boolean;
  onCopyUrl: (value: string) => void;
  onRefresh: () => void;
}

export function AppHeader({
  empresa,
  isWeb,
  remoteUrl,
  remoteUrlHealthy,
  repoUrl,
  localUrlHealthy,
  onCopyUrl,
  onRefresh,
}: AppHeaderProps) {
  const baseLabel = isWeb ? 'Modo Web' : 'Base Local';

  return (
    <header className="app-header executive-app-header">
      <div className="executive-brand">
        <div className="executive-brand__logo">
          <img
            src={empresa.logo || '/logo-freeplastic.png'}
            alt={empresa.logo ? 'Logo' : 'Logo FreePlastic'}
          />
        </div>

        <div className="executive-brand__copy">
          <h1>{empresa.nombre || 'Cartera Dashboard'}</h1>
          {empresa.administrador && (
            <span>👤 {empresa.administrador}</span>
          )}
        </div>
      </div>

      <div className="executive-header-actions">
        <button
          type="button"
          className={`executive-status-chip ${
            remoteUrl && remoteUrlHealthy
              ? 'is-healthy'
              : remoteUrl
                ? 'is-warning'
                : 'is-muted'
          }`}
          onClick={() => remoteUrl && onCopyUrl(remoteUrl)}
          disabled={!remoteUrl}
          title={
            remoteUrl
              ? `Acceso remoto: ${remoteUrl}. Clic para copiar.`
              : 'Acceso remoto no disponible'
          }
        >
          <span className="executive-status-dot" />
          Remoto
        </button>

        <button
          type="button"
          className={`executive-status-chip ${
            repoUrl && localUrlHealthy
              ? 'is-healthy'
              : repoUrl
                ? 'is-warning'
                : 'is-muted'
          }`}
          onClick={() => repoUrl && onCopyUrl(repoUrl)}
          disabled={!repoUrl}
          title={
            repoUrl
              ? `Red local: ${repoUrl}. Clic para copiar.`
              : 'Red local no disponible'
          }
        >
          <span className="executive-status-dot" />
          Local
        </button>

        <div
          className="executive-base-chip"
          title={
            isWeb
              ? 'Aplicación ejecutándose en modo web'
              : 'Base SQLite local conectada'
          }
        >
          <span>▣</span>
          <strong>{baseLabel}</strong>
        </div>

        <button
          type="button"
          className="executive-refresh-button"
          title="Actualizar toda la información"
          onClick={onRefresh}
        >
          ↻ Actualizar
        </button>
      </div>
    </header>
  );
}
