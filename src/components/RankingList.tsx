import React from "react";

interface RankingItem {
  label: string;
  value: number;
  color?: string;
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
        fontSize: '0.85rem', 
        marginBottom: 4, 
        color: '#1e293b',
        letterSpacing: '-0.2px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '3px'
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto', maxHeight: 'calc(100% - 25px)' }}>
        {safeItems.slice(0, maxItems).map((item, idx) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 18 }}>
            <div style={{ width: 14, textAlign: 'right', color: '#6366f1', fontWeight: 600, fontSize: '0.8rem' }}>{idx + 1}</div>
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
            <div style={{ flex: 2, minWidth: 30, maxWidth: 90, height: 4, background: '#e5e7eb', borderRadius: 3, margin: '0 5px', position: 'relative' }}>
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
            <div style={{ minWidth: 60, textAlign: 'right', fontWeight: 600, color: '#7c3aed', fontSize: '0.82rem' }}>
              {valuePrefix}{item.value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{valueSuffix}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
