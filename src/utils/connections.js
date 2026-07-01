export function getConnections() {
  try {
    const raw = localStorage.getItem('outreach_connections')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function logConnection({ type, contactName, contactValue, company, status, subject, message, variant }) {
  try {
    const logs = getConnections()
    const newLog = {
      id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      type,
      contactName,
      contactValue,
      company,
      status,
      subject,
      message,
      variant
    }
    logs.unshift(newLog) // add to beginning
    // Keep last 1000 logs to avoid bloating localStorage
    localStorage.setItem('outreach_connections', JSON.stringify(logs.slice(0, 1000)))
    return newLog
  } catch (err) {
    console.error("Failed to log connection:", err)
  }
}

export function clearConnections() {
  localStorage.removeItem('outreach_connections')
}
