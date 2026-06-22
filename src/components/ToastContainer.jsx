export default function ToastContainer({ toasts }) {
  const getIcon = (type) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      default: return 'ℹ️'
    }
  }

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span>{getIcon(toast.type)}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
