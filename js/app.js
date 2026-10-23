'use strict';
const $ = (s, el = document) => el.querySelector(s);
const view = () => $('#view');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const K = (tex, display) => { try { return katex.renderToString(tex, { throwOnError: false, displayMode: !!display }); } catch (e) { return esc(tex); } };
function md(text) {
  const math = []; let s = String(text).replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => `\u0000${math.push(K(m, true)) - 1}\u0000`).replace(/\$([^$]+?)\$/g, (_, m) => `\u0000${math.push(K(m)) - 1}\u0000`);
  s = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  s = s.split(/\n\n+/).map(b => /^- /m.test(b) ? '<ul>' + b.split('\n').map(l => l.replace(/^- /, '')).map(l => `<li>${l}</li>`).join('') + '</ul>' : /^\d\. /.test(b) ? '<ol>' + b.split('\n').map(l => `<li>${l.replace(/^\d\. /, '')}</li>`).join('') + '</ol>' : `<p>${b.replace(/\n/g, '<br>')}</p>`).join('');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => math[i]);
}
const TOPICS = Content.topics;
const topicById = id => TOPICS.find(t => t.id === id);
// ---------- state ----------
const S = { progress: {}, srs: {}, settings: { theme: 'auto', bg: 'grid', finger: false }, placement: null, templates: [] };
async function loadState() {
  for (const k of ['progress', 'srs', 'settings', 'placement', 'templates']) { const v = await DB.get('kv', k); if (v != null) S[k] = k === 'settings' ? Object.assign(S.settings, v) : v; }
  S.templates.forEach(t => t.sym !== 'cdot' && Recognizer.addTemplate(t.sym, t.strokes, true));
  applyTheme();
}
const save = k => DB.set('kv', k, S[k]);
function applyTheme() { const t = S.settings.theme; document.documentElement.dataset.theme = t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t; }
const prog = id => (S.progress[id] = S.progress[id] || { attempts: 0, correct: 0, level: 1, streak: 0, miss: 0, mastered: false, started: false });
const DAY = 864e5, INTERVALS = [1, 3, 7, 16, 35];
function dueItems() { const now = Date.now(); return Object.entries(S.srs).filter(([, v]) => v.due <= now).map(([id, v]) => ({ id, ...v })); }
function recordResult(q, correct, mode) {
  if (mode !== 'placement') {
    const p = prog(q.topic); p.started = true; p.attempts++;
    if (correct) { p.correct++; p.streak++; p.miss = 0; if (p.streak >= 3) { if (p.level < 3) { p.level++; p.streak = 0; } else p.mastered = true; } }
    else { p.streak = 0; p.miss++; if (p.miss >= 2 && p.level > 1) { p.level--; p.miss = 0; } }
    save('progress');
  }
  const key = q.id, ex = S.srs[key];
  if (!correct) S.srs[key] = { ref: q.ref, topic: q.topic, box: 0, due: Date.now() + DAY };
  else if (ex) { ex.box++; if (ex.box >= INTERVALS.length) delete S.srs[key]; else ex.due = Date.now() + INTERVALS[ex.box] * DAY; }
  save('srs');
}
function questionFromRef(ref) {
  if (ref.push != null) { const t = topicById(ref.topic), p = t.push[ref.push]; return Object.assign({}, p, { topic: ref.topic, id: `${ref.topic}-push-${ref.push}`, ref, push: true }); }
  const q = Content.makeQuestion(ref.topic, ref.level, ref.seed); q.ref = ref; return q;
}
const newSeed = () => (Math.random() * 1e9) | 0;
// ---------- router ----------
const routes = {};
function go(hash) { location.hash = hash; }
window.addEventListener('hashchange', render);
let cleanup = [];
function render() {
  cleanup.forEach(f => f()); cleanup = [];
  const [name, ...args] = (location.hash.slice(1) || 'home').split('/');
  (routes[name] || routes.home)(...args.map(decodeURIComponent));
  window.scrollTo(0, 0);
}
function header(title, back = '#home') { return `<header class="bar"><a class="btn icon" href="${back}" aria-label="Back">←</a><h1>${title}</h1><span></span></header>`; }
function nextTopic() { return TOPICS.find(t => !prog(t.id).mastered) || TOPICS[TOPICS.length - 1]; }
// ---------- home ----------
routes.home = () => {
  const due = dueItems().length, nt = nextTopic();
  view().innerHTML = `<header class="bar"><span></span><h1>Pen Maths</h1><a class="btn icon" href="#settings" aria-label="Settings">⚙</a></header>
  <main class="home">
    ${!S.placement ? `<a class="card big primary" href="#placement"><b>Start with a placement check</b><span>About 16 questions across grades 7–10. Write with your S Pen; it finds your starting point.</span></a>` : ''}
    <a class="card big ${S.placement ? 'primary' : ''}" href="#topic/${nt.id}"><b>Continue: ${esc(nt.title)}</b><span>Level ${prog(nt.id).level} of 3 · ${prog(nt.id).correct} correct so far</span></a>
    <div class="grid2">
      <a class="card" href="#review"><b>Review</b><span>${due} due ${due ? '— do these first' : ''}</span></a>
      <a class="card" href="#path"><b>Learning path</b><span>${TOPICS.filter(t => prog(t.id).mastered).length}/${TOPICS.length} topics mastered</span></a>
      <a class="card" href="#progress"><b>Progress</b><span>Accuracy and levels</span></a>
      <a class="card" href="#train"><b>Teach my handwriting</b><span>${S.templates.length} samples — improves recognition</span></a>
    </div>
    ${S.placement ? `<p class="muted center"><a href="#placement">Retake placement check</a></p>` : ''}
  </main>`;
};
routes.path = () => {
  view().innerHTML = header('Learning path') + `<main class="list">${Content.SUBJECTS.map(sub => `<h2>${esc(sub.title)}</h2>` + sub.topics.map((t, i) => { const p = prog(t.id);
    const st = p.mastered ? '✓ mastered' : p.started ? `level ${p.level}/3` : 'not started';
    return `<a class="row ${p.mastered ? 'done' : ''} ${t === nextTopic() ? 'next' : ''}" href="#topic/${t.id}"><span class="num">${i + 1}</span><span class="grow"><b>${esc(t.title)}</b><small>Grade ${t.grade}</small></span><span class="tag">${st}</span></a>`; }).join('')).join('')}</main>`;
};
routes.topic = id => {
  const t = topicById(id); if (!t) return go('#path');
  const ex = t.example;
  view().innerHTML = header(esc(t.title), '#path') + `<main class="lesson">
    <section class="prose">${md(t.explain)}</section>
    <section class="example"><h3>Worked example</h3><div class="q">${md(ex.q)}</div><ol class="steps">${ex.steps.map(s => `<li>${md(s)}</li>`).join('')}</ol><p>Answer: ${K(ex.a.replace(/\^(\d+)/g, '^{$1}'))}</p></section>
    <div class="actions"><a class="btn primary" href="#practice/${t.id}">Practice (level ${prog(t.id).level})</a><a class="btn" href="#push/${t.id}">Push problems (${t.push.length})</a></div></main>`;
};
routes.progress = () => {
  const rows = TOPICS.map(t => { const p = prog(t.id); const acc = p.attempts ? Math.round(100 * p.correct / p.attempts) : 0;
    return `<div class="row"><span class="grow"><b>${esc(t.title)}</b><small>${p.attempts} attempts · ${acc}% · level ${p.level}/3${p.mastered ? ' · mastered' : ''}</small><div class="meter"><i style="width:${p.mastered ? 100 : ((p.level - 1) * 33 + p.streak * 11)}%"></i></div></span></div>`; }).join('');
  const pl = S.placement ? `<p>Placement (${new Date(S.placement.date).toLocaleDateString()}): ${S.placement.score}/${S.placement.total} — started at <b>${esc(topicById(S.placement.start).title)}</b>.</p>` : '';
  view().innerHTML = header('Progress') + `<main class="list">${pl}<p>${Object.keys(S.srs).length} questions in spaced review, ${dueItems().length} due now.</p>${rows}</main>`;
};
routes.settings = () => {
  const s = S.settings, opt = (k, v, l) => `<button class="btn ${s[k] === v ? 'primary' : ''}" data-k="${k}" data-v="${v}">${l}</button>`;
  view().innerHTML = header('Settings') + `<main class="list">
    <h3>Theme</h3><div class="seg">${opt('theme', 'auto', 'Auto')}${opt('theme', 'light', 'Light')}${opt('theme', 'dark', 'Dark')}</div>
    <h3>Working background</h3><div class="seg">${opt('bg', 'grid', 'Grid')}${opt('bg', 'lines', 'Lined')}${opt('bg', 'blank', 'Blank')}</div>
    <h3>Finger drawing</h3><div class="seg"><button class="btn ${s.finger ? '' : 'primary'}" data-k="finger" data-v="0">Off (palm rejection)</button><button class="btn ${s.finger ? 'primary' : ''}" data-k="finger" data-v="1">On</button></div>
    <p class="muted">With finger drawing off, only the S Pen writes; fingers scroll the page.</p>
    <h3>Data</h3><button class="btn danger" id="reset">Reset all progress</button>
    <p class="muted">Everything is stored on this device only. Works offline.</p></main>`;
  view().querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const k = b.dataset.k; s[k] = k === 'finger' ? b.dataset.v === '1' : b.dataset.v; save('settings'); applyTheme(); routes.settings(); });
  $('#reset').onclick = async () => { if (!confirm('Erase all progress and saved working?')) return; S.progress = {}; S.srs = {}; S.placement = null; await save('progress'); await save('srs'); await DB.del('kv', 'placement'); await DB.clear('ink'); go('#home'); };
};
// ---------- sessions ----------
routes.practice = id => { const t = topicById(id); startSession({ title: t.title, back: `#topic/${id}`, mode: 'practice', next: () => ({ topic: id, level: prog(id).level, seed: newSeed() }) }); };
routes.push = id => { const t = topicById(id); let i = 0; startSession({ title: t.title + ' — push', back: `#topic/${id}`, mode: 'push', next: () => i < t.push.length ? { topic: id, push: i++ } : null }); };
routes.review = () => { const items = dueItems(); let i = 0; if (!items.length) { view().innerHTML = header('Review') + `<main class="list"><p>Nothing due. Missed questions come back here after 1, 3, 7, 16 and 35 days.</p></main>`; return; }
  startSession({ title: 'Review', mode: 'review', next: () => i < items.length ? items[i++].ref : null }); };
routes.placement = () => {
  const refs = []; TOPICS.forEach(t => { refs.push({ topic: t.id, level: 1, seed: newSeed() }); refs.push({ topic: t.id, level: 2, seed: newSeed() }); });
  const results = {}; let i = 0;
  startSession({ title: 'Placement check', mode: 'placement', next: () => refs[i++] || null, progressText: () => `${Math.min(i, refs.length)} / ${refs.length}`,
    onResult: (q, ok) => { (results[q.topic] = results[q.topic] || []).push(ok); },
    finish: async () => {
      let score = 0; Object.values(results).forEach(r => r.forEach(x => score += x));
      TOPICS.forEach(t => { const r = results[t.id] || []; const p = prog(t.id); const n = r.filter(Boolean).length; if (n === 2) { p.level = 3; } else if (n === 1) p.level = 2; else p.level = 1; });
      const start = (TOPICS.find(t => (results[t.id] || []).filter(Boolean).length < 2) || TOPICS[TOPICS.length - 1]).id;
      // topics before the start that were aced count as mastered so the path begins at the gap
      for (const t of TOPICS) { if (t.id === start) break; prog(t.id).mastered = true; }
      S.placement = { date: Date.now(), score, total: refs.length, start, results }; await save('placement'); await save('progress');
      view().innerHTML = header('Placement result') + `<main class="list"><p class="big">${score} / ${refs.length}</p>${TOPICS.map(t => `<div class="row"><span class="grow">${esc(t.title)}</span><span class="tag">${(results[t.id] || []).map(x => x ? '✓' : '✗').join(' ')}</span></div>`).join('')}
        <p>Start here: <b>${esc(topicById(start).title)}</b>. Missed questions are scheduled for review.</p><a class="btn primary" href="#topic/${start}">Go to ${esc(topicById(start).title)}</a></main>`;
    } });
};

function startSession(cfg) {
  let q, workPad, ansPad, recog = null, marked = false, saveT, recT, count = 0, right = 0;
  view().innerHTML = `<div class="session">
    <header class="bar"><a class="btn icon" href="${cfg.back || '#home'}" aria-label="Back">←</a><h1>${esc(cfg.title)}</h1><span class="muted" id="sp"></span></header>
    <section class="qpanel"><div id="qtext" class="q"></div></section>
    <section class="workwrap">
      <div class="tools"><button class="btn tool primary" data-tool="pen" aria-label="Pen">✎ Pen</button><button class="btn tool" data-tool="eraser">⌫ Eraser</button><button class="btn" id="undo" aria-label="Undo">↶</button><button class="btn" id="redo" aria-label="Redo">↷</button><button class="btn" id="wclear">Clear</button><span class="muted hint">Working — finger scrolls</span></div>
      <div class="work" id="work"><div class="sheet bg-${S.settings.bg}"><canvas id="wc" class="ink"></canvas></div></div>
    </section>
    <section class="apanel">
      <div class="anslabel"><b>Answer</b> <span class="muted">write it here</span><span class="sp"></span><button class="btn small" id="aundo">↶</button><button class="btn small" id="aclear">Clear</button></div>
      <div class="ansbox"><canvas id="ac" class="ink"></canvas></div>
      <div id="read" class="read muted">Write your final answer above.</div>
      <div class="actions" id="acts"></div>
      <div id="fb"></div>
    </section></div>`;
  const work = $('#work');
  workPad = new InkPad($('#wc'), { scroller: work, allowTouch: S.settings.finger, onChange: st => { clearTimeout(saveT); saveT = setTimeout(() => q && DB.set('ink', q.id, st), 400); } });
  ansPad = new InkPad($('#ac'), { width: 3, allowTouch: S.settings.finger, onChange: st => { clearTimeout(recT); recT = setTimeout(() => readAnswer(st), 550); q && DB.set('ink', q.id + '#ans', st); } });
  cleanup.push(() => { workPad.destroy(); ansPad.destroy(); clearTimeout(saveT); });
  view().querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { workPad.tool = b.dataset.tool; view().querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('primary', x === b)); });
  $('#undo').onclick = () => workPad.undo(); $('#redo').onclick = () => workPad.redo(); $('#wclear').onclick = () => workPad.clear();
  $('#aundo').onclick = () => ansPad.undo(); $('#aclear').onclick = () => ansPad.clear();
  function readAnswer(st) {
    if (marked) return;
    if (!st.length) { recog = null; $('#read').innerHTML = 'Write your final answer above.'; setActs(); return; }
    recog = Recognizer.recognise(st, { expectsVar: /[xy]/.test(String(q && q.a).replace(/sqrt|pi/g, '')) }); const ok = MathCheck.valid(recog.plain);
    $('#read').innerHTML = `I read: <span class="rec">${K(recog.latex || '?', false)}</span> ${ok ? '' : '<span class="warn">— can’t parse that, try rewriting</span>'}`;
    recog.ok = ok; setActs();
  }
  function setActs() {
    const a = $('#acts');
    if (!marked) a.innerHTML = `<button class="btn primary" id="check" ${recog && recog.ok ? '' : 'disabled'}>Check</button><button class="btn" id="self">Show answer · mark myself</button>`;
    if (!marked) { $('#check').onclick = check; $('#self').onclick = selfMark; }
  }
  function solutionHTML() { return `<div class="solution"><h3>Worked solution</h3><ol class="steps">${q.steps.map(s => `<li>${md(s)}</li>`).join('')}</ol><p>Answer: ${K(q.aTex || MathCheckLatex(q.a))}</p></div>`; }
  function finishQ(ok, how) {
    marked = true; count++; if (ok) right++; recordResult(q, ok, cfg.mode); cfg.onResult && cfg.onResult(q, ok);
    $('#acts').innerHTML = `<button class="btn primary" id="next">Next →</button>` + (how === 'auto' ? `<button class="btn" id="override">${ok ? 'Actually I was wrong' : 'It misread me — I was right'}</button>` : '');
    $('#next').onclick = nextQ;
    const ov = $('#override'); if (ov) ov.onclick = () => { // undo the record and flip it
      count--; if (ok) right--; undoLast(q, ok, cfg.mode); marked = false; finishQ(!ok, 'self'); showFb(!ok, 'Marked by you.'); };
    $('#sp').textContent = cfg.progressText ? cfg.progressText() : `${right}/${count}`;
  }
  function showFb(ok, msg) { $('#fb').innerHTML = `<div class="verdict ${ok ? 'good' : 'bad'}">${ok ? '✓ Correct' : '✗ Not quite'} ${msg ? `<small>${msg}</small>` : ''}</div>` + solutionHTML(); $('#fb').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  function check() {
    let ok = MathCheck.equivalent(recog.plain, q.a, q.tol), msg = '';
    if (ok && q.form === 'factored' && !recog.plain.includes('(')) { ok = false; msg = 'That’s equivalent, but the question asks for factorised form (with brackets).'; }
    finishQ(ok, 'auto'); showFb(ok, msg);
  }
  function selfMark() {
    $('#fb').innerHTML = solutionHTML();
    $('#acts').innerHTML = `<button class="btn good" id="iy">I got it right</button><button class="btn bad" id="in">I got it wrong</button>`;
    $('#iy').onclick = () => { finishQ(true, 'self'); showFb(true, 'Marked by you.'); }; $('#in').onclick = () => { finishQ(false, 'self'); showFb(false, 'Marked by you.'); };
  }
  async function nextQ() {
    const ref = cfg.next(); if (!ref) { if (cfg.finish) return cfg.finish(); view().querySelector('.qpanel').innerHTML = `<div class="q"><p class="big">Done — ${right}/${count}</p><a class="btn primary" href="${cfg.back || '#home'}">Back</a></div>`; $('#acts').innerHTML = ''; $('#fb').innerHTML = ''; return; }
    q = questionFromRef(ref); marked = false; recog = null;
    $('#qtext').innerHTML = (q.push ? '<span class="tag push">push problem</span> ' : q.level ? `<span class="tag">level ${q.level}</span> ` : '') + md(q.q) + (q.svg || '');
    $('#fb').innerHTML = ''; $('#read').textContent = 'Write your final answer above.';
    workPad.load(await DB.get('ink', q.id) || []); ansPad.load([]); work.scrollTop = 0; setActs();
    $('#sp').textContent = cfg.progressText ? cfg.progressText() : `${right}/${count}`;
  }
  nextQ();
}
function undoLast(q, ok, mode) { // revert recordResult effects approximately
  if (mode !== 'placement') { const p = prog(q.topic); p.attempts--; if (ok) { p.correct--; p.streak = Math.max(0, p.streak - 1); } }
  if (!ok) delete S.srs[q.id];
}
function MathCheckLatex(a) { return a.replace(/\*/g, '').replace(/\^\((\d+)\)/g, '^{$1}').replace(/\^(\d+)/g, '^{$1}').replace(/sqrt\((\d+)\)/g, '\\sqrt{$1}').replace(/pi/g, '\\pi').replace(/\+\-/g, '-').replace(/\(1\)x/g, 'x').replace(/(\d+)\/(\d+)/g, '\\frac{$1}{$2}'); }
// ---------- handwriting training ----------
routes.train = () => {
  const syms = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', 'y', '+', 'times', 'cdot', '(', ')', 'sqrt', 'pi'];
  const label = s => ({ sqrt: '√', pi: 'π', times: '×', cdot: '·' }[s] || s);
  let i = 0;
  view().innerHTML = header('Teach my handwriting') + `<main class="train">
    <p class="muted">For × write it small and centred, like a plus turned 45°; for the letter x sit it on the line. The · dot is read by its height, so its samples just let you practise it — try “3·4” with Test. Write the shown symbol once in the box, then Save. 3–5 samples of each symbol makes recognition much more reliable for your writing. Use “Test” to try whole answers.</p>
    <div class="seg" id="syms">${syms.map((s, k) => `<button class="btn small" data-i="${k}">${label(s)} <small>${S.templates.filter(t => t.sym === s).length}</small></button>`).join('')}</div>
    <div class="target" id="target"></div>
    <div class="ansbox tall"><canvas id="tc" class="ink"></canvas></div>
    <div class="actions"><button class="btn primary" id="tsave">Save sample</button><button class="btn" id="tclear">Clear</button><button class="btn" id="ttest">Test</button><button class="btn danger" id="treset">Delete my samples</button></div>
    <div id="tout" class="read"></div></main>`;
  const pad = new InkPad($('#tc'), { width: 3, allowTouch: S.settings.finger }); cleanup.push(() => pad.destroy());
  const show = () => { $('#target').innerHTML = `Write: <b>${label(syms[i])}</b>`; view().querySelectorAll('#syms button').forEach((b, k) => b.classList.toggle('primary', k === i)); };
  view().querySelectorAll('#syms button').forEach(b => b.onclick = () => { i = +b.dataset.i; show(); }); show();
  $('#tclear').onclick = () => { pad.load([]); $('#tout').innerHTML = ''; };
  $('#tsave').onclick = async () => { if (!pad.strokes.length) return; const st = pad.strokes.map(s => s.map(p => [Math.round(p[0]), Math.round(p[1])]));
    S.templates.push({ sym: syms[i], strokes: st }); if (syms[i] !== 'cdot') Recognizer.addTemplate(syms[i], st, true); await save('templates'); pad.load([]);
    view().querySelector(`#syms [data-i="${i}"] small`).textContent = S.templates.filter(t => t.sym === syms[i]).length; $('#tout').textContent = 'Saved.'; };
  $('#ttest').onclick = () => { const r = Recognizer.recognise(pad.strokes); $('#tout').innerHTML = `I read: ${K(r.latex || '?')} <code>${esc(r.plain)}</code>`; };
  $('#treset').onclick = async () => { if (!confirm('Delete all your handwriting samples?')) return; S.templates = []; await save('templates'); Recognizer.resetTemplates(); routes.train(); };
};
// ---------- boot ----------
(async () => {
  await loadState(); render();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
