import { useState } from 'react'
import ExcelUploader from './ExcelUploader'
import MessageComposer from './MessageComposer'

export default function ClientsPanel({ contacts, setContacts, companyProfile, smtpConfig, addToast, onImportCRM }) {
  const [headers, setHeaders] = useState([])
  const [activeTab, setActiveTab] = useState('upload')

  const handleContactsLoaded = (loadedContacts, loadedHeaders) => {
    setContacts(loadedContacts)
    setHeaders(loadedHeaders)
    if (loadedContacts.length > 0) {
      addToast(`Got it — ${loadedContacts.length} contacts loaded`, 'success')
      setActiveTab('contacts')
    }
  }

  const emailCount = contacts.filter(c => c.email).length
  const phoneCount = contacts.filter(c => c.phone).length

  return (
    <div>
      <div className="page-header">
        <h2>Clients</h2>
        <p>Reach out to potential clients about your services and what you can do for them.</p>
      </div>

      {contacts.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon client">👥</div>
            <div className="stat-info">
              <h3>{contacts.length}</h3>
              <p>Contacts loaded</p>
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
          Contacts {contacts.length > 0 && `(${contacts.length})`}
        </button>
        <button className={`panel-tab ${activeTab === 'compose' ? 'active' : ''}`} onClick={() => setActiveTab('compose')}>
          Compose & Send
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Upload your client list</h3>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Drop your Excel file here. We'll pick up columns like Company Name, Contact Name, Designation, Email, Website, Products Dealing, Activities — all automatically.
          </p>
          <ExcelUploader onContactsLoaded={handleContactsLoaded} variant="client" addToast={addToast} />
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="card-title">Your contacts</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {contacts.length > 0 && (
                <>
                  <span className="contact-count"><strong>{contacts.length}</strong> loaded</span>
                  <button className="btn btn-sm btn-client" onClick={() => onImportCRM(contacts)}>Import to CRM</button>
                </>
              )}
            </div>
          </div>
          {contacts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h4>Nothing here yet</h4>
              <p>Head over to the Upload tab to bring in your client list.</p>
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
                      <td>{c.email || '—'}</td>
                      <td>{c.phone || '—'}</td>
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
            variant="client"
          />
        </div>
      )}
    </div>
  )
}
