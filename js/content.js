/* Content is data-driven: SUBJECTS -> topics. Each topic has explanation, a worked example,
   a procedural generator gen(rng, level) for graded practice (level 1..3), and "push" problems.
   A question: { q: latex/markdown, a: expected expression string, tol?, steps: [md], hint?, svg?, form? }
   Markdown-ish text: $inline$ and $$display$$ maths rendered with KaTeX. Add a subject by
   pushing another object into SUBJECTS with the same shape. */
(function (root) {
  'use strict';
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
  function rng(seed) { let s = (seed >>> 0) || 1; return { next() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }, int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }, nz(a, b) { let v; do v = this.int(a, b); while (v === 0); return v; }, pick(arr) { return arr[Math.floor(this.next() * arr.length)]; } }; }
  function fr(n, d) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); n /= g; d /= g; return { n, d }; }
  const fl = f => f.d === 1 ? `${f.n}` : `${f.n < 0 ? '-' : ''}\\frac{${Math.abs(f.n)}}{${f.d}}`;
  const fp = f => f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`;
  const sg = n => n < 0 ? `- ${-n}` : `+ ${n}`;     // " + 3" / " - 3"
  const par = n => n < 0 ? `(${n})` : `${n}`;
  const coef = (c, v) => c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`;
  function polyL(cs) { // cs: [[coef, power]] -> latex
    let s = ''; cs.filter(c => c[0] !== 0).forEach(([c, p], i) => {
      const body = p === 0 ? `${Math.abs(c)}` : `${Math.abs(c) === 1 ? '' : Math.abs(c)}x${p === 1 ? '' : '^{' + p + '}'}`;
      s += i === 0 ? (c < 0 ? '-' : '') + body : (c < 0 ? ' - ' : ' + ') + body;
    }); return s || '0';
  }
  const polyP = cs => cs.filter(c => c[0] !== 0).map(([c, p]) => `(${c})*x^(${p})`).join('+') || '0';
  const r1 = x => Math.round(x * 10) / 10, rd = Math.round;
  const DEG = Math.PI / 180;
  function triSVG(a, b, labels) { // right triangle, right angle at bottom-left. labels: {base, height, hyp, angle}
    const W = 260, H = 180, s = Math.min(200 / a, 140 / b), x0 = 30, y0 = 160, x1 = x0 + a * s, y1 = y0 - b * s;
    return `<svg viewBox="0 0 ${W} ${H}" class="diagram" role="img"><polygon points="${x0},${y0} ${x1},${y0} ${x0},${y1}" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <rect x="${x0}" y="${y0 - 14}" width="14" height="14" fill="none" stroke="currentColor"/>
      <text x="${(x0 + x1) / 2}" y="${y0 + 18}" text-anchor="middle">${labels.base || ''}</text>
      <text x="${x0 - 8}" y="${(y0 + y1) / 2}" text-anchor="end">${labels.height || ''}</text>
      <text x="${(x0 + x1) / 2 + 10}" y="${(y0 + y1) / 2 - 6}">${labels.hyp || ''}</text>
      ${labels.angle ? `<text x="${x1 - 46}" y="${y0 - 6}">${labels.angle}</text>` : ''}</svg>`;
  }

  function plotSVG(fns, marks, opt) { // fns: [x=>y], marks: [[x,y,label]]
    opt = opt || {}; const X = opt.x || [-6, 6], Y = opt.y || [-6, 6], W = 280, H = 280, sx = W / (X[1] - X[0]), sy = H / (Y[1] - Y[0]);
    const px = x => (x - X[0]) * sx, py = y => H - (y - Y[0]) * sy; let g = '';
    for (let x = Math.ceil(X[0]); x <= X[1]; x++) g += `<line x1="${px(x)}" y1="0" x2="${px(x)}" y2="${H}" class="gl"/>`;
    for (let y = Math.ceil(Y[0]); y <= Y[1]; y++) g += `<line x1="0" y1="${py(y)}" x2="${W}" y2="${py(y)}" class="gl"/>`;
    g += `<line x1="0" y1="${py(0)}" x2="${W}" y2="${py(0)}" class="ax"/><line x1="${px(0)}" y1="0" x2="${px(0)}" y2="${H}" class="ax"/>`;
    g += `<text x="${W - 10}" y="${py(0) - 5}">x</text><text x="${px(0) + 5}" y="12">y</text>`;
    for (let x = Math.ceil(X[0]) + 1; x < X[1]; x += 2) if (x) g += `<text x="${px(x)}" y="${py(0) + 14}" text-anchor="middle" class="tick">${x}</text>`;
    for (let y = Math.ceil(Y[0]) + 1; y < Y[1]; y += 2) if (y) g += `<text x="${px(0) - 4}" y="${py(y) + 4}" text-anchor="end" class="tick">${y}</text>`;
    for (const f of fns) { let d = ''; for (let i = 0; i <= 200; i++) { const x = X[0] + (X[1] - X[0]) * i / 200, y = f(x); if (y < Y[0] - 5 || y > Y[1] + 5) { d += ' '; continue; } d += `${d.endsWith(' ') || !d ? 'M' : 'L'}${px(x).toFixed(1)},${py(y).toFixed(1)}`; } g += `<path d="${d.replace(/ M/g, 'M').replace(/ L/g, 'M').trim()}" class="curve"/>`; }
    for (const [x, y, l] of marks || []) g += `<circle cx="${px(x)}" cy="${py(y)}" r="5" class="pt"/>${l ? `<text x="${px(x) + 8}" y="${py(y) - 8}">${l}</text>` : ''}`;
    return `<svg viewBox="0 0 ${W} ${H}" class="diagram graph" role="img"><clipPath id="cp"><rect width="${W}" height="${H}"/></clipPath><g clip-path="url(#cp)">${g}</g></svg>`;
  }
  const topics = [
  { id: 'integers', title: 'Integers & order of operations', grade: 7,
    explain: `Numbers to the left of zero are **negative**. Rules worth knowing cold:\n\n- Subtracting a negative is adding: $5 - (-3) = 5 + 3 = 8$.\n- Multiplying or dividing: same signs give $+$, different signs give $-$. So $(-4)(-6) = 24$ and $(-20) \\div 5 = -4$.\n- Order of operations: brackets, powers, then $\\times\\,\\div$ (left to right), then $+\\,-$ (left to right).`,
    example: { q: 'Evaluate $-3 + 4 \\times (-2)^2$', steps: ['Power first: $(-2)^2 = 4$', 'Multiply: $4 \\times 4 = 16$', 'Add: $-3 + 16 = 13$'], a: '13' },
    gen(r, L) {
      if (L === 1) { const a = r.nz(-20, 20), b = r.nz(-20, 20), op = r.pick(['+', '-']); const v = op === '+' ? a + b : a - b;
        return { q: `Evaluate $${a} ${op} ${par(b)}$`, a: `${v}`, steps: [op === '-' && b < 0 ? `Subtracting a negative is adding: $${a} - (${b}) = ${a} + ${-b}$` : `Combine: $${a} ${op} ${par(b)}$`, `$= ${v}$`] }; }
      if (L === 2) { const a = r.nz(-12, 12), b = r.nz(-12, 12), k = r.pick(['×', '÷']);
        if (k === '×') return { q: `Evaluate $${par(a)} \\times ${par(b)}$`, a: `${a * b}`, steps: [`${(a < 0) === (b < 0) ? 'Same signs → positive' : 'Different signs → negative'}`, `$${Math.abs(a)} \\times ${Math.abs(b)} = ${Math.abs(a * b)}$, so the answer is $${a * b}$`] };
        return { q: `Evaluate $${a * b} \\div ${par(b)}$`, a: `${a}`, steps: [`${(a * b < 0) === (b < 0) ? 'Same signs → positive' : 'Different signs → negative'}`, `$${Math.abs(a * b)} \\div ${Math.abs(b)} = ${Math.abs(a)}$, so the answer is $${a}$`] }; }
      const a = r.nz(-9, 9), b = r.int(2, 5), c = r.nz(-4, 4), v = a + b * c * c;
      return { q: `Evaluate $${a} + ${b} \\times ${par(c)}^2$`, a: `${v}`, steps: [`Power first: $${par(c)}^2 = ${c * c}$`, `Multiply: $${b} \\times ${c * c} = ${b * c * c}$`, `Add: $${a} + ${b * c * c} = ${v}$`] };
    },
    push: [
      { q: 'Evaluate $1 - 2 + 3 - 4 + 5 - 6 + \\dots + 99 - 100$', a: '-50', steps: ['Pair the terms: $(1-2) + (3-4) + \\dots + (99-100)$', 'Each pair is $-1$ and there are $50$ pairs', 'Total $= -50$'] },
      { q: 'What is $(-1)^{1} + (-1)^{2} + (-1)^{3} + \\dots + (-1)^{2027}$?', a: '-1', steps: ['Odd powers give $-1$, even powers give $+1$', 'They cancel in pairs: $(-1+1) + \\dots$ — there are $1013$ pairs and one leftover odd term', 'Total $= -1$'] },
    ] },

  { id: 'fractions', title: 'Fractions', grade: 7,
    explain: `A fraction $\\frac{a}{b}$ means $a$ parts out of $b$ equal parts.\n\n- **Add/subtract**: make a common denominator (the LCM), then add the tops: $\\frac{1}{4} + \\frac{1}{6} = \\frac{3}{12} + \\frac{2}{12} = \\frac{5}{12}$.\n- **Multiply**: tops times tops, bottoms times bottoms.\n- **Divide**: flip the second fraction and multiply: $\\frac{a}{b} \\div \\frac{c}{d} = \\frac{a}{b} \\times \\frac{d}{c}$.\n- Always simplify by dividing top and bottom by their HCF.\n\nWrite answers as a fraction (stacked, with a horizontal bar) or a decimal — both are accepted.`,
    example: { q: 'Calculate $\\frac{2}{3} + \\frac{3}{4}$', steps: ['LCM of $3$ and $4$ is $12$', '$\\frac{2}{3} = \\frac{8}{12}$ and $\\frac{3}{4} = \\frac{9}{12}$', '$\\frac{8}{12} + \\frac{9}{12} = \\frac{17}{12}$ (or $1\\frac{5}{12}$)'], a: '17/12' },
    gen(r, L) {
      const a = r.int(1, 7), b = r.int(2, 9), c = r.int(1, 7), d = r.int(2, 9);
      if (L === 1) { const n = r.int(2, 9) * r.int(2, 4), dd = n * r.int(2, 3) / gcd(n, 1); const big = { n: r.int(1, 5) * 6, d: r.int(2, 6) * 6 };
        const s = fr(big.n, big.d); return { q: `Simplify $\\frac{${big.n}}{${big.d}}$`, a: fp(s), steps: [`HCF of $${big.n}$ and $${big.d}$ is $${gcd(big.n, big.d)}$`, `Divide top and bottom by it: $${fl(s)}$`] }; }
      if (L === 2) { const op = r.pick(['+', '-']); const m = lcm(b, d); const n = op === '+' ? a * (m / b) + c * (m / d) : a * (m / b) - c * (m / d); const s = fr(n, m);
        return { q: `Calculate $\\frac{${a}}{${b}} ${op} \\frac{${c}}{${d}}$`, a: fp(s), steps: [`Common denominator (LCM of $${b}$ and $${d}$): $${m}$`, `$\\frac{${a * m / b}}{${m}} ${op} \\frac{${c * m / d}}{${m}} = \\frac{${n}}{${m}}$`, s.d !== m ? `Simplify: $${fl(s)}$` : 'Already in simplest form'] }; }
      if (r.next() < 0.5) { const s = fr(a * c, b * d); return { q: `Calculate $\\frac{${a}}{${b}} \\times \\frac{${c}}{${d}}$`, a: fp(s), steps: [`Multiply tops and bottoms: $\\frac{${a}\\times${c}}{${b}\\times${d}} = \\frac{${a * c}}{${b * d}}$`, `Simplify: $${fl(s)}$`] }; }
      const s = fr(a * d, b * c); return { q: `Calculate $\\frac{${a}}{${b}} \\div \\frac{${c}}{${d}}$`, a: fp(s), steps: [`Flip the second and multiply: $\\frac{${a}}{${b}} \\times \\frac{${d}}{${c}}$`, `$= \\frac{${a * d}}{${b * c}}$`, `Simplify: $${fl(s)}$`] };
    },
    push: [
      { q: 'Evaluate $\\frac{1}{1\\times2} + \\frac{1}{2\\times3} + \\frac{1}{3\\times4} + \\dots + \\frac{1}{9\\times10}$', a: '9/10', steps: ['Key trick: $\\frac{1}{n(n+1)} = \\frac{1}{n} - \\frac{1}{n+1}$', 'The sum telescopes: $\\left(1 - \\frac12\\right) + \\left(\\frac12 - \\frac13\\right) + \\dots + \\left(\\frac19 - \\frac1{10}\\right)$', 'Everything cancels except $1 - \\frac{1}{10} = \\frac{9}{10}$'] },
      { q: 'Evaluate $\\left(1 - \\frac12\\right)\\left(1 - \\frac13\\right)\\left(1 - \\frac14\\right)\\cdots\\left(1 - \\frac{1}{50}\\right)$', a: '1/50', steps: ['Each bracket is $\\frac{n-1}{n}$: $\\frac12 \\cdot \\frac23 \\cdot \\frac34 \\cdots \\frac{49}{50}$', 'Every numerator cancels the previous denominator', 'Left with $\\frac{1}{50}$'] },
    ] },

  { id: 'decimals', title: 'Decimals & percentages', grade: 7,
    explain: `*Percent* means "out of 100": $35\\% = \\frac{35}{100} = 0.35$.\n\n- $p\\%$ **of** an amount: multiply by $\\frac{p}{100}$. $15\\%$ of $80 = 0.15 \\times 80 = 12$.\n- **Increase** by $p\\%$: multiply by $1 + \\frac{p}{100}$. **Decrease**: multiply by $1 - \\frac{p}{100}$.\n- Percentage change $= \\frac{\\text{new} - \\text{old}}{\\text{old}} \\times 100$.\n- Fraction → decimal: divide top by bottom: $\\frac{3}{8} = 0.375$.`,
    example: { q: 'A R240 jacket is discounted by $15\\%$. What is the new price?', steps: ['Decrease by 15% → multiply by $0.85$', '$240 \\times 0.85 = 204$', 'New price R204'], a: '204' },
    gen(r, L) {
      if (L === 1) { const p = r.pick([10, 20, 25, 5, 50, 75, 15, 30]), n = r.int(2, 20) * 20; const v = p * n / 100;
        return { q: `Find $${p}\\%$ of $${n}$`, a: `${v}`, steps: [`$${p}\\% = ${p / 100}$`, `$${p / 100} \\times ${n} = ${v}$`] }; }
      if (L === 2) { const d = r.pick([4, 5, 8, 20, 25, 40]), n = r.int(1, d - 1); const v = n / d;
        return { q: `Write $\\frac{${n}}{${d}}$ as a decimal`, a: `${v}`, steps: [`Divide: $${n} \\div ${d}$`, d === 4 || d === 20 || d === 25 || d === 5 ? `Scale to a power of ten: $\\frac{${n}}{${d}} = \\frac{${n * 100 / d}}{100}$` : `Long division gives the decimal`, `$= ${v}$`] }; }
      const old = r.int(4, 30) * 10, p = r.pick([10, 20, 25, 40, 5, 15]) * r.pick([1, -1]), nw = old * (1 + p / 100);
      if (r.next() < 0.5) return { q: `A price of $${old}$ ${p > 0 ? 'increases' : 'decreases'} by $${Math.abs(p)}\\%$. What is the new price?`, a: `${nw}`, steps: [`Multiplier: $1 ${p > 0 ? '+' : '-'} ${Math.abs(p) / 100} = ${1 + p / 100}$`, `$${old} \\times ${1 + p / 100} = ${nw}$`] };
      return { q: `A value changes from $${old}$ to $${nw}$. What is the percentage change? (Use a minus sign for a decrease.)`, a: `${p}`, steps: [`Change $= ${nw} - ${old} = ${nw - old}$`, `$\\frac{${nw - old}}{${old}} \\times 100 = ${p}\\%$`] };
    },
    push: [
      { q: 'A price rises by $20\\%$ and then falls by $20\\%$. By what percentage has it changed overall? (negative for a decrease)', a: '-4', steps: ['Multipliers: $1.2 \\times 0.8 = 0.96$', 'So the final price is $96\\%$ of the original', 'Overall change: $-4\\%$'] },
      { q: 'Write $0.\\overline{36} = 0.363636\\ldots$ as a fraction in simplest form.', a: '4/11', steps: ['Let $x = 0.3636\\ldots$, then $100x = 36.3636\\ldots$', 'Subtract: $99x = 36$', '$x = \\frac{36}{99} = \\frac{4}{11}$'] },
    ] },

  { id: 'exponents', title: 'Exponents', grade: 8,
    explain: `$a^n$ means $a$ multiplied by itself $n$ times. The laws:\n\n$$a^m \\cdot a^n = a^{m+n} \\qquad \\frac{a^m}{a^n} = a^{m-n} \\qquad (a^m)^n = a^{mn}$$\n$$a^0 = 1 \\qquad a^{-n} = \\frac{1}{a^n} \\qquad a^{1/2} = \\sqrt{a}$$\n\nWrite powers small and raised, to the upper right: $x^5$.`,
    example: { q: 'Simplify $\\frac{x^7 \\cdot x^2}{x^4}$', steps: ['Top: $x^{7+2} = x^9$', 'Divide: $x^{9-4} = x^5$'], a: 'x^5' },
    gen(r, L) {
      if (L === 1) { const b = r.int(2, 5), n = r.int(2, b < 4 ? 5 : 3); const v = Math.pow(b, n);
        return { q: `Evaluate $${b}^{${n}}$`, a: `${v}`, steps: [`$${Array(n).fill(b).join(' \\times ')} = ${v}$`] }; }
      if (L === 2) { const m = r.int(2, 9), n = r.int(2, 9), k = r.int(1, Math.min(m + n - 1, 9)); const p = m + n - k;
        return { q: `Simplify $\\frac{x^{${m}} \\cdot x^{${n}}}{x^{${k}}}$`, a: `x^${p}`, steps: [`Multiply → add powers: $x^{${m}+${n}} = x^{${m + n}}$`, `Divide → subtract: $x^{${m + n}-${k}} = x^{${p}}$`] }; }
      const t = r.int(0, 2);
      if (t === 0) { const b = r.pick([2, 3, 4, 5, 10]), n = r.int(1, 3); return { q: `Evaluate $${b}^{-${n}}$`, a: `1/${Math.pow(b, n)}`, steps: [`Negative power means reciprocal: $${b}^{-${n}} = \\frac{1}{${b}^{${n}}}$`, `$= \\frac{1}{${Math.pow(b, n)}}$`] }; }
      if (t === 1) { const c = r.int(2, 5), m = r.int(2, 4), n = r.int(2, 3); return { q: `Simplify $(${c}x^{${m}})^{${n}}$`, a: `${Math.pow(c, n)}x^${m * n}`, steps: [`Each factor gets the power: $${c}^{${n}} \\cdot (x^{${m}})^{${n}}$`, `$= ${Math.pow(c, n)}x^{${m * n}}$`] }; }
      const s = r.pick([4, 9, 16, 25, 36, 49, 64, 81, 100]), k = Math.sqrt(s), e = r.pick([1, 3]);
      return { q: `Evaluate $${s}^{${e === 1 ? '\\frac12' : '\\frac32'}}$`, a: `${Math.pow(k, e)}`, steps: [`$${s}^{1/2} = \\sqrt{${s}} = ${k}$`, e === 3 ? `Then cube: $${k}^3 = ${k * k * k}$` : `So the answer is $${k}$`] };
    },
    push: [
      { q: 'Find $x$ if $2^{x} \\cdot 4^{x} = 8^{5}$', a: '5', steps: ['Write everything as powers of 2: $2^x \\cdot 2^{2x} = 2^{15}$', '$2^{3x} = 2^{15}$', '$3x = 15$, so $x = 5$'] },
      { q: 'What is the last digit of $3^{2026}$?', a: '9', steps: ['Last digits of powers of 3 cycle: $3, 9, 7, 1, 3, 9, \\dots$ (period 4)', '$2026 = 4 \\times 506 + 2$, so it matches $3^2$', 'Last digit is $9$'] },
    ] },

  { id: 'linear', title: 'Linear equations', grade: 8,
    explain: `An equation is a balance: whatever you do to one side, do to the other. Goal: get $x$ alone.\n\n1. Expand brackets.\n2. Collect $x$ terms on one side, numbers on the other.\n3. Divide by the coefficient of $x$.\n\nCheck by substituting back. You may write just the number, or $x = \\dots$\n\n**Inequalities** ($<, >, \\le, \\ge$) solve the same way, except multiplying or dividing by a negative number **flips** the sign. Write the answer like $x \\ge -2$.`,
    example: { q: 'Solve $3(x - 2) = x + 8$', steps: ['Expand: $3x - 6 = x + 8$', 'Subtract $x$: $2x - 6 = 8$', 'Add $6$: $2x = 14$', 'Divide by $2$: $x = 7$'], a: '7' },
    gen(r, L) {
      const x = r.int(-9, 9);
      if (L === 1) { const a = r.int(2, 9), b = r.nz(-15, 15), c = a * x + b;
        return { q: `Solve $${a}x ${sg(b)} = ${c}$`, a: `${x}`, steps: [`${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$ on both sides: $${a}x = ${c - b}$`, `Divide by $${a}$: $x = ${x}$`] }; }
      if (L === 2) { let a = r.int(2, 9), c = r.int(1, 9); if (a === c) a++; const b = r.nz(-12, 12), d = a * x + b - c * x;
        return { q: `Solve $${a}x ${sg(b)} = ${coef(c, 'x')} ${sg(d)}$`, a: `${x}`, steps: [`Subtract $${coef(c, 'x')}$: $${a - c}x ${sg(b)} = ${d}$`, `${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$: $${a - c}x = ${d - b}$`, `Divide by $${a - c}$: $x = ${x}$`] }; }
      if (r.next() < 0.3) { const a = r.nz(-6, 6), b = r.nz(-10, 10), op = r.pick(['<', '>', '≤', '≥']), c = a * x + b; const flip = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' }[op], fo = a < 0 ? flip : op;
        const tex = o => ({ '<': '<', '>': '>', '≤': '\\le', '≥': '\\ge' }[o]);
        return { q: `Solve the inequality $${coef(a, 'x')} ${sg(b)} ${tex(op)} ${c}$`, a: `x${fo}${x}`, aTex: `x ${tex(fo)} ${x}`, steps: [`${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$: $${coef(a, 'x')} ${tex(op)} ${c - b}$`, a < 0 ? `Divide by $${a}$ — dividing by a **negative flips** the sign: $x ${tex(fo)} ${x}$` : `Divide by $${a}$: $x ${tex(fo)} ${x}$`] }; }
      if (r.next() < 0.5) { const a = r.int(2, 5), b = r.nz(-6, 6), c = r.int(2, 4), k = r.nz(-6, 6); // a(x+b) = c(x+k) + e
        const e = a * (x + b) - c * (x + k); if (a === c) return this.gen(r, 2);
        return { q: `Solve $${a}(x ${sg(b)}) = ${c}(x ${sg(k)}) ${sg(e)}$`, a: `${x}`, steps: [`Expand: $${a}x ${sg(a * b)} = ${c}x ${sg(c * k)} ${sg(e)}$`, `Simplify right: $${c}x ${sg(c * k + e)}$`, `Collect: $${a - c}x = ${c * k + e - a * b}$`, `$x = ${x}$`] }; }
      const d = r.pick([2, 3, 4, 5]), b = r.nz(-5, 5), xx = d * r.int(-4, 5), c = xx / d + b;
      return { q: `Solve $\\frac{x}{${d}} ${sg(b)} = ${c}$`, a: `${xx}`, steps: [`${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$: $\\frac{x}{${d}} = ${c - b}$`, `Multiply by $${d}$: $x = ${xx}$`] };
    },
    push: [
      { q: 'The sum of three consecutive odd numbers is $147$. What is the largest?', a: '51', steps: ['Let them be $n-2,\\ n,\\ n+2$', 'Sum $3n = 147$, so $n = 49$', 'Largest is $51$'] },
      { q: 'Solve $\\frac{x+1}{3} - \\frac{x-1}{4} = 2$', a: '17', steps: ['Multiply everything by $12$: $4(x+1) - 3(x-1) = 24$', '$4x + 4 - 3x + 3 = 24$', '$x + 7 = 24$, so $x = 17$'] },
    ] },

  { id: 'quadratics', title: 'Expanding, factorising & quadratics', grade: 9,
    explain: `**Expanding**: $(x + a)(x + b) = x^2 + (a+b)x + ab$.\n\n**Factorising** $x^2 + bx + c$: find two numbers that **multiply** to $c$ and **add** to $b$. E.g. $x^2 + 5x + 6 = (x+2)(x+3)$.\n\n**Solving** $x^2 + bx + c = 0$: factorise, then each bracket can be zero. If it won't factorise use the formula\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nWhen asked to factorise, write it with brackets — e.g. $(x+2)(x-5)$. For two roots write both with a comma between, in any order: $4, -3$. The formula's $\\pm$ is fine too, e.g. $1 \\pm 3$.`,
    example: { q: 'Solve $x^2 - x - 12 = 0$', steps: ['Need two numbers: product $-12$, sum $-1$ → $-4$ and $3$', '$(x - 4)(x + 3) = 0$', '$x = 4$ or $x = -3$ — write both, separated by a comma: $4, -3$'], a: '4,-3' },
    gen(r, L) {
      const p = r.nz(-9, 9), q = r.nz(-9, 9);
      if (L === 1) return { q: `Expand $(x ${sg(p)})(x ${sg(q)})$`, a: `x^2+${p + q}x+${p * q}`, aTex: polyL([[1, 2], [p + q, 1], [p * q, 0]]), steps: [`FOIL: $x^2 ${sg(q)}x ${sg(p)}x ${sg(p * q)}$`, `Collect: $${polyL([[1, 2], [p + q, 1], [p * q, 0]])}$`] };
      if (L === 2) return { q: `Factorise $${polyL([[1, 2], [p + q, 1], [p * q, 0]])}$`, a: `(x+${p})(x+${q})`, aTex: `(x ${sg(p)})(x ${sg(q)})`, form: 'factored', steps: [`Two numbers with product $${p * q}$ and sum $${p + q}$: $${p}$ and $${q}$`, `$(x ${sg(p)})(x ${sg(q)})$`] };
      if (r.next() < 0.6) { const rs = p === q ? `${-p}` : `${-p},${-q}`;
        return { q: `Solve $${polyL([[1, 2], [p + q, 1], [p * q, 0]])} = 0$. Give ${p === q ? 'the root' : '**both** roots, separated by a comma'}.`, a: rs, aTex: p === q ? `x = ${-p}` : `x = ${-p} \\text{ or } x = ${-q}`, steps: [`Factorise: $(x ${sg(p)})(x ${sg(q)}) = 0$`, `Each bracket can be zero: $x = ${-p}$ or $x = ${-q}$`] }; }
      const a = r.int(2, 3), m = r.nz(-5, 5), n = r.nz(-5, 5); // a(x-m)(x-n) area via formula: give sum of roots
      const B = -a * (m + n), Cc = a * m * n;
      return { q: `Solve $${polyL([[a, 2], [B, 1], [Cc, 0]])} = 0$. Give ${m === n ? 'the root' : '**both** roots, separated by a comma'}.`, a: m === n ? `${m}` : `${m},${n}`, aTex: `x = ${m}${m === n ? '' : ` \\text{ or } x = ${n}`}`, steps: [`Divide by $${a}$: $${polyL([[1, 2], [-(m + n), 1], [m * n, 0]])} = 0$`, `Factorise: $(x ${sg(-m)})(x ${sg(-n)}) = 0$`, `Roots: $x = ${m}$ and $x = ${n}$`] };
    },
    push: [
      { q: 'If $x + \\frac{1}{x} = 5$, find $x^2 + \\frac{1}{x^2}$', a: '23', steps: ['Square both sides: $x^2 + 2 + \\frac{1}{x^2} = 25$', 'So $x^2 + \\frac{1}{x^2} = 23$'] },
      { q: 'Compute $2027^2 - 2026^2$ without a calculator', a: '4053', steps: ['Difference of squares: $a^2 - b^2 = (a-b)(a+b)$', '$(2027 - 2026)(2027 + 2026) = 1 \\times 4053$', '$= 4053$'] },
      { q: 'The roots of $x^2 - 7x + k = 0$ differ by $3$. Find $k$.', a: '10', steps: ['Roots $r$ and $r+3$ add to $7$: $2r + 3 = 7$, so $r = 2$', 'Roots $2$ and $5$; product $= k = 10$'] },
    ] },

  { id: 'geometry', title: 'Pythagoras & geometry basics', grade: 8,
    explain: `**Pythagoras**: in a right-angled triangle with hypotenuse $c$ (opposite the right angle),\n$$a^2 + b^2 = c^2$$\n\nOther essentials:\n- Angles in a triangle add to $180^\\circ$; on a straight line $180^\\circ$; around a point $360^\\circ$.\n- Area of triangle $= \\frac12 \\times \\text{base} \\times \\text{height}$; circle area $= \\pi r^2$; circumference $= 2\\pi r$.\n\nYou can write $\\pi$ in answers (e.g. $25\\pi$) or a decimal.`,
    example: { q: 'A right triangle has legs $6$ and $8$. Find the hypotenuse.', steps: ['$c^2 = 6^2 + 8^2 = 36 + 64 = 100$', '$c = \\sqrt{100} = 10$'], a: '10' },
    gen(r, L) {
      const trip = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29]]);
      if (L === 1) { if (r.next() < 0.5) { const a = r.int(25, 80), b = r.int(25, 150 - a); return { q: `Two angles of a triangle are $${a}^\\circ$ and $${b}^\\circ$. Find the third angle (degrees).`, a: `${180 - a - b}`, steps: [`Angles add to $180^\\circ$`, `$180 - ${a} - ${b} = ${180 - a - b}$`] }; }
        const [a, b, c] = trip; return { q: `Find the hypotenuse $c$.`, svg: triSVG(a, b, { base: a, height: b, hyp: 'c' }), a: `${c}`, steps: [`$c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}$`, `$c = \\sqrt{${c * c}} = ${c}$`] }; }
      if (L === 2) { const [a, b, c] = trip; return { q: `The hypotenuse is $${c}$ and one leg is $${a}$. Find the other leg.`, svg: triSVG(a, b, { base: a, height: '?', hyp: c }), a: `${b}`, steps: [`$b^2 = c^2 - a^2 = ${c * c} - ${a * a} = ${b * b}$`, `$b = ${b}$`] }; }
      const t = r.int(0, 2);
      if (t === 0) { const a = r.int(2, 9), b = r.int(2, 9); const s = a * a + b * b; let k = 1, m = s; for (let i = 2; i * i <= m; i++) while (m % (i * i) === 0) { m /= i * i; k *= i; }
        return { q: `Legs are $${a}$ and $${b}$. Find the hypotenuse exactly (surd form) or to 2 decimal places.`, svg: triSVG(a, b, { base: a, height: b, hyp: 'c' }), a: `sqrt(${s})`, tol: 0.006, steps: [`$c^2 = ${a * a} + ${b * b} = ${s}$`, `$c = \\sqrt{${s}}${k > 1 ? ` = ${k}\\sqrt{${m}}` : ''} \\approx ${Math.sqrt(s).toFixed(2)}$`] }; }
      if (t === 1) { const rr = r.int(2, 12); return { q: `Find the area of a circle of radius $${rr}$ (in terms of $\\pi$, or to 1 d.p.)`, a: `${rr * rr}pi`, tol: 0.06, steps: [`$A = \\pi r^2 = \\pi \\times ${rr}^2$`, `$= ${rr * rr}\\pi \\approx ${(rr * rr * Math.PI).toFixed(1)}$`] }; }
      const b = r.int(3, 20), h = r.int(2, 15); return { q: `A triangle has base $${b}$ and perpendicular height $${h}$. Find its area.`, a: `${b * h / 2}`, steps: [`$A = \\frac12 \\times ${b} \\times ${h}$`, `$= ${b * h / 2}$`] };
    },
    push: [
      { q: 'A square is inscribed in a circle of radius $5$. Find the area of the square.', a: '50', steps: ["The square's diagonal is the circle's diameter: $10$", 'For side $s$: $s^2 + s^2 = 10^2$, so $s^2 = 50$', 'Area $= s^2 = 50$'] },
      { q: 'A ladder $13$ m long leans against a wall with its foot $5$ m from the wall. The foot slides out to $12$ m. How far (m) does the top slide down?', a: '7', steps: ['Initially height $= \\sqrt{13^2 - 5^2} = 12$', 'Afterwards height $= \\sqrt{13^2 - 12^2} = 5$', 'Slides down $12 - 5 = 7$ m'] },
      { q: 'Each interior angle of a regular polygon is $156^\\circ$. How many sides does it have?', a: '15', steps: ['Each exterior angle is $180 - 156 = 24^\\circ$', 'Exterior angles total $360^\\circ$', '$n = 360 / 24 = 15$'] },
    ] },

  { id: 'trig', title: 'Right-triangle trigonometry', grade: 10,
    explain: `For an angle $\\theta$ in a right triangle: **SOH CAH TOA**\n$$\\sin\\theta = \\frac{\\text{opp}}{\\text{hyp}} \\qquad \\cos\\theta = \\frac{\\text{adj}}{\\text{hyp}} \\qquad \\tan\\theta = \\frac{\\text{opp}}{\\text{adj}}$$\n\n1. Label the sides relative to the angle.\n2. Pick the ratio that uses the two sides you care about.\n3. Rearrange; use $\\sin^{-1}$ etc. to find an angle.\n\nUse a calculator in degree mode. Give sides to **1 decimal place** and angles to the **nearest degree**.\n\nExact values worth memorising: $\\sin 30^\\circ = \\frac12$, $\\cos 60^\\circ = \\frac12$, $\\tan 45^\\circ = 1$, $\\sin 60^\\circ = \\frac{\\sqrt3}{2}$.`,
    example: { q: 'Hypotenuse $10$, angle $35^\\circ$. Find the side opposite the angle.', steps: ['Opposite and hypotenuse → sine', '$\\sin 35^\\circ = \\frac{x}{10}$', '$x = 10 \\sin 35^\\circ \\approx 5.7$'], a: '5.7' },
    gen(r, L) {
      if (L === 1) { const opts = [['\\sin 30^\\circ', '1/2'], ['\\cos 60^\\circ', '1/2'], ['\\tan 45^\\circ', '1'], ['\\sin 90^\\circ', '1'], ['\\cos 0^\\circ', '1'], ['\\sin 60^\\circ', 'sqrt(3)/2'], ['\\cos 30^\\circ', 'sqrt(3)/2'], ['\\tan 60^\\circ', 'sqrt(3)'], ['\\sin 45^\\circ', 'sqrt(2)/2']];
        const [e, a] = r.pick(opts); return { q: `Give the exact value of $${e}$ (or 3 d.p.)`, a, tol: 0.0006, steps: [`Use the special triangles ($30$-$60$-$90$ with sides $1, \\sqrt3, 2$; $45$-$45$-$90$ with sides $1, 1, \\sqrt2$)`, `$${e} = ${a.replace('sqrt(3)', '\\sqrt3').replace('sqrt(2)', '\\sqrt2')}$`] }; }
      const ang = r.int(20, 70), h = r.int(5, 20);
      if (L === 2) { const which = r.pick(['opp', 'adj']); const v = which === 'opp' ? h * Math.sin(ang * DEG) : h * Math.cos(ang * DEG);
        const fn = which === 'opp' ? 'sin' : 'cos'; const W = Math.cos(ang * DEG) * h, Hh = Math.sin(ang * DEG) * h;
        return { q: `Hypotenuse $= ${h}$, angle $= ${ang}^\\circ$ (at the bottom right). Find $x$, the side ${which === 'opp' ? 'opposite' : 'adjacent to'} the angle, to 1 d.p.`,
          svg: triSVG(W, Hh, { base: which === 'adj' ? 'x' : '', height: which === 'opp' ? 'x' : '', hyp: h, angle: ang + '°' }), a: `${r1(v)}`, tol: 0.051,
          steps: [`${which === 'opp' ? 'Opposite' : 'Adjacent'} & hypotenuse → $\\${fn}$`, `$\\${fn} ${ang}^\\circ = \\frac{x}{${h}}$`, `$x = ${h}\\${fn} ${ang}^\\circ \\approx ${r1(v)}$`] }; }
      if (r.next() < 0.5) { const o = r.int(3, 15), a = r.int(3, 15); const t = Math.atan(o / a) / DEG;
        return { q: `Opposite $= ${o}$, adjacent $= ${a}$. Find the angle $\\theta$ to the nearest degree.`, svg: triSVG(a, o, { base: a, height: o, angle: 'θ' }), a: `${rd(t)}`, tol: 0.51,
          steps: ['Opposite & adjacent → $\\tan$', `$\\tan\\theta = \\frac{${o}}{${a}}$`, `$\\theta = \\tan^{-1}\\left(\\frac{${o}}{${a}}\\right) \\approx ${rd(t)}^\\circ$`] }; }
      const adj = r.int(4, 20); const v = adj * Math.tan(ang * DEG);
      return { q: `Adjacent $= ${adj}$, angle $= ${ang}^\\circ$. Find the opposite side to 1 d.p.`, svg: triSVG(adj, v, { base: adj, height: 'x', angle: ang + '°' }), a: `${r1(v)}`, tol: 0.051, steps: ['Opposite & adjacent → $\\tan$', `$x = ${adj}\\tan ${ang}^\\circ \\approx ${r1(v)}$`] };
    },
    push: [
      { q: 'From $50$ m away from the base of a tower, the angle of elevation of the top is $40^\\circ$. How tall is the tower (m, 1 d.p.)?', a: '42.0', tol: 0.051, steps: ['$\\tan 40^\\circ = \\frac{h}{50}$', '$h = 50 \\tan 40^\\circ \\approx 41.95 \\approx 42.0$ m'] },
      { q: 'If $\\sin\\theta = \\frac{3}{5}$ and $\\theta$ is acute, find $\\tan\\theta$.', a: '3/4', steps: ['Opposite $3$, hypotenuse $5$ → adjacent $= \\sqrt{25 - 9} = 4$', '$\\tan\\theta = \\frac{3}{4}$'] },
      { q: 'Find the exact value of $\\sin^2 37^\\circ + \\cos^2 37^\\circ$.', a: '1', steps: ['Pythagoras on the unit triangle: $\\sin^2\\theta + \\cos^2\\theta = 1$ for every $\\theta$'] },
    ] },


  { id: 'functions', title: 'Functions & graphs', grade: 10,
    explain: `A **function** $f$ takes an input $x$ and gives one output $f(x)$. To find $f(3)$, replace every $x$ with $3$.\n\n**Straight lines** $y = mx + c$: $m$ is the **gradient** (rise over run) and $c$ is the **$y$-intercept** (where the line crosses the $y$-axis).\n$$m = \\frac{y_2 - y_1}{x_2 - x_1}$$\n\n**Parabolas** $y = a(x - p)^2 + q$ have their **turning point (vertex)** at $(p, q)$. For $y = x^2 + bx + c$ the vertex is at $x = -\\frac{b}{2}$.\n\nFor a point, write the coordinates as $x, y$ — e.g. $2, -3$ (order matters).`,
    example: { q: 'Find the gradient of the line through $(1, 2)$ and $(4, 11)$', steps: ['$m = \\frac{11 - 2}{4 - 1}$', '$= \\frac{9}{3} = 3$'], a: '3' },
    gen(r, L) {
      if (L === 1) { if (r.next() < 0.5) { const a = r.nz(-5, 5), b = r.int(-9, 9), k = r.int(-5, 5); const v = a * k + b;
          return { q: `If $f(x) = ${polyL([[a, 1], [b, 0]])}$, find $f(${k})$`, a: `${v}`, steps: [`Replace $x$ with $${k}$: $f(${k}) = ${a}\\times${par(k)} ${sg(b)}$`, `$= ${v}$`] }; }
        const a = r.nz(-3, 3), b = r.int(-6, 6), c = r.int(-6, 6), k = r.int(-3, 3); const v = a * k * k + b * k + c;
        return { q: `If $f(x) = ${polyL([[a, 2], [b, 1], [c, 0]])}$, find $f(${k})$`, a: `${v}`, steps: [`Substitute $x = ${k}$: $${a}\\times${par(k)}^2 ${sg(b)}\\times${par(k)} ${sg(c)}$`, `$= ${a * k * k} ${sg(b * k)} ${sg(c)} = ${v}$`] }; }
      if (L === 2) { const x1 = r.int(-4, 0), x2 = x1 + r.int(1, 4), y1 = r.int(-4, 4), m = r.pick([-2, -1, 1, 2, 3, 0.5, -0.5]); const y2 = y1 + m * (x2 - x1);
        if (!Number.isInteger(y2) || Math.abs(y2) > 5) return this.gen(r, 2);
        const c = y1 - m * x1, ask = r.pick(['m', 'c']), f = x => m * x + c, ms = fr(Math.round(m * 2), 2);
        return { q: ask === 'm' ? 'Find the **gradient** of the line shown (the marked points are on it).' : 'Find the **$y$-intercept** of the line shown (the marked points are on it).',
          svg: plotSVG([f], [[x1, y1, `(${x1}, ${y1})`], [x2, y2, `(${x2}, ${y2})`]]), a: ask === 'm' ? fp(ms) : `${c}`,
          steps: [`$m = \\frac{${y2} - ${par(y1)}}{${x2} - ${par(x1)}} = \\frac{${y2 - y1}}{${x2 - x1}} = ${fl(ms)}$`].concat(ask === 'c' ? [`$y = mx + c$ through $(${x1}, ${y1})$: $${y1} = ${fl(ms)}\\times${par(x1)} + c$`, `$c = ${c}$`] : []) }; }
      const p = r.int(-3, 3), q = r.int(-4, 4), a = r.pick([1, 1, -1]); const f = x => a * (x - p) * (x - p) + q;
      const t = r.int(0, 2);
      if (t === 0) return { q: 'The graph shows a parabola. Write the coordinates of its turning point as $x, y$.', svg: plotSVG([f], [[p, q, '']]), a: `${p},${q}`, aTex: `(${p}, ${q})`, ordered: true, steps: [`The turning point is where the graph changes direction`, `Read it off: $(${p}, ${q})$`] };
      const b = -2 * p, c0 = p * p + q;
      if (t === 1) return { q: `Find the **minimum value** of $y = ${polyL([[1, 2], [b, 1], [c0, 0]])}$`, a: `${q}`, steps: [`Complete the square: $y = (x ${sg(-p)})^2 ${sg(q)}$`, `A square is never negative, so the minimum is when $x = ${p}$`, `Minimum value $${q}$`] };
      const g = r.int(1, 4), h = r.nz(-3, 3), k = r.int(-2, 3); const inner = g * k + h, v = inner * inner;
      return { q: `$f(x) = x^2$ and $g(x) = ${polyL([[g, 1], [h, 0]])}$. Find $f(g(${k}))$`, a: `${v}`, steps: [`Inside first: $g(${k}) = ${inner}$`, `Then $f(${inner}) = ${par(inner)}^2 = ${v}$`] };
    },
    push: [
      { q: 'If $f(x) = 2x + 3$, find $x$ such that $f(f(x)) = 29$', a: '5', steps: ['$f(f(x)) = 2(2x + 3) + 3 = 4x + 9$', '$4x + 9 = 29 \\Rightarrow x = 5$'] },
      { q: 'The lines $y = 2x + 1$ and $y = -x + 7$ meet at a point. Give its coordinates as $x, y$.', a: '2,5', ordered: true, aTex: '(2, 5)', steps: ['Set equal: $2x + 1 = -x + 7$', '$3x = 6$, so $x = 2$ and $y = 5$'] },
      { q: 'A function satisfies $f(x + 1) = f(x) + 3$ and $f(0) = 4$. Find $f(10)$.', a: '34', steps: ['Each step of $1$ in $x$ adds $3$', '$f(10) = 4 + 10 \\times 3 = 34$'] },
    ] },
  { id: 'derivatives', title: 'Introduction to derivatives', grade: 11,
    explain: `The **derivative** $f'(x)$ is the slope of the tangent to $y = f(x)$ — the instantaneous rate of change:\n$$f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$\n\n**Power rule**: $\\frac{d}{dx} x^n = n x^{n-1}$. Constants vanish, and you differentiate term by term:\n$$\\frac{d}{dx}\\left(3x^4 - 5x + 7\\right) = 12x^3 - 5$$\n\nWrite answers like $12x^3 - 5$ using raised powers.`,
    example: { q: 'Find the slope of $y = x^3 - 2x$ at $x = 2$', steps: ["$y' = 3x^2 - 2$", "At $x = 2$: $3(4) - 2 = 10$"], a: '10' },
    gen(r, L) {
      if (L === 1) { const c = r.int(1, 9), n = r.int(2, 6); return { q: `Differentiate $y = ${coef(c, 'x')}^{${n}}$`, a: `${c * n}x^${n - 1}`, steps: [`Power rule: bring down $${n}$, reduce power by 1`, `$y' = ${c * n}x^{${n - 1}}$`.replace('x^{1}', 'x')] }; }
      const cs = [[r.nz(-5, 5), 3], [r.int(-6, 6), 2], [r.nz(-9, 9), 1], [r.int(-9, 9), 0]].filter((c, i) => i !== 1 || r.next() < 0.8);
      const d = cs.filter(c => c[1] > 0).map(([c, p]) => [c * p, p - 1]);
      if (L === 2) return { q: `Differentiate $f(x) = ${polyL(cs)}$`, a: polyP(d), aTex: polyL(d), steps: ['Differentiate term by term with the power rule; the constant disappears', `$f'(x) = ${polyL(d)}$`] };
      const x0 = r.int(-3, 3); const v = d.reduce((s, [c, p]) => s + c * Math.pow(x0, p), 0);
      return { q: `Find the gradient of the tangent to $y = ${polyL(cs)}$ at $x = ${x0}$`, a: `${v}`, steps: [`$y' = ${polyL(d)}$`, `Substitute $x = ${x0}$: $y' = ${v}$`] };
    },
    push: [
      { q: 'Find the minimum value of $f(x) = x^2 - 6x + 11$ using derivatives.', a: '2', steps: ["$f'(x) = 2x - 6 = 0 \\Rightarrow x = 3$", '$f(3) = 9 - 18 + 11 = 2$'] },
      { q: 'A rectangle has perimeter $20$. What is its maximum possible area?', a: '25', steps: ['Sides $x$ and $10 - x$: area $A = 10x - x^2$', "$A' = 10 - 2x = 0 \\Rightarrow x = 5$", 'Max area $= 5 \\times 5 = 25$ (a square)'] },
      { q: 'Using the definition, $\\lim_{h\\to0} \\frac{(3+h)^2 - 9}{h} = ?$', a: '6', steps: ['Expand: $\\frac{9 + 6h + h^2 - 9}{h} = 6 + h$', 'As $h \\to 0$ this tends to $6$'] },
    ] },

  { id: 'integrals', title: 'Introduction to integrals', grade: 12,
    explain: `**Integration** undoes differentiation. The **antiderivative** of $x^n$ (for $n \\ne -1$) is
$$\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + c$$
Add one to the power, divide by the new power; integrate term by term. The $+ c$ is there because constants vanish when you differentiate — you may write it or leave it out.

A **definite integral** gives the (signed) area under a curve between $x = a$ and $x = b$:
$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$
where $F$ is any antiderivative.`,
    example: { q: 'Evaluate $\\int_1^3 2x\\,dx$', steps: ['Antiderivative of $2x$ is $x^2$', '$F(3) - F(1) = 9 - 1 = 8$'], a: '8' },
    gen(r, L) {
      if (L === 1) { const n = r.int(1, 5), k = (n + 1) * r.int(1, 4) * (r.next() < 0.8 ? 1 : -1);
        return { q: `Find $\\int ${coef(k, 'x')}^{${n}}\\,dx$`.replace('x^{1}\\,', 'x\\,'), a: `${k / (n + 1)}x^${n + 1}`, aTex: `${coef(k / (n + 1), 'x')}^{${n + 1}} + c`, upToC: true, steps: [`Add one to the power: $${n} + 1 = ${n + 1}$`, `Divide by it: $\\frac{${k}}{${n + 1}}x^{${n + 1}} = ${coef(k / (n + 1), 'x')}^{${n + 1}}$`, 'Add $+ c$'] }; }
      const a3 = 3 * r.int(-2, 2), a2 = 2 * r.nz(-4, 4), a1 = r.int(-6, 6); const cs = [[a3, 2], [a2, 1], [a1, 0]].filter(c => c[0]);
      const F = cs.map(([c, p]) => [c / (p + 1), p + 1]); const Fv = x => F.reduce((s, [c, p]) => s + c * Math.pow(x, p), 0);
      if (L === 2) return { q: `Find $\\int (${polyL(cs)})\\,dx$`, a: F.map(([c, p]) => `(${c})*x^(${p})`).join('+'), aTex: polyL(F) + ' + c', upToC: true, steps: ['Integrate term by term: raise each power by one and divide by the new power', `$${polyL(F)} + c$`] };
      const lo = r.int(-2, 1), hi = lo + r.int(1, 3); const v = Fv(hi) - Fv(lo);
      return { q: `Evaluate $\\int_{${lo}}^{${hi}} (${polyL(cs)})\\,dx$`, a: `${Math.round(v * 6)}/6`, aTex: fl(fr(Math.round(v * 6), 6)), steps: [`Antiderivative $F(x) = ${polyL(F)}$`, `$F(${hi}) = ${fl(fr(Math.round(Fv(hi) * 6), 6))}$, $F(${lo}) = ${fl(fr(Math.round(Fv(lo) * 6), 6))}$`, `$F(${hi}) - F(${lo}) = ${fl(fr(Math.round(v * 6), 6))}$`] };
    },
    push: [
      { q: 'Find the area between $y = x$ and $y = x^2$ for $0 \\le x \\le 1$.', a: '1/6', steps: ['On $[0, 1]$ the line is above the parabola', 'Area $= \\int_0^1 (x - x^2)\\,dx = \\frac12 - \\frac13$', '$= \\frac16$'] },
      { q: 'Find $k > 0$ such that $\\int_0^k 2x\\,dx = 49$', a: '7', steps: ['$\\int_0^k 2x\\,dx = k^2$', '$k^2 = 49$, $k = 7$'] },
      { q: 'Evaluate $\\int_{-3}^{3} (x^3 + 5x)\\,dx$', a: '0', steps: ['$x^3 + 5x$ is an odd function: the area left of $0$ cancels the area right of $0$', 'Result $0$ — no calculation needed'] },
    ] },
  ];
  const SUBJECTS = [{ id: 'maths', title: 'Mathematics', topics }];
  const api = { SUBJECTS, topics, rng, makeQuestion(topicId, level, seed) { const t = topics.find(x => x.id === topicId); const q = t.gen(rng(seed), level); return Object.assign(q, { topic: topicId, level, seed, id: `${topicId}-${level}-${seed}` }); } };
  if (typeof module !== 'undefined') module.exports = api; else root.Content = api;
})(this);
