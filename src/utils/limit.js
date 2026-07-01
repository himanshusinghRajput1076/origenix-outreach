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
