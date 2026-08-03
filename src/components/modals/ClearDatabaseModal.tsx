interface ClearDatabaseModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ClearDatabaseModal({
  open,
  loading,
  onClose,
  onConfirm,
}: ClearDatabaseModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
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

          <p style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '12px' }}>
            ⚠️ Esta acción NO se puede deshacer
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className="btn danger" onClick={() => void onConfirm()} disabled={loading}>
            {loading ? 'Limpiando...' : 'Sí, limpiar ahora'}
          </button>
        </div>
      </div>
    </div>
  );
}
