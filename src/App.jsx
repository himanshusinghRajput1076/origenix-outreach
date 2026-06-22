import { useState } from 'react'
import './index.css'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ClientsPanel from './components/ClientsPanel'
import InvestorsPanel from './components/InvestorsPanel'
import CompanyProfile from './components/CompanyProfile'
import ToastContainer from './components/ToastContainer'

function App() {
  const [activePanel, setActivePanel] = useState('dashboard')
  const [toasts, setToasts] = useState([])
  const [companyProfile, setCompanyProfile] = useState({
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
  })
  const [clientContacts, setClientContacts] = useState([])
  const [investorContacts, setInvestorContacts] = useState([])
  const [smtpConfig, setSmtpConfig] = useState({
    host: 'smtp.gmail.com',
    port: '587',
    email: 'origenixdigitalsolution@gmail.com',
    password: ''
  })

  const addToast = (message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  const renderPanel = () => {
    switch (activePanel) {
      case 'dashboard':
        return (
          <Dashboard
            clientContacts={clientContacts}
            investorContacts={investorContacts}
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
        return <Dashboard clientContacts={clientContacts} investorContacts={investorContacts} onNavigate={setActivePanel} />
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        clientCount={clientContacts.length}
        investorCount={investorContacts.length}
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
