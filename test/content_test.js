const C = require('../js/content.js'), M = require('../js/mathcheck.js');
let n = 0, bad = 0;
for (const t of C.topics) { for (let L = 1; L <= 3; L++) for (let s = 1; s <= 300; s++) { n++; let q;
  try { q = C.makeQuestion(t.id, L, s); } catch (e) { bad++; console.log('ERR', t.id, L, s, e.message); continue; }
  if (!M.valid(q.a) || !M.equivalent(q.a, q.a, q.tol) || /NaN|undefined|Infinity/.test(q.q + q.steps.join() + q.a)) { bad++; if (bad < 15) console.log('BAD', t.id, L, s, q.q, q.a); } }
  for (const p of t.push) if (!M.valid(p.a)) { bad++; console.log('BADPUSH', p.a); } if (!M.valid(t.example.a)) console.log('BADEX', t.id); }
console.log(n, 'questions', bad, 'bad');
