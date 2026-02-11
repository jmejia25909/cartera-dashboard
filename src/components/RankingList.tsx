import React from "react";

interface RankingItem {
  label: string;
  value: number;
  color?: string;
  fullLabel?: string;
}

interface RankingListProps {
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
  valuePrefix = '',
  valueSuffix = '',
  maxItems = 10,
  barColor = '#a855f7',
  decimals = 2,
}) => {
  // Protección: items siempre array
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    return (
      <div style={{ width: '100%', height: '100%', color: '#9ca3af', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Sin datos
      </div>
    );
  }
  const maxValue = Math.max(...safeItems.map(i => i.value), 1);
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ 
        fontWeight: 700, 
        fontSize: '0.8rem', 
        marginBottom: 3, 
        color: '#1e293b',
        letterSpacing: '-0.2px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '3px'
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden', maxHeight: 'calc(100% - 22px)' }}>
        {safeItems.slice(0, maxItems).map((item, idx) => {
          const fullLabel = (item.fullLabel ?? item.label).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
          const labelText = item.label.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
          return (
          <div key={`${labelText}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 16 }}>
            <div style={{ width: 12, textAlign: 'right', color: '#6366f1', fontWeight: 600, fontSize: '0.72rem' }}>{idx + 1}</div>
            <div
              title={fullLabel}
              style={{
                flex: '0 1 150px',
                minWidth: 0,
                maxWidth: 150,
                fontSize: '0.74rem',
                color: '#374151',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: '16px',
                height: 16
              }}
            >
              {labelText}
            </div>
            <div style={{ flex: 2, minWidth: 26, maxWidth: 86, height: 3, background: '#e5e7eb', borderRadius: 3, margin: '0 4px', position: 'relative' }}>
              <div style={{
                width: `${Math.max(6, (item.value / maxValue) * 100)}%`,
                height: '100%',
                background: item.color || barColor,
                borderRadius: 4,
                transition: 'width 0.3s',
                position: 'absolute',
                left: 0,
                top: 0,
              }} />
            </div>
            <div style={{ minWidth: 58, textAlign: 'right', fontWeight: 600, color: '#7c3aed', fontSize: '0.74rem', lineHeight: 1.1 }}>
              {valuePrefix}{item.value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{valueSuffix}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
};
