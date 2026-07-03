import { useState, useEffect } from 'react'
import { getConnections } from '../utils/connections'
import { getReplies, syncRepliesFromOutreach } from '../utils/replies'
import { maskEmail, maskPhone } from '../utils/mask'

export default function Dashboard({ 
  clientContacts, 
  investorContacts, 
  leads = [], 
  setLeads, 
  smtpStatus = 'unchecked', 
  onCheckSmtp, 
  onResetApp, 
  onResetQuotas,
  addToast, 
  onNavigate 
}) {
  const [logs, setLogs] = useState(() => getConnections())
  const [replies, setReplies] = useState(() => getReplies())
  const [syncing, setSyncing] = useState(false)

  // Reload logs and replies periodically or on active actions
  const reloadData = () => {
    setLogs(getConnections())
    setReplies(getReplies())
  }

  useEffect(() => {
    reloadData()
  }, [leads])

  const handleSyncReplies = () => {
    setSyncing(true)
    setTimeout(() => {
      const result = syncRepliesFromOutreach(leads, setLeads, addToast)
      setSyncing(false)
      reloadData()
      if (result.newCount > 0) {
        addToast(`Synced replies: Found ${result.newCount} new client messages!`, 'success')
      } else {
        addToast('Checked for replies. No new replies found.', 'info')
      }
    }, 1000)
  }

  // Count stats
  const clientEmails = clientContacts.filter(c => c.email).length
  const investorEmails = investorContacts.filter(c => c.email).length
  
  const totalEmailsSent = logs.filter(l => l.type === 'email' && l.status === 'sent').length
  const totalEmailsFailed = logs.filter(l => l.type === 'email' && l.status === 'failed').length
  const totalWhatsAppSent = logs.filter(l => l.type === 'whatsapp').length

  const recentOutreach = logs.slice(0, 5)

  const getSmtpLabelColor = () => {
    switch (smtpStatus) {
      case 'connected': return '#22c55e'
      case 'error': return '#ef4444'
      case 'checking': return '#f59e0b'
      default: return '#64748b'
    }
  }

  const formatTimeAgo = (isoStr) => {
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      return new Date(isoStr).toLocaleDateString()
    } catch {
      return ''
    }
  }

  return (
    <div>
      {/* Page Header with SMTP Monitor & Quick Actions */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Outreach Dashboard</h2>
          <p>Real-time campaign delivery stats, SMTP status, and client responses.</p>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--white)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gray-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getSmtpLabelColor() }} />
            <span style={{ fontWeight: 500, color: 'var(--gray-700)' }}>
              SMTP: {smtpStatus === 'connected' ? 'Connected' : smtpStatus === 'error' ? 'Connection Error' : smtpStatus === 'checking' ? 'Testing...' : 'Not Configured'}
            </span>
            <button className="btn btn-sm btn-secondary" onClick={() => onCheckSmtp()} style={{ padding: '2px 6px', fontSize: '0.72rem' }} disabled={smtpStatus === 'checking'}>
              🔄 Test
            </button>
          </div>
          <div style={{ borderLeft: '1px solid var(--gray-200)', height: '16px', margin: '0 4px' }} />
          <button className="btn btn-sm" onClick={onResetQuotas} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
            🔄 Reset Quotas
          </button>
          <button className="btn btn-sm" onClick={onResetApp} style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
            🚨 Reset Application
          </button>
        </div>
      </div>

      {/* Main stats grid */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon client">👥</div>
          <div className="stat-info">
            <h3>{clientContacts.length + investorContacts.length}</h3>
            <p>Contacts Loaded</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success">📧</div>
          <div className="stat-info">
            <h3>{totalEmailsSent}</h3>
            <p>Emails Delivered</p>
            {totalEmailsFailed > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--red)' }}>{totalEmailsFailed} failed</span>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">💬</div>
          <div className="stat-info">
            <h3>{totalWhatsAppSent}</h3>
            <p>WhatsApp Messages</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon info" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>📊</div>
          <div className="stat-info">
            <h3>{leads.length}</h3>
            <p>Active CRM Leads</p>
          </div>
        </div>
      </div>

      {/* Grid: Columns and Outreach Feed */}
      <div className="two-col-grid" style={{ marginBottom: '24px' }}>
        
        {/* Left Column: Connections and Contacts Panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🤝 Client Outreach</h3>
              <span className="tag tag-client">{clientContacts.length}</span>
            </div>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.88rem', marginBottom: '16px' }}>
              Reach out to potential clients about your services. Upload, queue, write, and launch campaigns.
            </p>
            <div className="btn-group">
              <button className="btn btn-client" onClick={() => onNavigate('clients')}>
                Manage Client File →
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">💼 Investor Outreach</h3>
              <span className="tag tag-investor">{investorContacts.length}</span>
            </div>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.88rem', marginBottom: '16px' }}>
              Pitch your company and Highlights. Upload investors, link attachment decks, and track follow-ups.
            </p>
            <div className="btn-group">
              <button className="btn btn-investor" onClick={() => onNavigate('investors')}>
                Manage Investor File →
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Outreach Feed */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">🔗 Recent Activity Feed</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('connections')} style={{ fontSize: '0.75rem' }}>
              View All Logs
            </button>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {recentOutreach.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '40px 20px', color: 'var(--gray-400)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📤</div>
                <p style={{ fontSize: '0.85rem' }}>No outreach campaigns sent yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentOutreach.map((item) => (
                  <div key={item.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '10px 12px', 
                    background: 'var(--gray-50)', 
                    borderRadius: '8px', 
                    border: '1px solid var(--gray-100)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '1.2rem' }}>
                        {item.type === 'email' ? '📧' : '💬'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-800)' }}>
                          {item.contactName || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                          {item.type === 'email' ? maskEmail(item.contactValue) : maskPhone(item.contactValue)}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="tag" style={item.status === 'sent'
                        ? { background: 'var(--green-light)', color: 'var(--green)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }
                        : { background: 'var(--red-light)', color: 'var(--red)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.status}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: '4px' }}>
                        {formatTimeAgo(item.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simulated Inbox / Client Replies Widget */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="card-title">📨 Client Replies Inbox</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-400)' }}>
              Automatically sync and match incoming client messages directly with CRM lead stages.
            </p>
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleSyncReplies} 
            disabled={syncing || totalEmailsSent === 0}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: syncing ? '#f3f4f6' : totalEmailsSent === 0 ? '#f3f4f6' : 'var(--blue-light)',
              color: totalEmailsSent === 0 ? 'var(--gray-400)' : 'var(--blue)',
              border: 'none',
              cursor: totalEmailsSent === 0 ? 'not-allowed' : 'pointer'
            }}
            title={totalEmailsSent === 0 ? "Send emails to clients first before checking for replies" : "Check for client responses"}
          >
            {syncing ? 'Syncing...' : '🔄 Check for Replies'}
          </button>
        </div>

        {replies.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px', textAlign: 'center', color: 'var(--gray-400)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📬</div>
            <h4>No replies received yet</h4>
            <p style={{ fontSize: '0.8rem' }}>
              {totalEmailsSent === 0 
                ? "Start by uploading contacts and sending email campaigns. Once sent, click 'Check for Replies' to check responses." 
                : "All quiet. Click 'Check for Replies' above to fetch replies from your active outreach list."}
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {replies.map((reply) => {
                const isPositive = reply.type === 'positive'
                const isNegative = reply.type === 'negative'
                
                return (
                  <div key={reply.id} style={{ 
                    padding: '12px', 
                    borderRadius: '8px', 
                    background: isPositive ? '#f0fdf4' : isNegative ? '#fef2f2' : '#f0f9ff',
                    border: `1px solid ${isPositive ? '#bdf0c4' : isNegative ? '#fecaca' : '#bae6fd'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-800)' }}>
                        👤 {reply.contactName} {reply.company && `@ ${reply.company}`}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                        {formatTimeAgo(reply.timestamp)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--gray-700)', fontStyle: 'italic', paddingLeft: '20px' }}>
                      "{reply.message}"
                    </div>
                    <div style={{ display: 'flex', gap: '8px', paddingLeft: '20px', marginTop: '4px' }}>
                      <span className="tag" style={isPositive 
                        ? { background: '#22c55e', color: 'var(--white)', fontSize: '0.68rem', padding: '1px 5px' }
                        : isNegative 
                        ? { background: '#ef4444', color: 'var(--white)', fontSize: '0.68rem', padding: '1px 5px' }
                        : { background: '#0284c7', color: 'var(--white)', fontSize: '0.68rem', padding: '1px 5px' }}>
                        {reply.type === 'positive' ? 'Interested (Move to Negotiation)' : reply.type === 'negative' ? 'Declined (Move to Lost)' : 'Info Request (Move to Proposal)'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leads CRM Pipeline card */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">📊 Leads CRM Pipeline</h3>
          <span className="tag" style={{ background: 'var(--blue-light)', color: 'var(--blue)', fontWeight: 600 }}>{leads.length.toLocaleString()} Active Leads</span>
        </div>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Track deal/investment stages, log phone/chat timelines, set follow-up tasks, and view contact statistics.
        </p>
        <div className="btn-group" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => onNavigate('crm')}>
            Open CRM Board →
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">How it works</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: 'var(--gray-700)' }}>Step 1</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Go to Company & Settings and fill in your details and email credentials.</p>
          </div>
          <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: 'var(--gray-700)' }}>Step 2</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Upload your Excel file with names, emails, and phone numbers.</p>
          </div>
          <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: 'var(--gray-700)' }}>Step 3</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Pick a template, tweak it if you want, and hit send.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
