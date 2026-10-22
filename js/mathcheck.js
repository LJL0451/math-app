/* Tiny expression parser/evaluator for answer checking. Supports + - * / ^, implicit
   multiplication, parentheses, sqrt(), pi, variables x y. Equivalence = numeric agreement
   at several random points (so 0.5 == 1/2, 2(x+3) == 2x+6). */
(function (root) {
  'use strict';
  function tokenize(s) {
    s = s.replace(/\s+/g, '').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
    const t = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; const num = s.slice(i, j); if ((num.match(/\./g) || []).length > 1 || num === '.') throw Error('bad number'); t.push({ k: 'n', v: parseFloat(num) }); i = j; }
      else if (s.startsWith('sqrt', i)) { t.push({ k: 'f', v: 'sqrt' }); i += 4; }
      else if (s.startsWith('pi', i)) { t.push({ k: 'n', v: Math.PI, pi: 1 }); i += 2; }
      else if (/[a-z]/.test(c)) { t.push({ k: 'v', v: c }); i++; }
      else if ('+-*/^()'.includes(c)) { t.push({ k: c }); i++; }
      else throw Error('bad char ' + c);
    }
    return t;
  }
  function parse(str) {
    const t = tokenize(str); let p = 0;
    const peek = () => t[p], eat = k => { if (!t[p] || t[p].k !== k) throw Error('expected ' + k); return t[p++]; };
    function expr() { let n = term(); while (peek() && (peek().k === '+' || peek().k === '-')) { const op = t[p++].k; const r = term(); const l = n; n = op === '+' ? e => l(e) + r(e) : e => l(e) - r(e); } return n; }
    function startsFactor(x) { return x && (x.k === 'n' || x.k === 'v' || x.k === 'f' || x.k === '('); }
    function term() {
      let n = unary();
      for (;;) {
        const x = peek();
        if (x && (x.k === '*' || x.k === '/')) { p++; const r = unary(), l = n; n = x.k === '*' ? e => l(e) * r(e) : e => l(e) / r(e); }
        else if (startsFactor(x)) { const r = power(), l = n; n = e => l(e) * r(e); }
        else return n;
      }
    }
    function unary() { if (peek() && peek().k === '-') { p++; const u = unary(); return e => -u(e); } if (peek() && peek().k === '+') { p++; return unary(); } return power(); }
    function power() { const b = atom(); if (peek() && peek().k === '^') { p++; const ex = unary(); return e => Math.pow(b(e), ex(e)); } return b; }
    function atom() {
      const x = t[p++]; if (!x) throw Error('unexpected end');
      if (x.k === 'n') { const v = x.v; return () => v; }
      if (x.k === 'v') { const v = x.v; return e => (v in e ? e[v] : NaN); }
      if (x.k === 'f') { const a = atom(); return e => Math.sqrt(a(e)); }
      if (x.k === '(') { const n = expr(); eat(')'); return n; }
      throw Error('unexpected ' + x.k);
    }
    const f = expr(); if (p !== t.length) throw Error('trailing input'); return f;
  }
  function vars(s) { return Array.from(new Set((s.replace(/sqrt|pi/g, '').match(/[a-z]/g) || []))); }
  // strip "x=" / "y =" prefix
  function rhs(s) { const parts = s.split('='); return parts[parts.length - 1]; }
  function equivalent(user, expected, tol) {
    try {
      const u = parse(rhs(user)), e = parse(rhs(expected));
      const vs = Array.from(new Set(vars(rhs(user)).concat(vars(rhs(expected)))));
      const pts = [{}]; if (vs.length) { pts.length = 0; for (let i = 0; i < 6; i++) { const o = {}; vs.forEach(v => o[v] = 0.37 + i * 0.91 + Math.random() * 0.1 * (v === 'y' ? 2 : 1)); pts.push(o); } }
      for (const pt of pts) {
        const a = u(pt), b = e(pt); if (!isFinite(a) || !isFinite(b)) return false;
        const lim = tol != null ? tol : 1e-9 * Math.max(1, Math.abs(b));
        if (Math.abs(a - b) > lim + 1e-12) return false;
      }
      return true;
    } catch (err) { return false; }
  }
  function valid(s) { try { parse(rhs(s)); return true; } catch (e) { return false; } }
  const api = { parse, equivalent, valid, evaluate: (s, env) => parse(rhs(s))(env || {}) };
  if (typeof module !== 'undefined') module.exports = api; else root.MathCheck = api;
})(this);
