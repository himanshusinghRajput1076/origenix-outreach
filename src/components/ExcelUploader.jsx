import { useRef, useState } from 'react'
import API_BASE from '../config'
import { incrementDailyCount, getRemainingDailyQuota } from '../utils/limit'

export default function ExcelUploader({ onContactsLoaded, variant = 'investor', addToast }) {
  const [dragging, setDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)

  const isClient = variant === 'client'

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragIn = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const handleDragOut = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) uploadFile(file)
  }

  const uploadFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      addToast?.('Please upload an Excel file (.xlsx or .xls)', 'error')
      return
    }

    setLoading(true)
    setUploadedFile({ name: file.name, size: file.size })

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE}/upload-excel`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        const loadedContacts = data.contacts
        const totalCount = loadedContacts.length
        const remainingQuota = getRemainingDailyQuota('upload')

        let todayContacts = []
        let queuedContacts = []

        if (remainingQuota <= 0) {
          queuedContacts = loadedContacts
          addToast?.(`Daily upload limit reached. Queued all ${totalCount} contacts for future days.`, 'warning')
        } else if (totalCount > remainingQuota) {
          todayContacts = loadedContacts.slice(0, remainingQuota)
          queuedContacts = loadedContacts.slice(remainingQuota)
          addToast?.(`Loaded first ${remainingQuota} contacts today. Queued remaining ${queuedContacts.length} contacts for tomorrow/future days.`, 'warning')
        } else {
          todayContacts = loadedContacts
        }

        // Save queued contacts to localStorage (append to existing queue)
        if (queuedContacts.length > 0) {
          const queueKey = `outreach_queued_contacts_${variant}`
          let existingQueue = []
          try {
            const raw = localStorage.getItem(queueKey)
            if (raw) existingQueue = JSON.parse(raw)
          } catch (e) {
            console.error(e)
          }
          const updatedQueue = [...existingQueue, ...queuedContacts]
          localStorage.setItem(queueKey, JSON.stringify(updatedQueue))
        }

        const loadedCount = todayContacts.length
        if (loadedCount > 0) {
          incrementDailyCount('upload', loadedCount)
          onContactsLoaded(todayContacts, data.headers)
        } else {
          onContactsLoaded([], [])
        }
      } else {
        addToast?.('Failed to parse Excel: ' + (data.error || 'Unknown error'), 'error')
        setUploadedFile(null)
      }
    } catch (err) {
      addToast?.('Server not running. Please start the backend server (cd server && npm start)', 'error')
      setUploadedFile(null)
    }
    setLoading(false)
  }

  const removeFile = () => {
    setUploadedFile(null)
    onContactsLoaded([], [])
    if (fileRef.current) fileRef.current.value = ''
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div>
      <div
        className={`upload-zone ${isClient ? 'client-upload' : ''} ${dragging ? 'dragging' : ''}`}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="upload-file-input"
          onChange={handleFileChange}
        />
        {loading ? (
          <>
            <span className="upload-icon">⏳</span>
            <div className="upload-text">
              <h4>Processing Excel file...</h4>
              <p>Parsing contacts and detecting columns</p>
            </div>
          </>
        ) : (
          <>
            <span className="upload-icon">📊</span>
            <div className="upload-text">
              <h4>Drop your Excel file here</h4>
              <p>
                or <span className="browse-link">browse files</span> — Supports .xlsx and .xls
              </p>
            </div>
          </>
        )}
      </div>

      {uploadedFile && (
        <div className="uploaded-file">
          <span className="file-icon">📄</span>
          <div className="file-info">
            <h5>{uploadedFile.name}</h5>
            <p>{formatSize(uploadedFile.size)} — Parsed successfully</p>
          </div>
          <button className="remove-btn" onClick={removeFile}>✕</button>
        </div>
      )}
    </div>
  )
}
