export default function Dashboard({ clientContacts, investorContacts, leadsCount = 0, onNavigate }) {
  const clientEmails = clientContacts.filter(c => c.email).length
  const investorEmails = investorContacts.filter(c => c.email).length
  const clientPhones = clientContacts.filter(c => c.phone).length
  const investorPhones = investorContacts.filter(c => c.phone).length

  return (
    <div>
      <div className="page-header">
        <h2>Hey there 👋</h2>
        <p>Here's a quick look at your outreach so far.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon client">🤝</div>
          <div className="stat-info">
            <h3>{clientContacts.length}</h3>
            <p>Clients</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon investor">💼</div>
          <div className="stat-info">
            <h3>{investorContacts.length}</h3>
            <p>Investors</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success">📧</div>
          <div className="stat-info">
            <h3>{clientEmails + investorEmails}</h3>
            <p>Emails ready</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">📱</div>
          <div className="stat-info">
            <h3>{clientPhones + investorPhones}</h3>
            <p>Phone numbers</p>
          </div>
        </div>
      </div>

      <div className="two-col-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🤝 Clients</h3>
            <span className="tag tag-client">{clientContacts.length}</span>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Reach out to potential clients about your services. Upload your contact list, write your message, and send.
          </p>
          {clientContacts.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No contacts yet — start by uploading an Excel file.
            </p>
          ) : (
            <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>
              {clientEmails} email{clientEmails !== 1 ? 's' : ''}, {clientPhones} phone number{clientPhones !== 1 ? 's' : ''}
            </p>
          )}
          <div className="btn-group">
            <button className="btn btn-client" onClick={() => onNavigate('clients')}>
              Go to Clients →
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">💼 Investors</h3>
            <span className="tag tag-investor">{investorContacts.length}</span>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Send your pitch to investors. Upload contacts, pick a template, attach your deck, and reach out.
          </p>
          {investorContacts.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No contacts yet — start by uploading an Excel file.
            </p>
          ) : (
            <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>
              {investorEmails} email{investorEmails !== 1 ? 's' : ''}, {investorPhones} phone number{investorPhones !== 1 ? 's' : ''}
            </p>
          )}
          <div className="btn-group">
            <button className="btn btn-investor" onClick={() => onNavigate('investors')}>
              Go to Investors →
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">📊 Leads CRM Pipeline</h3>
          <span className="tag" style={{ background: 'var(--blue-light)', color: 'var(--blue)', fontWeight: 600 }}>{leadsCount.toLocaleString()} Active Leads</span>
        </div>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Track deal/investment stages, log phone/chat timelines, set follow-up tasks, and view contact statistics.
        </p>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => onNavigate('crm')}>
            Open CRM Board →
          </button>
        </div>
      </div>

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
