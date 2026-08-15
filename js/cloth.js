/* cloth.js — a constrained particle grid, one per prayer-flag line.
 *
 * Jakobsen's scheme from "Advanced Character Physics" (GDC 2001): Verlet
 * integration for the particles, and a Gauss-Seidel relaxation loop that
 * satisfies distance constraints by projecting the two endpoints toward each
 * other, weighted by inverse mass.
 *
 *   integrate:  x' = x + (x - x_prev) * damping + a * dt^2
 *   constrain:  along the delta, move each end by (d - rest)/d * stiff,
 *               split by its share of the inverse mass
 *
 * Three constraint families, and a cloth needs all three:
 *
 *   structural  N-S and E-W neighbours. Resists stretch. On its own a
 *               pin-jointed grid holds every edge length and still collapses
 *               flat, because nothing resists the angles.
 *   shear       the two diagonals of each cell. Triangulates it, which is what
 *               stops the block folding into a parallelogram.
 *   bend        neighbours two apart. Resists creasing and sets how stiff the
 *               sheet feels; leave it out and the cloth crumples.
 *
 * Flat typed arrays rather than particle objects: at a couple of thousand
 * points resolved several times a frame, that difference is the performance
 * budget.
 */
(function (global) {
  'use strict';

  /* opts: cols, rows, x0, y0, dx, dy, mass */
  function Cloth(o) {
    var cols = this.cols = o.cols | 0;
    var rows = this.rows = o.rows | 0;
    var n = this.n = cols * rows;

    this.x   = new Float64Array(n);
    this.y   = new Float64Array(n);
    this.px  = new Float64Array(n);
    this.py  = new Float64Array(n);
    this.ax  = new Float64Array(n);
    this.ay  = new Float64Array(n);
    this.inv = new Float64Array(n);          // 0 means pinned

    var dx = o.dx, dy = o.dy, invMass = 1 / (o.mass || 1);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var i = r * cols + c;
        this.x[i] = this.px[i] = o.x0 + c * dx;
        this.y[i] = this.py[i] = o.y0 + r * dy;
        this.inv[i] = invMass;
      }
    }

    this.ncons = 0;
    this.ca = null; this.cb = null;
    this.cr2 = null; this.cf = null; this.sa = null; this.sb = null;
  }

  Cloth.prototype.at = function (c, r) { return r * this.cols + c; };

  Cloth.prototype.pin = function (c, r) { this.inv[r * this.cols + c] = 0; };

  /* Build-time placement: the point starts here and at rest, so a line laid
     out along the curve it will hang in does not snap on frame one. */
  Cloth.prototype.moveTo = function (i, x, y) {
    this.x[i] = this.px[i] = x;
    this.y[i] = this.py[i] = y;
  };


  /* stiff: { structural, shear, bend } in 0..1. Rest lengths are taken from
     wherever the points currently are, so a non-uniform grid works. */
  Cloth.prototype.link = function (stiff) {
    var cols = this.cols, rows = this.rows;
    var a = [], b = [], s = [];
    var across = stiff.structural;
    var shear  = stiff.shear || 0;
    var bendX  = stiff.bend || 0;
    var bendY  = stiff.bend || 0;

    function push(i, j, k) { a.push(i); b.push(j); s.push(k); }

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var i = r * cols + c;
        if (c + 1 < cols && across > 0) push(i, i + 1, across);
        if (r + 1 < rows) push(i, i + cols, stiff.structural);
        if (c + 1 < cols && r + 1 < rows && shear > 0) {
          push(i, i + cols + 1, shear);
          push(i + 1, i + cols, shear);
        }
        if (c + 2 < cols && bendX > 0) push(i, i + 2, bendX);
        if (r + 2 < rows && bendY > 0) push(i, i + 2 * cols, bendY);
      }
    }

    /* Everything the inner loop needs is precomputed here, because none of
       it changes once the sheet is built:

         cr2  the rest length SQUARED, so the solver never takes a root
         cf   2 * stiffness, folding the half-and-half split into a constant
         sa   this end's share of the correction, wa / (wa + wb)

       and constraints with both ends pinned are dropped outright rather than
       tested every pass — on a flag line that is both ends of the cord. */
    var keep = [];
    for (var t = 0; t < a.length; t++) {
      if (this.inv[a[t]] !== 0 || this.inv[b[t]] !== 0) keep.push(t);
    }
    var m = this.ncons = keep.length;
    this.ca = new Int32Array(m);
    this.cb = new Int32Array(m);
    this.cr2 = new Float64Array(m);
    this.cf = new Float32Array(m);
    this.sa = new Float32Array(m);
    this.sb = new Float32Array(m);
    for (var j = 0; j < m; j++) {
      var t2 = keep[j], ia = a[t2], ib = b[t2];
      this.ca[j] = ia; this.cb[j] = ib;
      var dx = this.x[ib] - this.x[ia];
      var dy = this.y[ib] - this.y[ia];
      var rest = Math.sqrt(dx * dx + dy * dy);
      this.cr2[j] = rest * rest;
      this.cf[j] = 2 * s[t2];
      var wa = this.inv[ia], wb = this.inv[ib], w = wa + wb;
      this.sa[j] = wa / w; this.sb[j] = wb / w;
    }
    return this;
  };

  Cloth.prototype.addForce = function (fx, fy) {
    for (var i = 0; i < this.n; i++) { this.ax[i] += fx; this.ay[i] += fy; }
  };

  /* A row-dependent horizontal force, so a breeze can lean the sheet without
     shearing every row by the same amount. */
  Cloth.prototype.addWind = function (base, perRow) {
    for (var r = 0; r < this.rows; r++) {
      var f = base * (1 + r * perRow);
      for (var c = 0; c < this.cols; c++) this.ax[r * this.cols + c] += f;
    }
  };

  Cloth.prototype.applyPointer = function (px, py, pvx, pvy, radius, drag, push) {
    var r2 = radius * radius;
    for (var i = 0; i < this.n; i++) {
      if (this.inv[i] === 0) continue;
      var dx = this.x[i] - px;
      if (dx > radius || dx < -radius) continue;      // cheap reject first
      var dy = this.y[i] - py;
      if (dy > radius || dy < -radius) continue;
      var d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      var d = Math.sqrt(d2) || 0.0001;
      var t = 1 - d / radius, fall = t * t;      // smooth, 1 at the pointer
      this.ax[i] += (pvx * drag + (dx / d) * push) * fall;
      this.ay[i] += (pvy * drag + (dy / d) * push) * fall;
    }
  };

  Cloth.prototype.integrate = function (dt, damping, gravity) {
    var n = this.n, x = this.x, y = this.y, px = this.px, py = this.py;
    var ax = this.ax, ay = this.ay, inv = this.inv, dt2 = dt * dt;
    for (var i = 0; i < n; i++) {
      if (inv[i] === 0) { px[i] = x[i]; py[i] = y[i]; ax[i] = 0; ay[i] = 0; continue; }
      var vx = (x[i] - px[i]) * damping;
      var vy = (y[i] - py[i]) * damping;
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx + ax[i] * dt2;
      y[i] += vy + (ay[i] + gravity) * dt2;
      ax[i] = 0; ay[i] = 0;
    }
  };

  /* Gauss-Seidel relaxation: each pass sees the corrections earlier
     constraints made in the same pass, which is why a few passes converge
     where one does not.

     NO SQUARE ROOT. The exact projection is

         delta *= 1 - rest / sqrt(delta.delta)

     and Jakobsen's substitution for it is

         delta *= 0.5 - rest^2 / (delta.delta + rest^2)

     approximating rest/d by 2*rest^2/(d^2 + rest^2) — exact at d = rest, and
     successive passes walk out the error either side of it. One division
     replaces one root per constraint per pass, which over ~17,000 constraints
     several times a frame is most of the solver's cost.

     WATCH THE SIGN. Written the other way round, every link pushes its ends
     apart when they are too far apart — positive feedback that holds for about
     fifty steps and then takes the sheet to NaN all at once, with no bad frame
     in between to notice.

     No branches in the loop: zero-mass constraints were dropped at link time,
     and rest^2 in the denominator cannot be zero. */
  Cloth.prototype.relax = function (iters) {
    var ca = this.ca, cb = this.cb, cr2 = this.cr2, cf = this.cf;
    var sa = this.sa, sb = this.sb;
    var m = this.ncons, x = this.x, y = this.y;
    for (var k = 0; k < iters; k++) {
      for (var j = 0; j < m; j++) {
        var a = ca[j], b = cb[j];
        var dx = x[b] - x[a], dy = y[b] - y[a];
        var r2 = cr2[j];
        var f = (0.5 - r2 / (dx * dx + dy * dy + r2)) * cf[j];
        var fx = dx * f, fy = dy * f;
        var wa = sa[j], wb = sb[j];
        x[a] += fx * wa; y[a] += fy * wa;
        x[b] -= fx * wb; y[b] -= fy * wb;
      }
    }
  };

  /* Walk a row by arc length. Returns the point, the unit tangent, and the
     unit vector down to the row below — which together are the frame a flag
     hangs in. */
  Cloth.prototype.sampleRow = function (row, dist, out) {
    var cols = this.cols, base = row * cols, acc = 0, i;
    for (i = 0; i < cols - 1; i++) {
      var a = base + i, b = a + 1;
      var dx = this.x[b] - this.x[a], dy = this.y[b] - this.y[a];
      var seg = Math.sqrt(dx * dx + dy * dy);
      if (acc + seg >= dist || i === cols - 2) {
        var t = seg > 0 ? Math.min(1, (dist - acc) / seg) : 0;
        out.x = this.x[a] + dx * t;
        out.y = this.y[a] + dy * t;
        var inv = seg > 0 ? 1 / seg : 0;
        out.tx = dx * inv; out.ty = dy * inv;
        if (row + 1 < this.rows) {
          var a2 = a + cols, b2 = b + cols;
          var hx = (this.x[a2] + (this.x[b2] - this.x[a2]) * t) - out.x;
          var hy = (this.y[a2] + (this.y[b2] - this.y[a2]) * t) - out.y;
          var hl = Math.sqrt(hx * hx + hy * hy) || 1;
          out.hx = hx / hl; out.hy = hy / hl;
        } else { out.hx = 0; out.hy = 1; }
        return out;
      }
      acc += seg;
    }
    return out;
  };

  Cloth.prototype.rowLength = function (row) {
    var base = row * this.cols, total = 0;
    for (var i = 0; i < this.cols - 1; i++) {
      var a = base + i;
      var dx = this.x[a + 1] - this.x[a], dy = this.y[a + 1] - this.y[a];
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
  };

  global.Cloth = Cloth;
})(window);
