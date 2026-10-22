/* Pen-only ink surface. Pointer Events; ink only for pointerType 'pen' (and mouse for desktop
   testing). Touch pans the scroll container (palm rejection). Pressure-sensitive width,
   stroke eraser (tool button, pen eraser end, or S Pen side button), undo/redo. */
class InkPad {
  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts;
    this.strokes = []; this.undoStack = []; this.redoStack = []; this.tool = 'pen'; this.cur = null; this.erasing = false;
    this.scroller = opts.scroller || null; this.allowTouch = !!opts.allowTouch;
    const on = (t, f) => canvas.addEventListener(t, f, { passive: false });
    on('pointerdown', e => this.down(e)); on('pointermove', e => this.move(e)); on('pointerup', e => this.up(e)); on('pointercancel', e => this.up(e));
    on('contextmenu', e => e.preventDefault());
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas); this.resize();
  }
  resize() {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width) return; this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr); this.dpr = dpr; this.redraw();
  }
  pos(e) { const r = this.c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5]; }
  inks(e) { return e.pointerType === 'pen' || e.pointerType === 'mouse' || (this.allowTouch && e.pointerType === 'touch'); }
  down(e) {
    e.preventDefault();
    if (!this.inks(e)) { if (this.scroller) this.pan = { y: e.clientY, x: e.clientX, id: e.pointerId }; return; }
    try { this.c.setPointerCapture(e.pointerId); } catch (_) {}
    this.erasing = this.tool === 'eraser' || (e.buttons & 32) || (e.pointerType === 'pen' && (e.buttons & 2));
    if (this.erasing) { this.eraseBatch = []; this.eraseAt(this.pos(e)); return; }
    this.cur = [this.pos(e)]; this.strokes.push(this.cur);
  }
  move(e) {
    if (this.pan && e.pointerId === this.pan.id) { this.scroller.scrollTop -= e.clientY - this.pan.y; this.scroller.scrollLeft -= e.clientX - this.pan.x; this.pan.y = e.clientY; this.pan.x = e.clientX; return; }
    if (this.erasing) { this.eraseAt(this.pos(e)); return; }
    if (!this.cur) return; e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of (evs.length ? evs : [e])) { const p = this.pos(ce); const last = this.cur[this.cur.length - 1]; this.cur.push(p); this.seg(last, p); }
  }
  up(e) {
    if (this.pan && e.pointerId === this.pan.id) { this.pan = null; return; }
    if (this.erasing) { this.erasing = false; if (this.eraseBatch.length) { this.undoStack.push({ t: 'erase', s: this.eraseBatch }); this.redoStack = []; this.changed(); } return; }
    if (!this.cur) return; const s = this.cur; this.cur = null;
    if (s.length === 1) { s.push([s[0][0] + 0.5, s[0][1] + 0.5, s[0][2]]); this.redraw(); }
    this.undoStack.push({ t: 'add', s }); this.redoStack = []; this.changed();
  }
  eraseAt(p) {
    const R = 14; let hit = false;
    this.strokes = this.strokes.filter(s => { const near = s.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < R); if (near) { this.eraseBatch.push(s); hit = true; } return !near; });
    if (hit) this.redraw();
  }
  width(p) { return (this.opts.width || 2.6) * (0.35 + 1.1 * p); }
  seg(a, b) {
    const x = this.ctx, d = this.dpr; x.strokeStyle = getComputedStyle(this.c).color; x.lineCap = 'round'; x.lineJoin = 'round';
    x.lineWidth = this.width((a[2] + b[2]) / 2) * d; x.beginPath(); x.moveTo(a[0] * d, a[1] * d); x.lineTo(b[0] * d, b[1] * d); x.stroke();
  }
  redraw() { this.ctx.clearRect(0, 0, this.c.width, this.c.height); for (const s of this.strokes) for (let i = 1; i < s.length; i++) this.seg(s[i - 1], s[i]); }
  undo() { const a = this.undoStack.pop(); if (!a) return; if (a.t === 'add') this.strokes = this.strokes.filter(s => s !== a.s); else this.strokes.push(...a.s); this.redoStack.push(a); this.redraw(); this.changed(); }
  redo() { const a = this.redoStack.pop(); if (!a) return; if (a.t === 'add') this.strokes.push(a.s); else this.strokes = this.strokes.filter(s => !a.s.includes(s)); this.undoStack.push(a); this.redraw(); this.changed(); }
  clear() { if (!this.strokes.length) return; this.undoStack.push({ t: 'erase', s: this.strokes.slice() }); this.strokes = []; this.redraw(); this.changed(); }
  load(strokes) { this.strokes = strokes || []; this.undoStack = []; this.redoStack = []; this.redraw(); }
  changed() { this.opts.onChange && this.opts.onChange(this.strokes); }
  destroy() { this.ro.disconnect(); }
}
window.InkPad = InkPad;
