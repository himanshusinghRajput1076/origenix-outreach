import { useState, useMemo } from 'react'
import { maskEmail, maskPhone } from '../utils/mask'

export default function CRMPanel({ leads, onSaveLeads, addToast }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [viewMode, setViewMode] = useState('pipeline') // 'pipeline' or 'list'
  const [revealed, setRevealed] = useState({})

  const toggleReveal = (key, e) => {
    if (e) e.stopPropagation()
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSelectLead = (lead) => {
    setRevealed(prev => {
      const next = { ...prev }
      delete next['modal_email']
      delete next['modal_phone']
      return next
    })
    setSelectedLead(lead)
  }
  
  // Modal State
  const [selectedLead, setSelectedLead] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  
  // Note Form State
  const [newNote, setNewNote] = useState('')
  
  // Manual Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    website: '',
    type: 'client',
    status: 'new',
    note: ''
  })

  const statuses = [
    { id: 'new', label: 'New', color: 'var(--blue)' },
    { id: 'contacted', label: 'Contacted', color: 'var(--yellow)' },
    { id: 'nurturing', label: 'Nurturing', color: 'var(--purple)' },
    { id: 'won', label: 'Won', color: 'var(--green)' },
    { id: 'lost', label: 'Lost', color: 'var(--red)' }
  ]

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = 
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.company.toLowerCase().includes(search.toLowerCase()) ||
        lead.email.toLowerCase().includes(search.toLowerCase())
      
      const matchesType = typeFilter === 'all' || lead.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [leads, search, typeFilter])

  // Leads Grouped by Status (for Kanban Board)
  const groupedLeads = useMemo(() => {
    const groups = { new: [], contacted: [], nurturing: [], won: [], lost: [] }
    filteredLeads.forEach(lead => {
      if (groups[lead.status]) {
        groups[lead.status].push(lead)
      } else {
        groups.new.push(lead)
      }
    })
    return groups
  }, [filteredLeads])

  // Handle Drag & Drop status transition
  const handleDragStart = (e, leadId) => {
    e.dataTransfer.setData('text/plain', leadId)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e, targetStatus) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('text/plain')
    const updated = leads.map(l => {
      if (l.id === leadId && l.status !== targetStatus) {
        return {
          ...l,
          status: targetStatus,
          notes: [
            ...l.notes,
            { date: new Date().toISOString(), text: `Status updated to: ${targetStatus.toUpperCase()} (drag & drop)` }
          ]
        }
      }
      return l
    })
    onSaveLeads(updated)
    addToast('Lead status updated', 'success')
  }

  // Handle manually adding a lead
  const handleAddLead = (e) => {
    e.preventDefault()
    if (!newLeadForm.name) {
      addToast('Name is required', 'warning')
      return
    }

    const newLead = {
      id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: newLeadForm.name.trim(),
      email: newLeadForm.email.trim(),
      phone: newLeadForm.phone.trim(),
      company: newLeadForm.company.trim(),
      website: newLeadForm.website.trim(),
      type: newLeadForm.type,
      status: newLeadForm.status,
      notes: newLeadForm.note.trim() 
        ? [{ date: new Date().toISOString(), text: newLeadForm.note.trim() }] 
        : [{ date: new Date().toISOString(), text: 'Lead manually created' }],
      followUpDate: '',
      addedAt: new Date().toISOString()
    }

    onSaveLeads([...leads, newLead])
    addToast('Lead added successfully', 'success')
    setShowAddModal(false)
    setNewLeadForm({
      name: '',
      email: '',
      phone: '',
      company: '',
      website: '',
      type: 'client',
      status: 'new',
      note: ''
    })
  }

  // Handle Note Addition inside Lead Modal
  const handleAddNote = (e) => {
    e.preventDefault()
    if (!newNote.trim()) return

    const updated = leads.map(l => {
      if (l.id === selectedLead.id) {
        const updatedLead = {
          ...l,
          notes: [...l.notes, { date: new Date().toISOString(), text: newNote.trim() }]
        }
        setSelectedLead(updatedLead) // Update active modal display
        return updatedLead
      }
      return l
    })

    onSaveLeads(updated)
    setNewNote('')
    addToast('Note added to timeline', 'success')
  }

  // Update Lead Details
  const handleUpdateLeadField = (field, value) => {
    const updated = leads.map(l => {
      if (l.id === selectedLead.id) {
        const updatedLead = { ...l, [field]: value }
        setSelectedLead(updatedLead)
        return updatedLead
      }
      return l
    })
    onSaveLeads(updated)
  }

  // Delete Lead
  const handleDeleteLead = (leadId) => {
    if (window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
      const updated = leads.filter(l => l.id !== leadId)
      onSaveLeads(updated)
      setSelectedLead(null)
      addToast('Lead deleted', 'info')
    }
  }

  // Export CRM database to CSV
  const handleExportCSV = () => {
    if (leads.length === 0) {
      addToast('No leads to export.', 'warning')
      return
    }

    const headers = ['ID', 'Name', 'Email', 'Phone', 'Company', 'Website', 'Type', 'Status', 'Follow Up Date', 'Added At', 'Notes History']
    const rows = leads.map(l => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      l.email,
      l.phone,
      `"${l.company.replace(/"/g, '""')}"`,
      l.website,
      l.type,
      l.status,
      l.followUpDate || 'None',
      l.addedAt,
      `"${l.notes.map(n => `[${new Date(n.date).toLocaleDateString()}] ${n.text}`).join(' | ').replace(/"/g, '""')}"`
    ])

    const csvString = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `outreach_crm_leads_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    addToast('CSV export downloaded', 'success')
  }

  return (
    <div className="crm-panel">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Leads CRM</h2>
          <p>Organize, track, and follow up on your client and investor prospects.</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-sm btn-investor" onClick={() => setShowAddModal(true)}>+ Add Lead</button>
          <button className="btn btn-sm btn-secondary" onClick={handleExportCSV}>Export CSV</button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="card" style={{ marginBottom: '16px', padding: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flex: 1, gap: '12px', minWidth: '280px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search leads by name, company, email..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ margin: 0 }}
            />
            <select 
              className="form-input" 
              value={typeFilter} 
              onChange={e => setTypeFilter(e.target.value)} 
              style={{ margin: 0, width: '140px' }}
            >
              <option value="all">All Types</option>
              <option value="client">Clients Only</option>
              <option value="investor">Investors Only</option>
            </select>
          </div>
          <div className="panel-tabs" style={{ margin: 0, border: 'none', background: 'var(--gray-50)', borderRadius: '6px', padding: '3px' }}>
            <button 
              className={`panel-tab ${viewMode === 'pipeline' ? 'active' : ''}`} 
              onClick={() => setViewMode('pipeline')}
              style={{ padding: '6px 12px', margin: 0, fontSize: '0.82rem', borderRadius: '4px' }}
            >
              Pipeline Board
            </button>
            <button 
              className={`panel-tab ${viewMode === 'list' ? 'active' : ''}`} 
              onClick={() => setViewMode('list')}
              style={{ padding: '6px 12px', margin: 0, fontSize: '0.82rem', borderRadius: '4px' }}
            >
              List View
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Rendering */}
      {viewMode === 'pipeline' ? (
        /* Kanban Pipeline View */
        <div className="crm-kanban-board">
          {statuses.map(col => {
            const list = groupedLeads[col.id] || []
            return (
              <div 
                key={col.id} 
                className="crm-kanban-column"
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, col.id)}
              >
                <div className="crm-column-header">
                  <span className="crm-column-dot" style={{ background: col.color }} />
                  <span className="crm-column-title">{col.label}</span>
                  <span className="crm-column-count">{list.length}</span>
                </div>
                <div className="crm-column-cards">
                  {list.length === 0 ? (
                    <div className="crm-column-empty">Drag leads here</div>
                  ) : (
                    list.map(lead => {
                      const isOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date()
                      return (
                        <div 
                          key={lead.id} 
                          className="crm-card"
                          draggable
                          onDragStart={e => handleDragStart(e, lead.id)}
                          onClick={() => handleSelectLead(lead)}
                        >
                          <div className="crm-card-header">
                            <span className={`tag ${lead.type === 'client' ? 'tag-client' : 'tag-investor'}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                              {lead.type}
                            </span>
                            {isOverdue && <span className="tag" style={{ background: 'var(--red-light)', color: 'var(--red)', fontSize: '0.65rem', padding: '2px 4px' }}>Overdue</span>}
                          </div>
                          <div className="crm-card-name">{lead.name}</div>
                          <div className="crm-card-company">{lead.company || '—'}</div>
                          {lead.followUpDate && (
                            <div className="crm-card-followup" style={isOverdue ? { color: 'var(--red)', fontWeight: 500 } : {}}>
                              📅 {new Date(lead.followUpDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="card">
          <div className="contacts-table-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Follow Up</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-400)' }}>
                      No leads match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => (
                    <tr key={lead.id} className="crm-list-row" onClick={() => handleSelectLead(lead)} style={{ cursor: 'pointer' }}>
                      <td style={{ color: 'var(--gray-900)', fontWeight: 500 }}>{lead.name}</td>
                      <td>{lead.company || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                          <span>{lead.email ? (revealed[`${lead.id}_email`] ? lead.email : maskEmail(lead.email)) : '—'}</span>
                          {lead.email && (
                            <button 
                              type="button"
                              onClick={(e) => toggleReveal(`${lead.id}_email`, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '0.9rem', color: 'var(--gray-400)', display: 'inline-flex', alignItems: 'center' }}
                              title={revealed[`${lead.id}_email`] ? 'Hide' : 'Reveal'}
                            >
                              {revealed[`${lead.id}_email`] ? '🙈' : '👁️'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                          <span>{lead.phone ? (revealed[`${lead.id}_phone`] ? lead.phone : maskPhone(lead.phone)) : '—'}</span>
                          {lead.phone && (
                            <button 
                              type="button"
                              onClick={(e) => toggleReveal(`${lead.id}_phone`, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '0.9rem', color: 'var(--gray-400)', display: 'inline-flex', alignItems: 'center' }}
                              title={revealed[`${lead.id}_phone`] ? 'Hide' : 'Reveal'}
                            >
                              {revealed[`${lead.id}_phone`] ? '🙈' : '👁️'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`tag ${lead.type === 'client' ? 'tag-client' : 'tag-investor'}`}>
                          {lead.type}
                        </span>
                      </td>
                      <td>
                        <span className="tag" style={{ 
                          background: statuses.find(s => s.id === lead.status)?.color + '18', 
                          color: statuses.find(s => s.id === lead.status)?.color,
                          fontWeight: 600
                        }}>
                          {lead.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={lead.followUpDate && new Date(lead.followUpDate) < new Date() ? { color: 'var(--red)', fontWeight: 600 } : {}}>
                        {lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-secondary" 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectLead(lead)
                          }}
                          style={{ padding: '4px 8px' }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Add Lead Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content cyber-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Create New Lead</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddLead} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label>Contact Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newLeadForm.name} 
                  onChange={e => setNewLeadForm({ ...newLeadForm, name: e.target.value })} 
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={newLeadForm.email} 
                    onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newLeadForm.phone} 
                    onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Company Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newLeadForm.company} 
                    onChange={e => setNewLeadForm({ ...newLeadForm, company: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Website</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newLeadForm.website} 
                    onChange={e => setNewLeadForm({ ...newLeadForm, website: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Lead Type</label>
                  <select 
                    className="form-input" 
                    value={newLeadForm.type} 
                    onChange={e => setNewLeadForm({ ...newLeadForm, type: e.target.value })}
                  >
                    <option value="client">Client</option>
                    <option value="investor">Investor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Initial Status</label>
                  <select 
                    className="form-input" 
                    value={newLeadForm.status} 
                    onChange={e => setNewLeadForm({ ...newLeadForm, status: e.target.value })}
                  >
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Introductory Note</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={newLeadForm.note} 
                  onChange={e => setNewLeadForm({ ...newLeadForm, note: e.target.value })}
                  placeholder="e.g., Met at network event, interested in consulting services"
                />
              </div>
              <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-client">Add Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Detail / Notes Timeline Modal */}
      {selectedLead && (
        <div className="modal-backdrop" onClick={() => setSelectedLead(null)}>
          <div className="modal-content cyber-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px' }}>
            
            {/* Left Col: Lead Info editing */}
            <div style={{ borderRight: '1px solid var(--gray-100)', paddingRight: '20px' }}>
              <div className="modal-header" style={{ paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Lead details</h3>
              </div>
              <div className="form-group">
                <label>Contact name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={selectedLead.name} 
                  onChange={e => handleUpdateLeadField('name', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Company name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={selectedLead.company} 
                  onChange={e => handleUpdateLeadField('company', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {revealed['modal_email'] ? (
                    <input 
                      type="email" 
                      className="form-input" 
                      value={selectedLead.email} 
                      onChange={e => handleUpdateLeadField('email', e.target.value)}
                      style={{ margin: 0, flex: 1 }}
                    />
                  ) : (
                    <input 
                      type="text" 
                      className="form-input" 
                      value={maskEmail(selectedLead.email)} 
                      readOnly
                      style={{ margin: 0, flex: 1, backgroundColor: 'var(--gray-50)', color: 'var(--gray-500)', cursor: 'not-allowed' }}
                    />
                  )}
                  <button 
                    type="button"
                    onClick={() => toggleReveal('modal_email')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', fontSize: '1rem', color: 'var(--gray-500)' }}
                    title={revealed['modal_email'] ? 'Lock / Hide' : 'Reveal & Edit'}
                  >
                    {revealed['modal_email'] ? '🔒' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Phone</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {revealed['modal_phone'] ? (
                    <input 
                      type="text" 
                      className="form-input" 
                      value={selectedLead.phone} 
                      onChange={e => handleUpdateLeadField('phone', e.target.value)}
                      style={{ margin: 0, flex: 1 }}
                    />
                  ) : (
                    <input 
                      type="text" 
                      className="form-input" 
                      value={maskPhone(selectedLead.phone)} 
                      readOnly
                      style={{ margin: 0, flex: 1, backgroundColor: 'var(--gray-50)', color: 'var(--gray-500)', cursor: 'not-allowed' }}
                    />
                  )}
                  <button 
                    type="button"
                    onClick={() => toggleReveal('modal_phone')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', fontSize: '1rem', color: 'var(--gray-500)' }}
                    title={revealed['modal_phone'] ? 'Lock / Hide' : 'Reveal & Edit'}
                  >
                    {revealed['modal_phone'] ? '🔒' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Website</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={selectedLead.website} 
                  onChange={e => handleUpdateLeadField('website', e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Status</label>
                  <select 
                    className="form-input" 
                    value={selectedLead.status} 
                    onChange={e => {
                      const newStatus = e.target.value
                      const updated = leads.map(l => {
                        if (l.id === selectedLead.id) {
                          const updatedLead = {
                            ...l,
                            status: newStatus,
                            notes: [...l.notes, { date: new Date().toISOString(), text: `Status updated to: ${newStatus.toUpperCase()}` }]
                          }
                          setSelectedLead(updatedLead)
                          return updatedLead
                        }
                        return l
                      })
                      onSaveLeads(updated)
                      addToast(`Status updated to ${newStatus}`, 'success')
                    }}
                  >
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Follow up date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={selectedLead.followUpDate || ''} 
                    onChange={e => handleUpdateLeadField('followUpDate', e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-secondary" 
                style={{ width: '100%', marginTop: '16px', background: 'var(--red-light)', color: 'var(--red)', border: 'none' }}
                onClick={() => handleDeleteLead(selectedLead.id)}
              >
                🗑 Delete Lead
              </button>
            </div>

            {/* Right Col: Timeline logs & new notes */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="modal-header" style={{ paddingBottom: '12px', marginBottom: '16px', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>Timeline / notes</h3>
                <button className="modal-close" onClick={() => setSelectedLead(null)}>×</button>
              </div>

              {/* Timeline list */}
              <div className="crm-timeline" style={{ flex: 1, overflowY: 'auto', maxHeight: '310px', paddingRight: '4px', marginBottom: '12px' }}>
                {selectedLead.notes.length === 0 ? (
                  <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', fontStyle: 'italic' }}>No logs on this timeline yet.</p>
                ) : (
                  [...selectedLead.notes].reverse().map((note, index) => (
                    <div key={index} className="crm-timeline-item" style={{ borderLeft: '2px solid var(--gray-200)', paddingLeft: '12px', paddingBottom: '16px', position: 'relative' }}>
                      <span className="crm-timeline-dot" style={{ position: 'absolute', left: '-5px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gray-400)' }} />
                      <div className="crm-timeline-date" style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: '2px' }}>
                        {new Date(note.date).toLocaleString()}
                      </div>
                      <div className="crm-timeline-text" style={{ fontSize: '0.85rem', color: 'var(--gray-700)', lineHeight: 1.4 }}>
                        {note.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '12px' }}>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.78rem' }}>Add note</label>
                  <textarea 
                    className="form-input" 
                    rows="2"
                    value={newNote} 
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Type call notes, follow-up remarks, custom logs..."
                    style={{ margin: 0, fontSize: '0.85rem' }}
                  />
                </div>
                <button type="submit" className="btn btn-sm btn-client" style={{ width: '100%' }}>Add Note</button>
              </form>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
