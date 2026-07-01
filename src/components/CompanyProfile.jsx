import { useRef, useState } from 'react'
import API_BASE from '../config'
import { saveAttachment, removeAttachmentFromDB } from '../utils/db'

export default function CompanyProfile({ profile, setProfile, smtpConfig, setSmtpConfig, smtpStatus, onCheckSmtp, onResetApp, addToast }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState(null) // { success: boolean, message: string }
  const [showGuideModal, setShowGuideModal] = useState(false)

  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  const updateHighlight = (index, value) => {
    setProfile(prev => {
      const highlights = [...prev.highlights]
      highlights[index] = value
      return { ...prev, highlights }
    })
  }

  const updateService = (index, value) => {
    setProfile(prev => {
      const services = [...prev.services]
      services[index] = value
      return { ...prev, services }
    })
  }

  const updateSmtp = (field, value) => {
    setSmtpConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    try {
      // Save file to IndexedDB locally
      await saveAttachment(file.name, file)
      
      setProfile(prev => ({
        ...prev,
        attachments: [...prev.attachments, file.name]
      }))
      addToast(`Attached: ${file.name}`, 'success')
    } catch (err) {
      console.error(err)
      addToast('Couldn\'t save attachment to browser database.', 'error')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeAttachment = async (index) => {
    const filename = profile.attachments[index]
    try {
      await removeAttachmentFromDB(filename)
    } catch (err) {
      console.error('Error removing from DB:', err)
    }
    setProfile(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const handleSave = () => {
    try {
      localStorage.setItem('outreach_company_profile', JSON.stringify(profile))
      localStorage.setItem('outreach_smtp_config', JSON.stringify(smtpConfig))
      addToast('Settings saved successfully!', 'success')
    } catch (err) {
      addToast('Failed to save settings to browser.', 'error')
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setTestResult(null)
    try {
      const res = await fetch(`${API_BASE}/test-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEmail: smtpConfig.email,
          fromPassword: smtpConfig.password,
          smtpHost: smtpConfig.host,
          smtpPort: smtpConfig.port
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message || 'SMTP login successful! Your settings are correct.' })
        addToast('SMTP test connection successful!', 'success')
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' })
        addToast('SMTP test connection failed.', 'error')
      }
    } catch (err) {
      setTestResult({ success: false, message: 'Could not connect to the backend server. Please verify the server is running.' })
      addToast('SMTP test connection error.', 'error')
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Company & Settings</h2>
        <p>Fill this in once and it'll show up in all your message templates automatically.</p>
      </div>

      {/* Company basics */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">About your company</h3>
        </div>
        <div className="profile-grid">
          <div className="form-group">
            <label>Company name</label>
            <input type="text" className="form-input" value={profile.companyName}
              onChange={e => updateField('companyName', e.target.value)}
              placeholder="e.g., Acme Solutions" />
          </div>
          <div className="form-group">
            <label>Your name</label>
            <input type="text" className="form-input" value={profile.founderName}
              onChange={e => updateField('founderName', e.target.value)}
              placeholder="e.g., Rahul Sharma" />
          </div>
          <div className="form-group">
            <label>Website</label>
            <input type="text" className="form-input" value={profile.website}
              onChange={e => updateField('website', e.target.value)}
              placeholder="e.g., https://acme.com" />
          </div>
          <div className="form-group">
            <label>Contact email</label>
            <input type="email" className="form-input" value={profile.email}
              onChange={e => updateField('email', e.target.value)}
              placeholder="e.g., hello@acme.com" />
          </div>
          <div className="form-group full-width">
            <label>What does your company do? (one or two lines)</label>
            <textarea className="form-input" value={profile.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="We help small businesses manage their finances with a simple app..."
              style={{ minHeight: '80px' }} />
          </div>
        </div>
      </div>

      {/* Funding details */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">Funding details (for investor emails)</h3>
        </div>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', marginBottom: '16px' }}>
          These fill in the {'{funding_amount}'}, {'{funding_purpose}'}, and {'{highlight}'} tags in your investor templates.
        </p>
        <div className="profile-grid">
          <div className="form-group">
            <label>How much are you raising?</label>
            <input type="text" className="form-input" value={profile.fundingAmount}
              onChange={e => updateField('fundingAmount', e.target.value)}
              placeholder="e.g., $500K or ₹2 Crore" />
          </div>
          <div className="form-group">
            <label>What will the funding be used for?</label>
            <input type="text" className="form-input" value={profile.fundingPurpose}
              onChange={e => updateField('fundingPurpose', e.target.value)}
              placeholder="e.g., hire engineers and expand to 3 new cities" />
          </div>
          <div className="form-group full-width">
            <label>Highlights (things investors should know)</label>
            {profile.highlights.map((h, i) => (
              <input key={i} type="text" className="form-input" value={h}
                onChange={e => updateHighlight(i, e.target.value)}
                placeholder={i === 0 ? 'e.g., 10,000 active users' : i === 1 ? 'e.g., 3x growth this year' : 'e.g., Team of 15 engineers'}
                style={{ marginBottom: i < 2 ? '8px' : 0 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">Your services (for client emails)</h3>
        </div>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', marginBottom: '16px' }}>
          These fill in the {'{service_1}'}, {'{service_2}'}, and {'{service_3}'} tags in your client templates.
        </p>
        <div className="form-group">
          {profile.services.map((s, i) => (
            <input key={i} type="text" className="form-input" value={s}
              onChange={e => updateService(i, e.target.value)}
              placeholder={i === 0 ? 'e.g., Web & App Development' : i === 1 ? 'e.g., Digital Marketing' : 'e.g., Cloud Hosting & Support'}
              style={{ marginBottom: i < 2 ? '8px' : 0 }} />
          ))}
        </div>
      </div>

      {/* Attachments */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">Attachments</h3>
        </div>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', marginBottom: '16px' }}>
          Upload your pitch deck, brochure, or any document you want to attach to your emails.
        </p>
        <button className="btn btn-outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <><span className="spinner"></span> Uploading...</> : 'Upload a file'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          style={{ display: 'none' }} onChange={handleAttachmentUpload} />
        {profile.attachments.length > 0 && (
          <div className="attachment-list">
            {profile.attachments.map((att, i) => (
              <div key={i} className="attachment-item">
                <span className="att-icon">📄</span>
                <span>{att}</span>
                <button className="remove-att" onClick={() => removeAttachment(i)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SMTP */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">Email settings</h3>
        </div>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', marginBottom: '16px' }}>
          Your email credentials for sending. These are only used locally and never stored anywhere else.
        </p>
        <div className="smtp-config">
          <div className="form-group">
            <label>SMTP server</label>
            <input type="text" className="form-input" value={smtpConfig.host}
              onChange={e => updateSmtp('host', e.target.value)} placeholder="smtp.gmail.com" />
          </div>
          <div className="form-group">
            <label>Port</label>
            <input type="text" className="form-input" value={smtpConfig.port}
              onChange={e => updateSmtp('port', e.target.value)} placeholder="587" />
          </div>
          <div className="form-group">
            <label>Your email address</label>
            <input type="email" className="form-input" value={smtpConfig.email}
              onChange={e => updateSmtp('email', e.target.value)} placeholder="you@gmail.com"
              autoComplete="off" />
          </div>
          <div className="form-group">
            <label>App password</label>
            <input type="password" className="form-input" value={smtpConfig.password}
              onChange={e => updateSmtp('password', e.target.value)} placeholder="••••••••••••"
              autoComplete="new-password" />
          </div>
        </div>
        <div style={{ marginTop: '12px', padding: '12px 16px', background: 'var(--blue-light)', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--gray-600)' }}>
            <strong>Using Gmail?</strong> You'll need an App Password, not your regular one.
            Turn on 2-Step Verification, then create one at{' '}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer"
              style={{ color: 'var(--blue)' }}>
              myaccount.google.com/apppasswords
            </a>
            {' '}or{' '}
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              style={{ background: 'none', border: 'none', color: 'var(--blue)', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
              read our step-by-step guide
            </button>.
          </p>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleTestConnection}
            disabled={testingConnection}
            style={{ minWidth: '160px' }}
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>
          {testResult && (
            <div style={{
              fontSize: '0.85rem',
              color: testResult.success ? 'var(--green)' : 'var(--red)',
              fontWeight: 600,
              padding: '8px 14px',
              borderRadius: '8px',
              background: testResult.success ? 'var(--green-light)' : 'var(--red-light)',
              border: `1px solid ${testResult.success ? 'var(--green-soft)' : 'var(--red)'}`,
              flex: '1 1 300px'
            }}>
              {testResult.success ? '✓ ' : '✗ '} {testResult.message}
              {!testResult.success && smtpConfig.email.includes('gmail.com') && (
                <div style={{ marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--blue)', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit', fontWeight: 'bold' }}
                  >
                    Click here to open the Gmail App Password helper guide
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ marginBottom: '24px', border: '1px solid #fecaca', background: '#fff5f5' }}>
        <div className="card-header" style={{ borderBottom: '1px solid #fee2e2' }}>
          <h3 className="card-title" style={{ color: 'var(--red)', margin: 0 }}>🚨 Danger Zone</h3>
        </div>
        <div style={{ padding: '16px' }}>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.85rem', marginBottom: '12px' }}>
            Wipe all local outreach configurations, contact active lists, rollover queue lists, and connections logs. This action cannot be undone.
          </p>
          <button className="btn" onClick={onResetApp} style={{ background: 'var(--red)', color: 'var(--white)', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
            Reset Application Data
          </button>
        </div>
      </div>

      <div className="btn-group">
        <button className="btn btn-investor btn-lg" onClick={handleSave}>
          Save everything
        </button>
      </div>

      {/* Guide Modal */}
      {showGuideModal && (
        <div className="modal-backdrop" onClick={() => setShowGuideModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>How to Create a Gmail App Password 🔑</h3>
              <button className="modal-close" onClick={() => setShowGuideModal(false)}>×</button>
            </div>
            <div style={{ padding: '16px 0', fontSize: '0.88rem', lineHeight: '1.5', color: 'var(--gray-700)' }}>
              <p style={{ marginBottom: '12px' }}>
                Gmail does not allow third-party apps to send emails using your main password. You must generate a secure 16-character <strong>App Password</strong>.
              </p>
              <ol style={{ paddingLeft: '20px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  Go to <a href="https://myaccount.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>Google Account Settings</a>.
                </li>
                <li>
                  Go to the <strong>Security</strong> tab.
                </li>
                <li>
                  Ensure <strong>2-Step Verification</strong> is enabled. (This is required by Google).
                </li>
                <li>
                  Click on <strong>2-Step Verification</strong>, scroll to the bottom, and select <strong>App passwords</strong>.
                </li>
                <li>
                  Choose a name (e.g. <code>Origenix Outreach</code>) and click <strong>Create</strong>.
                </li>
                <li>
                  Copy the <strong>16-character password</strong> inside the yellow box.
                </li>
                <li>
                  Paste it into the <strong>App password</strong> field in settings.
                </li>
              </ol>
              <div style={{ background: 'var(--blue-light)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid var(--blue)', color: 'var(--gray-600)', fontSize: '0.82rem' }}>
                Note: Spaces are not part of the password; you can type or paste the code as one continuous string.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--gray-100)', paddingTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowGuideModal(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
