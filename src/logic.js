// Pure helpers — session/atelier parsing and formatting (ported from the design prototype).
export const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const MOISL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function kind(a) {
  const t = (a.type || '').toLowerCase(), d = (a.dominante || '').toLowerCase(), ti = (a.titre || '').toLowerCase();
  let type = 'Exercice';
  if (/^ech/.test(t) || /^ech/.test(d) || /^echauffement/.test(ti)) type = 'Échauffement';
  else if (t.includes('30-15') || d === 'test') type = 'Test';
  else if (t === 'jeu' || t === 'situation') type = 'Jeu';
  else if (t === 'athle') type = 'Athlé';
  let dom = 'Technique';
  if (/motric/.test(d + ti) || /vitesse|athle|test/.test(d)) dom = 'Physique';
  else if (/tact|match/.test(d)) dom = 'Tactique';
  return { type, dom };
}

export function seqOf(a) {
  const total = parseInt(a.total) || 15;
  if ((a.type || '').includes('30-15')) return { ift: true, n: 24, work: 30, rest: 15, total };
  const m = (a.sequences || '').match(/(\d+)\s*séquences?\s*de\s*(\d+)\s*(minutes?|manches?)\s*(\d+)?/);
  if (m && /minute/.test(m[3])) return { n: +m[1], work: +m[2] * 60 + (m[4] ? +m[4] : 0), total };
  if (m) return { n: +m[1], work: Math.round(total * 60 / +m[1]), total };
  return { n: 1, work: total * 60, total };
}

export function effOf(a) {
  const raw = (a.effectifRaw || a.effectif || []).filter(e => !/^x\s/i.test(e));
  if (!raw.length) return { lines: (a.effectif || []).length ? a.effectif : [], total: '', short: (a.effectif || [])[0] || '' };
  const groups = [];
  raw.forEach(e => { const g = groups.find(x => x.e === e); g ? g.n++ : groups.push({ e, n: 1 }); });
  let total = 0, exact = true;
  const lines = groups.map(({ e, n }) => {
    const m = e.match(/^(\d+)\s*(à (\d+))?\s*(.*)$/);
    if (!m) return e;
    const v = +m[1], unit = m[4];
    if (m[3]) exact = false;
    total += (m[3] ? +m[3] : v) * (/joueur/.test(unit) ? n : 1);
    if (/joueur/.test(unit) && n >= 2) return `${n} équipes de ${v} joueurs`;
    if (/^GB$/i.test(unit)) return `${v} gardien${v > 1 ? 's' : ''}`;
    return e;
  });
  const short = lines.map(l => l.replace(/(\d+) équipes de (\d+) joueurs/, '$1 × $2')).join(' + ');
  return { lines, total: exact && lines.length > 1 ? `${total} joueurs au total` : '', short };
}

export const fmtSeq = s => s.ift ? '30″ / 15″' : s.n > 1 ? `${s.n} × ${s.work % 60 ? Math.floor(s.work / 60) + '′' + (s.work % 60) : s.work / 60 + ' min'}` : `${Math.round(s.work / 60)} min`;
export const mmss = x => { x = Math.max(0, x); return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
export const dateParts = iso => { const d = new Date(iso + 'T12:00:00'); return { dow: DOW[d.getDay()], day: d.getDate(), mois: MOIS[d.getMonth()] }; };
export const libKey = a => (a.titre + '|' + (a.regles[0] || a.comportements[0] || '')).toLowerCase();
