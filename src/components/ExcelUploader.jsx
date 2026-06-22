import { useRef, useState } from 'react'
import API_BASE from '../config'

export default function ExcelUploader({ onContactsLoaded, variant = 'investor' }) {
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
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      '.xlsx', '.xls'
    ]
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      alert('Please upload an Excel file (.xlsx or .xls)')
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
        onContactsLoaded(data.contacts, data.headers)
      } else {
        alert('Failed to parse Excel: ' + (data.error || 'Unknown error'))
        setUploadedFile(null)
      }
    } catch (err) {
      alert('Server not running. Please start the backend server (cd server && npm start)')
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
