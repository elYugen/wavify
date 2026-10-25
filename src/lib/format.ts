export function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function fmtTotal(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h} h ${m} min`;
  return `${m} min ${String(Math.floor(sec % 60)).padStart(2, '0')} s`;
}

// crypto.randomUUID n'existe qu'en contexte sécurisé (HTTPS) : on reste simple.
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function hue(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Bonne nuit';
  if (h < 18) return 'Bonjour';
  return 'Bonsoir';
}
