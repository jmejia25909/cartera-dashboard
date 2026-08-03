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
  return (
    <header className="app-header">
      <div className="header-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              background: empresa.logo
                ? 'transparent'
                : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
              overflow: 'hidden',
            }}
          >
            <img
              src={empresa.logo || '/logo-freeplastic.png'}
              alt={empresa.logo ? 'Logo' : 'Logo FreePlastic'}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.4rem',
                fontWeight: '700',
                color: 'var(--text-main)',
              }}
            >
              {empresa.nombre || 'Cartera Dashboard'}
            </h1>

            {empresa.administrador && (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginTop: '2px',
                }}
              >
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

        <div
          className={`header-info header-info-clickable url-button cloudflare-button ${
            remoteUrl ? '' : 'disabled'
          }`}
          onClick={() => remoteUrl && onCopyUrl(remoteUrl)}
          title={
            remoteUrl
              ? `Acceso Remoto (ngrok) - ${remoteUrl} - Clic para copiar`
              : 'Acceso Remoto - Iniciando...'
          }
        >
          <span className="info-label">
            {!remoteUrl ? '🔌' : remoteUrlHealthy ? '🌐' : '🔴'}
          </span>
          <span className="info-value info-url url-max-width">Remoto</span>
          {remoteUrl && !remoteUrlHealthy && <span className="health-badge">⚠️</span>}
        </div>

        <div
          className={`header-info header-info-clickable url-button local-button ${
            repoUrl ? '' : 'disabled'
          }`}
          onClick={() => repoUrl && onCopyUrl(repoUrl)}
          title={
            repoUrl
              ? `Red Local - ${repoUrl} - Clic para copiar`
              : 'Red Local - Conectando...'
          }
        >
          <span className="info-label">
            {!repoUrl ? '🔌' : localUrlHealthy ? '🟢' : '🔴'}
          </span>
          <span className="info-value info-url url-max-width">Local</span>
          {repoUrl && !localUrlHealthy && <span className="health-badge">⚠️</span>}
          {!repoUrl && <span className="health-badge">⏳</span>}
        </div>

        <div className="header-info">
          <span className="info-label">💾</span>
          <span className="info-value info-path">
            {isWeb ? 'Modo Web' : 'C:\\Users\\...\\cartera.db'}
          </span>
        </div>

        <div className="header-info">
          <button
            className="refresh-btn"
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              background: '#2563eb',
              color: '#fff',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              marginLeft: 8,
            }}
            title="Refrescar todo el sistema"
            onClick={onRefresh}
          >
            🔄 Refrescar
          </button>
        </div>
      </div>
    </header>
  );
}
