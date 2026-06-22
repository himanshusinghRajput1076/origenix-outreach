// API base URL — auto-detects production (Render) vs local dev
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : 'https://origenix-outreach-api.onrender.com/api')

export default API_BASE
