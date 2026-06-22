export default function Sidebar({ activePanel, setActivePanel, clientCount, investorCount, leadsCount }) {
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

        <div className="sidebar-section-label">Setup</div>
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
      </div>
    </aside>
  )
}

