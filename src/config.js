// API base URL — uses env var in production, falls back to Render URL for deployed hosting, and /api for local dev proxy
const API_BASE = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? '/api' : 'https://origenix-outreach-api.onrender.com/api')

export default API_BASE
