// Time-ordered event queue keyed on world time. Events fire exactly once, in order,
// even when a single frame spans several of them.
export class EventQueue {
  constructor() { this.heap = []; this.seq = 0; }
  clear() { this.heap.length = 0; this.seq = 0; }
  get size() { return this.heap.length; }
  push(w, fn, tag = '') {
    const h = this.heap, e = { w, fn, tag, s: this.seq++ };
    h.push(e);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(h[p], h[i])) break;
      [h[p], h[i]] = [h[i], h[p]]; i = p;
    }
    return e;
  }
  less(a, b) { return a.w < b.w || (a.w === b.w && a.s < b.s); }
  peekTime() { return this.heap.length ? this.heap[0].w : Infinity; }
  pop() {
    const h = this.heap, top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && this.less(h[l], h[m])) m = l;
        if (r < h.length && this.less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]]; i = m;
      }
    }
    return top;
  }
}
