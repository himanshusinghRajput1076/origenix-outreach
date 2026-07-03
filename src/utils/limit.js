const DAILY_LIMIT = 500;

export function getDailyCount(type) {
  const today = new Date().toDateString();
  const raw = localStorage.getItem(`outreach_daily_tracker_${type}`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        return parsed.count || 0;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return 0;
}

export function incrementDailyCount(type, increment) {
  const today = new Date().toDateString();
  const current = getDailyCount(type);
  const newCount = current + increment;
  localStorage.setItem(`outreach_daily_tracker_${type}`, JSON.stringify({
    date: today,
    count: newCount
  }));
  return newCount;
}

export function checkDailyLimit(type, increment) {
  const current = getDailyCount(type);
  return current + increment <= DAILY_LIMIT;
}

export function getRemainingDailyQuota(type) {
  return Math.max(0, DAILY_LIMIT - getDailyCount(type));
}

/**
 * Reset daily quota for a specific type ('email', 'whatsapp', 'upload')
 */
export function resetDailyQuota(type) {
  localStorage.removeItem(`outreach_daily_tracker_${type}`);
}

/**
 * Reset ALL daily quotas (email + whatsapp + upload) at once
 */
export function resetAllQuotas() {
  resetDailyQuota('email');
  resetDailyQuota('whatsapp');
  resetDailyQuota('upload');
}

/**
 * Get full quota info for all types — used by Dashboard
 */
export function getQuotaInfo() {
  const email = getDailyCount('email');
  const whatsapp = getDailyCount('whatsapp');
  const upload = getDailyCount('upload');
  return {
    email: { used: email, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - email) },
    whatsapp: { used: whatsapp, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - whatsapp) },
    upload: { used: upload, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - upload) },
    totalLimit: DAILY_LIMIT
  };
}

/**
 * Check if the stored quota date is stale (not today) — means auto-reset happened
 */
export function isQuotaAutoReset(type) {
  const today = new Date().toDateString();
  const raw = localStorage.getItem(`outreach_daily_tracker_${type}`);
  if (!raw) return true; // no data = fresh day
  try {
    const parsed = JSON.parse(raw);
    return parsed.date !== today;
  } catch {
    return true;
  }
}

export function checkAndPromoteQueuedContacts(variant, activeContacts, setContacts, addToast) {
  try {
    const queueKey = `outreach_queued_contacts_${variant}`;
    const rawQueue = localStorage.getItem(queueKey);
    if (!rawQueue) return;

    const queued = JSON.parse(rawQueue);
    if (queued.length === 0) return;

    const remainingQuota = getRemainingDailyQuota('upload');
    if (remainingQuota <= 0) return;

    const toPromoteCount = Math.min(queued.length, remainingQuota);
    const toPromote = queued.slice(0, toPromoteCount);
    const remainingQueue = queued.slice(toPromoteCount);

    // Save remaining queue
    localStorage.setItem(queueKey, JSON.stringify(remainingQueue));

    // Update active contacts
    const updatedActive = [...activeContacts, ...toPromote];
    setContacts(updatedActive);

    // Increment count
    incrementDailyCount('upload', toPromoteCount);

    if (addToast) {
      addToast(`Automatically loaded ${toPromoteCount} queued contacts for today! (${remainingQueue.length} remaining in queue)`, 'success');
    }
  } catch (err) {
    console.error("Error promoting queued contacts:", err);
  }
}
