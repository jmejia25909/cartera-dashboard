interface DocumentationModalProps {
  open: boolean;
  onClose: () => void;
}

export function DocumentationModal({ open, onClose }: DocumentationModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: 700, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="modal-header">📖 Guía Rápida del Sistema</div>
        <div className="modal-body" style={{ lineHeight: 1.6 }}>
          <h3 style={{ color: '#2563eb', marginTop: 0 }}>🏠 Dashboard</h3>
          <p>
            Vista general con KPIs principales: cartera total, vencida, morosidad.
            Gráficos de aging y top clientes.
          </p>

          <h3 style={{ color: '#2563eb', marginTop: 16 }}>👥 Gestión de Clientes</h3>
          <ul style={{ marginLeft: 20 }}>
            <li><strong>Ver clientes:</strong> Lista de clientes con saldo vencido y estado de contacto</li>
            <li><strong>Registrar gestión:</strong> Llamadas, emails, WhatsApp, visitas con resultado y promesas</li>
            <li><strong>Seguimiento:</strong> Historial completo por cliente</li>
          </ul>

          <h3 style={{ color: '#2563eb', marginTop: 16 }}>📊 Reportes</h3>
          <ul style={{ marginLeft: 20 }}>
            <li><strong>Documentos:</strong> Tabla completa de facturas con filtros por cliente, vendedor y aging</li>
            <li><strong>Exportar:</strong> Excel/PDF con documentos seleccionados</li>
            <li><strong>Estados de cuenta:</strong> PDF por cliente para enviar</li>
          </ul>

          <h3 style={{ color: '#2563eb', marginTop: 16 }}>📥 Importar desde Contifico</h3>
          <ol style={{ marginLeft: 20 }}>
            <li>Ir a <strong>Configuración &gt; Gestión de Datos</strong></li>
            <li>Clic en <strong>Importar Excel Contifico</strong></li>
            <li>Seleccionar archivo de Cartera por Cobrar</li>
            <li>El sistema detecta nuevos documentos y actualiza saldos</li>
          </ol>

          <p style={{ background: '#fef3c7', padding: 10, borderRadius: 6, fontSize: '0.9rem' }}>
            💡 <strong>Tip:</strong> Importa regularmente para mantener la cartera actualizada.
            Los documentos pagados se cierran automáticamente.
          </p>

          <h3 style={{ color: '#2563eb', marginTop: 16 }}>🚨 Alertas</h3>
          <p>Documentos críticos por días vencidos y monto. Usa filtros para priorizar tu cobranza.</p>

          <h3 style={{ color: '#2563eb', marginTop: 16 }}>📈 Análisis y Tendencias</h3>
          <p>Motivos de impago, productividad de gestores y tendencias históricas mensuales.</p>

          <h3 style={{ color: '#2563eb', marginTop: 16 }}>⚙️ Configuración</h3>
          <ul style={{ marginLeft: 20 }}>
            <li><strong>Empresa:</strong> Datos, logo, RUC y meta mensual</li>
            <li><strong>Temas:</strong> Personalización visual</li>
            <li><strong>Respaldos:</strong> Exporta/importa base de datos</li>
          </ul>

          <div style={{ marginTop: 20, padding: 12, background: '#dbeafe', borderRadius: 8 }}>
            <strong>📞 Soporte:</strong> j-mejiacastro1993@outlook.com | +593-962739443
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn primary" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  );
}
