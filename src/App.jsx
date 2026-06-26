import { useState } from 'react'
import './index.css'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ClientsPanel from './components/ClientsPanel'
import InvestorsPanel from './components/InvestorsPanel'
import CompanyProfile from './components/CompanyProfile'
import CRMPanel from './components/CRMPanel'
import ToastContainer from './components/ToastContainer'

function App() {
  const [activePanel, setActivePanel] = useState('dashboard')
  const [toasts, setToasts] = useState([])
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
  const [clientContacts, setClientContacts] = useState([])
  const [investorContacts, setInvestorContacts] = useState([])
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
            leadsCount={leads.length}
            onNavigate={setActivePanel}
          />
        )
      case 'clients':
        return (
          <ClientsPanel
            contacts={clientContacts}
            setContacts={setClientContacts}
            companyProfile={companyProfile}
            smtpConfig={smtpConfig}
            addToast={addToast}
            onImportCRM={(list) => importLeads(list, 'client')}
          />
        )
      case 'investors':
        return (
          <InvestorsPanel
            contacts={investorContacts}
            setContacts={setInvestorContacts}
            companyProfile={companyProfile}
            smtpConfig={smtpConfig}
            addToast={addToast}
            onImportCRM={(list) => importLeads(list, 'investor')}
          />
        )
      case 'crm':
        return (
          <CRMPanel
            leads={leads}
            onSaveLeads={saveLeads}
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
            addToast={addToast}
          />
        )
      default:
        return <Dashboard clientContacts={clientContacts} investorContacts={investorContacts} leadsCount={leads.length} onNavigate={setActivePanel} />
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

