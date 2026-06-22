import { useRef, useState } from 'react'
import API_BASE from '../config'

export default function CompanyProfile({ profile, setProfile, smtpConfig, setSmtpConfig, addToast }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

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
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE}/upload-attachment`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setProfile(prev => ({
          ...prev,
          attachments: [...prev.attachments, data.filename]
        }))
        addToast(`Attached: ${file.name}`, 'success')
      }
    } catch (err) {
      addToast('Couldn\'t upload — is the server running?', 'error')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeAttachment = (index) => {
    setProfile(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const handleSave = () => {
    addToast('Saved!', 'success')
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
              onChange={e => updateSmtp('email', e.target.value)} placeholder="you@gmail.com" />
          </div>
          <div className="form-group">
            <label>App password</label>
            <input type="password" className="form-input" value={smtpConfig.password}
              onChange={e => updateSmtp('password', e.target.value)} placeholder="••••••••••••" />
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
          </p>
        </div>
      </div>

      <div className="btn-group">
        <button className="btn btn-investor btn-lg" onClick={handleSave}>
          Save everything
        </button>
      </div>
    </div>
  )
}
