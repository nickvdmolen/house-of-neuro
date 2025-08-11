export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const EMAIL_RE = /@student\.nhlstenden\.com$/i;
export const emailValid = (email) => EMAIL_RE.test((email || '').trim());
