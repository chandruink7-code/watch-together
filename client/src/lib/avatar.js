// Deterministic gradient avatars based on user id/name.
// Same input → same gradient, so peers always look the same.

const GRADIENTS = [
  ['#e50914', '#8a050b'],   // brand red
  ['#f97316', '#c2410c'],   // orange
  ['#a855f7', '#6b21a8'],   // purple
  ['#06b6d4', '#0e7490'],   // cyan
  ['#10b981', '#047857'],   // emerald
  ['#ec4899', '#be185d'],   // pink
  ['#3b82f6', '#1e40af'],   // blue
  ['#eab308', '#a16207'],   // yellow
  ['#14b8a6', '#0f766e'],   // teal
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function avatarFor(seed) {
  const hash = hashString(seed || 'guest');
  const [from, to] = GRADIENTS[hash % GRADIENTS.length];
  return { from, to, gradient: `linear-gradient(135deg, ${from}, ${to})` };
}

export function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
