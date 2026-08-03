import { RankingList } from '../components';
import type {
  AnalisisRetenciones,
  AnalisisVendedor,
  DeudorCronico,
  EficienciaCobranza,
  VencimientosProximos,
} from '../services/dashboardService';
import { compactLabel, fmtMoney } from '../utils';

interface DashboardStats {
  totalSaldo?: number;
  vencidaSaldo?: number;
  npl?: number;
  clientesConSaldo?: number;
  docsPendientes?: number;
  totalCobrado?: number;
}

interface AgingChartItem {
  name: string;
  saldo: number;
  fill: string;
}

interface ClienteChartItem {
  name: string;
  saldo: number;
  fill: string;
}

export interface DashboardPageProps {
  isMobile: boolean;
  descuadresDetectados: number;
  stats: DashboardStats | null;
  agingData: AgingChartItem[] | null;
  topClientesData: ClienteChartItem[] | null;
  eficienciaCobranza: EficienciaCobranza;
  vencimientosProximos: VencimientosProximos;
  analisisRetenciones: AnalisisRetenciones;
  analisisPorVendedor: AnalisisVendedor[];
  deudoresCronicos: DeudorCronico[];
  onOpenReports: () => void;
}

export function DashboardPage({
  isMobile,
  descuadresDetectados,
  stats,
  agingData,
  topClientesData,
  eficienciaCobranza,
  vencimientosProximos,
  analisisRetenciones,
  analisisPorVendedor,
  deudoresCronicos,
  onOpenReports,
}: DashboardPageProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {descuadresDetectados > 0 && (
        <div
          style={{
            padding: '10px 16px',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>
              <strong>Atención:</strong> Se detectaron{' '}
              <strong>{descuadresDetectados}</strong> documentos en Contifico con
              descuadre entre tramos de días y Total.
            </span>
          </div>
          <button
            className="btn secondary"
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            onClick={onOpenReports}
          >
            Ver en Reportes →
          </button>
        </div>
      )}

      <div
        style={{
          flex: '0 0 auto',
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
          gap: '12px',
        }}
      >
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
        <div className="card" style={{ padding: '12px 8px', minHeight: 90, textAlign: 'center', background: stats && (stats.npl ?? 0) > 30 ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' : 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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

      <div style={{ flex: '0 0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}><div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>DOCS</div><div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{stats?.docsPendientes || 0}</div></div>
        <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}><div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>VENCE 7D</div><div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f59e0b' }}>{fmtMoney(vencimientosProximos.monto7)}</div></div>
        <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}><div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>VENCE 30D</div><div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f97316' }}>{fmtMoney(vencimientosProximos.monto30)}</div></div>
        <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}><div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>RETENCIONES</div><div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{fmtMoney(analisisRetenciones.totalRetenido)}</div></div>
        <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}><div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>COBRADO MES</div><div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#10b981' }}>{fmtMoney(stats?.totalCobrado || 0)}</div></div>
        <div className="card" style={{ padding: '6px 6px', textAlign: 'center' }}><div style={{ fontSize: '0.52rem', color: 'var(--text-secondary)', marginBottom: '1px' }}>CRÓNICOS</div><div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ef4444' }}>{deudoresCronicos.length}</div></div>
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', height: '100%', alignItems: 'stretch' }}>
          <div className="card" style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '5px solid #10b981', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 4px 16px rgba(16,185,129,0.1)', transition: 'all 0.3s ease' }}>
            <RankingList title="Aging de Cartera" items={Array.isArray(agingData) ? agingData.map((item) => ({ label: item.name, value: item.saldo, color: item.fill })) : []} valuePrefix="" valueSuffix="" maxItems={10} barColor="#10b981" decimals={2} />
          </div>
          <div className="card" style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '5px solid #a855f7', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 4px 16px rgba(168,85,247,0.1)', transition: 'all 0.3s ease' }}>
            <RankingList title="Top Clientes" items={Array.isArray(topClientesData) ? topClientesData.slice(0, 10).map((item) => ({ label: item.name, value: item.saldo, color: item.fill })) : []} valuePrefix="" valueSuffix="" maxItems={10} barColor="#a855f7" decimals={2} />
          </div>
          <div className="card" style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '5px solid #3b82f6', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 4px 16px rgba(59,130,246,0.1)', transition: 'all 0.3s ease' }}>
            <RankingList title="Por Vendedor" items={Array.isArray(analisisPorVendedor) ? analisisPorVendedor.slice(0, 10).map((item) => ({ label: compactLabel(item.vendedor), fullLabel: item.vendedor, value: item.totalPendiente, color: item.porcentajeMorosidad > 30 ? '#ef4444' : item.porcentajeMorosidad > 15 ? '#f59e0b' : '#3b82f6' })) : []} valuePrefix="" valueSuffix="" maxItems={10} barColor="#3b82f6" decimals={2} />
          </div>
          <div className="card" style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', borderTop: '5px solid #dc2626', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 4px 16px rgba(220,38,38,0.1)', transition: 'all 0.3s ease' }}>
            <RankingList title="Deudores Crónicos" items={Array.isArray(deudoresCronicos) ? deudoresCronicos.slice(0, 10).map((item) => ({ label: compactLabel(item.cliente), fullLabel: item.cliente, value: item.totalVencido, color: '#dc2626' })) : []} valuePrefix="" valueSuffix="" maxItems={10} barColor="#dc2626" decimals={2} />
          </div>
        </div>
      </div>
    </div>
  );
}
