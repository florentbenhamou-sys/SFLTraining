// Parse a coach session .pptx (template « Le coin de l'éducateur ») into ateliers.
const TYPES = /^(EXERCICE|Exercice|exercice|Jeu|JEU|ECH|Ech|ECHA|Echauffement|Situation|ATHLE|30-15 IFT)$/;
const IS_VAR = /^(Mettre|Changer|Faire du|Diminuer|limiter|Limiter|réduire|Réduire|Ajouter|Interdire|Autoriser|Imposer|but doublé|Marquer|finir|Passe de|Enlever|\d touches|Si prise|Agrandir|jouer en|augmenter|Créer deux|Ne pas utiliser|rajouter|Rajouter|Un seul défenseur|Faire 10|Les joueurs ont)/i;
const EFF = /^(\d+|x)\s*(à \d+)?\s*(joueurs?|GB|gardiens?|jokers?)$/i;
const clean = s => s.replace(/^[\s•\-·]+/, '').replace(/\s+/g, ' ').trim();
const dec = t => t.replace(/&amp;/g, '&').replace(/&apos;/g, '’').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const COMP_LBL = /^(variables?\s+)?complexifiantes?\s*:?\s*/i;
const SIMP_LBL = /^(variables?\s+)?simplifiantes?\s*:?\s*/i;

// Z[i] = 'var' | 'comportements' | null : zone of paragraph i, from where its box sits on the slide
// (under the VARIABLES header or under the COMPORTEMENTS ATTENDUS header). Text order in the file
// does not follow the layout, so position is the reliable signal for these two side-by-side boxes.
function parseSlide(P, Z = []) {
  const a = { titre: '', type: '', dominante: '', surface: '', total: '', sequences: '', effectif: [], effectifRaw: [], regles: [], but: [], comp: [], simp: [], comportements: [], conseils: [] };
  const ti = P.findIndex(p => /LE COIN DE L/.test(p));
  const tIdx = ti > 0 ? ti - 1 : 0;
  a.titre = clean(P[tIdx] || '');
  if (!a.titre || /^ESPACE/.test(a.titre) || COMP_LBL.test(a.titre)) a.titre = clean(P.find(p => !/^(ESPACE|Complexifiantes|Simplifiantes|•)/.test(p.trim())) || 'Atelier');
  const lastDraw = P.map(p => /VOTRE ATELIER/.test(p)).lastIndexOf(true);
  const tail = lastDraw >= 0 ? P.slice(lastDraw + 1).map(clean).filter(Boolean) : [];
  let sec = null, lab = '', vsec = 'comp';
  const end = lastDraw >= 0 ? lastDraw + 1 : P.length;
  for (let i = 0; i < end; i++) {
    const p = P[i].trim(), c = clean(p);
    if (i === tIdx || /LE COIN DE L/.test(p)) continue;
    if (Z[i] === 'comportements') { if (c) a.comportements.push(c); continue; }
    if (Z[i] === 'var') {
      if (COMP_LBL.test(c)) { vsec = 'comp'; const r = c.replace(COMP_LBL, ''); if (r) a.comp.push(r); }
      else if (SIMP_LBL.test(c)) { vsec = 'simp'; const r = c.replace(SIMP_LBL, ''); if (r) a.simp.push(r); }
      else if (c) a[vsec].push(c);
      continue;
    }
    if (/^Surface/.test(p)) { a.surface = clean(P[i + 1] || ''); i++; if (P[i + 1] && /terrain|carré/i.test(P[i + 1]) && !/Le temps/.test(P[i + 1])) { a.surface += ' · ' + clean(P[i + 1]); i++; } continue; }
    if (/^Le temps/.test(p)) { a.total = c.replace(/^Le temps (total )?:?\s*/, ''); continue; }
    if (/séquences? de|manches/.test(p) && !a.sequences && p.length < 40) { a.sequences = c; continue; }
    if (EFF.test(p.replace(/\s+/g, ' ').replace(/(\d)(joueurs)/, '$1 $2'))) { const e = c.replace(/(\d)(joueurs)/, '$1 $2'); a.effectifRaw.push(e); if (!/^x/i.test(e)) a.effectif.push(e); continue; }
    if (TYPES.test(p)) { a.type = c; a.dominante = clean(P[i + 1] || ''); i++; sec = null; continue; }
    if (/^(REGLES|RÈGLES|DESCRIPTION|DÉROULEMENT)$/i.test(p)) { sec = 'regles'; continue; }
    if (/^BUT DU JEU$/.test(p)) { sec = 'but'; continue; }
    if (COMP_LBL.test(c)) { sec = 'comp'; const r = c.replace(COMP_LBL, ''); if (r) a.comp.push(r); continue; }
    if (SIMP_LBL.test(c)) { sec = 'simp'; const r = c.replace(SIMP_LBL, ''); if (r) a.simp.push(r); continue; }
    if (/^(CONSEILS|ASTUCE)/.test(p)) continue;
    if (/^(PORTEUR DE BALLE|NON-PORTEURS? DE BALLE|il faudra|CRITÈRES)/i.test(p)) { sec = 'comportements'; lab = /NON/.test(p) ? 'Non-porteur : ' : /PORTEUR/.test(p) ? 'Porteur : ' : ''; continue; }
    if (/^(VARIABLES|COMPORTEMENTS ATTENDUS|LE DESSIN DE|VOTRE ATELIER|ESPACE|EFFECTIF|TEMPS DE JEU|DIFFICULTÉ|Déplacement|x joueurs|X joueurs|X jokers|x GB|joueurs)/i.test(p)) { if (/^VARIABLES/.test(p)) sec = 'var'; if (/DIFFICULT/.test(p)) sec = null; continue; }
    if (sec === 'regles') a.regles.push(c);
    else if (sec === 'but') a.but.push(c);
    else if (sec === 'comp') { if (IS_VAR.test(c)) a.comp.push(c); else { a.comportements.push(c); sec = 'comportements'; lab = ''; } }
    else if (sec === 'simp') { if (IS_VAR.test(c)) a.simp.push(c); else { a.comportements.push(c); sec = 'comportements'; lab = ''; } }
    else if (sec === 'comportements') a.comportements.push((lab && !/^Le (non-)?porteur|^Les? jokers?|^Le joker/i.test(c) ? lab : '') + c);
    else if (sec === 'var' || c.length > 30) a.conseils.push(c);
  }
  a.but.push(...tail.filter(t => !a.but.includes(t)));
  a.comportements.push(...a.conseils.filter(t => t.length < 160));
  a.conseils = a.conseils.filter(t => t.length >= 160);
  const sc = a.comportements.filter(c => /=\s*\d+\s*pts?\b/i.test(c));
  a.but.push(...sc.filter(x => !a.but.includes(x)));
  a.comportements = a.comportements.filter(c => !sc.includes(c));
  return a;
}

// Text boxes of a slide, in file order, with their position (EMU).
function shapesOf(x) {
  return [...x.matchAll(/<p:(sp|graphicFrame)\b[^>]*>[\s\S]*?<\/p:\1>/g)].map(m => {
    const g = m[0].match(/<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"/);
    const paras = m[0].split('</a:p>').map(p => dec([...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(t => t[1]).join(''))).filter(t => t.trim() && t.trim() !== '.');
    return { paras, box: g ? { x: +g[1], y: +g[2], w: +g[3], h: +g[4] } : null };
  }).filter(s => s.paras.length);
}

function zonesOf(shapes) {
  const heads = shapes.filter(s => s.box && s.paras.length === 1).map(s => {
    const t = s.paras[0].trim().toUpperCase();
    return { s, zone: /^VARIABLES$/.test(t) ? 'var' : /^COMPORTEMENTS ATTENDUS$/.test(t) ? 'comportements' : null };
  }).filter(h => h.zone);
  return shapes.map(s => {
    if (!s.box || heads.some(h => h.s === s)) return null;
    const cx = s.box.x + s.box.w / 2;
    const h = heads.filter(h => s.box.y >= h.s.box.y && cx >= h.s.box.x && cx <= h.s.box.x + h.s.box.w)
      .sort((a, b) => b.s.box.y - a.s.box.y)[0];
    return h ? h.zone : null;
  });
}

const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

export async function parsePptx(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((x, y) => parseInt(x.match(/\d+/)[0]) - parseInt(y.match(/\d+/)[0]));
  const rels = {}, use = {};
  for (const s of slides) {
    const n = s.match(/\d+/)[0], f = zip.file(`ppt/slides/_rels/slide${n}.xml.rels`);
    const t = f ? [...new Set([...(await f.async('string')).matchAll(/Target="\.\.\/media\/([^"]+)"/g)].map(m => m[1]))] : [];
    rels[n] = t; t.forEach(x => use[x] = (use[x] || 0) + 1);
  }
  const ateliers = [];
  for (const s of slides) {
    const n = s.match(/\d+/)[0];
    const x = await zip.file(s).async('string');
    const shapes = shapesOf(x), zones = zonesOf(shapes);
    const P = shapes.flatMap(sh => sh.paras), Z = shapes.flatMap((sh, k) => sh.paras.map(() => zones[k]));
    if (P.length < 4) continue;
    const a = parseSlide(P, Z);
    const cand = rels[n].filter(f => use[f] < slides.length || slides.length === 1).filter(f => /\.(png|jpe?g|gif)$/i.test(f));
    let best = null, bs = 0;
    for (const f of cand) { const sz = (await zip.file('ppt/media/' + f).async('uint8array')).length; if (sz > bs) { bs = sz; best = f; } }
    if (best) a.schema = await blobToDataURL(await zip.file('ppt/media/' + best).async('blob'));
    ateliers.push(a);
  }
  const base = file.name.replace(/\.pptx?$/i, '').replace(/\(\d+\)/g, '');
  const theme = base.replace(/^s[ée]ance\s*(du\s*)?/i, '').replace(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*/i, '').replace(/^\d+([-/]\d+)?\s*(septembre|octobre|novembre|décembre|janvier|février|mars|avril|mai|juin|juillet|août)?\s*/i, '').trim();
  return { fileName: file.name, theme: theme ? theme.charAt(0).toUpperCase() + theme.slice(1) : '', ateliers };
}
