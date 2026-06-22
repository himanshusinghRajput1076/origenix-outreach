import { useState, useRef, useCallback } from 'react'
import API_BASE from '../config'

export default function MessageComposer({ contacts, companyProfile, smtpConfig, addToast, variant = 'investor' }) {
  const isClient = variant === 'client'
  const pollRef = useRef(null)

  const investorTemplates = {
    'Funding Request': {
      subject: 'Quick intro — {your_company}',
      body: `Hi {name},

My name is {your_name}, and I'm the founder of {your_company}. {company_description}

I noticed {company} is active in {products} and I believe there's a strong fit with what we're building.

We're raising {funding_amount} to {funding_purpose}, and I think you'd find this interesting.

A few things worth mentioning:
• {highlight_1}
• {highlight_2}
• {highlight_3}

I'd really appreciate 15 minutes of your time. Happy to work around your schedule.

Warm regards,
{your_name}
{your_company}
{your_website}
{your_email}`
    },
    'Partnership': {
      subject: 'Would love to connect — {your_company}',
      body: `Hi {name},

Hope you're doing well. I'm {your_name} from {your_company}.

{company_description}

I've been looking at {company}'s work in {products} and believe there's a natural fit. Would love to chat sometime this week if you're open to it.

Thanks for your time,
{your_name}
{your_company}
{your_website}`
    },
    'Warm Intro': {
      subject: 'Thought you might find this interesting',
      body: `Hi {name},

I'm {your_name} — I run {your_company}. {company_description}

Given {company}'s involvement in {activities}, I think there could be a meaningful connection here.

We're currently looking for {funding_amount} to {funding_purpose}. Here's what we've done so far:
• {highlight_1}
• {highlight_2}
• {highlight_3}

No pressure at all — but if this sounds like something up your alley, I'd love to have a conversation.

All the best,
{your_name}`
    }
  }

  const clientTemplates = {
    'Introduce Services': {
      subject: 'A quick hello from {your_company}',
      body: `Hi {name},

I'm {your_name} from {your_company}. I came across {company} and your work in {products}, and thought there might be a good fit here.

{company_description}

Here's what we help with:
• {service_1}
• {service_2}
• {service_3}

If any of that sounds useful, I'd love to chat. No strings attached.

Talk soon,
{your_name}
{your_company}
{your_website}
{your_email}`
    },
    'Special Offer': {
      subject: 'Something for {company} from {your_company}',
      body: `Hi {name},

Quick one from {your_company} — we're running a limited offer and given {company}'s work in {products}, I thought of you.

What we offer:
• {service_1}
• {service_2}
• {service_3}

Happy to share more details if you're interested. Just hit reply.

Cheers,
{your_name}
{your_company}`
    },
    'Follow Up': {
      subject: 'Just checking in — {your_company}',
      body: `Hi {name},

Hope you've been well. I reached out a while ago from {your_company} and wanted to follow up.

{company_description}

Would love to find a good time to connect. No rush — whenever works.

Best,
{your_name}
{your_email}`
    }
  }

  const templates = isClient ? clientTemplates : investorTemplates
  const templateNames = Object.keys(templates)

  const [activeTemplate, setActiveTemplate] = useState(templateNames[0])
  const [subject, setSubject] = useState(templates[templateNames[0]].subject)
  const [body, setBody] = useState(templates[templateNames[0]].body)
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState([])
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 })
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [waLinks, setWaLinks] = useState([])
  const [jobId, setJobId] = useState(null)

  const selectTemplate = (name) => {
    setActiveTemplate(name)
    setSubject(templates[name].subject)
    setBody(templates[name].body)
  }

  const fillCompanyVars = (text) => {
    return text
      .replace(/\{your_company\}/g, companyProfile.companyName || 'Your Company')
      .replace(/\{your_name\}/g, companyProfile.founderName || 'Your Name')
      .replace(/\{company_description\}/g, companyProfile.description || '')
      .replace(/\{your_website\}/g, companyProfile.website || '')
      .replace(/\{your_email\}/g, companyProfile.email || '')
      .replace(/\{funding_amount\}/g, companyProfile.fundingAmount || '[amount]')
      .replace(/\{funding_purpose\}/g, companyProfile.fundingPurpose || '[purpose]')
      .replace(/\{highlight_1\}/g, companyProfile.highlights?.[0] || '')
      .replace(/\{highlight_2\}/g, companyProfile.highlights?.[1] || '')
      .replace(/\{highlight_3\}/g, companyProfile.highlights?.[2] || '')
      .replace(/\{service_1\}/g, companyProfile.services?.[0] || '')
      .replace(/\{service_2\}/g, companyProfile.services?.[1] || '')
      .replace(/\{service_3\}/g, companyProfile.services?.[2] || '')
  }

  const insertVariable = (variable) => {
    setBody(prev => prev + variable)
  }

  const contactVars = ['{name}', '{company}', '{designation}', '{email}', '{products}', '{activities}', '{website}']
  const companyVars = isClient
    ? ['{your_company}', '{your_name}', '{service_1}', '{service_2}', '{service_3}']
    : ['{your_company}', '{your_name}', '{funding_amount}', '{highlight_1}', '{highlight_2}']

  // Poll job status
  const pollJobStatus = useCallback((id) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/job-status/${id}`)
        const data = await res.json()
        setProgress({ sent: data.sent, failed: data.failed, total: data.total })
        setSendResults(data.results.slice(-100)) // Show last 100 results

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollRef.current)
          pollRef.current = null
          setSending(false)
          setJobId(null)
          if (data.status === 'completed') {
            addToast(`All done — ${data.sent.toLocaleString()} sent, ${data.failed.toLocaleString()} failed.`, data.sent > 0 ? 'success' : 'error')
          } else {
            addToast('Job failed: ' + (data.error || 'Unknown error'), 'error')
          }
        }
      } catch {
        // Keep polling even if one request fails
      }
    }, 2000)
  }, [addToast])

  const handleSendEmails = async () => {
    if (!smtpConfig.email || !smtpConfig.password) {
      addToast('Set up your email credentials in Company & Settings first.', 'warning')
      return
    }
    const emailContacts = contacts.filter(c => c.email)
    if (emailContacts.length === 0) {
      addToast('None of your contacts have email addresses.', 'warning')
      return
    }

    setSending(true)
    setSendResults([])
    setProgress({ sent: 0, failed: 0, total: emailContacts.length })

    const filledSubject = fillCompanyVars(subject)
    const filledBody = fillCompanyVars(body)
    const payload = {
      contacts: emailContacts,
      subject: filledSubject,
      htmlBody: filledBody.replace(/\n/g, '<br>'),
      smtpHost: smtpConfig.host,
      smtpPort: parseInt(smtpConfig.port),
      fromEmail: smtpConfig.email,
      fromPassword: smtpConfig.password,
      attachments: companyProfile.attachments || []
    }

    // Use batch endpoint for large lists (50+), regular for small
    const useBatch = emailContacts.length > 50
    const endpoint = useBatch ? `${API_BASE}/send-emails-batch` : `${API_BASE}/send-emails`

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (useBatch && data.success) {
        // Batch mode — poll for progress
        setJobId(data.jobId)
        addToast(`Sending ${emailContacts.length.toLocaleString()} emails in background...`, 'info')
        pollJobStatus(data.jobId)
      } else if (data.success) {
        // Direct mode — results are immediate
        setSendResults(data.results)
        const sent = data.results.filter(r => r.status === 'sent').length
        const failed = data.results.filter(r => r.status === 'failed').length
        setProgress({ sent, failed, total: emailContacts.length })
        addToast(`Done — ${sent} sent, ${failed} failed.`, sent > 0 ? 'success' : 'error')
        setSending(false)
      } else {
        addToast('Something went wrong: ' + (data.error || 'Unknown error'), 'error')
        setSending(false)
      }
    } catch (err) {
      addToast('Can\'t reach the server. Is the backend running?', 'error')
      setSending(false)
    }
  }

  const handleWhatsApp = async () => {
    const phoneContacts = contacts.filter(c => c.phone)
    if (phoneContacts.length === 0) {
      addToast('None of your contacts have phone numbers.', 'warning')
      return
    }
    try {
      const filledBody = fillCompanyVars(body)
      const res = await fetch(`${API_BASE}/generate-whatsapp-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: phoneContacts, messageTemplate: filledBody })
      })
      const data = await res.json()
      if (data.success) {
        setWaLinks(data.links)
        setShowWhatsApp(true)
        addToast(`${data.links.length.toLocaleString()} WhatsApp links ready`, 'success')
      }
    } catch {
      addToast('Can\'t reach the server. Is the backend running?', 'error')
    }
  }

  const openWaLink = (link) => window.open(link, '_blank')

  const openAllWaLinks = () => {
    waLinks.forEach((item, i) => setTimeout(() => window.open(item.link, '_blank'), i * 2000))
    addToast('Opening links one by one...', 'info')
  }

  const progressPercent = progress.total > 0 ? ((progress.sent + progress.failed) / progress.total) * 100 : 0

  return (
    <div className="composer-section">
      <div className="card-header">
        <h3 className="card-title">Write your message</h3>
      </div>

      <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginBottom: '16px' }}>
        Pick a template or write your own. Tags get replaced with real data for each person.
      </p>

      <div className="template-selector">
        {templateNames.map(name => (
          <button key={name}
            className={`template-btn ${activeTemplate === name ? (isClient ? 'active client-btn' : 'active') : ''}`}
            onClick={() => selectTemplate(name)}>
            {name}
          </button>
        ))}
      </div>

      <div className="form-group">
        <label>Subject line</label>
        <input type="text" className="form-input" value={subject}
          onChange={e => setSubject(e.target.value)} placeholder="Email subject..." />
      </div>

      <div className="form-group">
        <label>Message</label>
        <textarea className="form-input" value={body}
          onChange={e => setBody(e.target.value)} placeholder="Write your message here..." />
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '8px', marginBottom: '4px' }}>
          <strong>From their Excel data:</strong>
        </p>
        <div className="variable-tags">
          {contactVars.map(v => (
            <button key={v} className="variable-tag" onClick={() => insertVariable(v)}>{v}</button>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '8px', marginBottom: '4px' }}>
          <strong>From your company profile:</strong>
        </p>
        <div className="variable-tags">
          {companyVars.map(v => (
            <button key={v} className="variable-tag" onClick={() => insertVariable(v)}>{v}</button>
          ))}
        </div>
      </div>

      <div className="btn-group">
        <button className={`btn ${isClient ? 'btn-client' : 'btn-investor'} btn-lg`}
          onClick={handleSendEmails} disabled={sending || contacts.length === 0}>
          {sending ? <><span className="spinner"></span> Sending {progress.sent + progress.failed} / {progress.total}...</> : `Send emails (${contacts.filter(c => c.email).length.toLocaleString()})`}
        </button>
        <button className="btn btn-whatsapp btn-lg" onClick={handleWhatsApp} disabled={contacts.length === 0}>
          WhatsApp links ({contacts.filter(c => c.phone).length.toLocaleString()})
        </button>
      </div>

      {/* Progress */}
      {(sending || sendResults.length > 0) && (
        <div className="progress-section">
          <hr className="section-divider" />
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-700)' }}>
            {sending ? `Sending... ${Math.round(progressPercent)}%` : `Done — ${progress.sent.toLocaleString()} sent`}
            {jobId && <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: '8px' }}>(batch mode)</span>}
          </h4>
          <div className="progress-bar-container">
            <div className={`progress-bar-fill ${isClient ? 'client' : 'investor'}`}
              style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="progress-stats">
            <span className="stat sent">✓ {progress.sent.toLocaleString()} sent</span>
            <span className="stat failed">✗ {progress.failed.toLocaleString()} failed</span>
            <span className="stat pending">… {(progress.total - progress.sent - progress.failed).toLocaleString()} remaining</span>
          </div>
          {sendResults.length > 0 && (
            <div className="send-results">
              {sendResults.slice(-50).map((result, i) => (
                <div key={i} className="result-item">
                  <div className={`result-status ${result.status === 'sent' ? 'success' : 'failed'}`} />
                  <span style={{ flex: 1 }}>{result.email}</span>
                  <span className="tag" style={result.status === 'sent'
                    ? { background: 'var(--green-light)', color: 'var(--green)' }
                    : { background: 'var(--red-light)', color: 'var(--red)' }}>
                    {result.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* WhatsApp */}
      {showWhatsApp && waLinks.length > 0 && (
        <div className="progress-section">
          <hr className="section-divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--gray-700)' }}>
              WhatsApp links ({waLinks.length.toLocaleString()})
            </h4>
            <button className="btn btn-whatsapp btn-sm" onClick={openAllWaLinks}>Open all</button>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--gray-400)', marginBottom: '12px' }}>
            Each link opens WhatsApp with your message pre-filled. Just hit send.
          </p>
          <div className="whatsapp-links">
            {waLinks.slice(0, 100).map((item, i) => (
              <div key={i} className="wa-link-item">
                <div className="wa-link-info">
                  <span className="wa-icon">💬</span>
                  <div>
                    <div className="wa-name">{item.name || 'Unknown'}</div>
                    <div className="wa-phone">{item.phone}</div>
                  </div>
                </div>
                <button className="wa-send-btn" onClick={() => openWaLink(item.link)}>Open</button>
              </div>
            ))}
            {waLinks.length > 100 && (
              <p style={{ padding: '12px', color: 'var(--gray-400)', fontSize: '0.82rem', textAlign: 'center' }}>
                Showing first 100 of {waLinks.length.toLocaleString()} links. Use "Open all" to send to everyone.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
