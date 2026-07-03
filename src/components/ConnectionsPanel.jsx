import { useState, useMemo } from 'react'
import { getConnections, clearConnections } from '../utils/connections'
import { getDailyCount } from '../utils/limit'
import { maskEmail, maskPhone } from '../utils/mask'

export default function ConnectionsPanel({ addToast, onResetQuotas }) {
  const [logs, setLogs] = useState(() => getConnections())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [variantFilter, setVariantFilter] = useState('all')
  const [expandedLogId, setExpandedLogId] = useState(null)

  // Recalculate daily progress counts
  const emailsToday = getDailyCount('email')
  const whatsappToday = getDailyCount('whatsapp')

  const handleClearLogs = () => {
    if (window.confirm("Are you sure you want to clear your outreach connections history? This cannot be undone.")) {
      clearConnections()
      setLogs([])
      addToast('Outreach logs cleared successfully.', 'success')
    }
  }

  // Filter logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = 
        (log.contactName || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.contactValue || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.company || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.subject || '').toLowerCase().includes(search.toLowerCase())

      const matchType = typeFilter === 'all' || log.type === typeFilter
      const matchStatus = statusFilter === 'all' || log.status === statusFilter
      const matchVariant = variantFilter === 'all' || log.variant === variantFilter

      return matchSearch && matchType && matchStatus && matchVariant
    })
  }, [logs, search, typeFilter, statusFilter, variantFilter])

  // Count stats
  const totalEmails = logs.filter(l => l.type === 'email' && l.status === 'sent').length
  const totalFailedEmails = logs.filter(l => l.type === 'email' && l.status === 'failed').length
  const totalWhatsApp = logs.filter(l => l.type === 'whatsapp').length

  const formatDate = (isoStr) => {
    try {
      const date = new Date(isoStr)
      return date.toLocaleString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } catch {
      return isoStr
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Outreach Connections</h2>
          <p>View, search, and track all successful and failed outreach logs.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onResetQuotas} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
            🔄 Reset Quotas
          </button>
          {logs.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleClearLogs} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
              🗑️ Clear History
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon success">📧</div>
          <div className="stat-info">
            <h3>{totalEmails}</h3>
            <p>Emails Sent</p>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{totalFailedEmails} failed</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon client">💬</div>
          <div className="stat-info">
            <h3>{totalWhatsApp}</h3>
            <p>WhatsApp Links Opened</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>⚡</div>
          <div className="stat-info">
            <h3>{emailsToday} / 500</h3>
            <p>Email Quota Today</p>
            <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '4px' }}>
              <div style={{ width: `${Math.min(100, (emailsToday/500)*100)}%`, height: '100%', background: '#0284c7', borderRadius: '2px' }} />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#22c55e' }}>📱</div>
          <div className="stat-info">
            <h3>{whatsappToday} / 500</h3>
            <p>WhatsApp Quota Today</p>
            <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '4px' }}>
              <div style={{ width: `${Math.min(100, (whatsappToday/500)*100)}%`, height: '100%', background: '#22c55e', borderRadius: '2px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '12px', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by name, email, phone, company..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <select 
              className="form-input" 
              value={typeFilter} 
              onChange={e => setTypeFilter(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            >
              <option value="all">All Channels</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <select 
              className="form-input" 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent / Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <select 
              className="form-input" 
              value={variantFilter} 
              onChange={e => setVariantFilter(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            >
              <option value="all">All Audiences</option>
              <option value="client">Clients</option>
              <option value="investor">Investors</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card">
        {filteredLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px' }}>
            <div className="empty-icon">📁</div>
            <h4>No connection logs found</h4>
            <p>Logs will automatically populate when you start email campaigns or launch WhatsApp threads.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="contacts-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--gray-200)' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Channel</th>
                  <th style={{ padding: '12px' }}>Contact</th>
                  <th style={{ padding: '12px' }}>Company</th>
                  <th style={{ padding: '12px' }}>Audience</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id
                  const isEmail = log.type === 'email'
                  const isSuccess = log.status === 'sent'

                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--gray-100)', background: isExpanded ? 'var(--gray-50)' : 'transparent' }}>
                      <td style={{ padding: '12px', fontSize: '0.82rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                        {formatDate(log.timestamp)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.88rem' }}>
                        {isEmail ? '📧 Email' : '💬 WhatsApp'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--gray-800)' }}>{log.contactName || 'Unknown'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                          {isEmail ? maskEmail(log.contactValue) : maskPhone(log.contactValue)}
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--gray-700)' }}>{log.company || '—'}</td>
                      <td style={{ padding: '12px', textTransform: 'capitalize', fontSize: '0.82rem' }}>
                        <span className={`tag ${log.variant === 'client' ? 'tag-client' : 'tag-investor'}`}>
                          {log.variant}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className="tag" style={isSuccess
                          ? { background: 'var(--green-light)', color: 'var(--green)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }
                          : { background: 'var(--red-light)', color: 'var(--red)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          {isExpanded ? 'Hide Details' : 'View Message'}
                        </button>
                      </td>
                      {isExpanded && (
                        <td colSpan="7" style={{ padding: '16px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', borderBottom: '1px solid var(--gray-200)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--gray-700)', maxWidth: '800px' }}>
                            {isEmail && log.subject && (
                              <div style={{ marginBottom: '8px' }}>
                                <strong>Subject:</strong> {log.subject}
                              </div>
                            )}
                            <div style={{ whiteSpace: 'pre-wrap', background: 'var(--white)', padding: '12px', borderRadius: '6px', border: '1px solid var(--gray-200)', fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: '180px', overflowY: 'auto' }}>
                              {log.message}
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
