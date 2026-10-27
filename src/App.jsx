import React from 'react';
import { cap, labelOf, todayISO, kind, seqOf, effOf, fmtSeq, fmtRest, mmss, dateParts, libKey } from './logic.js';
import * as I from './Icons.jsx';

// Timer settings (were design-time "Tweaks" in the prototype).
const RECUP = 60;           // seconds of recovery between séquences
const SETTINGS = 'training-sfl-settings';
// End-of-chrono sound, chosen in the timer screen (bell button). Played with Web Audio, no files.
const SOUNDS = [['none', 'Aucune'], ['bip', 'Bip'], ['double', 'Double bip'], ['carillon', 'Carillon'], ['sifflet', 'Sifflet'], ['gong', 'Gong']];
const VOLUMES = [['Faible', 0.05], ['Moyen', 0.14], ['Fort', 0.32]];
const DEFAULT_SETTINGS = { sound: 'double', countdown: true, volume: 1 };
const LIVE_SCHEMA = true;   // show the field diagram during the timer
const STORE = 'training-sfl-imports';
// Local edits on top of seances.json + imports: { patches: { [id]: { date, label, theme, ateliers } }, deleted: [id] }
const EDITS = 'training-sfl-edits';

const INK = '#f2f2f3', DARK = '#1d2d3d', LIGHT = '#f2f2f3';
const kickerS = { font: '500 11px var(--font-body)', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-accent-700)' };
const smallCapsS = { font: '500 10px var(--font-body)', letterSpacing: '.1em', textTransform: 'uppercase' };
const ghostBtnS = { alignSelf: 'flex-start', height: 44, marginLeft: -6, fontSize: 16, gap: 2 };
const importBtnS = { height: 44, fontSize: 15, textTransform: 'uppercase', letterSpacing: '.05em', gap: 8, flex: 'none' };
const editBtnS = { height: 48, fontSize: 15, textTransform: 'uppercase', letterSpacing: '.05em' };
const bigBtnS = { height: 56, fontSize: 19, textTransform: 'uppercase', letterSpacing: '.06em', gap: 10 };
const liveIconBtnS = { width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(242,242,243,.25)', color: INK, cursor: 'pointer', padding: 0, flex: 'none' };

export default class App extends React.Component {
  state = { data: null, tab: 'today', stack: [], filter: 'Tous', q: '', live: null, imp: null, edit: null, chrono: null, settings: DEFAULT_SETTINGS, soundPanel: false };
  scrollRef = React.createRef();
  fileRef = React.createRef();
  today = todayISO();

  // ── lifecycle ──
  componentDidMount() {
    fetch('seances.json').then(r => r.json()).then(data => {
      let extra = []; try { extra = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) {}
      const ed = this.loadEdits();
      const all = [...data, ...extra].filter(s => !ed.deleted.includes(s.id)).map(s => ed.patches[s.id] ? { ...s, ...ed.patches[s.id] } : s);
      this.setState({ data: all.sort((a, b) => a.date.localeCompare(b.date)) });
    });
    try { this.setState({ settings: { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS) || '{}') } }); } catch (e) {}
    this.timer = setInterval(() => this.tick(), 250);
    this.onVis = () => { if (document.visibilityState === 'visible') { this.today = todayISO(); this.syncWakeLock(); } };
    document.addEventListener('visibilitychange', this.onVis);
    this.syncChrome();
  }
  componentWillUnmount() { clearInterval(this.timer); document.removeEventListener('visibilitychange', this.onVis); }
  componentDidUpdate(_, prev) {
    const s = this.state, k = s.tab + JSON.stringify(s.stack[s.stack.length - 1] || null) + !!s.live;
    if (k !== this._navKey) { this._navKey = k; if (this.scrollRef.current) this.scrollRef.current.scrollTop = 0; if (s.chrono) this.setState({ chrono: null }); }
    if (!!prev.live !== !!s.live) this.syncChrome();
    if ((prev.live && prev.live.running) !== (s.live && s.live.running)) this.syncWakeLock();
  }

  // Status-bar / overscroll colour follows the screen (dark during the timer).
  syncChrome() {
    const dark = !!this.state.live;
    document.documentElement.style.background = dark ? DARK : LIGHT;
    document.body.style.background = dark ? DARK : LIGHT;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = dark ? DARK : LIGHT;
  }
  // Keep the screen awake while the timer runs (iOS 16.4+).
  async syncWakeLock() {
    const want = !!(this.state.live && this.state.live.running) && document.visibilityState === 'visible';
    try {
      if (want && !this.wake && navigator.wakeLock) { this.wake = await navigator.wakeLock.request('screen'); this.wake.addEventListener('release', () => { this.wake = null; }); }
      else if (!want && this.wake) { await this.wake.release(); this.wake = null; }
    } catch (e) { this.wake = null; }
  }

  // ── sounds ──
  audio() {
    this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)();
    if (this.ac.state === 'suspended') this.ac.resume();
    return this.ac;
  }
  // One note: f Hz, starting `at` s from now, lasting d s; `ring` = struck sound that fades out.
  tone(f, at, d, { type = 'sine', ring = false, gain = 1 } = {}) {
    const ac = this.audio(), o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + at;
    const v = VOLUMES[this.state.settings.volume][1] * gain;
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    if (!ring) g.gain.setValueAtTime(v, t + Math.max(0.02, d - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.05);
    return o;
  }
  playSound(id = this.state.settings.sound) {
    try {
      if (id === 'bip') this.tone(880, 0, 0.3);
      else if (id === 'double') { this.tone(988, 0, 0.14); this.tone(988, 0.2, 0.14); }
      else if (id === 'carillon') { [784, 988, 1175].forEach((f, i) => this.tone(f, i * 0.16, 0.7, { ring: true })); }
      else if (id === 'sifflet') {
        const ac = this.audio(), o = this.tone(2700, 0, 0.7, { gain: 0.6 }), lfo = ac.createOscillator(), lg = ac.createGain();
        lfo.frequency.value = 28; lg.gain.value = 180; lfo.connect(lg); lg.connect(o.frequency); lfo.start(); lfo.stop(ac.currentTime + 0.75);
      }
      else if (id === 'gong') { this.tone(196, 0, 2.2, { ring: true, gain: 1.4 }); this.tone(392, 0, 1.6, { ring: true, gain: 0.5 }); this.tone(587, 0, 1, { ring: true, gain: 0.25 }); }
    } catch (e) {}
  }
  // Short tick for the 3-2-1 countdown.
  beep() { if (this.state.settings.countdown) { try { this.tone(660, 0, 0.09, { gain: 0.6 }); } catch (e) {} } }
  setSettings(patch, then) {
    this.setState(s => {
      const settings = { ...s.settings, ...patch };
      try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch (e) {}
      return { settings };
    }, then);
  }
  session(id) { return this.state.data.find(s => s.id === id); }
  // "Aujourd'hui" = today's session, else the next one, else the latest.
  todayId() {
    const d = this.state.data;
    return (d.find(s => s.date === this.today) || d.find(s => s.date > this.today) || d[d.length - 1] || {}).id;
  }
  push(e) { this.setState(s => ({ stack: [...s.stack, e] })); }

  // ── PPTX import ──
  async onFile(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    this.setState(s => ({ imp: { status: 'parsing', fileName: file.name }, stack: [...s.stack.filter(x => x.v !== 'import'), { v: 'import' }] }));
    try {
      const { parsePptx } = await import('./pptx-import.js');
      const r = await parsePptx(file);
      if (!r.ateliers.length) throw new Error('Aucun atelier trouvé dans ce fichier.');
      const last = this.state.data.reduce((m, s) => s.date > m ? s.date : m, this.today);
      const d = new Date(last + 'T12:00:00'); do { d.setDate(d.getDate() + 1); } while (![2, 4].includes(d.getDay()));
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      this.setState({ imp: { status: 'review', fileName: r.fileName, theme: r.theme, date, ateliers: r.ateliers, keep: r.ateliers.map(() => true) } });
    } catch (err) {
      this.setState({ imp: { status: 'error', fileName: file.name, error: err.message || 'Lecture impossible.' } });
    }
  }
  createSession() {
    const im = this.state.imp, data = this.state.data;
    const ateliers = im.ateliers.filter((_, i) => im.keep[i]);
    if (!ateliers.length || !im.date) return;
    const deleted = this.loadEdits().deleted;
    let id = im.date; while (data.some(s => s.id === id) || deleted.includes(id)) id += 'b';
    const S = { id, date: im.date, label: labelOf(im.date), theme: im.theme || 'Nouvelle séance', ateliers, imported: true };
    const next = [...data, S].sort((a, b) => a.date.localeCompare(b.date));
    try { const prev = JSON.parse(localStorage.getItem(STORE) || '[]'); localStorage.setItem(STORE, JSON.stringify([...prev, S])); } catch (e) {}
    this.setState({ data: next, imp: null, tab: 'list', stack: [{ v: 'seance', sid: id }] });
  }

  // ── edit / delete ──
  loadEdits() {
    try { const e = JSON.parse(localStorage.getItem(EDITS) || '{}'); return { patches: e.patches || {}, deleted: e.deleted || [] }; }
    catch (e) { return { patches: {}, deleted: [] }; }
  }
  saveEdits(e) { try { localStorage.setItem(EDITS, JSON.stringify(e)); } catch (err) {} }
  openEdit(sid) {
    const S = this.session(sid);
    this.setState(s => ({ edit: { sid, date: S.date, theme: S.theme, ateliers: S.ateliers, keep: S.ateliers.map(() => true) }, stack: [...s.stack, { v: 'edit', sid }] }));
  }
  moveAtelier(i, dir) {
    this.setState(s => {
      const e = s.edit, j = i + dir;
      if (j < 0 || j >= e.ateliers.length) return null;
      const swap = arr => { const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };
      return { edit: { ...e, ateliers: swap(e.ateliers), keep: swap(e.keep) } };
    });
  }
  saveEdit() {
    const e = this.state.edit, ateliers = e.ateliers.filter((_, i) => e.keep[i]);
    if (!ateliers.length || !e.date) return;
    const patch = { date: e.date, label: labelOf(e.date), theme: e.theme.trim() || 'Séance', ateliers };
    const ed = this.loadEdits(); ed.patches[e.sid] = patch; this.saveEdits(ed);
    this.setState(s => ({
      data: s.data.map(x => x.id === e.sid ? { ...x, ...patch } : x).sort((a, b) => a.date.localeCompare(b.date)),
      edit: null, stack: s.stack.filter(x => x.v !== 'edit'),
    }));
  }
  deleteSession(sid) {
    const S = this.session(sid);
    if (!S || !window.confirm(`Supprimer la séance « ${S.label} · ${S.theme} » ?\nCette action est définitive sur ce téléphone.`)) return;
    const ed = this.loadEdits(); delete ed.patches[sid]; if (!ed.deleted.includes(sid)) ed.deleted.push(sid); this.saveEdits(ed);
    try { const imp = JSON.parse(localStorage.getItem(STORE) || '[]'); localStorage.setItem(STORE, JSON.stringify(imp.filter(x => x.id !== sid))); } catch (e) {}
    this.setState(s => ({ data: s.data.filter(x => x.id !== sid), edit: null, tab: 'list', stack: [] }));
  }

  // ── chronos of one atelier ──
  updateAtelier(sid, ai, atelier) {
    const S = this.session(sid), ateliers = S.ateliers.map((x, i) => i === ai ? atelier : x);
    const ed = this.loadEdits();
    ed.patches[sid] = { ...(ed.patches[sid] || {}), date: S.date, label: S.label, theme: S.theme, ateliers };
    this.saveEdits(ed);
    this.setState(s => ({ data: s.data.map(x => x.id === sid ? { ...x, ateliers } : x), chrono: null }));
  }
  openChrono(sid, ai) {
    const a = this.session(sid).ateliers[ai], sq = seqOf(a);
    this.setState({ chrono: { sid, ai, n: String(sq.n), min: String(Math.floor(sq.work / 60)), sec: String(sq.work % 60), rest: String(this.restFor(sq)) } });
  }
  chronoParsed() {
    const c = this.state.chrono, int = v => { const x = parseInt(v, 10); return Number.isFinite(x) && x >= 0 ? x : NaN; };
    const n = int(c.n), work = int(c.min || '0') * 60 + int(c.sec || '0'), rest = int(c.rest || '0');
    return { n, work, rest, ok: n >= 1 && n <= 99 && work >= 5 && rest >= 0 };
  }
  saveChrono() {
    const c = this.state.chrono, v = this.chronoParsed();
    if (!v.ok) return;
    const a = this.session(c.sid).ateliers[c.ai];
    this.updateAtelier(c.sid, c.ai, { ...a, chrono: { n: v.n, work: v.work, rest: v.n > 1 ? v.rest : 0 } });
  }
  resetChrono(sid, ai) {
    const { chrono, ...a } = this.session(sid).ateliers[ai];
    this.updateAtelier(sid, ai, a);
  }

  // ── live timer ──
  startLive(sid, ai = 0) {
    const sq = seqOf(this.session(sid).ateliers[ai]);
    this.setState({ live: { sid, ai, k: 0, phase: 'work', left: sq.work, running: false, elapsed: 0, done: [], finished: false } });
  }
  restFor(sq) { return sq.rest != null ? sq.rest : RECUP; }
  advance(l, sound = true) {
    // Every chrono that runs out (work, recovery, end of atelier) rings the chosen sound.
    if (sound) this.playSound();
    const S = this.session(l.sid), sq = seqOf(S.ateliers[l.ai]), rest = this.restFor(sq);
    if (l.phase === 'work' && l.k < sq.n - 1 && rest > 0) return { ...l, phase: 'rest', left: rest };
    if (l.k < sq.n - 1) return { ...l, k: l.k + 1, phase: 'work', left: sq.work };
    const done = l.done.includes(l.ai) ? l.done : [...l.done, l.ai];
    if (l.ai < S.ateliers.length - 1) { const n = seqOf(S.ateliers[l.ai + 1]); return { ...l, ai: l.ai + 1, k: 0, phase: 'work', left: n.work, running: false, done }; }
    return { ...l, running: false, finished: true, done };
  }
  // Wall-clock driven so the countdown stays right even if iOS throttles timers.
  tick() {
    const l0 = this.state.live; if (!l0 || !l0.running) return;
    const now = Date.now(); let steps = Math.floor((now - this.lastT) / 1000);
    if (steps <= 0) return;
    this.lastT += steps * 1000;
    let l = l0;
    while (steps-- > 0 && l.running) {
      const last = steps === 0;
      l = { ...l, left: l.left - 1, elapsed: l.elapsed + 1 };
      if (last && l.left > 0 && l.left <= 3) this.beep();
      if (l.left <= 0) l = this.advance(l, last);
    }
    this.setState({ live: l });
  }
  togglePlay() {
    try { this.tone(1, 0, 0.02, { gain: 0.001 }); } catch (e) {} // unlocks audio on iOS (needs a user gesture)
    this.lastT = Date.now();
    this.setState(s => ({ live: { ...s.live, running: !s.live.running } }));
  }
  prev() {
    const l = this.state.live; if (!l) return;
    const S = this.session(l.sid), sq = seqOf(S.ateliers[l.ai]);
    const full = l.phase === 'work' ? sq.work : this.restFor(sq);
    this.lastT = Date.now();
    if (full - l.left > 3) return this.setState({ live: { ...l, left: full } });
    if (l.phase === 'rest') return this.setState({ live: { ...l, phase: 'work', left: sq.work } });
    if (l.k > 0) return this.setState({ live: { ...l, k: l.k - 1, left: sq.work } });
    if (l.ai > 0) { const p = seqOf(S.ateliers[l.ai - 1]); return this.setState({ live: { ...l, ai: l.ai - 1, k: p.n - 1, phase: 'work', left: p.work } }); }
  }

  // ── view models ──
  liveVals() {
    const l = this.state.live, S = this.session(l.sid), a = S.ateliers[l.ai], sq = seqOf(a), kd = kind(a);
    const rest = this.restFor(sq), isRest = l.phase === 'rest';
    const full = isRest ? rest : sq.work;
    const segN = sq.ift ? 0 : sq.n;
    const segs = Array.from({ length: segN }, (_, i) => i < l.k ? 'var(--color-accent-400)' : i === l.k ? INK : 'rgba(242,242,243,.18)');
    let phase, phaseSub;
    if (sq.ift) { const kmh = (8 + 0.5 * l.k).toFixed(1).replace('.', ','); phase = isRest ? 'Récupération · marcher' : `Palier ${l.k + 1} · ${kmh} km/h`; phaseSub = isRest ? `Ensuite ${(8.5 + 0.5 * l.k).toFixed(1).replace('.', ',')} km/h` : '30″ course'; }
    else { phase = isRest ? 'Récupération' : `Séquence ${l.k + 1} / ${sq.n}`; phaseSub = isRest ? `Puis séquence ${l.k + 2}` : fmtSeq(sq); }
    if (!l.running && l.left === full && l.k === 0 && !isRest) phase = 'Prêt · ' + phase;
    // consignes — highlight the theme/sequence that matches the current séquence
    const rules = a.regles.length ? a.regles : a.comportements;
    const themed = rules.map((t, i) => ({ t, i, m: t.match(/^(Thème|Séquences?)\s*(\d+)/i) })).filter(x => x.m);
    let hi = -1;
    if (themed.length) { const idx = Math.min(themed.length - 1, Math.floor(l.k * themed.length / sq.n)); hi = themed[idx].i; }
    let list = rules.map((t, i) => ({ t: t.length > 140 ? t.slice(0, 137) + '…' : t, i }));
    if (themed.length) list = list.filter(x => !themed.some(th => th.i === x.i) || x.i === hi);
    const consignes = list.slice(0, 4).map(x => ({ t: x.t, line: x.i === hi ? 'var(--color-accent-400)' : 'rgba(242,242,243,.18)', color: x.i === hi ? INK : 'rgba(242,242,243,.82)', weight: x.i === hi ? 500 : 400 }));
    const nx = S.ateliers[l.ai + 1];
    const next = l.k < sq.n - 1 ? (isRest ? 'Prochaine séquence à 0:00' : `Puis ${rest > 0 ? mmss(rest) + ' de récupération' : 'séquence suivante'}`) : nx ? `Ensuite : ${cap(nx.titre)} · ${fmtSeq(seqOf(nx))}` : 'Dernière séquence de la séance';
    return {
      finished: l.finished,
      pos: `Atelier ${l.ai + 1} / ${S.ateliers.length}`,
      kicker: `${kd.type} · ${kd.dom} · ${a.surface}`,
      titre: a.titre, segs, phase, phaseSub, clock: mmss(l.left),
      pct: `${Math.round((1 - l.left / full) * 100)}%`,
      phaseColor: isRest ? '#e9c46a' : 'var(--color-accent-400)',
      consignes, next, schema: a.schema, showSchema: LIVE_SCHEMA && !!a.schema,
      playLabel: l.running ? 'Pause' : (l.elapsed ? 'Reprendre' : 'Démarrer'),
      sessionLabel: S.label, elapsed: Math.round(l.elapsed / 60) + ' min', doneCount: `${l.done.length} / ${S.ateliers.length}`,
      recap: S.ateliers.map((x, i) => ({ num: String(i + 1).padStart(2, '0'), titre: x.titre, dur: l.done.includes(i) ? fmtSeq(seqOf(x)) : 'Non fait' })),
    };
  }

  sessionVals(id, showBack) {
    const S = this.session(id), all = this.state.data, T = this.today;
    let t = 0;
    const ateliers = S.ateliers.map((a, i) => {
      const sq = seqOf(a), kd = kind(a), start = t; t += sq.total;
      return { start: start + '′', kicker: `${String(i + 1).padStart(2, '0')} · ${kd.type} · ${kd.dom}`, titre: a.titre,
        meta: [a.surface, fmtSeq(sq), effOf(a).short].filter(Boolean).join(' · '), schema: a.schema,
        open: () => this.push({ v: 'atelier', sid: id, ai: i }) };
    });
    const nextS = all.find(s => s.date > S.date);
    return {
      showBack, label: S.label, theme: S.theme,
      kicker: S.date === T ? 'Aujourd’hui · U15' : S.date < T ? 'Séance passée' : 'À venir',
      duration: t, count: S.ateliers.length, ateliers, end: t + '′',
      start: () => this.startLive(id, 0),
      hasNext: !showBack && !!nextS, nextLabel: nextS ? nextS.label : '', nextTheme: nextS ? nextS.theme : '',
      openNext: () => nextS && this.push({ v: 'seance', sid: nextS.id }),
      edit: () => this.openEdit(id), remove: () => this.deleteSession(id),
    };
  }

  atelierVals(sid, ai) {
    const S = this.session(sid), a = S.ateliers[ai], sq = seqOf(a), kd = kind(a), eff = effOf(a);
    const sections = [
      { title: 'But du jeu', items: a.but, mark: '◆' },
      { title: 'Règles', items: a.regles, mark: '—' },
      { title: 'Comportements attendus', items: a.comportements, mark: '→' },
      { title: 'Variables complexifiantes', items: a.comp, mark: '+' },
      { title: 'Variables simplifiantes', items: a.simp, mark: '−' },
      { title: 'Le coin de l’éducateur', items: a.conseils, mark: '·' },
    ].filter(s => s.items && s.items.length);
    const prev = this.state.stack[this.state.stack.length - 2];
    return {
      kicker: `${kd.type} · ${kd.dom}`, titre: a.titre, schema: a.schema,
      src: `Atelier ${ai + 1} / ${S.ateliers.length} · ${S.label}`,
      backLabel: prev ? (prev.v === 'seance' ? S.label : 'Retour') : this.state.tab === 'library' ? 'Exercices' : this.state.tab === 'list' ? 'Séances' : 'Aujourd’hui',
      specs: [
        { k: 'Surface', v: a.surface || '—', col: 'auto' }, { k: 'Temps total', v: sq.custom ? `${sq.total} minutes` : a.total || '—', col: 'auto' },
        { k: 'Séquences', v: sq.custom ? fmtSeq(sq) : a.sequences || fmtSeq(sq), col: '1 / -1',
          sub: sq.custom ? `${sq.n > 1 ? fmtRest(sq.rest) + ' · ' : ''}Chronos modifiés` : sq.n > 1 ? fmtRest(this.restFor(sq)) : '' },
        { k: 'Effectif', v: eff.lines.join(' · ') || '—', col: '1 / -1', sub: eff.total },
      ],
      sections,
      startLabel: `Lancer le minuteur · ${fmtSeq(sq)}`,
      start: () => this.startLive(sid, ai),
      custom: !!sq.custom,
      editChrono: () => this.openChrono(sid, ai), resetChrono: () => this.resetChrono(sid, ai),
      chrono: this.state.chrono && this.state.chrono.sid === sid && this.state.chrono.ai === ai ? this.chronoVals() : null,
    };
  }

  chronoVals() {
    const c = this.state.chrono, v = this.chronoParsed();
    const set = k => e => { const x = e.target.value; this.setState(s => ({ chrono: { ...s.chrono, [k]: x } })); };
    return { ...c, ok: v.ok, multi: v.n > 1,
      summary: v.ok ? `${v.n} × ${mmss(v.work)}${v.n > 1 ? ` · ${v.rest} s de récup` : ''} · ${Math.ceil((v.n * v.work + (v.n > 1 ? (v.n - 1) * v.rest : 0)) / 60)} min au total` : 'Au moins 1 répétition de 5 secondes.',
      onN: set('n'), onMin: set('min'), onSec: set('sec'), onRest: set('rest'),
      save: () => this.saveChrono(), cancel: () => this.setState({ chrono: null }) };
  }

  importVals() {
    const im = this.state.imp || { status: 'error', error: 'Aucun fichier.' }, data = this.state.data;
    const known = new Set(); data.forEach(s => s.ateliers.forEach(a => known.add(libKey(a))));
    const rows = (im.ateliers || []).map((a, i) => {
      const kd = kind(a), on = im.keep[i], isNew = !known.has(libKey(a));
      return { kicker: `${String(i + 1).padStart(2, '0')} · ${kd.type} · ${kd.dom}`, titre: a.titre, schema: a.schema || '',
        meta: [a.surface, fmtSeq(seqOf(a)), effOf(a).short].filter(Boolean).join(' · '),
        tag: isNew ? 'Nouvel exercice' : 'Déjà dans la bibliothèque', tagClass: isNew ? 'tag tag-accent' : 'tag tag-neutral', on,
        toggle: () => this.setState(s => ({ imp: { ...s.imp, keep: s.imp.keep.map((k, j) => j === i ? !k : k) } })) };
    });
    const kept = (im.ateliers || []).filter((_, i) => im.keep[i]);
    const nNew = kept.filter(a => !known.has(libKey(a))).length;
    const total = kept.reduce((m, a) => m + seqOf(a).total, 0);
    return { status: im.status, errorMsg: im.error || '', fileName: im.fileName || '', date: im.date || '', theme: im.theme || '', rows,
      summary: `${kept.length} atelier${kept.length > 1 ? 's' : ''} · ${total} min · ${nNew} nouvel${nNew > 1 ? 's' : ''} exercice${nNew > 1 ? 's' : ''} ajouté${nNew > 1 ? 's' : ''} à la bibliothèque`,
      canCreate: kept.length > 0 && !!im.date,
      onDate: e => { const v = e.target.value; this.setState(s => ({ imp: { ...s.imp, date: v } })); },
      onTheme: e => { const v = e.target.value; this.setState(s => ({ imp: { ...s.imp, theme: v } })); },
      cancel: () => this.setState(s => ({ imp: null, stack: s.stack.filter(x => x.v !== 'import') })) };
  }

  editVals() {
    const e = this.state.edit;
    const rows = e.ateliers.map((a, i) => {
      const kd = kind(a);
      return { kicker: `${String(i + 1).padStart(2, '0')} · ${kd.type} · ${kd.dom}`, titre: a.titre, schema: a.schema || '',
        meta: [a.surface, fmtSeq(seqOf(a))].filter(Boolean).join(' · '), on: e.keep[i],
        first: i === 0, last: i === e.ateliers.length - 1,
        toggle: () => this.setState(s => ({ edit: { ...s.edit, keep: s.edit.keep.map((k, j) => j === i ? !k : k) } })),
        up: () => this.moveAtelier(i, -1), down: () => this.moveAtelier(i, 1) };
    });
    const kept = e.ateliers.filter((_, i) => e.keep[i]);
    const total = kept.reduce((m, a) => m + seqOf(a).total, 0);
    return { date: e.date, theme: e.theme, rows,
      summary: `${kept.length} atelier${kept.length > 1 ? 's' : ''} · ${total} min`,
      canSave: kept.length > 0 && !!e.date,
      onDate: ev => { const v = ev.target.value; this.setState(s => ({ edit: { ...s.edit, date: v } })); },
      onTheme: ev => { const v = ev.target.value; this.setState(s => ({ edit: { ...s.edit, theme: v } })); },
      save: () => this.saveEdit(), remove: () => this.deleteSession(e.sid),
      cancel: () => this.setState(s => ({ edit: null, stack: s.stack.filter(x => x.v !== 'edit') })) };
  }

  listGroups() {
    const T = this.today, data = this.state.data;
    const item = s => {
      const p = dateParts(s.date), t = s.ateliers.reduce((m, a) => m + seqOf(a).total, 0), isT = s.date === T;
      return { id: s.id, dow: p.dow, day: p.day, theme: s.theme, meta: `${p.day} ${p.mois} · ${s.ateliers.length} ateliers · ${t} min`,
        tag: isT ? 'Aujourd’hui' : s.imported ? 'Importée' : '',
        boxBg: isT ? 'var(--color-accent)' : 'transparent', boxInk: isT ? 'var(--color-bg)' : 'var(--color-text)', boxBorder: isT ? 'var(--color-accent)' : 'var(--color-divider)',
        open: () => this.push({ v: 'seance', sid: s.id }) };
    };
    return [
      { title: 'À venir', items: data.filter(s => s.date >= T).map(item) },
      { title: 'Passées', items: data.filter(s => s.date < T).reverse().map(item) },
    ].filter(g => g.items.length);
  }

  libraryItems() {
    const T = this.today, seen = new Map();
    this.state.data.forEach(s => s.ateliers.forEach((a, ai) => {
      const key = libKey(a), e = seen.get(key);
      if (e) { e.uses++; e.last = s; e.ai = ai; } else seen.set(key, { a, ai, uses: 1, last: s });
    }));
    const f = this.state.filter, q = this.state.q.trim().toLowerCase();
    return [...seen.values()].filter(({ a }) => {
      const kd = kind(a);
      if (f === 'Échauffement' && kd.type !== 'Échauffement') return false;
      if (['Technique', 'Tactique', 'Physique'].includes(f) && kd.dom !== f) return false;
      if (q && !(a.titre + ' ' + a.regles.join(' ') + ' ' + a.but.join(' ') + ' ' + a.surface).toLowerCase().includes(q)) return false;
      return true;
    }).map(({ a, last, ai, uses }) => {
      const kd = kind(a), sq = seqOf(a), p = dateParts(last.date);
      return { key: last.id + ai, kicker: `${kd.type} · ${kd.dom}`, titre: a.titre, schema: a.schema,
        meta: [a.surface, fmtSeq(sq), effOf(a).short].filter(Boolean).join(' · '),
        src: `${uses > 1 ? uses + ' utilisations · ' : ''}${last.date >= T ? 'prévu le' : 'dernière le'} ${p.day} ${p.mois}`,
        open: () => this.push({ v: 'atelier', sid: last.id, ai }) };
    });
  }

  // ── render ──
  render() {
    const { data, tab, stack, live } = this.state;
    if (live && data) return <div className="shell" style={{ background: 'var(--color-accent-900)', color: INK }}>{this.renderLive()}</div>;

    const top = stack[stack.length - 1];
    const view = top ? top.v : tab === 'today' ? 'seance' : tab;
    const openPicker = () => this.fileRef.current && this.fileRef.current.click();
    const goBack = () => this.setState(s => ({ stack: s.stack.slice(0, -1) }));
    const tabs = [['today', 'Aujourd’hui', I.TabToday], ['list', 'Séances', I.TabList], ['library', 'Exercices', I.TabLib]];
    const sid = top ? top.sid : data && this.todayId();

    return (
      <div className="shell" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <div ref={this.scrollRef} className="scroller">
          {data && view === 'seance' && sid && this.renderSession(this.sessionVals(sid, !!top), goBack)}
          {data && view === 'list' && this.renderList(openPicker)}
          {data && view === 'library' && this.renderLibrary(openPicker)}
          {data && view === 'atelier' && this.renderAtelier(this.atelierVals(top.sid, top.ai), goBack)}
          {data && view === 'import' && this.renderImport(this.importVals(), openPicker)}
          {data && view === 'edit' && this.state.edit && this.renderEdit(this.editVals())}
        </div>
        <input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" ref={this.fileRef} onChange={e => this.onFile(e)} style={{ display: 'none' }} />
        <nav className="tabbar">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} onClick={() => this.setState({ tab: id, stack: [] })} aria-current={tab === id ? 'page' : undefined}
              style={{ height: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'transparent', border: 0, cursor: 'pointer', color: tab === id ? 'var(--color-accent)' : 'var(--color-neutral-700)', font: '600 12px var(--font-heading)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              <Icon />{label}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  renderLive() {
    const lv = this.liveVals(), close = () => this.setState({ live: null, soundPanel: false });
    const faint = 'rgba(242,242,243,.55)';
    return (
      <div className="live">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...kickerS, color: 'var(--color-accent-400)' }}>{lv.pos}</span>
          <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => this.setState(s => ({ soundPanel: !s.soundPanel }))} aria-label="Sonnerie" aria-expanded={this.state.soundPanel} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: this.state.soundPanel ? 'rgba(242,242,243,.14)' : 'transparent', border: '1px solid rgba(242,242,243,.25)', color: INK, cursor: 'pointer', padding: 0 }}>{this.state.settings.sound === 'none' ? <I.BellOff /> : <I.Bell />}</button>
          <button onClick={close} aria-label="Fermer" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(242,242,243,.25)', color: INK, cursor: 'pointer', padding: 0 }}><I.Close /></button>
          </div>
        </div>
        {this.state.soundPanel && this.renderSoundPanel()}

        {lv.finished ? (<>
          <div className="live-body" style={{ gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ ...kickerS, color: 'var(--color-accent-400)' }}>Séance terminée</span>
              <span style={{ font: '600 44px/1 var(--font-heading)', textTransform: 'uppercase', letterSpacing: '-.01em' }}>{lv.sessionLabel}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid rgba(242,242,243,.2)' }}>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 2, borderRight: '1px solid rgba(242,242,243,.2)' }}><span style={{ font: '600 34px/1 var(--font-heading)' }}>{lv.elapsed}</span><span style={{ ...smallCapsS, color: 'var(--color-accent-400)' }}>Temps écoulé</span></div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ font: '600 34px/1 var(--font-heading)' }}>{lv.doneCount}</span><span style={{ ...smallCapsS, color: 'var(--color-accent-400)' }}>Ateliers</span></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lv.recap.map(r => (
                <div key={r.num} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '12px 0', borderBottom: '1px solid rgba(242,242,243,.14)' }}>
                  <span style={{ font: '600 15px var(--font-heading)', color: 'var(--color-accent-400)', width: 22, flex: 'none' }}>{r.num}</span>
                  <span style={{ flex: 1, font: '600 17px/1.15 var(--font-heading)', textTransform: 'uppercase' }}>{r.titre}</span>
                  <span style={{ font: '500 12px var(--font-body)', color: 'rgba(242,242,243,.7)', flex: 'none' }}>{r.dur}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={close} style={{ flex: 'none', minHeight: 56, background: INK, color: 'var(--color-accent-900)', border: 0, font: '600 18px var(--font-heading)', textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer' }}>Retour à la séance</button>
        </>) : (<>
          <div className="live-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ font: '500 11px var(--font-body)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(242,242,243,.65)' }}>{lv.kicker}</span>
            <span style={{ font: '600 34px/1 var(--font-heading)', textTransform: 'uppercase', letterSpacing: '-.01em', textWrap: 'balance' }}>{lv.titre}</span>
          </div>
          {lv.segs.length > 0 && <div style={{ display: 'flex', gap: 4 }}>{lv.segs.map((bg, i) => <div key={i} style={{ flex: 1, height: 6, background: bg }} />)}</div>}
          <div className="blueprint" style={{ borderColor: 'rgba(242,242,243,.22)', padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 10, color: INK, flex: 'none' }}>
            <I.Corners color={faint} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ font: '500 12px var(--font-body)', letterSpacing: '.12em', textTransform: 'uppercase', color: lv.phaseColor }}>{lv.phase}</span>
              <span style={{ font: '500 12px var(--font-body)', color: 'rgba(242,242,243,.6)', flex: 'none' }}>{lv.phaseSub}</span>
            </div>
            <span className="clock" role="timer" aria-live="off">{lv.clock}</span>
            <div style={{ height: 2, background: 'rgba(242,242,243,.15)' }}><div style={{ height: 2, width: lv.pct, background: lv.phaseColor, transition: 'width 1s linear' }} /></div>
          </div>
          {lv.showSchema && <img className="live-schema" src={lv.schema} alt="Schéma de l'atelier" style={{ width: '100%', height: 'auto', maxHeight: '40dvh', objectFit: 'contain', border: '1px solid rgba(242,242,243,.22)', display: 'block', flex: 'none' }} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, overflow: 'hidden', flex: 'none' }}>
            <span style={{ ...smallCapsS, letterSpacing: '.12em', color: faint, marginBottom: 4 }}>Consignes</span>
            {lv.consignes.map((c, i) => <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0 7px 10px', borderLeft: `2px solid ${c.line}`, font: `${c.weight} 14px/1.35 var(--font-body)`, color: c.color }}>{c.t}</div>)}
          </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 'none' }}>
            <span style={{ font: '500 12px var(--font-body)', color: 'rgba(242,242,243,.6)', textAlign: 'center' }}>{lv.next}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => this.prev()} aria-label="Précédent" style={liveIconBtnS}><I.Prev /></button>
              <button className="play" onClick={() => this.togglePlay()} style={{ flex: 1, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--color-accent)', border: '1px solid var(--color-accent)', color: INK, font: '600 20px var(--font-heading)', textTransform: 'uppercase', letterSpacing: '.06em', cursor: 'pointer' }}>{lv.playLabel}</button>
              <button onClick={() => { this.lastT = Date.now(); this.setState(s => ({ live: this.advance({ ...s.live }, false) })); }} aria-label="Suivant" style={liveIconBtnS}><I.Next /></button>
            </div>
          </div>
        </>)}
      </div>
    );
  }

  renderSoundPanel() {
    const st = this.state.settings;
    const chip = (on, label, onClick, key) => (
      <button key={key} onClick={onClick} aria-pressed={on} style={{ height: 40, padding: '0 12px', border: `1px solid ${on ? 'var(--color-accent-400)' : 'rgba(242,242,243,.25)'}`, background: on ? 'var(--color-accent-400)' : 'transparent', color: on ? 'var(--color-accent-900)' : INK, font: '600 14px var(--font-heading)', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>{label}</button>
    );
    const lbl = { ...smallCapsS, letterSpacing: '.12em', color: 'rgba(242,242,243,.6)' };
    return (
      <div className="blueprint" style={{ borderColor: 'rgba(242,242,243,.22)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, flex: 'none' }}>
        <I.Corners color="rgba(242,242,243,.55)" />
        <span style={lbl}>Sonnerie de fin de chrono</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SOUNDS.map(([id, label]) => chip(st.sound === id, label, () => this.setSettings({ sound: id }, () => this.playSound()), id))}
        </div>
        <span style={lbl}>Volume</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {VOLUMES.map(([label], i) => chip(st.volume === i, label, () => this.setSettings({ volume: i }, () => this.playSound()), label))}
        </div>
        <button onClick={() => this.setSettings({ countdown: !st.countdown })} role="switch" aria-checked={st.countdown} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, background: 'transparent', border: 0, color: INK, padding: 0, cursor: 'pointer', font: '400 15px var(--font-body)', textAlign: 'left' }}>
          <span style={{ width: 22, height: 22, flex: 'none', border: `1.5px solid ${st.countdown ? 'var(--color-accent-400)' : 'rgba(242,242,243,.4)'}`, background: st.countdown ? 'var(--color-accent-400)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-900)' }}>{st.countdown && <I.Check />}</span>
          Petits bips 3-2-1 avant la fin
        </button>
        <span style={{ font: '400 12px/1.4 var(--font-body)', color: 'rgba(242,242,243,.55)' }}>Sur iPhone, le son est coupé si le bouton silencieux est activé.</span>
      </div>
    );
  }

  renderSession(sv, goBack) {
    const statLabel = { ...smallCapsS, color: 'var(--color-neutral-700)' };
    return (
      <div className="screen" style={{ gap: 22 }}>
        {sv.showBack && <button onClick={goBack} className="btn btn-ghost" style={ghostBtnS}><I.Back />Séances</button>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={kickerS}>{sv.kicker}</span>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: .98, textTransform: 'uppercase' }}>{sv.label}</h1>
          <span style={{ font: '400 16px/1.4 var(--font-body)', color: 'var(--color-neutral-800)', textWrap: 'pretty' }}>{sv.theme}</span>
        </div>
        <div className="blueprint" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
          <I.Corners />
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ font: '600 28px/1 var(--font-heading)' }}>{sv.duration}</span><span style={statLabel}>Minutes</span></div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--color-divider)' }}><span style={{ font: '600 28px/1 var(--font-heading)' }}>{sv.count}</span><span style={statLabel}>Ateliers</span></div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--color-divider)' }}><span style={{ font: '600 28px/1 var(--font-heading)' }}>U15</span><span style={statLabel}>Catégorie</span></div>
        </div>
        <button onClick={sv.start} className="btn btn-primary blueprint" style={bigBtnS}><I.Corners /><I.Play />Lancer la séance</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h6 style={{ margin: '0 0 6px', color: 'var(--color-neutral-700)' }}>Déroulé</h6>
          {sv.ateliers.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingTop: 14, gap: 6 }}>
                <span style={{ font: '500 11px var(--font-body)', color: 'var(--color-neutral-700)', fontVariantNumeric: 'tabular-nums' }}>{a.start}</span>
                <div style={{ flex: 1, width: 1, background: 'var(--color-divider)', marginLeft: 6 }} />
              </div>
              <div onClick={a.open} className="blueprint hov7" role="button" style={{ display: 'flex', gap: 12, padding: 10, margin: '6px 0', cursor: 'pointer' }}>
                <I.Corners />
                <img src={a.schema} alt="" loading="lazy" style={{ width: 64, height: 64, objectFit: 'cover', flex: 'none', border: '1px solid var(--color-divider)' }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ ...smallCapsS, color: 'var(--color-accent-700)' }}>{a.kicker}</span>
                  <span style={{ font: '600 18px/1.08 var(--font-heading)', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{a.titre}</span>
                  <span style={{ font: '400 13px/1.35 var(--font-body)', color: 'var(--color-neutral-700)' }}>{a.meta}</span>
                </div>
              </div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', gap: 10 }}><span style={{ font: '500 11px var(--font-body)', color: 'var(--color-neutral-700)' }}>{sv.end}</span><span style={{ font: '400 13px var(--font-body)', color: 'var(--color-neutral-700)' }}>Fin de séance</span></div>
        </div>
        {sv.hasNext && (
          <div onClick={sv.openNext} role="button" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: '1px solid var(--color-divider)', cursor: 'pointer' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ ...smallCapsS, color: 'var(--color-neutral-700)' }}>Prochaine séance · {sv.nextLabel}</span>
              <span style={{ font: '600 18px var(--font-heading)', textTransform: 'uppercase' }}>{sv.nextTheme}</span>
            </div>
            <I.Chevron />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4 }}>
          <button onClick={sv.edit} className="btn btn-secondary" style={editBtnS}>Modifier</button>
          <button onClick={sv.remove} className="btn btn-danger" style={editBtnS}>Supprimer</button>
        </div>
      </div>
    );
  }

  renderHeader(kicker, title, openPicker) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={kickerS}>{kicker}</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1, textTransform: 'uppercase', minWidth: 0 }}>{title}</h1>
          <button onClick={openPicker} className="btn btn-secondary" style={importBtnS}><I.Upload />Importer PPT</button>
        </div>
      </div>
    );
  }

  renderList(openPicker) {
    return (
      <div className="screen" style={{ gap: 18 }}>
        {this.renderHeader('Saison 2026–27 · U15', 'Séances', openPicker)}
        {this.listGroups().map(g => (
          <div key={g.title} style={{ display: 'flex', flexDirection: 'column' }}>
            <h6 style={{ margin: '6px 0 4px', color: 'var(--color-neutral-700)' }}>{g.title}</h6>
            {g.items.map(s => (
              <div key={s.id} onClick={s.open} className="hov6" role="button" style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '13px 0', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 48, border: `1px solid ${s.boxBorder}`, background: s.boxBg, color: s.boxInk }}>
                  <span style={{ font: '500 9px var(--font-body)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{s.dow}</span>
                  <span style={{ font: '600 22px/1 var(--font-heading)' }}>{s.day}</span>
                </div>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ font: '600 17px/1.1 var(--font-heading)', textTransform: 'uppercase' }}>{s.theme}</span>
                  <span style={{ font: '400 13px var(--font-body)', color: 'var(--color-neutral-700)' }}>{s.meta}</span>
                </div>
                <span style={{ font: '500 11px var(--font-body)', color: 'var(--color-accent-700)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{s.tag}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  renderLibrary(openPicker) {
    const items = this.libraryItems(), f = this.state.filter;
    return (
      <div className="screen" style={{ gap: 16 }}>
        {this.renderHeader(`${items.length} ateliers`, 'Exercices', openPicker)}
        <div style={{ position: 'relative' }}>
          <I.Search />
          <input className="input" type="search" enterKeyHint="search" value={this.state.q} onChange={e => this.setState({ q: e.target.value })} placeholder="Rechercher : appuis, 4vs2, mini-buts…" style={{ height: 44, paddingLeft: 38 }} />
        </div>
        <div className="bleed" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {['Tous', 'Échauffement', 'Technique', 'Tactique', 'Physique'].map(label => {
            const on = f === label;
            return <button key={label} onClick={() => this.setState({ filter: label })} style={{ flex: 'none', height: 36, padding: '0 13px', border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-divider)'}`, background: on ? 'var(--color-accent)' : 'transparent', color: on ? 'var(--color-bg)' : 'var(--color-text)', font: '600 14px var(--font-heading)', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>{label}</button>;
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
          {items.map(it => (
            <div key={it.key} onClick={it.open} className="blueprint hov7" role="button" style={{ display: 'flex', gap: 12, padding: 10, cursor: 'pointer' }}>
              <I.Corners />
              <img src={it.schema} alt="" loading="lazy" style={{ width: 76, height: 76, objectFit: 'cover', flex: 'none', border: '1px solid var(--color-divider)' }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ ...smallCapsS, color: 'var(--color-accent-700)' }}>{it.kicker}</span>
                <span style={{ font: '600 18px/1.08 var(--font-heading)', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{it.titre}</span>
                <span style={{ font: '400 13px/1.35 var(--font-body)', color: 'var(--color-neutral-700)' }}>{it.meta}</span>
                <span style={{ font: '400 12px var(--font-body)', color: 'var(--color-neutral-600)' }}>{it.src}</span>
              </div>
            </div>
          ))}
          {items.length === 0 && <span style={{ font: '400 14px var(--font-body)', color: 'var(--color-neutral-700)', padding: '20px 0' }}>Aucun atelier ne correspond.</span>}
        </div>
      </div>
    );
  }

  renderAtelier(av, goBack) {
    return (
      <div className="screen" style={{ gap: 20 }}>
        <button onClick={goBack} className="btn btn-ghost" style={ghostBtnS}><I.Back />{av.backLabel}</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={kickerS}>{av.kicker}</span>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1, textTransform: 'uppercase', textWrap: 'balance', overflowWrap: 'anywhere' }}>{av.titre}</h1>
          <span style={{ font: '400 13px var(--font-body)', color: 'var(--color-neutral-700)' }}>{av.src}</span>
        </div>
        {av.schema && (
          <figure className="blueprint" style={{ margin: 0, padding: 6 }}>
            <I.Corners />
            <img src={av.schema} alt="Schéma de l'atelier" style={{ width: '100%', display: 'block' }} />
          </figure>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--color-divider)', borderLeft: '1px solid var(--color-divider)' }}>
          {av.specs.map(sp => (
            <div key={sp.k} style={{ gridColumn: sp.col, padding: '10px 12px', borderRight: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ ...smallCapsS, color: 'var(--color-neutral-700)' }}>{sp.k}</span>
              <span style={{ font: '600 17px/1.15 var(--font-heading)', overflowWrap: 'anywhere' }}>{sp.v}</span>
              {sp.sub && <span style={{ font: '400 13px var(--font-body)', color: 'var(--color-neutral-700)' }}>{sp.sub}</span>}
            </div>
          ))}
        </div>
        {av.chrono ? this.renderChrono(av.chrono) : (
          <div style={{ display: 'grid', gridTemplateColumns: av.custom ? '1fr 1fr' : '1fr', gap: 10, marginTop: -8 }}>
            <button onClick={av.editChrono} className="btn btn-secondary" style={editBtnS}><I.Stopwatch />Modifier les chronos</button>
            {av.custom && <button onClick={av.resetChrono} className="btn btn-secondary" style={editBtnS}>Valeurs d’origine</button>}
          </div>
        )}
        {av.sections.map(sec => (
          <div key={sec.title} style={{ display: 'flex', flexDirection: 'column' }}>
            <h6 style={{ margin: '0 0 4px', color: 'var(--color-accent-700)' }}>{sec.title}</h6>
            {sec.items.map((li, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr)', padding: '9px 0', borderBottom: '1px solid color-mix(in srgb,var(--color-text) 8%,transparent)', font: '400 15px/1.45 var(--font-body)', textWrap: 'pretty' }}>
                <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{sec.mark}</span><span style={{ overflowWrap: 'anywhere' }}>{li}</span>
              </div>
            ))}
          </div>
        ))}
        <button onClick={av.start} className="btn btn-primary blueprint" style={{ ...bigBtnS, marginTop: 6 }}><I.Corners /><I.Stopwatch />{av.startLabel}</button>
      </div>
    );
  }

  renderEdit(ev) {
    const arrowS = { width: 36, height: 36, padding: 0, flex: 'none' };
    return (
      <div className="screen" style={{ gap: 20 }}>
        <button onClick={ev.cancel} className="btn btn-ghost" style={ghostBtnS}><I.Back />Annuler</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={kickerS}>Modifier</span>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1, textTransform: 'uppercase' }}>Séance</h1>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          <div className="field"><label htmlFor="ed-date">Date de la séance</label><input id="ed-date" className="input" type="date" value={ev.date} onChange={ev.onDate} style={{ height: 44 }} /></div>
          <div className="field"><label htmlFor="ed-theme">Thème</label><input id="ed-theme" className="input" value={ev.theme} onChange={ev.onTheme} placeholder="ex. Créer et utiliser les espaces" style={{ height: 44 }} /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h6 style={{ margin: '4px 0 0', color: 'var(--color-neutral-700)' }}>Ateliers · cocher / réordonner</h6>
          {ev.rows.map((r, i) => (
            <div key={i} className="blueprint" style={{ display: 'flex', gap: 10, padding: 10, alignItems: 'center', opacity: r.on ? 1 : .5 }}>
              <I.Corners />
              <div onClick={r.toggle} role="checkbox" aria-checked={r.on} className="hov7" style={{ flex: 1, minWidth: 0, display: 'flex', gap: 10, cursor: 'pointer' }}>
                <div style={{ width: 22, height: 22, flex: 'none', marginTop: 2, border: `1.5px solid ${r.on ? 'var(--color-accent)' : 'var(--color-neutral-500)'}`, background: r.on ? 'var(--color-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-bg)' }}>
                  {r.on && <I.Check />}
                </div>
                {r.schema && <img src={r.schema} alt="" loading="lazy" style={{ width: 52, height: 52, objectFit: 'cover', flex: 'none', border: '1px solid var(--color-divider)' }} />}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ ...smallCapsS, color: 'var(--color-accent-700)' }}>{r.kicker}</span>
                  <span style={{ font: '600 16px/1.08 var(--font-heading)', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{r.titre}</span>
                  <span style={{ font: '400 12px/1.35 var(--font-body)', color: 'var(--color-neutral-700)' }}>{r.meta}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 'none' }}>
                <button onClick={r.up} disabled={r.first} className="btn btn-secondary" style={arrowS} aria-label="Monter"><I.Up /></button>
                <button onClick={r.down} disabled={r.last} className="btn btn-secondary" style={arrowS} aria-label="Descendre"><I.Down /></button>
              </div>
            </div>
          ))}
        </div>
        <span style={{ font: '400 13px/1.45 var(--font-body)', color: 'var(--color-neutral-700)' }}>{ev.summary}</span>
        <button onClick={ev.save} disabled={!ev.canSave} className="btn btn-primary blueprint" style={bigBtnS}><I.Corners />Enregistrer</button>
        <button onClick={ev.remove} className="btn btn-danger" style={editBtnS}>Supprimer la séance</button>
      </div>
    );
  }

  renderChrono(cv) {
    const num = (id, label, value, onChange, unit) => (
      <div className="field" style={{ minWidth: 0 }}>
        <label htmlFor={id}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input id={id} className="input" type="number" inputMode="numeric" min={0} value={value} onChange={onChange} style={{ height: 44, width: '100%', minWidth: 0 }} />
          {unit && <span style={{ font: '400 14px var(--font-body)', color: 'var(--color-neutral-700)', flex: 'none' }}>{unit}</span>}
        </div>
      </div>
    );
    return (
      <div className="blueprint" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <I.Corners />
        <span style={{ font: '600 18px var(--font-heading)', textTransform: 'uppercase' }}>Chronos de l’exercice</span>
        {num('ch-n', 'Répétitions', cv.n, cv.onN)}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {num('ch-min', 'Durée · minutes', cv.min, cv.onMin, 'min')}
          {num('ch-sec', 'secondes', cv.sec, cv.onSec, 's')}
        </div>
        {cv.multi && num('ch-rest', 'Récupération entre répétitions', cv.rest, cv.onRest, 's')}
        <span style={{ font: '400 13px/1.45 var(--font-body)', color: cv.ok ? 'var(--color-neutral-700)' : 'var(--color-danger)' }}>{cv.summary}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={cv.cancel} className="btn btn-secondary" style={editBtnS}>Annuler</button>
          <button onClick={cv.save} disabled={!cv.ok} className="btn btn-primary" style={editBtnS}>Enregistrer</button>
        </div>
      </div>
    );
  }

  renderImport(iv, openPicker) {
    return (
      <div className="screen" style={{ gap: 20 }}>
        <button onClick={iv.cancel} className="btn btn-ghost" style={ghostBtnS}><I.Back />Annuler</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ ...kickerS, overflowWrap: 'anywhere' }}>Import · {iv.fileName}</span>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1, textTransform: 'uppercase' }}>Nouvelle séance</h1>
        </div>
        {iv.status === 'parsing' && (
          <div className="blueprint" style={{ padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <I.Corners />
            <span style={{ font: '600 20px var(--font-heading)', textTransform: 'uppercase' }}>Lecture des diapositives…</span>
            <span style={{ font: '400 14px/1.45 var(--font-body)', color: 'var(--color-neutral-700)' }}>Extraction des ateliers, des consignes et des schémas de terrain.</span>
          </div>
        )}
        {iv.status === 'error' && (
          <div className="blueprint" style={{ padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <I.Corners />
            <span style={{ font: '600 20px var(--font-heading)', textTransform: 'uppercase' }}>Import impossible</span>
            <span style={{ font: '400 14px/1.45 var(--font-body)', color: 'var(--color-neutral-800)' }}>{iv.errorMsg}</span>
            <button onClick={openPicker} className="btn btn-secondary" style={{ height: 44, fontSize: 15, textTransform: 'uppercase', letterSpacing: '.05em' }}>Choisir un autre fichier</button>
          </div>
        )}
        {iv.status === 'review' && (<>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            <div className="field"><label htmlFor="imp-date">Date de la séance</label><input id="imp-date" className="input" type="date" value={iv.date} onChange={iv.onDate} style={{ height: 44 }} /></div>
            <div className="field"><label htmlFor="imp-theme">Thème</label><input id="imp-theme" className="input" value={iv.theme} onChange={iv.onTheme} placeholder="ex. Créer et utiliser les espaces" style={{ height: 44 }} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h6 style={{ margin: '4px 0 0', color: 'var(--color-neutral-700)' }}>Ateliers détectés · {iv.rows.length}</h6>
            {iv.rows.map((r, i) => (
              <div key={i} onClick={r.toggle} className="blueprint hov7" role="checkbox" aria-checked={r.on} style={{ display: 'flex', gap: 12, padding: 10, cursor: 'pointer', opacity: r.on ? 1 : .5 }}>
                <I.Corners />
                <div style={{ width: 22, height: 22, flex: 'none', marginTop: 2, border: `1.5px solid ${r.on ? 'var(--color-accent)' : 'var(--color-neutral-500)'}`, background: r.on ? 'var(--color-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-bg)' }}>
                  {r.on && <I.Check />}
                </div>
                {r.schema && <img src={r.schema} alt="" style={{ width: 60, height: 60, objectFit: 'cover', flex: 'none', border: '1px solid var(--color-divider)' }} />}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ ...smallCapsS, color: 'var(--color-accent-700)' }}>{r.kicker}</span>
                  <span style={{ font: '600 17px/1.08 var(--font-heading)', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{r.titre}</span>
                  <span style={{ font: '400 13px/1.35 var(--font-body)', color: 'var(--color-neutral-700)' }}>{r.meta}</span>
                  <span className={r.tagClass} style={{ alignSelf: 'flex-start', marginTop: 3 }}>{r.tag}</span>
                </div>
              </div>
            ))}
          </div>
          <span style={{ font: '400 13px/1.45 var(--font-body)', color: 'var(--color-neutral-700)' }}>{iv.summary}</span>
          <button onClick={() => this.createSession()} disabled={!iv.canCreate} className="btn btn-primary blueprint" style={bigBtnS}><I.Corners />Créer la séance</button>
        </>)}
      </div>
    );
  }
}
