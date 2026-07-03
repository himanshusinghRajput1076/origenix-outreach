import { useState, useEffect } from 'react'
import './index.css'
import API_BASE from './config'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ClientsPanel from './components/ClientsPanel'
import InvestorsPanel from './components/InvestorsPanel'
import CompanyProfile from './components/CompanyProfile'
import CRMPanel from './components/CRMPanel'
import ConnectionsPanel from './components/ConnectionsPanel'
import ToastContainer from './components/ToastContainer'
import { resetAllQuotas } from './utils/limit'

function App() {
  const [activePanel, setActivePanel] = useState('dashboard')
  const [toasts, setToasts] = useState([])
  const [smtpStatus, setSmtpStatus] = useState('unchecked') // 'unchecked', 'checking', 'connected', 'error'

  const checkSmtpConnection = async (config = smtpConfig) => {
    if (!config.email || !config.password) {
      setSmtpStatus('disconnected')
      return
    }
    setSmtpStatus('checking')
    try {
      const res = await fetch(`${API_BASE}/test-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEmail: config.email,
          fromPassword: config.password,
          smtpHost: config.host,
          smtpPort: config.port
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSmtpStatus('connected')
      } else {
        setSmtpStatus('error')
      }
    } catch {
      setSmtpStatus('error')
    }
  }

  // Check SMTP connection on load, when config changes, and run a heartbeat check every 45 seconds
  useEffect(() => {
    checkSmtpConnection()
    const interval = setInterval(() => {
      if (smtpConfig.email && smtpConfig.password) {
        fetch(`${API_BASE}/test-smtp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromEmail: smtpConfig.email,
            fromPassword: smtpConfig.password,
            smtpHost: smtpConfig.host,
            smtpPort: smtpConfig.port
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSmtpStatus('connected')
          } else {
            setSmtpStatus('error')
          }
        })
        .catch(() => {
          setSmtpStatus('error')
        })
      }
    }, 45000)

    return () => clearInterval(interval)
  }, [smtpConfig])

  // Global reset handler
  const handleResetApplication = () => {
    if (window.confirm("⚠️ DANGER ZONE: Are you sure you want to RESET the entire application?\n\nThis will permanently delete all contacts, settings, leads, and outreach logs.")) {
      if (window.confirm("PROCEED WITH RESET? All data will be lost forever. Click OK to wipe everything.")) {
        localStorage.clear()
        addToast('Application reset successfully! Wiping state...', 'success')
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    }
  }

  const handleResetQuotas = () => {
    if (window.confirm("🔄 Reset daily quotas? This will set your daily sent/upload counts back to 0.")) {
      resetAllQuotas()
      addToast('Daily quotas reset successfully!', 'success')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }

  const [companyProfile, setCompanyProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('outreach_company_profile')
      return stored ? JSON.parse(stored) : {
        companyName: 'OrigenixDigitalSolution',
        founderName: '',
        description: '',
        website: '',
        email: 'origenixdigitalsolution@gmail.com',
        phone: '8815831129, 8223897320',
        fundingAmount: '',
        fundingPurpose: '',
        highlights: ['', '', ''],
        services: ['', '', ''],
        attachments: []
      }
    } catch {
      return {
        companyName: 'OrigenixDigitalSolution',
        founderName: '',
        description: '',
        website: '',
        email: 'origenixdigitalsolution@gmail.com',
        phone: '8815831129, 8223897320',
        fundingAmount: '',
        fundingPurpose: '',
        highlights: ['', '', ''],
        services: ['', '', ''],
        attachments: []
      }
    }
  })
  const [clientContacts, setClientContacts] = useState(() => {
    try {
      const stored = localStorage.getItem('outreach_active_contacts_client')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [investorContacts, setInvestorContacts] = useState(() => {
    try {
      const stored = localStorage.getItem('outreach_active_contacts_investor')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const saveClientContacts = (updated) => {
    setClientContacts(updated)
    localStorage.setItem('outreach_active_contacts_client', JSON.stringify(updated))
  }
  const saveInvestorContacts = (updated) => {
    setInvestorContacts(updated)
    localStorage.setItem('outreach_active_contacts_investor', JSON.stringify(updated))
  }
  const [smtpConfig, setSmtpConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('outreach_smtp_config')
      return stored ? JSON.parse(stored) : {
        host: 'smtp.gmail.com',
        port: '587',
        email: 'origenixdigitalsolution@gmail.com',
        password: ''
      }
    } catch {
      return {
        host: 'smtp.gmail.com',
        port: '587',
        email: 'origenixdigitalsolution@gmail.com',
        password: ''
      }
    }
  })

  // Leads CRM State loaded from LocalStorage
  const [leads, setLeads] = useState(() => {
    try {
      const stored = localStorage.getItem('outreach_leads')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const saveLeads = (updatedLeads) => {
    setLeads(updatedLeads)
    localStorage.setItem('outreach_leads', JSON.stringify(updatedLeads))
  }

  const addToast = (message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  const importLeads = (contactsList, type) => {
    if (!contactsList || contactsList.length === 0) {
      addToast('No contacts to import.', 'warning')
      return
    }

    let importedCount = 0
    let skippedCount = 0
    const updated = [...leads]

    contactsList.forEach(c => {
      const emailLower = c.email ? c.email.toLowerCase().trim() : null
      const exists = emailLower ? updated.find(l => l.email && l.email.toLowerCase().trim() === emailLower) : null

      if (exists) {
        skippedCount++
      } else {
        updated.push({
          id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: c.name || 'Unknown Lead',
          email: c.email || '',
          phone: c.phone || '',
          company: c.company || '',
          website: c.website || '',
          type: type, // 'client' or 'investor'
          status: 'new',
          notes: [{ date: new Date().toISOString(), text: 'Lead imported from Excel list' }],
          followUpDate: '',
          addedAt: new Date().toISOString()
        })
        importedCount++
      }
    })

    saveLeads(updated)
    if (importedCount > 0) {
      addToast(`Successfully imported ${importedCount.toLocaleString()} new leads to CRM!${skippedCount > 0 ? ` (${skippedCount.toLocaleString()} duplicates skipped)` : ''}`, 'success')
    } else {
      addToast(`All ${skippedCount.toLocaleString()} contacts were already in the CRM.`, 'warning')
    }
  }

  const renderPanel = () => {
    switch (activePanel) {
      case 'dashboard':
        return (
          <Dashboard
            clientContacts={clientContacts}
            investorContacts={investorContacts}
            leads={leads}
            setLeads={saveLeads}
            smtpStatus={smtpStatus}
            onCheckSmtp={checkSmtpConnection}
            onResetApp={handleResetApplication}
            onResetQuotas={handleResetQuotas}
            addToast={addToast}
            onNavigate={setActivePanel}
          />
        )
      case 'clients':
        return (
          <ClientsPanel
            contacts={clientContacts}
            setContacts={saveClientContacts}
            companyProfile={companyProfile}
            smtpConfig={smtpConfig}
            addToast={addToast}
            onImportCRM={(list) => importLeads(list, 'client')}
            onResetApp={handleResetApplication}
          />
        )
      case 'investors':
        return (
          <InvestorsPanel
            contacts={investorContacts}
            setContacts={saveInvestorContacts}
            companyProfile={companyProfile}
            smtpConfig={smtpConfig}
            addToast={addToast}
            onImportCRM={(list) => importLeads(list, 'investor')}
            onResetApp={handleResetApplication}
          />
        )
      case 'connections':
        return (
          <ConnectionsPanel
            addToast={addToast}
            onResetQuotas={handleResetQuotas}
          />
        )
      case 'crm':
        return (
          <CRMPanel
            leads={leads}
            onSaveLeads={saveLeads}
            onImportLeads={importLeads}
            addToast={addToast}
          />
        )
      case 'profile':
        return (
          <CompanyProfile
            profile={companyProfile}
            setProfile={setCompanyProfile}
            smtpConfig={smtpConfig}
            setSmtpConfig={setSmtpConfig}
            smtpStatus={smtpStatus}
            onCheckSmtp={checkSmtpConnection}
            onResetApp={handleResetApplication}
            addToast={addToast}
          />
        )
      default:
        return (
          <Dashboard 
            clientContacts={clientContacts} 
            investorContacts={investorContacts} 
            leads={leads} 
            setLeads={saveLeads}
            smtpStatus={smtpStatus}
            onCheckSmtp={checkSmtpConnection}
            onResetApp={handleResetApplication}
            onResetQuotas={handleResetQuotas}
            addToast={addToast} 
            onNavigate={setActivePanel} 
          />
        )
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        clientCount={clientContacts.length}
        investorCount={investorContacts.length}
        leadsCount={leads.length}
        smtpStatus={smtpStatus}
        onResetApp={handleResetApplication}
      />
      <main className="main-content">
        <div className="page-content">
          {renderPanel()}
        </div>
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  )
}

export default App

