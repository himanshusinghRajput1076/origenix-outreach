export default function Sidebar({ activePanel, setActivePanel, clientCount, investorCount, leadsCount, smtpStatus = 'unchecked', onResetApp }) {
  const getSmtpBadge = () => {
    switch (smtpStatus) {
      case 'connected':
        return { label: 'SMTP Online', color: '#22c55e', bg: '#dcfce7' }
      case 'error':
        return { label: 'SMTP Error', color: '#ef4444', bg: '#fee2e2' }
      case 'checking':
        return { label: 'Connecting...', color: '#f59e0b', bg: '#fef3c7' }
      case 'disconnected':
        return { label: 'SMTP Not Setup', color: '#94a3b8', bg: '#f1f5f9' }
      case 'sleeping':
        return { label: 'Server Waking...', color: '#a855f7', bg: '#f3e8ff' }
      default:
        return { label: 'SMTP Status', color: '#94a3b8', bg: '#f1f5f9' }
    }
  }

  const smtpBadge = getSmtpBadge()

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">📨</div>
          <div className="sidebar-logo-text">
            <h1>Origenix Outreach</h1>
            <p>by OrigenixDigitalSolution</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Home</div>
        <button
          className={`nav-item ${activePanel === 'dashboard' ? 'active dashboard' : ''}`}
          onClick={() => setActivePanel('dashboard')}
        >
          <span className="nav-icon">🏠</span>
          <span>Dashboard</span>
        </button>

        <div className="sidebar-section-label">Panels</div>
        <button
          className={`nav-item ${activePanel === 'clients' ? 'active client' : ''}`}
          onClick={() => setActivePanel('clients')}
        >
          <span className="nav-icon">🤝</span>
          <span>Clients</span>
          {clientCount > 0 && <span className="nav-badge">{clientCount.toLocaleString()}</span>}
        </button>
        <button
          className={`nav-item ${activePanel === 'investors' ? 'active investor' : ''}`}
          onClick={() => setActivePanel('investors')}
        >
          <span className="nav-icon">💼</span>
          <span>Investors</span>
          {investorCount > 0 && <span className="nav-badge">{investorCount.toLocaleString()}</span>}
        </button>

        <button
          className={`nav-item ${activePanel === 'crm' ? 'active dashboard' : ''}`}
          style={activePanel === 'crm' ? { borderLeft: '4px solid var(--accent-gradient-start)' } : {}}
          onClick={() => setActivePanel('crm')}
        >
          <span className="nav-icon">📊</span>
          <span>Leads CRM</span>
          {leadsCount > 0 && <span className="nav-badge" style={{ background: 'var(--blue)' }}>{leadsCount.toLocaleString()}</span>}
        </button>

        <button
          className={`nav-item ${activePanel === 'connections' ? 'active dashboard' : ''}`}
          style={activePanel === 'connections' ? { borderLeft: '4px solid var(--green)' } : {}}
          onClick={() => setActivePanel('connections')}
        >
          <span className="nav-icon">🔗</span>
          <span>Connections</span>
        </button>

        <div className="sidebar-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Setup</span>
          <button 
            type="button"
            onClick={() => setActivePanel('profile')}
            style={{ 
              fontSize: '0.68rem', 
              fontWeight: 600, 
              padding: '2px 6px', 
              borderRadius: '4px', 
              background: smtpBadge.bg, 
              color: smtpBadge.color,
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px'
            }}
            title="Go to settings to configure SMTP"
          >
            {smtpBadge.label} ⚙️
          </button>
        </div>
        <button
          className={`nav-item ${activePanel === 'profile' ? 'active dashboard' : ''}`}
          onClick={() => setActivePanel('profile')}
        >
          <span className="nav-icon">⚙️</span>
          <span>Company & Settings</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <p className="sidebar-footer-info">OrigenixDigitalSolution © 2025</p>
        <button 
          onClick={onResetApp}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--red)', 
            cursor: 'pointer', 
            fontSize: '0.72rem', 
            textDecoration: 'underline', 
            marginTop: '8px',
            display: 'block',
            width: '100%',
            textAlign: 'center'
          }}
        >
          🚨 Reset System Data
        </button>
      </div>
    </aside>
  )
}

