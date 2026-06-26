export function maskEmail(email) {
  if (!email) return '—';
  const clean = email.trim();
  const parts = clean.split('@');
  if (parts.length !== 2) return clean;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || ''}***@${domain}`;
  }
  return `${local.substring(0, 2)}***@${domain}`;
}

export function maskPhone(phone) {
  if (!phone) return '—';
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  // If it has +91 or other country codes
  if (clean.startsWith('+')) {
    return `${clean.substring(0, 4)}******${clean.substring(clean.length - 2)}`;
  }
  return `${clean.substring(0, 2)}******${clean.substring(clean.length - 2)}`;
}
