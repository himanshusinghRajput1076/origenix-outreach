import { getConnections } from './connections'

// Potential simulated client replies
const REPLY_TEMPLATES = [
  {
    type: 'positive',
    status: 'negotiation',
    messages: [
      "Hi, this sounds interesting! Let's connect next Tuesday at 3 PM. Can you send a calendar invite?",
      "Thanks for reaching out. I'm interested in knowing more. Are you available for a brief Zoom call tomorrow?",
      "Excellent services! We've been looking for something like this. Let's set up a call next week."
    ]
  },
  {
    type: 'request_info',
    status: 'proposal',
    messages: [
      "Thanks for the email. Could you please send over your service brochure or deck for our team to review?",
      "Sounds promising. Please share your pricing structure and past client case studies.",
      "Can you send more details about your highlights and portfolio?"
    ]
  },
  {
    type: 'negative',
    status: 'lost',
    messages: [
      "Thanks for reaching out, but we are not looking for new services or funding at this time.",
      "We already have a partner handling this. Appreciate the intro though.",
      "Please remove us from your list. Thank you."
    ]
  }
]

export function getReplies() {
  try {
    const raw = localStorage.getItem('outreach_replies')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveReplies(replies) {
  localStorage.setItem('outreach_replies', JSON.stringify(replies))
}

export function clearReplies() {
  localStorage.removeItem('outreach_replies')
}

export function syncRepliesFromOutreach(leads, onUpdateLeads, addToast) {
  try {
    const connections = getConnections().filter(c => c.type === 'email' && c.status === 'sent')
    if (connections.length === 0) {
      return { newCount: 0, messages: [] }
    }

    const currentReplies = getReplies()
    const repliedValues = new Set(currentReplies.map(r => r.contactValue.toLowerCase().trim()))

    // Find contacts we emailed but haven't replied to yet
    const potentialRepliers = connections.filter(c => !repliedValues.has(c.contactValue.toLowerCase().trim()))
    if (potentialRepliers.length === 0) {
      return { newCount: 0, messages: [] }
    }

    // Determine how many reply (e.g. 30-50% probability, max 3 new replies at a time to be realistic)
    const newReplies = []
    const updatedLeads = [...leads]
    let updatedCount = 0

    // Randomize candidates
    const shuffled = [...potentialRepliers].sort(() => 0.5 - Math.random())
    const countToGenerate = Math.min(shuffled.length, Math.floor(Math.random() * 2) + 2) // 2-3 replies

    for (let i = 0; i < countToGenerate; i++) {
      const conn = shuffled[i]
      
      // Pick random category and message template
      const category = REPLY_TEMPLATES[Math.floor(Math.random() * REPLY_TEMPLATES.length)]
      const messageText = category.messages[Math.floor(Math.random() * category.messages.length)]

      const replyObj = {
        id: 'reply_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        timestamp: new Date().toISOString(),
        contactName: conn.contactName,
        contactValue: conn.contactValue,
        company: conn.company,
        message: messageText,
        type: category.type
      }

      newReplies.push(replyObj)

      // Find the corresponding lead in the CRM
      const leadIndex = updatedLeads.findIndex(l => l.email && l.email.toLowerCase().trim() === conn.contactValue.toLowerCase().trim())
      if (leadIndex !== -1) {
        // Update stage
        updatedLeads[leadIndex] = {
          ...updatedLeads[leadIndex],
          status: category.status,
          notes: [
            ...updatedLeads[leadIndex].notes,
            {
              date: new Date().toISOString(),
              text: `📩 Received reply: "${messageText}"`
            }
          ]
        }
        updatedCount++
        if (addToast) {
          addToast(`New reply from ${conn.contactName} (${conn.company}). CRM lead status updated to ${category.status}!`, 'success')
        }
      }
    }

    if (newReplies.length > 0) {
      const allReplies = [...newReplies, ...currentReplies]
      saveReplies(allReplies)
      if (updatedCount > 0) {
        onUpdateLeads(updatedLeads)
      }
    }

    return {
      newCount: newReplies.length,
      replies: newReplies
    }
  } catch (err) {
    console.error("Error syncing replies:", err)
    return { newCount: 0, replies: [] }
  }
}
