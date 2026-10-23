/* Expression parser/evaluator for answer checking.
   + - * / ^ ± °, implicit multiplication, ( ), sqrt sin cos tan log ln (trig in DEGREES), pi,
   single-letter variables and θ. Answers may be comma lists (order-independent unless ordered),
   contain ± (expands to two values), or be inequalities (< > ≤ ≥, chains allowed), compared as
   solution sets. Equivalence = numeric agreement at several random points. */
(function (root) {
  'use strict';
  const FN = ['sqrt', 'sin', 'cos', 'tan', 'log', 'ln'];
  const D = Math.PI / 180;
  const FIMPL = { sqrt: Math.sqrt, sin: v => Math.sin(v * D), cos: v => Math.cos(v * D), tan: v => Math.tan(v * D), log: Math.log10, ln: Math.log };
  function norm(s) { return String(s).replace(/\s+/g, '').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/\+-|\+\/-/g, '±').replace(/theta/g, 'θ'); }
  function tokenize(s) {
    s = norm(s); const t = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; const num = s.slice(i, j); if ((num.match(/\./g) || []).length > 1 || num === '.') throw Error('bad number'); t.push({ k: 'n', v: parseFloat(num) }); i = j; continue; }
      const f = FN.find(f => s.startsWith(f, i)); if (f) { t.push({ k: 'f', v: f }); i += f.length; continue; }
      if (s.startsWith('pi', i)) { t.push({ k: 'n', v: Math.PI }); i += 2; continue; }
      if (/[a-zθ]/.test(c)) { t.push({ k: 'v', v: c }); i++; continue; }
      if ('+-*/^()±°'.includes(c)) { t.push({ k: c }); i++; continue; }
      throw Error('bad char ' + c);
    }
    return t;
  }
  function parse(str) {
    const t = tokenize(str); let p = 0;
    if (!t.length) throw Error('empty');
    const peek = () => t[p], eat = k => { if (!t[p] || t[p].k !== k) throw Error('expected ' + k); return t[p++]; };
    function expr() { let n = term(); while (peek() && '+-±'.includes(peek().k)) { const op = t[p++].k; const r = term(); const l = n; n = op === '+' ? e => l(e) + r(e) : op === '-' ? e => l(e) - r(e) : e => l(e) + (e.__pm || 1) * r(e); } return n; }
    const startsFactor = x => x && (x.k === 'n' || x.k === 'v' || x.k === 'f' || x.k === '(');
    function term() {
      let n = unary();
      for (;;) { const x = peek();
        if (x && (x.k === '*' || x.k === '/')) { p++; const r = unary(), l = n; n = x.k === '*' ? e => l(e) * r(e) : e => l(e) / r(e); }
        else if (startsFactor(x)) { const r = power(), l = n; n = e => l(e) * r(e); }
        else return n; }
    }
    function unary() { const x = peek(); if (x && x.k === '-') { p++; const u = unary(); return e => -u(e); } if (x && x.k === '±') { p++; const u = unary(); return e => (e.__pm || 1) * u(e); } if (x && x.k === '+') { p++; return unary(); } return power(); }
    function power() { let b = atom(); while (peek() && peek().k === '°') p++; if (peek() && peek().k === '^') { p++; const ex = unary(); const bb = b; return e => Math.pow(bb(e), ex(e)); } return b; }
    function atom() {
      const x = t[p++]; if (!x) throw Error('unexpected end');
      if (x.k === 'n') { const v = x.v; return () => v; }
      if (x.k === 'v') { const v = x.v; return e => (v in e ? e[v] : NaN); }
      if (x.k === 'f') { let ex = null; if (peek() && peek().k === '^') { p++; const e2 = atom(); ex = e2; } // sin^2 x
        const a = power(), F = FIMPL[x.v]; return ex ? e => Math.pow(F(a(e)), ex(e)) : e => F(a(e)); }
      if (x.k === '(') { const n = expr(); eat(')'); return n; }
      throw Error('unexpected ' + x.k);
    }
    const f = expr(); if (p !== t.length) throw Error('trailing input'); return f;
  }
  const REL = /([<>≤≥])/;
  const vars = s => Array.from(new Set((norm(s).replace(/sqrt|sin|cos|tan|log|ln|pi/g, '').match(/[a-zθ]/g) || [])));
  const rhs = s => { const parts = s.split('='); return parts[parts.length - 1]; };
  const splitList = s => norm(s).split(',').filter(x => x !== '');
  const hasPm = s => norm(s).includes('±');
  function points(vs, n) { const pts = []; for (let i = 0; i < n; i++) { const o = {}; vs.forEach((v, j) => o[v] = 0.37 + i * 0.91 + (j + 1) * 0.173 + Math.random() * 0.05); pts.push(o); } return vs.length ? pts : [{}]; }
  function close(a, b, tol) { if (!isFinite(a) || !isFinite(b)) return false; const lim = tol != null ? tol : 1e-9 * Math.max(1, Math.abs(b)); return Math.abs(a - b) <= lim + 1e-12; }
  // an item expands to 1 or 2 evaluators (±)
  function items(s) { const out = []; for (const it of splitList(s)) { const f = parse(rhs(it)); if (hasPm(it)) { out.push(e => f(Object.assign({}, e, { __pm: 1 })), e => f(Object.assign({}, e, { __pm: -1 }))); } else out.push(f); } return out; }
  function sameFn(u, e, pts, tol, upToC) {
    let off = null;
    for (const pt of pts) { const a = u(Object.assign({ c: 0 }, pt)), b = e(pt);
      if (upToC) { if (!isFinite(a) || !isFinite(b)) return false; if (off == null) off = a - b; else if (!close(a - b, off, 1e-7 * Math.max(1, Math.abs(b)))) return false; }
      else if (!close(a, b, tol)) return false; }
    return true;
  }
  function inequality(user, expected) {
    const chain = s => { const parts = norm(s).split(REL); const exprs = [], ops = []; parts.forEach((x, i) => i % 2 ? ops.push(x) : exprs.push(parse(x))); return { exprs, ops }; };
    const U = chain(user), E = chain(expected); if (!U.ops.length) return false;
    const vs = Array.from(new Set(vars(user).concat(vars(expected)))); if (vs.length !== 1) return false; const v = vs[0];
    const truth = (C, x) => { const env = { [v]: x }; const vals = C.exprs.map(f => f(env)); return C.ops.every((op, i) => { const a = vals[i], b = vals[i + 1], eq = Math.abs(a - b) < 1e-9; return op === '<' ? a < b && !eq : op === '>' ? a > b && !eq : op === '≤' ? a < b || eq : a > b || eq; }); };
    const xs = []; for (let x = -60; x <= 60; x += 0.25) xs.push(x);
    for (const C of [U, E]) C.exprs.forEach(f => { try { const c = f({}); if (isFinite(c)) xs.push(c, c - 1e-4, c + 1e-4); } catch (e) {} });
    // boundaries of linear expressions in x: solve f(x)=other by sampling roots is overkill; constants cover the usual "x < c" form
    return xs.every(x => truth(U, x) === truth(E, x));
  }
  function equivalent(user, expected, tol, opts) {
    opts = opts || {};
    try {
      if (REL.test(norm(expected)) || REL.test(norm(user))) return REL.test(norm(expected)) && REL.test(norm(user)) && inequality(user, expected);
      const U = items(user), E = items(expected); if (U.length !== E.length) return false;
      const vs = Array.from(new Set(vars(user.split(',').map(rhs).join(',')).concat(vars(expected.split(',').map(rhs).join(','))))).filter(v => !(opts.upToC && v === 'c'));
      const pts = points(vs, 6);
      if (opts.ordered) return U.every((u, i) => sameFn(u, E[i], pts, tol, opts.upToC));
      const used = new Array(U.length).fill(false);
      return E.every(e => { const k = U.findIndex((u, i) => !used[i] && sameFn(u, e, pts, tol, opts.upToC)); if (k < 0) return false; used[k] = true; return true; });
    } catch (err) { return false; }
  }
  function valid(s) {
    try { if (REL.test(norm(s))) { norm(s).split(REL).forEach((x, i) => { if (!(i % 2)) parse(x); }); return true; } items(s); return true; } catch (e) { return false; }
  }
  const api = { parse, equivalent, valid, evaluate: (s, env) => parse(rhs(s))(env || {}) };
  if (typeof module !== 'undefined') module.exports = api; else root.MathCheck = api;
})(this);
