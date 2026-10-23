/* Offline handwritten-maths recogniser.
   Symbols: $P point-cloud recogniser (Vatavu, Anthony, Wobbrock 2012) over synthetic
   templates + user-trained samples. Layout: stroke grouping by x-overlap, then
   structural rules for fraction bars, radicals, superscripts, decimal points, minus, "=". */
(function (root) {
  'use strict';
  const N = 32;
  // ---------- geometry helpers ----------
  function catmull(ctrl, steps) {
    if (ctrl.length < 3) {
      const out = []; const [a, b] = ctrl.length === 1 ? [ctrl[0], ctrl[0]] : ctrl;
      for (let i = 0; i <= steps; i++) { const t = i / steps; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      return out;
    }
    const pts = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = [];
    for (let i = 1; i < pts.length - 2; i++) {
      const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    out.push(ctrl[ctrl.length - 1]);
    return out;
  }
  function poly(ctrl) { // straight segments (sharp corners)
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) for (let s = 0; s < 8; s++) { const t = s / 8; out.push([ctrl[i][0] + (ctrl[i + 1][0] - ctrl[i][0]) * t, ctrl[i][1] + (ctrl[i + 1][1] - ctrl[i][1]) * t]); }
    out.push(ctrl[ctrl.length - 1]); return out;
  }
  function ellipse(cx, cy, rx, ry, start, sweep) {
    const out = []; for (let i = 0; i <= 40; i++) { const a = start + sweep * i / 40; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return out;
  }
  const C = c => catmull(c, 8), P = poly;
  // ---------- synthetic templates (y down, ~0..100) ----------
  const T = {
    '0': [[ellipse(50, 50, 30, 50, -Math.PI / 2, -2 * Math.PI)], [ellipse(50, 50, 30, 50, -Math.PI / 2, 2 * Math.PI)]],
    '1': [[P([[30, 20], [50, 0], [50, 100]])], [P([[30, 20], [50, 0], [50, 100]]), P([[30, 100], [70, 100]])]],
    '2': [[C([[15, 25], [30, 5], [55, 0], [75, 15], [75, 40], [50, 65], [15, 100]]).concat(P([[15, 100], [85, 100]]))],
          [C([[15, 20], [45, 0], [75, 20], [60, 55], [15, 100]]).concat(C([[15, 100], [40, 88], [60, 100], [85, 95]]))]],
    '3': [[C([[15, 10], [45, 0], [70, 15], [65, 40], [40, 50]]).concat(C([[40, 50], [70, 60], [75, 85], [45, 100], [15, 90]]))],
          [P([[15, 0], [75, 0], [40, 40]]).concat(C([[40, 40], [70, 55], [75, 85], [45, 100], [15, 90]]))]],
    '4': [[P([[55, 0], [5, 65], [85, 65]]), P([[62, 25], [62, 100]])], [P([[20, 0], [12, 60], [85, 60]]), P([[65, 0], [65, 100]])],
          [P([[55, 0], [5, 65], [85, 65]]).concat(P([[85, 65], [62, 65], [62, 25], [62, 100]])) ]],
    '5': [[P([[72, 0], [22, 0], [17, 45]]).concat(C([[17, 45], [45, 36], [72, 55], [72, 82], [45, 100], [15, 90]]))],
          [P([[22, 0], [17, 45]]).concat(C([[17, 45], [45, 36], [72, 55], [72, 82], [45, 100], [15, 90]])), P([[22, 0], [75, 0]])]],
    '6': [[C([[65, 5], [40, 0], [15, 30], [10, 70], [30, 100], [60, 95], [70, 70], [55, 50], [30, 52], [12, 70]])]],
    '7': [[P([[10, 0], [80, 0], [35, 100]])], [P([[10, 0], [80, 0], [35, 100]]), P([[30, 50], [72, 50]])]],
    '8': [[C([[62, 10], [40, 0], [18, 12], [25, 35], [60, 60], [72, 85], [45, 100], [18, 88], [25, 62], [60, 38], [68, 15], [55, 3]])],
          [C([[40, 50], [15, 30], [40, 0], [65, 25], [40, 50], [70, 75], [40, 100], [10, 75], [40, 50]])]],
    '9': [[C([[70, 15], [50, 0], [22, 8], [18, 32], [40, 45], [68, 30], [70, 15]]).concat(C([[70, 15], [68, 60], [62, 100]]))],
          [C([[70, 15], [50, 0], [22, 8], [18, 32], [40, 45], [68, 30]]), P([[70, 5], [70, 100]])]],
    'x': [[P([[10, 0], [90, 100]]), P([[90, 0], [10, 100]])], [P([[10, 0], [90, 100]]), P([[10, 100], [90, 0]])],
          [C([[10, 15], [30, 0], [50, 40], [50, 70], [70, 100], [90, 85]]), P([[90, 10], [10, 90]])]],
    'y': [[P([[10, 0], [50, 55]]), P([[90, 0], [30, 150]])], [C([[10, 0], [15, 40], [45, 55], [80, 20]]).concat(C([[80, 0], [78, 100], [55, 150], [20, 130]]))],
          [P([[10, 0], [50, 55], [90, 0]]).concat(P([[90, 0], [30, 150]]))]],
    '+': [[P([[50, 0], [50, 100]]), P([[0, 50], [100, 50]])], [P([[0, 50], [100, 50]]), P([[50, 0], [50, 100]])]],
    '(': [[C([[60, 0], [32, 30], [28, 70], [60, 100]])]],
    ')': [[C([[40, 0], [68, 30], [72, 70], [40, 100]])]],
    'sqrt': [[P([[0, 60], [15, 50], [35, 100], [55, 0], [130, 0]])], [P([[0, 60], [15, 50], [35, 100], [60, 0]])], [P([[5, 55], [35, 100], [55, 0], [130, 0]])]],
    'pi': [[P([[0, 10], [15, 0], [100, 0]]), P([[35, 0], [30, 100]]), P([[70, 0], [75, 100]])],
           [P([[0, 0], [100, 0]]), P([[30, 0], [30, 100]]), P([[70, 0], [70, 100]])],
           [P([[0, 0], [100, 0]]), C([[30, 0], [28, 60], [15, 100]]), C([[70, 0], [70, 80], [90, 100]])]],
    '^': [[P([[0, 100], [50, 0], [100, 100]])]],
    // multiplication cross: same shape family as x; told apart by context (see disambiguate)
    'times': [[P([[10, 10], [90, 90]]), P([[90, 10], [10, 90]])], [P([[10, 10], [90, 90]]), P([[10, 90], [90, 10]])]],
  };
  // ---------- $P core ----------
  function pathLen(pts) { let d = 0; for (let i = 1; i < pts.length; i++) if (pts[i].s === pts[i - 1].s) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return d; }
  function resample(pts, n) {
    const I = pathLen(pts) / (n - 1); let D = 0; const out = [pts[0]]; pts = pts.slice();
    if (I === 0) { while (out.length < n) out.push(pts[0]); return out; }
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].s === pts[i - 1].s) {
        const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (D + d >= I) {
          const t = (I - D) / d, q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y), s: pts[i].s };
          out.push(q); pts.splice(i, 0, q); D = 0;
        } else D += d;
      }
    }
    while (out.length < n) out.push(pts[pts.length - 1]);
    return out.slice(0, n);
  }
  function normalize(strokes) {
    let pts = []; strokes.forEach((s, si) => s.forEach(p => pts.push({ x: p[0], y: p[1], s: si })));
    if (pts.length === 1) pts.push({ ...pts[0] });
    pts = resample(pts, N);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const sc = Math.max(maxX - minX, maxY - minY) || 1;
    pts = pts.map(p => ({ x: (p.x - minX) / sc, y: (p.y - minY) / sc, s: p.s }));
    let cx = 0, cy = 0; pts.forEach(p => { cx += p.x; cy += p.y; }); cx /= N; cy /= N;
    return pts.map(p => ({ x: p.x - cx, y: p.y - cy }));
  }
  function cloudDist(a, b, start) {
    const matched = new Array(N).fill(false); let sum = 0, i = start;
    do {
      let idx = -1, min = Infinity;
      for (let j = 0; j < N; j++) if (!matched[j]) { const d = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y); if (d < min) { min = d; idx = j; } }
      matched[idx] = true; const w = 1 - ((i - start + N) % N) / N; sum += w * min; i = (i + 1) % N;
    } while (i !== start);
    return sum;
  }
  function greedy(a, b) { const step = Math.floor(Math.pow(N, 0.5)); let m = Infinity; for (let i = 0; i < N; i += step) m = Math.min(m, cloudDist(a, b, i), cloudDist(b, a, i)); return m; }
  let templates = [];
  function addTemplate(sym, strokes, user) { templates.push({ sym, pts: normalize(strokes), n: strokes.length, user: !!user }); }
  function resetTemplates() { templates = []; for (const k in T) T[k].forEach(v => addTemplate(k, v)); }
  resetTemplates();
  function classify(strokes, exclude) {
    const pts = normalize(strokes); const scores = {};
    for (const t of templates) {
      if (exclude && exclude.includes(t.sym)) continue;
      let d = greedy(pts, t.pts); if (t.user) d *= 0.9; // slight preference for the user's own handwriting
      if (Math.abs(t.n - strokes.length) > 1) d *= 1.25;
      if (!(t.sym in scores) || d < scores[t.sym]) scores[t.sym] = d;
    }
    return Object.entries(scores).sort((a, b) => a[1] - b[1]);
  }
  // ---------- layout ----------
  function bbox(strokes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(s => s.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }));
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }
  function straightness(s) { // chord / path length
    let L = 0; for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    return L ? Math.hypot(s[s.length - 1][0] - s[0][0], s[s.length - 1][1] - s[0][1]) / L : 1;
  }
  function isFlat(s, H) { const b = bbox([s]); return b.w > 0.25 * H && b.h < 0.3 * b.w && straightness(s) > 0.85; }
  function refHeight(strokes) {
    const hs = strokes.map(s => bbox([s])).filter(b => b.h > b.w * 0.4).map(b => b.h).sort((a, b) => b - a);
    const all = bbox(strokes); return hs.length ? Math.max(hs[0], all.h * 0.3) : Math.max(all.h, all.w * 0.5, 1);
  }
  const OUT = (latex, plain) => ({ latex, plain });
  function joinOut(parts) { return OUT(parts.map(p => p.latex).join(''), parts.map(p => p.plain).join('')); }

  function recognise(strokes, depth) {
    depth = depth || 0;
    strokes = strokes.filter(s => s.length > 0);
    if (!strokes.length || depth > 6) return OUT('', '');
    const H = refHeight(strokes);
    // 1. fraction bars (widest first)
    const flats = strokes.filter(s => isFlat(s, H)).sort((a, b) => bbox([b]).w - bbox([a]).w);
    for (const bar of flats) {
      const bb = bbox([bar]); const above = [], below = [], left = [], right = [];
      for (const s of strokes) {
        if (s === bar) continue; const b = bbox([s]);
        const inside = b.cx > bb.minX - 0.05 * bb.w && b.cx < bb.maxX + 0.05 * bb.w;
        if (inside && b.maxY < bb.cy + 0.15 * H && b.cy < bb.cy) above.push(s);
        else if (inside && b.minY > bb.cy - 0.15 * H && b.cy > bb.cy) below.push(s);
        else if (b.cx < bb.cx) left.push(s); else right.push(s);
      }
      if (!above.length || !below.length) continue;
      // "=" : two flat lines of similar width with nothing else stacked
      if (above.length === 1 && below.length === 0) continue;
      const ab = bbox(above), bl = bbox(below);
      if (above.length === 1 && isFlat(above[0], H) && below.length >= 1 && !(bl.minY > bb.cy)) continue;
      const num = recognise(above, depth + 1), den = recognise(below, depth + 1);
      const L = recognise(left, depth + 1), R = recognise(right, depth + 1);
      let frac = OUT(`\\frac{${num.latex}}{${den.latex}}`, `((${num.plain})/(${den.plain}))`);
      if (/^\d+$/.test(num.plain) && /^\d+$/.test(den.plain) && /^-?\d+$/.test(L.plain) && L.plain !== '-' ) {
        // mixed number e.g. 1 1/2
        return joinOut([OUT(L.latex + frac.latex, `(${L.plain.startsWith('-') ? '-' : ''}(${L.plain.replace('-', '')}+${num.plain}/${den.plain}))`), R]);
      }
      return joinOut([L, frac, R]);
    }
    // 1b. radical signs: a wide stroke shaped like a tick with a roof; contents sit under the roof
    for (const s of strokes) {
      const b = bbox([s]); if (b.w < 0.6 * H || straightness(s) > 0.8) continue;
      const r = classify([s]); if (r[0][0] !== 'sqrt') continue;
      const inner = [], left = [], right = [];
      for (const o of strokes) { if (o === s) continue; const ob = bbox([o]);
        if (ob.cx > b.minX + 0.3 * b.w && ob.cx < b.maxX + 0.05 * H && ob.cy > b.minY) inner.push(o);
        else if (ob.cx < b.cx) left.push(o); else right.push(o); }
      const I = recognise(inner, depth + 1);
      return joinOut([recognise(left, depth + 1), OUT(`\\sqrt{${I.latex}}`, `sqrt(${I.plain})`), recognise(right, depth + 1)]);
    }
    // 2. group strokes into symbols by horizontal overlap
    const sorted = strokes.slice().sort((a, b) => bbox([a]).minX - bbox([b]).minX);
    const groups = [];
    for (const s of sorted) {
      const b = bbox([s]); let g = groups[groups.length - 1];
      if (g) {
        const gb = bbox(g); const ov = Math.min(gb.maxX, b.maxX) - Math.max(gb.minX, b.minX);
        const mw = Math.max(Math.min(gb.w, b.w), 2);
        const tiny = Math.max(b.w, b.h) < 0.22 * H || Math.max(gb.w, gb.h) < 0.22 * H;
        const within = (b.cx > gb.minX && b.cx < gb.maxX) || (gb.cx > b.minX && gb.cx < b.maxX);
        if (!tiny && (ov > 0.5 * mw || within)) { g.push(s); continue; }
        // radical: anything to the right but under its bar belongs to it -> handled below
      }
      groups.push([s]);
    }
    // 3. classify each group
    let syms = [];
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi], b = bbox(g); let sym;
      if (Math.max(b.w, b.h) < 0.22 * H) sym = '.';
      else if (g.length === 1 && isFlat(g[0], H)) sym = '-';
      else if (g.length === 2 && g.every(s => isFlat(s, H * 0.6))) sym = '=';
      else if (g.length === 1 && straightness(g[0]) > 0.9) {
        const s = g[0], dx = s[s.length - 1][0] - s[0][0], dy = s[s.length - 1][1] - s[0][1];
        const r = Math.abs(dx) / (Math.abs(dy) || 1e-6);
        if (r < 0.36) sym = '1';
        else if (r < 2.5 && (dx * dy < 0)) sym = '/';
        else sym = classify(g)[0][0];
      } else {
        const ranked = classify(g); sym = ranked[0][0];
        if (sym === 'sqrt') {
          // swallow following groups under the bar
          const inner = [];
          while (gi + 1 < groups.length && bbox(groups[gi + 1]).cx < b.maxX + 0.1 * H) inner.push(...groups[++gi]);
          const r = recognise(inner, depth + 1);
          syms.push({ sym, b, latex: `\\sqrt{${r.latex}}`, plain: `sqrt(${r.plain})` });
          continue;
        }
      }
      // radical can also have been merged with its contents in a single group
      syms.push({ sym, b, ranked: g.length > 0 && (sym === 'x' || sym === 'times') ? classify(g, null) : null });
    }
    disambiguate(syms, H);
    // fix: '-' then content under a radical shape inside one group (rare) ignored.
    // 4. superscripts
    const out = []; let i = 0;
    const base = s => /[0-9xy)]|pi/.test(s.sym);
    while (i < syms.length) {
      const s = syms[i]; out.push(s); i++;
      if (base(s) && s.sym !== '.') {
        const sup = [];
        while (i < syms.length && !['-', '+', '=', '/', 'times', 'cdot'].includes(syms[i].sym) && syms[i].b.maxY < s.b.cy + 0.1 * s.b.h && syms[i].b.h < 0.8 * Math.max(s.b.h, H * 0.6) && syms[i].sym !== '.') sup.push(syms[i++]);
        if (sup.length) out.push({ sup });
      }
    }
    return render(out);
  }
  const LATEX = { pi: '\\pi', '-': '-', '+': '+', '/': '/', '^': '^', '.': '.', '=': '=', x: 'x', y: 'y', sqrt: '\\sqrt{}', times: '\\times ', cdot: '\\cdot ' };
  function render(list) {
    let latex = '', plain = '';
    for (const s of list) {
      if (s.sup) { const r = render(s.sup); latex += `^{${r.latex}}`; plain += `^(${r.plain})`; continue; }
      if (s.latex) { latex += s.latex; plain += s.plain; continue; }
      latex += LATEX[s.sym] || s.sym; plain += s.sym === 'times' || s.sym === 'cdot' ? '*' : s.sym;
    }
    return { latex, plain };
  }
  // stroke input: array of strokes; each stroke array of [x,y,(p)]
  // ---------- x vs ×, '.' vs '·' from context ----------
  let OPTS = {};
  const isOperand = s => s && (/^[0-9xy)]$|^pi$/.test(s.sym) || s.latex);
  const isOperandStart = s => s && (isOperand(s) || s.sym === '(');
  function lineRef(syms, i, H) { // baseline/top from nearby full-height operands
    const near = []; for (let k = i - 2; k <= i + 2; k++) if (k !== i && syms[k] && /^[0-9()]$|^pi$|^[xy]$/.test(syms[k].sym) && syms[k].b.h > 0.3 * H) near.push(syms[k].b);
    if (!near.length) return null;
    const base = Math.max(...near.map(b => b.maxY)), top = Math.min(...near.map(b => b.minY)); return { base, top, h: Math.max(base - top, 1) };
  }
  function disambiguate(syms, H) {
    for (let i = 0; i < syms.length; i++) {
      const s = syms[i], prev = syms[i - 1], next = syms[i + 1];
      const between = isOperand(prev) && isOperandStart(next);
      if (s.sym === '.') { // a dot raised to mid-height between operands is a multiplication dot
        const L = lineRef(syms, i, H); if (between && L && s.b.cy < L.base - 0.28 * L.h) s.sym = 'cdot'; continue;
      }
      if (s.sym !== 'x' && s.sym !== 'times') continue;
      const L = lineRef(syms, i, H); let score = between ? 0.5 : -3;
      if (L) {
        const lowGap = (L.base - s.b.maxY) / L.h, rel = s.b.h / L.h, mid = (L.top + L.base) / 2;
        if (lowGap > 0.12) score += 1.5; else if (lowGap < 0.05) score -= 1;   // x sits on the baseline, × floats
        if (rel < 0.7) score += 0.5;
        if (Math.abs(s.b.cy - mid) < 0.15 * L.h) score += 0.5;
        if (s.b.minY > L.top + 0.12 * L.h) score += 0.25;
      }
      if (s.ranked) { // trained samples (weighted in classify) break the tie when they disagree clearly
        const tx = (s.ranked.find(r => r[0] === 'x') || [0, Infinity])[1], tt = (s.ranked.find(r => r[0] === 'times') || [0, Infinity])[1];
        if (isFinite(tx) && isFinite(tt) && Math.abs(tx - tt) > 0.08 * Math.min(tx, tt)) score += tt < tx ? 0.75 : -0.75;
      }
      if (OPTS.expectsVar === false) score += 0.75; else if (OPTS.expectsVar === true) score -= 0.25;
      s.sym = score >= 1.25 ? 'times' : 'x';
    }
  }
  function recogniseInk(strokes, opts) {
    OPTS = opts || {};
    const clean = strokes.map(s => s.map(p => [p[0], p[1]])).filter(s => s.length);
    if (!clean.length) return { latex: '', plain: '' };
    return recognise(clean, 0);
  }
  const api = { recognise: recogniseInk, classify, addTemplate, resetTemplates, symbols: Object.keys(T).concat(['-', '.', '/', '=', 'cdot']), _T: T, _bbox: bbox };
  if (typeof module !== 'undefined') module.exports = api; else root.Recognizer = api;
})(this);
