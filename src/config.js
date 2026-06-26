// API base URL — uses env var in production, /api fallback for dev (Vite proxy) and Netlify
const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default API_BASE
