import React from "react";

export interface RankingItem {
  label: string;
  value: number;
  color?: string;
  fullLabel?: string;
}

export interface RankingListProps {
  title: string;
  items: RankingItem[];
  valuePrefix?: string;
  valueSuffix?: string;
  maxItems?: number;
  barColor?: string;
  decimals?: number;
}

export const RankingList: React.FC<RankingListProps> = ({
  title,
  items,
  valuePrefix = '$',
  valueSuffix = '',
  maxItems = 10,
  barColor = '#3b82f6',
  decimals = 2,
}) => {
  const safeItems = Array.isArray(items) ? items : [];

  if (!safeItems.length) {
    return (
      <div style={{ width: '100%', height: '100%', color: '#9ca3af', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        Sin datos disponibles
      </div>
    );
  }

  const maxValue = Math.max(...safeItems.map(i => i.value), 1);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        fontWeight: 700, 
        fontSize: '0.85rem', 
        marginBottom: 8, 
        color: 'var(--text-main, #1e293b)',
        letterSpacing: '-0.2px',
        borderBottom: '2px solid var(--border, #e5e7eb)',
        paddingBottom: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>{title}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}>Top {Math.min(maxItems, safeItems.length)}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
        {safeItems.slice(0, maxItems).map((item, idx) => {
          const fullLabel = (item.fullLabel ?? item.label).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
          const labelText = item.label.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
          const percent = Math.max(5, Math.min(100, (item.value / maxValue) * 100));

          // Estilo badge ranking
          const rankColor = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#6366f1';

          return (
            <div key={`${labelText}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 20 }}>
              <div style={{ 
                width: 16, 
                height: 16,
                borderRadius: '50%',
                background: idx < 3 ? `${rankColor}20` : 'transparent',
                color: rankColor, 
                fontWeight: 700, 
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {idx + 1}
              </div>

              <div
                title={fullLabel}
                style={{
                  flex: '0 1 140px',
                  minWidth: 0,
                  maxWidth: 140,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--text-main, #374151)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '16px'
                }}
              >
                {labelText}
              </div>

              <div style={{ flex: 1, minWidth: 30, height: 6, background: '#e5e7eb', borderRadius: 3, margin: '0 4px', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  width: `${percent}%`,
                  height: '100%',
                  background: item.color || barColor,
                  borderRadius: 3,
                  transition: 'width 0.4s ease-in-out',
                }} />
              </div>

              <div style={{ minWidth: 65, textAlign: 'right', fontWeight: 600, color: 'var(--text-main, #4c1d95)', fontSize: '0.75rem', lineHeight: 1.1 }}>
                {valuePrefix}{item.value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{valueSuffix}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
