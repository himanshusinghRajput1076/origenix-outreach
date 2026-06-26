import { useState, useRef, useCallback, useEffect } from 'react'
import API_BASE from '../config'
import { getAttachment } from '../utils/db'

export default function MessageComposer({ contacts, companyProfile, smtpConfig, addToast, variant = 'investor' }) {
  const isClient = variant === 'client'
  const pollRef = useRef(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
      }
    }
  }, [])

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
  const [jobStatus, setJobStatus] = useState(null)
  const [sendSpeed, setSendSpeed] = useState('gmail')
  const [customConcurrency, setCustomConcurrency] = useState(5)
  const [customDelay, setCustomDelay] = useState(0)
  const [previewIndex, setPreviewIndex] = useState(0)

  const selectTemplate = (name) => {
    setActiveTemplate(name)
    setSubject(templates[name].subject)
    setBody(templates[name].body)
  }

  const fillCompanyVars = (text) => {
    const companyKeys = {
      companyname: companyProfile.companyName || 'Your Company',
      yourcompany: companyProfile.companyName || 'Your Company',
      foundername: companyProfile.founderName || 'Your Name',
      yourname: companyProfile.founderName || 'Your Name',
      description: companyProfile.description || '',
      companydescription: companyProfile.description || '',
      website: companyProfile.website || '',
      yourwebsite: companyProfile.website || '',
      email: companyProfile.email || '',
      youremail: companyProfile.email || '',
      fundingamount: companyProfile.fundingAmount || '[amount]',
      fundingpurpose: companyProfile.fundingPurpose || '[purpose]',
      highlight1: companyProfile.highlights?.[0] || '',
      highlight2: companyProfile.highlights?.[1] || '',
      highlight3: companyProfile.highlights?.[2] || '',
      service1: companyProfile.services?.[0] || '',
      service2: companyProfile.services?.[1] || '',
      service3: companyProfile.services?.[2] || ''
    }

    return text.replace(/\{([^{}]+)\}/g, (match, key) => {
      const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]/g, "")
      if (companyKeys[normalizedKey] !== undefined) {
        return companyKeys[normalizedKey]
      }
      return match // leave contact variables untouched
    })
  }

  const fillContactVars = (text, contact) => {
    if (!contact) return text
    return text.replace(/\{([^{}]+)\}/g, (match, key) => {
      const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]/g, "")
      for (const contactKey of Object.keys(contact)) {
        if (contactKey.toLowerCase().replace(/[\s_-]/g, "") === normalizedKey) {
          return contact[contactKey] ?? ""
        }
      }
      if (/^[a-zA-Z0-9\s_-]+$/.test(key)) {
        return ""
      }
      return match
    })
  }

  const insertVariable = (variable) => {
    setBody(prev => prev + variable)
  }

  const contactVars = ['{name}', '{company}', '{designation}', '{email}', '{products}', '{activities}', '{website}']
  const companyVars = isClient
    ? ['{your_company}', '{your_name}', '{service_1}', '{service_2}', '{service_3}']
    : ['{your_company}', '{your_name}', '{funding_amount}', '{highlight_1}', '{highlight_2}']

  // Helper to fetch all attachments from IndexedDB
  const loadAttachmentsForSend = async (attachmentNames) => {
    const result = []
    for (const name of attachmentNames) {
      try {
        const att = await getAttachment(name)
        if (att) {
          result.push({
            filename: att.name,
            content: att.base64,
            contentType: att.type
          })
        }
      } catch (err) {
        console.error(`Failed to load attachment ${name} from IndexedDB:`, err)
      }
    }
    return result
  }

  // Client-side campaign execution loop
  const runCampaignLoop = useCallback(async (currentCampaignState) => {
    let {
      contacts: campaignContacts,
      currentIndex,
      results,
      progress: currentProgress,
      subject: campaignSubject,
      body: campaignBody,
      smtpConfig: campaignSmtp,
      sendSpeed: campaignSpeed,
      attachments: campaignAttachments
    } = currentCampaignState

    if (currentIndex >= campaignContacts.length) {
      // Completed!
      setSending(false)
      setJobStatus('completed')
      localStorage.removeItem('active_outreach_campaign')
      addToast(`All done — ${currentProgress.sent.toLocaleString()} sent, ${currentProgress.failed.toLocaleString()} failed.`, currentProgress.sent > 0 ? 'success' : 'error')
      return
    }

    // Determine concurrency and delay based on speed setting
    let concurrency = 1
    let delayBetweenMs = 4000
    if (campaignSpeed === 'standard') {
      concurrency = 3
      delayBetweenMs = 1500
    } else if (campaignSpeed === 'turbo') {
      concurrency = 5
      delayBetweenMs = 0
    } else if (campaignSpeed === 'custom') {
      concurrency = currentCampaignState.customConcurrency || 5
      delayBetweenMs = currentCampaignState.customDelay !== undefined ? currentCampaignState.customDelay : 0
    }

    // Get the next batch of contacts
    const batch = campaignContacts.slice(currentIndex, currentIndex + concurrency)
    
    // Prepare API request payload
    const payload = {
      contacts: batch,
      subject: campaignSubject,
      htmlBody: campaignBody,
      smtpHost: campaignSmtp.host,
      smtpPort: parseInt(campaignSmtp.port),
      fromEmail: campaignSmtp.email,
      fromPassword: campaignSmtp.password,
      attachments: campaignAttachments,
      concurrency,
      delayBetweenMs
    }

    try {
      const res = await fetch(`${API_BASE}/send-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (data.success && data.results) {
        const nextResults = [...results, ...data.results]
        const nextSent = nextResults.filter(r => r.status === 'sent').length
        const nextFailed = nextResults.filter(r => r.status === 'failed').length
        const nextIndex = currentIndex + batch.length
        const nextProgress = { sent: nextSent, failed: nextFailed, total: campaignContacts.length }

        setSendResults(nextResults)
        setProgress(nextProgress)

        const nextState = {
          ...currentCampaignState,
          currentIndex: nextIndex,
          results: nextResults,
          progress: nextProgress
        }

        // Save progress to localStorage
        localStorage.setItem('active_outreach_campaign', JSON.stringify(nextState))

        // Schedule next chunk if still running
        pollRef.current = setTimeout(() => {
          const savedCampaign = localStorage.getItem('active_outreach_campaign')
          if (savedCampaign) {
            const parsed = JSON.parse(savedCampaign)
            if (parsed.status === 'running') {
              runCampaignLoop(parsed)
            }
          }
        }, delayBetweenMs)
      } else {
        // Severe error (e.g. SMTP invalid credentials or server error)
        addToast(data.error || 'SMTP Connection or server error occurred during sending.', 'error')
        
        // Pause the campaign
        const nextState = { ...currentCampaignState, status: 'paused' }
        localStorage.setItem('active_outreach_campaign', JSON.stringify(nextState))
        setSending(false)
        setJobStatus('paused')
      }
    } catch (err) {
      console.error(err)
      addToast('Can\'t reach the backend server. Pausing campaign.', 'error')
      
      // Pause the campaign
      const nextState = { ...currentCampaignState, status: 'paused' }
      localStorage.setItem('active_outreach_campaign', JSON.stringify(nextState))
      setSending(false)
      setJobStatus('paused')
    }
  }, [addToast])

  // Recover active campaign from localStorage on mount
  useEffect(() => {
    const savedCampaign = localStorage.getItem('active_outreach_campaign')
    if (savedCampaign) {
      const parsed = JSON.parse(savedCampaign)
      setJobId('local_campaign')
      setJobStatus(parsed.status)
      setProgress(parsed.progress)
      setSendResults(parsed.results)
      setSendSpeed(parsed.sendSpeed || 'gmail')
      if (parsed.customConcurrency) setCustomConcurrency(parsed.customConcurrency)
      if (parsed.customDelay !== undefined) setCustomDelay(parsed.customDelay)
      
      if (parsed.status === 'running') {
        setSending(true)
        runCampaignLoop(parsed)
      }
    }
  }, [runCampaignLoop])

  const handlePauseCampaign = () => {
    const savedCampaign = localStorage.getItem('active_outreach_campaign')
    if (savedCampaign) {
      const parsed = JSON.parse(savedCampaign)
      parsed.status = 'paused'
      localStorage.setItem('active_outreach_campaign', JSON.stringify(parsed))
    }
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
    setSending(false)
    setJobStatus('paused')
    addToast('Campaign paused.', 'info')
  }

  const handleCancelCampaign = () => {
    if (!window.confirm('Are you sure you want to cancel this campaign? Any unsent emails will not be sent.')) return
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
    localStorage.removeItem('active_outreach_campaign')
    setSending(false)
    setJobStatus('cancelled')
    addToast('Campaign cancelled.', 'info')
  }

  const handleResumeCampaign = async () => {
    if (!smtpConfig.email || !smtpConfig.password) {
      addToast('Set up your email credentials in Company & Settings first.', 'warning')
      return
    }
    const savedCampaign = localStorage.getItem('active_outreach_campaign')
    if (savedCampaign) {
      const parsed = JSON.parse(savedCampaign)
      parsed.status = 'running'
      parsed.smtpConfig = smtpConfig // Update credentials if they changed
      parsed.sendSpeed = sendSpeed // Update speed selection
      parsed.customConcurrency = customConcurrency
      parsed.customDelay = customDelay
      
      localStorage.setItem('active_outreach_campaign', JSON.stringify(parsed))
      setSending(true)
      setJobStatus('running')
      addToast('Resuming campaign...', 'info')
      runCampaignLoop(parsed)
    }
  }

  const downloadFailuresCSV = () => {
    const failedResults = sendResults.filter(r => r.status === 'failed')
    if (failedResults.length === 0) return

    const errorMap = {}
    failedResults.forEach(r => {
      if (r.email) {
        errorMap[r.email.toLowerCase().trim()] = r.error || 'Unknown error'
      }
    })

    const failedContacts = contacts.filter(c => c.email && errorMap[c.email.toLowerCase().trim()] !== undefined)

    let csvContent = ""
    if (failedContacts.length > 0) {
      const headers = [...Object.keys(failedContacts[0]), "Error Reason"]
      let csvRows = [headers.map(h => `"${h.replace(/'/g, "''").replace(/"/g, '""')}"`).join(",")]
      failedContacts.forEach(c => {
        const emailKey = c.email.toLowerCase().trim()
        const errorReason = errorMap[emailKey] || ''
        const row = headers.map(h => {
          if (h === "Error Reason") {
            return `"${errorReason.replace(/"/g, '""')}"`
          }
          const val = c[h] ?? ''
          return `"${String(val).replace(/"/g, '""')}"`
        })
        csvRows.push(row.join(","))
      })
      csvContent = csvRows.join("\n")
    } else {
      let csvRows = [["Email", "Error Reason"].join(",")]
      failedResults.forEach(r => {
        csvRows.push(`"${(r.email || '').replace(/"/g, '""')}","${(r.error || 'Unknown error').replace(/"/g, '""')}"`)
      })
      csvContent = csvRows.join("\n")
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `failed_contacts_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
    setJobStatus('running')
    setProgress({ sent: 0, failed: 0, total: emailContacts.length })
    addToast('Preparing campaign...', 'info')

    // Load base64 attachment buffers from IndexedDB
    const base64Attachments = await loadAttachmentsForSend(companyProfile.attachments || [])

    const filledSubject = fillCompanyVars(subject)
    const filledBody = fillCompanyVars(body)
    
    // Add unique internal index to identify contacts in callback
    const contactsWithId = emailContacts.map((c, idx) => ({ ...c, __idx: idx }))

    const campaignState = {
      contacts: contactsWithId,
      currentIndex: 0,
      results: [],
      progress: { sent: 0, failed: 0, total: emailContacts.length },
      subject: filledSubject,
      body: filledBody.replace(/\n/g, '<br>'),
      smtpConfig,
      sendSpeed,
      customConcurrency,
      customDelay,
      attachments: base64Attachments,
      status: 'running'
    }

    setJobId('local_campaign')
    localStorage.setItem('active_outreach_campaign', JSON.stringify(campaignState))

    runCampaignLoop(campaignState)
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

  const emailContacts = contacts.filter(c => c.email)
  const currentPreviewContact = emailContacts[previewIndex] || null

  const previewSubject = currentPreviewContact
    ? fillContactVars(fillCompanyVars(subject), currentPreviewContact)
    : fillCompanyVars(subject)

  const previewBody = currentPreviewContact
    ? fillContactVars(fillCompanyVars(body), currentPreviewContact)
    : fillCompanyVars(body)

  const handlePrevPreview = () => {
    if (emailContacts.length === 0) return
    setPreviewIndex(prev => (prev > 0 ? prev - 1 : emailContacts.length - 1))
  }

  const handleNextPreview = () => {
    if (emailContacts.length === 0) return
    setPreviewIndex(prev => (prev < emailContacts.length - 1 ? prev + 1 : 0))
  }

  return (
    <div style={emailContacts.length > 0 ? { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' } : {}}>
      {/* Left Pane: Composer Form */}
      <div className="composer-section" style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '24px' }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--gray-100)', paddingBottom: '12px', marginBottom: '16px' }}>
          <h3 className="card-title">✍️ Compose outreach message</h3>
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
            onChange={e => setBody(e.target.value)} placeholder="Write your message here..." style={{ minHeight: '180px' }} />
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

        {smtpConfig.host === 'smtp.gmail.com' && emailContacts.length > 500 && (
          <div style={{
            background: 'var(--orange-light)',
            borderLeft: '4px solid var(--orange)',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: 'var(--gray-700)',
            marginTop: '16px',
            marginBottom: '16px',
            lineHeight: '1.4'
          }}>
            <strong>⚠️ Gmail Sending Limit Warning:</strong> You are trying to send to {emailContacts.length.toLocaleString()} emails. Free Gmail accounts have a strict limit of <strong>500 emails per 24 hours</strong> (Workspace limits are 2000). Exceeding this can trigger Google account suspensions. Consider splitting your lists or using professional SMTP services like SendGrid.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px', marginBottom: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gray-600)' }}>Sending Speed / Mode</label>
            <select
              className="form-input"
              value={sendSpeed}
              onChange={e => setSendSpeed(e.target.value)}
              disabled={sending}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="gmail">Safe Mode (Gmail) — 1 email / 4s</option>
              <option value="standard">Standard Mode — ~2 emails / second</option>
              <option value="turbo">Turbo Mode (SMTP Relays) — High-speed parallel</option>
              <option value="custom">Custom Speed Settings...</option>
            </select>
          </div>
        </div>

        {sendSpeed === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '4px', marginBottom: '16px', padding: '16px', background: 'var(--gray-50)', borderRadius: '12px', border: '1px solid var(--gray-200)' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '6px', display: 'block' }}>Parallel Connections (1-20)</label>
              <input
                type="number"
                min="1"
                max="20"
                className="form-input"
                value={customConcurrency}
                onChange={e => setCustomConcurrency(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                disabled={sending}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '6px', display: 'block' }}>Delay between sends (ms)</label>
              <input
                type="number"
                min="0"
                max="10000"
                className="form-input"
                value={customDelay}
                onChange={e => setCustomDelay(Math.max(0, parseInt(e.target.value) || 0))}
                disabled={sending}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>
        )}

        <div className="btn-group">
          <button className={`btn ${isClient ? 'btn-client' : 'btn-investor'} btn-lg`}
            onClick={handleSendEmails} disabled={sending || contacts.length === 0}>
            {sending ? <><span className="spinner"></span> Sending {progress.sent + progress.failed} / {progress.total}...</> : `Send emails (${emailContacts.length.toLocaleString()})`}
          </button>
          <button className="btn btn-whatsapp btn-lg" onClick={handleWhatsApp} disabled={contacts.length === 0}>
            WhatsApp links ({contacts.filter(c => c.phone).length.toLocaleString()})
          </button>
        </div>

        {/* Progress */}
        {(sending || sendResults.length > 0 || (jobId && jobStatus && jobStatus !== 'completed')) && (
          <div className="progress-section">
            <hr className="section-divider" />
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-700)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                {jobStatus === 'running' && `⚡ Sending Campaign... ${Math.round(progressPercent)}%`}
                {jobStatus === 'paused' && `⏸️ Campaign Paused (${Math.round(progressPercent)}%)`}
                {jobStatus === 'interrupted' && `⚠️ Campaign Interrupted (${Math.round(progressPercent)}%)`}
                {jobStatus === 'failed' && `❌ Campaign Failed`}
                {jobStatus === 'cancelled' && `🛑 Campaign Cancelled`}
                {(!jobStatus || jobStatus === 'completed') && `✅ Campaign Completed — ${progress.sent.toLocaleString()} sent`}
                {jobId && <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: '8px' }}>(batch mode)</span>}
              </span>
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

            {jobId && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px', marginBottom: '16px' }}>
                {jobStatus === 'running' && (
                  <button className="btn btn-secondary btn-sm" onClick={handlePauseCampaign} style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
                    ⏸️ Pause Campaign
                  </button>
                )}
                {(jobStatus === 'paused' || jobStatus === 'interrupted' || jobStatus === 'failed') && (
                  <button className="btn btn-secondary btn-sm" onClick={handleResumeCampaign} style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
                    ▶️ Resume Campaign
                  </button>
                )}
                {(jobStatus === 'running' || jobStatus === 'paused' || jobStatus === 'interrupted') && (
                  <button className="btn btn-secondary btn-sm" onClick={handleCancelCampaign} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
                    🛑 Cancel Campaign
                  </button>
                )}
                {sendResults.some(r => r.status === 'failed') && (
                  <button className="btn btn-secondary btn-sm" onClick={downloadFailuresCSV} style={{ marginLeft: 'auto', background: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
                    📥 Download Failures
                  </button>
                )}
              </div>
            )}

            {sendResults.length > 0 && (
              <div className="send-results" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: '8px', padding: '8px', marginTop: '12px' }}>
                {sendResults.slice(-100).map((result, i) => (
                  <div key={i} className="result-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px', borderBottom: '1px solid var(--gray-100)', padding: '8px 4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className={`result-status ${result.status === 'sent' ? 'success' : 'failed'}`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: result.status === 'sent' ? 'var(--green)' : 'var(--red)' }} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--gray-700)', wordBreak: 'break-all' }}>{result.email}</span>
                      </div>
                      <span className="tag" style={result.status === 'sent'
                        ? { background: 'var(--green-light)', color: 'var(--green)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }
                        : { background: 'var(--red-light)', color: 'var(--red)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                        {result.status}
                      </span>
                    </div>
                    {result.error && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--red)', marginLeft: '16px', wordBreak: 'break-all' }}>
                        ⚠️ {result.error}
                      </div>
                    )}
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

      {/* Right Pane: Interactive Live Email Preview */}
      {emailContacts.length > 0 && currentPreviewContact && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '24px', position: 'sticky', top: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-100)', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--gray-800)' }}>🔍 Live Email Preview</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrevPreview} style={{ padding: '4px 8px' }}>◀</button>
              <span style={{ fontSize: '0.82rem', color: 'var(--gray-500)', fontWeight: 500 }}>
                {previewIndex + 1} / {emailContacts.length}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleNextPreview} style={{ padding: '4px 8px' }}>▶</button>
            </div>
          </div>

          <div style={{ border: '1px solid var(--gray-100)', borderRadius: '8px', padding: '16px', background: 'var(--gray-50)', minHeight: '350px', fontSize: '0.85rem' }}>
            <div style={{ borderBottom: '1px solid var(--gray-200)', paddingBottom: '12px', marginBottom: '12px' }}>
              <div style={{ marginBottom: '6px', color: 'var(--gray-600)' }}>
                <strong>To:</strong> {currentPreviewContact.name || 'Unknown'} 
                {currentPreviewContact.email ? ` <${currentPreviewContact.email}>` : ''}
                {currentPreviewContact.designation && ` — ${currentPreviewContact.designation}`}
                {currentPreviewContact.company && ` @ ${currentPreviewContact.company}`}
              </div>
              <div style={{ color: 'var(--gray-800)', fontWeight: 600 }}>
                <strong>Subject:</strong> {previewSubject}
              </div>
            </div>
            
            <div style={{ 
              whiteSpace: 'pre-wrap', 
              color: 'var(--gray-700)', 
              lineHeight: '1.5', 
              maxHeight: '260px', 
              overflowY: 'auto',
              paddingRight: '6px'
            }}>
              {previewBody}
            </div>

            {companyProfile.attachments && companyProfile.attachments.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px dotted var(--gray-200)' }}>
                <strong style={{ display: 'block', fontSize: '0.78rem', color: 'var(--gray-500)', marginBottom: '6px' }}>
                  Attachments ({companyProfile.attachments.length}):
                </strong>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {companyProfile.attachments.map((file, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      background: 'var(--white)', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      border: '1px solid var(--gray-200)',
                      fontSize: '0.75rem',
                      color: 'var(--gray-600)'
                    }}>
                      <span>📎</span>
                      <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--blue-light)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--gray-600)' }}>
            💡 <strong>Pro Tip:</strong> Click the ◀ and ▶ buttons at the top right to verify that names and other dynamic details match correctly for each contact.
          </div>
        </div>
      )}
    </div>
  )
}

