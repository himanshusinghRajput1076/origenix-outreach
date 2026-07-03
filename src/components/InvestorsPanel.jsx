import { useState, useEffect } from 'react'
import ExcelUploader from './ExcelUploader'
import MessageComposer from './MessageComposer'
import { maskEmail, maskPhone } from '../utils/mask'
import { checkAndPromoteQueuedContacts } from '../utils/limit'

export default function InvestorsPanel({ contacts, setContacts, companyProfile, smtpConfig, addToast, onImportCRM, onResetApp }) {
  const [headers, setHeaders] = useState([])
  const [activeTab, setActiveTab] = useState('upload')
  const [revealed, setRevealed] = useState({})

  const variant = 'investor'
  const [queuedCount, setQueuedCount] = useState(0)

  const updateQueueCount = () => {
    try {
      const stored = localStorage.getItem(`outreach_queued_contacts_${variant}`)
      setQueuedCount(stored ? JSON.parse(stored).length : 0)
    } catch {
      setQueuedCount(0)
    }
  }

  useEffect(() => {
    checkAndPromoteQueuedContacts(variant, contacts, setContacts, addToast)
    updateQueueCount()
  }, [])

  const toggleReveal = (key) => {
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleContactsLoaded = (loadedContacts, loadedHeaders) => {
    setContacts(loadedContacts)
    setHeaders(loadedHeaders)
    updateQueueCount()
    if (loadedContacts.length > 0) {
      addToast(`Got it — ${loadedContacts.length} investors loaded`, 'success')
      setActiveTab('contacts')
    }
  }

  const handleForceLoadQueue = () => {
    try {
      const queueKey = `outreach_queued_contacts_${variant}`
      const rawQueue = localStorage.getItem(queueKey)
      if (!rawQueue) return
      
      const queued = JSON.parse(rawQueue)
      if (queued.length === 0) {
        addToast('No contacts in the queue.', 'warning')
        return
      }

      const toLoadCount = Math.min(queued.length, 500)
      const toLoad = queued.slice(0, toLoadCount)
      const remainingQueue = queued.slice(toLoadCount)

      localStorage.setItem(queueKey, JSON.stringify(remainingQueue))
      const updatedContacts = [...contacts, ...toLoad]
      setContacts(updatedContacts)
      
      setQueuedCount(remainingQueue.length)
      addToast(`Force loaded ${toLoadCount} contacts from queue!`, 'success')
    } catch (e) {
      console.error(e)
    }
  }

  const handleClearQueue = () => {
    if (window.confirm("Are you sure you want to clear all queued contacts? They will be permanently removed from tomorrow's rollover queue.")) {
      localStorage.removeItem(`outreach_queued_contacts_${variant}`)
      setQueuedCount(0)
      addToast('Queued contacts cleared.', 'success')
    }
  }

  const handleClearContacts = () => {
    if (window.confirm("⚠️ Clear all loaded Investor contacts?\n\nThis will remove all investor contacts from this panel. (Active CRM leads will remain).")) {
      setContacts([])
      setHeaders([])
      addToast('Investor list cleared successfully.', 'success')
    }
  }

  const emailCount = contacts.filter(c => c.email).length
  const phoneCount = contacts.filter(c => c.phone).length

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Investors</h2>
          <p>Send your pitch to potential investors — request funding, share your deck, and start conversations.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {contacts.length > 0 && (
            <button className="btn btn-sm" onClick={handleClearContacts} style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '6px 12px', fontWeight: 600 }}>
              🗑️ Clear Investor List
            </button>
          )}
          <button className="btn btn-sm btn-secondary" onClick={onResetApp} style={{ padding: '6px 12px', fontWeight: 600 }}>
            🚨 Reset App
          </button>
        </div>
      </div>

      {queuedCount > 0 && (
        <div style={{
          background: 'var(--orange-light)',
          borderLeft: '4px solid var(--orange)',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.88rem'
        }}>
          <div>
            <strong style={{ color: 'var(--orange-dark)' }}>⏳ {queuedCount.toLocaleString()} investors waiting in queue for tomorrow.</strong>
            <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: '4px' }}>
              These contacts will automatically load (up to 500/day) when a new day starts.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-secondary" onClick={handleForceLoadQueue} style={{ background: 'var(--white)', border: '1px solid var(--gray-200)' }}>
              ⚡ Load Next 500 Now
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleClearQueue} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
              ✕ Clear Queue
            </button>
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon investor">💼</div>
            <div className="stat-info">
              <h3>{contacts.length}</h3>
              <p>Investors loaded</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon success">📧</div>
            <div className="stat-info">
              <h3>{emailCount}</h3>
              <p>Have email</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon warning">📱</div>
            <div className="stat-info">
              <h3>{phoneCount}</h3>
              <p>Have phone</p>
            </div>
          </div>
        </div>
      )}

      <div className="panel-tabs">
        <button className={`panel-tab ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>
          Upload
        </button>
        <button className={`panel-tab ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => setActiveTab('contacts')}>
          Investors {contacts.length > 0 && `(${contacts.length})`}
        </button>
        <button className={`panel-tab ${activeTab === 'compose' ? 'active' : ''}`} onClick={() => setActiveTab('compose')}>
          Compose & Send
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Upload your investor list</h3>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Drop your Excel file here. We'll pick up columns like Company Name, Contact Name, Designation, Email, Website, Products Dealing, Activities — all automatically.
          </p>
          <ExcelUploader onContactsLoaded={handleContactsLoaded} variant="investor" addToast={addToast} />
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="card-title">Your investors</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {contacts.length > 0 && (
                <>
                  <span className="contact-count"><strong>{contacts.length}</strong> loaded</span>
                  <button className="btn btn-sm btn-investor" onClick={() => onImportCRM(contacts)}>Import to CRM</button>
                </>
              )}
            </div>
          </div>
          {contacts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💼</div>
              <h4>Nothing here yet</h4>
              <p>Head over to the Upload tab to bring in your investor list.</p>
            </div>
          ) : (
            <div className="contacts-table-wrapper" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <table className="contacts-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Company</th>
                    <th>Contact Person</th>
                    <th>Designation</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Website</th>
                    <th>Products / Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c, i) => (
                    <tr key={c.email ? `${c.email}_${i}` : `${c.phone || ''}_${i}`}>
                      <td>{i + 1}</td>
                      <td style={{ color: 'var(--gray-800)', fontWeight: 500 }}>{c.company || '—'}</td>
                      <td>{c.name || '—'}{c.contact2 ? `, ${c.contact2}` : ''}</td>
                      <td>{c.designation || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                          <span>{c.email ? (revealed[`${i}_email`] ? c.email : maskEmail(c.email)) : '—'}</span>
                          {c.email && (
                            <button 
                              type="button"
                              onClick={() => toggleReveal(`${i}_email`)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '0.9rem', color: 'var(--gray-400)', display: 'inline-flex', alignItems: 'center' }}
                              title={revealed[`${i}_email`] ? 'Hide' : 'Reveal'}
                            >
                              {revealed[`${i}_email`] ? '🙈' : '👁️'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                          <span>{c.phone ? (revealed[`${i}_phone`] ? c.phone : maskPhone(c.phone)) : '—'}</span>
                          {c.phone && (
                            <button 
                              type="button"
                              onClick={() => toggleReveal(`${i}_phone`)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '0.9rem', color: 'var(--gray-400)', display: 'inline-flex', alignItems: 'center' }}
                              title={revealed[`${i}_phone`] ? 'Hide' : 'Reveal'}
                            >
                              {revealed[`${i}_phone`] ? '🙈' : '👁️'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        {c.website ? (
                          <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                            target="_blank" rel="noreferrer"
                            style={{ color: 'var(--blue)', textDecoration: 'none', fontSize: '0.82rem' }}>
                            {c.website}
                          </a>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                        {c.products || c.activities || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'compose' && (
        <div className="card">
          <MessageComposer
            contacts={contacts}
            companyProfile={companyProfile}
            smtpConfig={smtpConfig}
            addToast={addToast}
            variant="investor"
          />
        </div>
      )}
    </div>
  )
}
