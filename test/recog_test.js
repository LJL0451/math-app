const R = require('../js/recognizer.js');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const T = R._T;
// synth a symbol: random variant, random affine, smooth wobble, at x offset, height h
function synth(sym, x0, y0, h) {
  if (sym === '-') return [[[x0, y0 + h * 0.5], [x0 + h * 0.6, y0 + h * 0.5 + (rnd() - .5) * 3]]].map(s => interp(s));
  if (sym === '.') return [[[x0 + 2, y0 + h - 3], [x0 + 3, y0 + h - 2], [x0 + 3.5, y0 + h - 3]]];
  const vars = T[sym]; const v = vars[Math.floor(rnd() * vars.length)];
  const rot = (rnd() - .5) * 0.25, sh = (rnd() - .5) * 0.3, sx = 0.85 + rnd() * 0.3;
  const ph = rnd() * 6, amp = 1 + rnd() * 2;
  const sc = h / 100;
  return v.map(st => st.map((p, i) => {
    let X = (p[0] - 50) * sx, Y = p[1] - 50; X += sh * Y;
    const xr = X * Math.cos(rot) - Y * Math.sin(rot), yr = X * Math.sin(rot) + Y * Math.cos(rot);
    return [x0 + 30 * sc + xr * sc + amp * Math.sin(i / 5 + ph), y0 + 50 * sc + yr * sc + amp * Math.cos(i / 7 + ph), 0.5];
  }));
}
function interp(s) { const o = []; for (let i = 0; i <= 10; i++) o.push([s[0][0] + (s[1][0] - s[0][0]) * i / 10, s[0][1] + (s[1][1] - s[0][1]) * i / 10]); return o; }
function width(sym, h) { return sym === '.' ? 8 : sym === 'sqrt' ? h * 1.3 : h * 0.75; }
// sequence writer, tokens: symbols; {sup:[...]}; {frac:[num,den]}
function write(tokens, x, y, h) {
  let strokes = [];
  for (const t of tokens) {
    if (t.sqrt) { strokes.push(...synth('sqrt', x, y, h * 1.1)); const r = write(t.sqrt, x + h * 0.5, y + h * 0.1, h * 0.85); strokes.push(...r.strokes); x = Math.max(r.x, x + h * 1.4); }
    else if (typeof t === 'string') { strokes.push(...synth(t, x, y, h)); x += width(t, h) + h * 0.15 + rnd() * h * 0.1; }
    else if (t.sup) { const r = write(t.sup, x, y - h * 0.45, h * 0.55); strokes.push(...r.strokes); x = r.x; }
    else if (t.frac) {
      const n = write(t.frac[0], 0, 0, h), d = write(t.frac[1], 0, 0, h); const w = Math.max(n.x, d.x);
      const nn = write(t.frac[0], x + (w - n.x) / 2 + h * 0.1, y - h * 0.65, h), dd = write(t.frac[1], x + (w - d.x) / 2 + h * 0.1, y + h * 0.75, h);
      strokes.push(...nn.strokes, ...dd.strokes, interp([[x, y + h * 0.5], [x + w + h * 0.2, y + h * 0.5 + (rnd() - .5) * 4]]));
      x += w + h * 0.5;
    }
  }
  return { strokes, x };
}
const sym = s => s.split(' ');
// isolated symbol accuracy
let ok = 0, tot = 0; const conf = {};
for (const s of Object.keys(T).filter(k => k !== 'sqrt').concat(['-'])) for (let k = 0; k < 40; k++) {
  const st = synth(s, 100, 100, 60 + rnd() * 40); const r = R.recognise(st).plain;
  const exp = s; tot++; if (r === exp) ok++; else conf[s + '->' + r] = (conf[s + '->' + r] || 0) + 1;
}
console.log(`isolated symbols: ${ok}/${tot} = ${(100 * ok / tot).toFixed(1)}%`); console.log(conf);
const cases = [
  [sym('4 2'), '42'], [sym('- 7'), '-7'], [sym('3 . 5'), '3.5'], [sym('- 0 . 2 5'), '-0.25'],
  [[{ frac: [['3'], ['4']] }], '((3)/(4))'], [['-', { frac: [['5'], ['8']] }], '-((5)/(8))'],
  [['x', { sup: ['2'] }], 'x^(2)'], [sym('2 x + 3'), '2x+3'], [sym('3 x - 1'), '3x-1'], [[{ sqrt: ['2'] }], 'sqrt(2)'], [['3', { sqrt: ['5'] }], '3sqrt(5)'],
  [sym('2 pi'), '2pi'], [['x', '=', '4'], 'x=4'], [sym('( x + 2 ) ( x - 3 )'), '(x+2)(x-3)'], [sym('1 9 6 0'), '1960'],
  [['6', 'x', { sup: ['2'] }, '+', '2'], '6x^(2)+2'], [[{ frac: [['1', '2'], ['5']] }], '((12)/(5))'], [sym('y + 1'), 'y+1'],
];
// '=' synth
T['='] = [[[[0, 35], [100, 35]].map(p => p), [[0, 65], [100, 65]]].map(s => interp(s))];
let eok = 0;
for (const [tok, exp] of cases) { let c = 0; for (let k = 0; k < 20; k++) { const r = R.recognise(write(tok, 50, 200, 50 + rnd() * 30).strokes).plain; if (r === exp) c++; else if (k < 2) console.log('  miss', exp, 'got', r); } console.log(exp.padEnd(16), c + '/20'); eok += c; }
console.log(`expressions: ${eok}/${cases.length * 20} = ${(100 * eok / cases.length / 20).toFixed(1)}%`);
