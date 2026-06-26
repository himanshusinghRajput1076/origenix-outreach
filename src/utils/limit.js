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
