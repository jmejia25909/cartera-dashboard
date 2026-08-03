interface ChangeHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChangeHistoryModal({ open, onClose }: ChangeHistoryModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: 650, maxHeight: '80vh', overflowY: 'auto' }}
      >
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
          <button className="btn primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
