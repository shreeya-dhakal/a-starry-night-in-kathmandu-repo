/* crowns.js — the chaitya, painted across the head of the stage.
 *
 * Filled and shaded rather than outlined: gilt reads as gilt, stone as stone,
 * whitewash as whitewash. The crown resolves to one horizontal cornice — that
 * line is where the mani wall stands, so the geometry at the foot is fixed
 * whatever the window does to the silhouette above it.
 *
 * The drawer takes (ctx, x0, x1, y): the cornice run and its height.
 * Everything distinctive happens above y.
 *
 * Drawn once into an offscreen canvas and blitted, so all this detail is
 * paid for on layout and on style change, never per frame.
 */
(function (global) {
  'use strict';

  var P = {
    gold: '#D9A441', goldLit: '#F5D48A', goldPale: '#FDEBC2',
    goldDeep: '#8A5F28', goldDark: '#4F3517',
    brick: '#8C4B33', brickLit: '#B4653F', brickDeep: '#54291C',
    stone: '#8A7A68', stoneLit: '#B8A791', stoneDeep: '#463A30',
    cream: '#E8DCC6', creamDim: '#C0AF95', creamDeep: '#7C6E5B',
    vermilion: '#C1502E', crimson: '#A32E33',
    jade: '#3E7A62', lapis: '#33608F',
    wood: '#6B3F2A', woodLit: '#94603F',
    ink: 'rgba(18,12,9,0.55)'
  };

  /* ---- material helpers ---------------------------------------------------
   * The difference between flat vector and something that reads as built is
   * almost entirely edges: a lit arris along the top of every surface, a shadow
   * where it meets what is beneath it, and a soft occlusion under anything that
   * overhangs. These apply that consistently, so the crown is lit from one
   * direction throughout.
   * ---------------------------------------------------------------------- */

  var _grain = null;
  function grain(ctx) {
    if (_grain) return _grain;
    var g = document.createElement('canvas');
    g.width = g.height = 96;
    var gc = g.getContext('2d');
    var img = gc.createImageData(96, 96);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 118 + Math.random() * 68;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
    _grain = ctx.createPattern(g, 'repeat');
    return _grain;
  }

  /* A film of noise, so large flats do not look like flat fills. */
  function texture(ctx, x, y, w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grain(ctx);
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /* A horizontal moulding: lit arris on top, body, shadow at the foot. */
  function moulding(ctx, x0, x1, y, h, lit, body, dark) {
    ctx.fillStyle = vg(ctx, y, y + h, lit, body, dark);
    ctx.fillRect(x0, y, x1 - x0, h);
    ctx.fillStyle = 'rgba(255,244,214,0.42)';
    ctx.fillRect(x0, y, x1 - x0, 1.1);
    ctx.fillStyle = 'rgba(24,14,6,0.5)';
    ctx.fillRect(x0, y + h - 1.4, x1 - x0, 1.4);
  }

  /* The soft dark that gathers under any overhang. Cheap, and it is most of
     what makes stacked elements read as stacked. */
  function occlude(ctx, x0, x1, y, depth, alpha) {
    var g = ctx.createLinearGradient(0, y, 0, y + depth);
    g.addColorStop(0, 'rgba(12,7,3,' + alpha + ')');
    g.addColorStop(1, 'rgba(12,7,3,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y, x1 - x0, depth);
  }

  /* Cylindrical shading across a run — dark at both edges, lit off-centre. */
  function barrel(ctx, x0, x1, y, h, alpha) {
    var g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0,    'rgba(16,9,4,' + alpha + ')');
    g.addColorStop(0.34, 'rgba(16,9,4,0)');
    g.addColorStop(0.52, 'rgba(255,240,208,' + (alpha * 0.30) + ')');
    g.addColorStop(0.70, 'rgba(16,9,4,0)');
    g.addColorStop(1,    'rgba(16,9,4,' + (alpha * 0.92) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y, x1 - x0, h);
  }

  function vg(ctx, y0, y1, a, b, c) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, a);
    if (c) { g.addColorStop(0.55, b); g.addColorStop(1, c); }
    else   { g.addColorStop(1, b); }
    return g;
  }

  function hg(ctx, x0, x1, a, b, c) {
    var g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, c);
    return g;
  }

  /* ---- Stupa --------------------------------------------------------------
   * Built up in layers rather than drawn as shapes: terraces, dome, harmika,
   * thirteen rings, pinnacle. Lit from the upper left throughout.
   * ---------------------------------------------------------------------- */
  function stupa(ctx, x0, x1, y) {
    var mid = (x0 + x1) / 2, span = x1 - x0;

    /* Proportions read straight off the Boudhanath elevation, every one a
       multiple of the dome's HALF-WIDTH, Rx:

         terraces       0.30 tall,  1.30 half-wide
         plinth         0.09        1.06
         niche course   0.088       1.045
         DOME           0.62        1.00     <- height, not radius
         harmika        0.302       0.26
         spire          0.465       0.252 at the foot, tapering to 0.36
         pinnacle       0.478       0.132 across the drum */
    var avail = Math.max(250, y - 44);
    var Ht = Math.min(avail, span * 0.56);
    var Rx = Ht / 2.34, Ry = Rx * 0.62;

    var terrH = Rx * 0.30, plinthH = Rx * 0.09, nicheH = Rx * 0.088;
    var base = y - terrH - plinthH - nicheH;      // where the dome springs
    var domeTop = base - Ry;
    var hH = Rx * 0.302, rH = Rx * 0.465;
    var R = Rx;
    var W1 = Rx * 1.30;
    var steps = [
      { w: W1,        t: y,                h: terrH * 0.40 },
      { w: W1 * 0.91, t: y - terrH * 0.40, h: terrH * 0.32 },
      { w: W1 * 0.82, t: y - terrH * 0.72, h: terrH * 0.28 }
    ];
    for (var t = 0; t < steps.length; t++) {
      var st = steps[t], stop = st.t - st.h;
      ctx.fillStyle = vg(ctx, stop, st.t, '#FBF7EE', '#DFD8CA', '#9A9182');
      ctx.fillRect(mid - st.w, stop, st.w * 2, st.h);
      barrel(ctx, mid - st.w, mid + st.w, stop, st.h, 0.14);

      var pitch = (st.w * 2) / Math.max(8, Math.round((st.w * 2) / 30));
      for (var pq = mid - st.w + pitch; pq < mid + st.w - 2; pq += pitch) {
        ctx.fillStyle = 'rgba(120,110,94,0.16)';
        ctx.fillRect(pq, stop + st.h * 0.18, 2, st.h * 0.82);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(pq + 2, stop + st.h * 0.18, 1, st.h * 0.82);
      }

      ctx.fillStyle = vg(ctx, stop - 3.5, stop, '#FFFFFF', '#E6DFD1');
      ctx.fillRect(mid - st.w, stop - 3.5, st.w * 2, 4);
      ctx.fillStyle = 'rgba(40,32,22,0.26)';
      ctx.fillRect(mid - st.w, st.t - 1.4, st.w * 2, 1.4);
      texture(ctx, mid - st.w, stop - 3.5, st.w * 2, st.h + 3.5, 0.08);
      if (t > 0) occlude(ctx, mid - st.w, mid + st.w, st.t, 14, 0.34);
    }

    /* the stair, which the photograph puts dead centre on the front */
    (function () {
      var sw2 = Rx * 0.26, n = 7, sh2 = terrH / n, i;
      /* the flight is recessed, so it reads as a cut INTO the terraces */
      ctx.fillStyle = 'rgba(52,42,28,0.30)';
      ctx.fillRect(mid - sw2 * 1.20, y - terrH, sw2 * 2.40, terrH);
      for (i = 0; i < n; i++) {
        var w2 = sw2 * (1 + i * 0.03), ty = y - sh2 * i;
        ctx.fillStyle = vg(ctx, ty - sh2, ty, '#FFFFFF', '#E7E0D2');
        ctx.fillRect(mid - w2, ty - sh2, w2 * 2, sh2);
        ctx.fillStyle = 'rgba(40,32,22,0.42)';       // the riser's shadow
        ctx.fillRect(mid - w2, ty - 1.6, w2 * 2, 1.6);
      }
      // cheek walls either side of the flight
      [-1, 1].forEach(function (sg) {
        var cx4 = mid + sg * sw2 * 1.20;
        ctx.fillStyle = vg(ctx, y - terrH, y, '#FFFFFF', '#DAD3C4', '#9A9182');
        ctx.fillRect(cx4 - sg * sw2 * 0.14, y - terrH, sw2 * 0.14, terrH);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(cx4 - sg * sw2 * 0.14, y - terrH, 1.4, terrH);
      });
    })();
    occlude(ctx, mid - W1, mid + W1, y, 16, 0.42);

    /* --- plinth, and the ring of niches -----------------------------------
     * The band of small square niches under the dome is the one detail that
     * says Boudhanath at a glance. */
    var pw2 = Rx * 1.06, py2 = y - terrH;
    ctx.fillStyle = vg(ctx, py2 - plinthH, py2, '#FCF9F2', '#E2DBCD', '#A29988');
    ctx.fillRect(mid - pw2, py2 - plinthH, pw2 * 2, plinthH);
    ctx.fillStyle = 'rgba(40,32,22,0.24)';
    ctx.fillRect(mid - pw2, py2 - 1.4, pw2 * 2, 1.4);

    var nw2 = Rx * 1.045, ny2 = py2 - plinthH;
    ctx.fillStyle = vg(ctx, ny2 - nicheH, ny2, '#FFFFFF', '#EDE6D9', '#B0A796');
    ctx.fillRect(mid - nw2, ny2 - nicheH, nw2 * 2, nicheH);
    (function () {
      var cells = Math.max(18, Math.round((nw2 * 2) / (Rx * 0.052)));
      var cw3 = (nw2 * 2) / cells;
      for (var i = 0; i < cells; i++) {
        var cx3 = mid - nw2 + cw3 * (i + 0.5);
        ctx.fillStyle = 'rgba(58,48,34,0.55)';
        ctx.fillRect(cx3 - cw3 * 0.2, ny2 - nicheH * 0.72, cw3 * 0.4, nicheH * 0.46);
      }
      ctx.fillStyle = vg(ctx, ny2 - nicheH - 3.5, ny2 - nicheH, '#FFFFFF', '#DCD5C6');
      ctx.fillRect(mid - nw2, ny2 - nicheH - 3.5, nw2 * 2, 4);
      ctx.fillStyle = 'rgba(40,32,22,0.26)';
      ctx.fillRect(mid - nw2, ny2 - 1.4, nw2 * 2, 1.4);
    })();
    occlude(ctx, mid - nw2, mid + nw2, ny2, 12, 0.34);

    /* --- the dome --------------------------------------------------------- */
    function domePath() {
      ctx.beginPath();
      ctx.ellipse(mid, base, Rx, Ry, 0, Math.PI, 0, false);
      ctx.closePath();
    }
    /* half-width of the dome h above the spring — the oblate form means this
       is no longer sqrt(R*R - h*h) */
    function domeR(h) {
      return Rx * Math.sqrt(Math.max(0, 1 - (h * h) / (Ry * Ry)));
    }

    domePath(); ctx.fillStyle = '#FBF8F1'; ctx.fill();
    ctx.save(); domePath(); ctx.clip();

    /* Nearly flat: whitewash in sun is an even field with the shading only at
       the rim. A stronger falloff stacks with the saffron gaps into a bright
       vertical band down one side, which reads as a spotlight. */
    var lit = ctx.createRadialGradient(
      mid - Rx * 0.22, base - Ry * 0.60, Rx * 0.05,
      mid - Rx * 0.06, base - Ry * 0.30, Rx * 1.34);
    lit.addColorStop(0,    '#FFFFFF');
    lit.addColorStop(0.46, '#FDFBF6');
    lit.addColorStop(0.74, '#F1EBE0');
    lit.addColorStop(0.91, '#D6CDBC');
    lit.addColorStop(1,    '#9C9384');
    ctx.fillStyle = lit;
    ctx.fillRect(mid - Rx, base - Ry, Rx * 2, Ry);

    /* The saffron: five broad lobes of stain running from the crown down to the
       spring. Narrower and more numerous, they read as stripes and the dome as
       a beach ball, whatever the alpha. */
    var petals = 5;
    var jit = [1.00, 1.14, 0.90, 1.10, 0.96];
    var lobeSpan = 2.86 / petals, TOPH = Ry * 0.99;
    for (var p2 = 0; p2 < petals; p2++) {
      var j = jit[p2];
      var thC = -1.43 + lobeSpan * (p2 + 0.5) + lobeSpan * (j - 1) * 0.16;
      var hwA = lobeSpan * 0.40 * j;
      var g2 = ctx.createLinearGradient(0, base - Ry, 0, base);
      g2.addColorStop(0,    'rgba(232,176,86,0)');
      g2.addColorStop(0.28, 'rgba(228,158,64,0.05)');
      g2.addColorStop(0.60, 'rgba(216,124,50,0.10)');
      g2.addColorStop(0.90, 'rgba(196,92,40,0.12)');
      g2.addColorStop(1,    'rgba(170,66,32,0.07)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      var N = 22, i2, h2, rr, w;
      for (i2 = 0; i2 <= N; i2++) {
        h2 = TOPH * (1 - i2 / N);
        rr = domeR(h2);
        w = hwA * Math.pow(1 - h2 / TOPH, 0.40);
        if (i2 === 0) ctx.moveTo(mid + Math.sin(thC - w) * rr, base - h2);
        else ctx.lineTo(mid + Math.sin(thC - w) * rr, base - h2);
      }
      for (i2 = N; i2 >= 0; i2--) {
        h2 = TOPH * (1 - i2 / N);
        rr = domeR(h2);
        w = hwA * Math.pow(1 - h2 / TOPH, 0.40);
        ctx.lineTo(mid + Math.sin(thC + w) * rr, base - h2);
      }
      ctx.closePath(); ctx.fill();
    }

    /* No courses: the dome is smooth whitewash, and ruling ellipses across it
       makes a gridded balloon of it. Just the shadow gathering at the foot. */
    var foot = ctx.createLinearGradient(0, base - Ry * 0.26, 0, base);
    foot.addColorStop(0, 'rgba(30,20,10,0)');
    foot.addColorStop(1, 'rgba(30,20,10,0.30)');
    ctx.fillStyle = foot;
    ctx.fillRect(mid - Rx, base - Ry * 0.26, Rx * 2, Ry * 0.26);
    texture(ctx, mid - Rx, base - Ry, Rx * 2, Ry, 0.07);
    ctx.restore();

    /* --- harmika ----------------------------------------------------------
     * A block of golden ochre masonry — coursed and weathered, not whitewashed
     * — carrying the eyes. Over the head of that face hangs a red pleated
     * valance with a zigzag hem, and above it a pale course and a band of blue
     * / green / yellow / red.
     * -------------------------------------------------------------------- */
    var hw = Rx * 0.26;
    /* Its base must sit BELOW the dome's shoulder, not on its crown. At the
       corners (x = 0.44R) the sphere has already dropped 0.10R, so a base at
       the crown leaves the block floating over sky at both ends — and the
       contact shadow then paints a hard black rectangle onto that sky. */
    var hBot = domeTop + Ry * 0.05;
    var hTop = hBot - hH;
    var bandsH = hH * 0.158, valH = hH * 0.193;
    var faceT = hTop + bandsH, faceH = hBot - faceT;
    var visT = faceT + valH, visH = hBot - visT;   // what the valance leaves

    /* The whole eye assembly — red accent, brow, lid, sclera, lower lid — is
       only about half as tall as it is wide. Drawn as tall as it is wide, which
       is the instinct, the brows climb behind the valance and the face becomes
       a mask. */
    var es = hw / 104;

    /* Contact shadow, radial rather than occlude(): that fades vertically only,
       so on a white dome its hard left and right edges print a grey rectangle
       wider than the block casting it. This has to fall off in BOTH axes. */
    ctx.save(); domePath(); ctx.clip();
    var hsh = ctx.createRadialGradient(mid, hBot + hw * 0.10, hw * 0.15,
                                       mid, hBot + hw * 0.10, hw * 1.9);
    hsh.addColorStop(0,    'rgba(44,32,16,0.34)');
    hsh.addColorStop(0.45, 'rgba(44,32,16,0.15)');
    hsh.addColorStop(1,    'rgba(44,32,16,0)');
    ctx.fillStyle = hsh;
    ctx.fillRect(mid - hw * 2, hBot - hw * 1.8, hw * 4, hw * 3.8);
    ctx.restore();

    /* the masonry */
    ctx.fillStyle = vg(ctx, faceT, hBot, '#EBBD5E', '#C88F2C', '#8B6218');
    ctx.fillRect(mid - hw, faceT, hw * 2, faceH);
    (function () {
      ctx.save();
      ctx.beginPath(); ctx.rect(mid - hw, faceT, hw * 2, faceH); ctx.clip();
      var courses = 12, chh = faceH / courses, bwid = hw * 0.28, ci, bx;
      for (ci = 0; ci <= courses; ci++) {
        var cyy = faceT + chh * ci;
        ctx.fillStyle = 'rgba(112,72,16,0.32)';
        ctx.fillRect(mid - hw, cyy, hw * 2, 1.2);
        ctx.fillStyle = 'rgba(255,231,166,0.22)';
        ctx.fillRect(mid - hw, cyy + 1.2, hw * 2, 0.9);
        for (bx = mid - hw + (ci % 2) * bwid * 0.5; bx < mid + hw; bx += bwid) {
          ctx.fillStyle = 'rgba(112,72,16,0.26)';
          ctx.fillRect(bx, cyy, 1.2, chh);
        }
      }
      ctx.restore();
    })();
    barrel(ctx, mid - hw, mid + hw, faceT, faceH, 0.30);
    texture(ctx, mid - hw, faceT, hw * 2, faceH, 0.17);
    moulding(ctx, mid - hw * 1.04, mid + hw * 1.04, hBot - hH * 0.045,
             hH * 0.06, '#FFFFFF', '#E2DACA', '#8E8676');

    /* The eyes. Everything here is a FILLED shape, not a stroke: nothing on a
     * real one has constant width — the upper lid starts as a point at the
     * inner corner, swells over the iris and draws out into a tail — and a
     * uniform stroke cannot taper, so it reads as a drawn line rather than a
     * sign-painter's mark.
     *
     * Local units: sclera -32..32 long, -9..8 tall; the tail runs on to 55.
     */
    function eye(ex, ey, dir) {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.scale(dir * es, es);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';

      function scleraPath() {
        ctx.beginPath();
        ctx.moveTo(-32, 5);                                  // inner point
        ctx.bezierCurveTo(-24, -4, -10, -9, 4, -9);
        ctx.bezierCurveTo(18, -9, 27, -7, 32, -3);           // outer corner
        ctx.bezierCurveTo(23, 3, 10, 7, -6, 7);
        ctx.bezierCurveTo(-18, 7, -27, 6, -32, 5);
        ctx.closePath();
      }

      /* the lid: a point at the inner corner, thickest over the iris, then
         drawn out into the tail */
      function lidPath() {
        ctx.beginPath();
        ctx.moveTo(-33, 5);
        ctx.bezierCurveTo(-25, -10, -10, -16, 4, -16);
        ctx.bezierCurveTo(20, -16, 31, -13, 39, -8);
        ctx.bezierCurveTo(45, -11, 50, -13, 55, -15);        // out to the tip
        ctx.bezierCurveTo(46, -9, 38, -5, 32, -3);           // and back under
        ctx.bezierCurveTo(27, -7, 18, -9, 4, -9);
        ctx.bezierCurveTo(-10, -9, -24, -4, -33, 5);
        ctx.closePath();
      }

      function lowerPath() {
        ctx.beginPath();
        ctx.moveTo(-32, 5);
        ctx.bezierCurveTo(-20, 10, -6, 11, 8, 9);
        ctx.bezierCurveTo(19, 7, 27, 2, 32, -3);
        ctx.bezierCurveTo(23, 3, 10, 7, -6, 7);
        ctx.bezierCurveTo(-18, 7, -27, 6, -32, 5);
        ctx.closePath();
      }

      // the red ground, sitting just outside the black on every edge
      ctx.strokeStyle = '#B23F1E'; ctx.lineWidth = 3.4;
      lidPath(); ctx.stroke();
      lowerPath(); ctx.stroke();

      ctx.fillStyle = '#FBF7EE'; scleraPath(); ctx.fill();

      // the iris runs UNDER the lid, so it is clipped by the sclera and the
      // lid then covers its top — which is what makes the eye look open
      ctx.save(); scleraPath(); ctx.clip();
      ctx.fillStyle = '#0E3A63';
      ctx.beginPath(); ctx.arc(2, -1, 10.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1E86C8';
      ctx.beginPath(); ctx.arc(2, -1, 8.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0A0908';
      ctx.beginPath(); ctx.arc(2, -1, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#141010';
      lidPath(); ctx.fill();
      lowerPath(); ctx.fill();

      /* the brow: its own crescent, pointed at both ends, reaching in far
         enough that the pair very nearly meet over the nose */
      ctx.beginPath();
      ctx.moveTo(-36, -9);
      ctx.bezierCurveTo(-26, -21, -6, -25, 12, -23);
      ctx.bezierCurveTo(27, -22, 38, -18, 47, -12);
      ctx.bezierCurveTo(38, -15, 26, -18, 11, -20);
      ctx.bezierCurveTo(-4, -22, -22, -18, -33, -7);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    /* They very nearly meet at the centre line — inner corners at 0.03 of the
       half-width — and the nose hangs between and below them. */
    var eyeY = visT + visH * 0.34;
    eye(mid - hw * 0.36, eyeY, -1);
    eye(mid + hw * 0.36, eyeY, 1);

    /* the nose: the Nepali १, a spiral over a tapering stroke. It is WHITE
       with a red outline — drawn in flat vermilion it reads as a letter J
       stamped on the wall. */
    (function () {
      var nT = visT + visH * 0.44, nH = visH * 0.44, nW = hw * 0.078;
      function curl(lw, colour) {
        ctx.strokeStyle = colour; ctx.lineWidth = lw;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        var steps = 30, si, tt, ang, rad;
        ctx.beginPath();
        for (si = 0; si <= steps; si++) {
          tt = si / steps;
          /* The stroke must be well under the radius it loses per turn or
             the spiral floods and the whole thing reads as a white blob. */
          ang = -Math.PI * 0.5 + tt * Math.PI * 2 * 1.15;
          rad = nW * (1.30 - 0.72 * tt);
          var sx = mid + Math.cos(ang) * rad;
          var sy2 = nT + nW * 1.15 + Math.sin(ang) * rad;
          if (si === 0) ctx.moveTo(sx, sy2); else ctx.lineTo(sx, sy2);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mid, nT);
        ctx.quadraticCurveTo(mid + nW * 0.95, nT + nH * 0.58, mid, nT + nH);
        ctx.stroke();
      }
      curl(nW * 0.74, '#B4441E');   // white body, thin red edge — not the reverse
      curl(nW * 0.50, '#FBF7EE');
    })();

    /* the valance over the head of the face */
    (function () {
      var vw = hw * 1.02, vT = faceT, vB = faceT + valH;
      var pl = 20, stp = (vw * 2) / pl, zig = valH * 0.26, i11;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(mid - vw, vT); ctx.lineTo(mid + vw, vT);
      ctx.lineTo(mid + vw, vB - zig);
      for (i11 = pl; i11 > 0; i11--) {
        var xa5 = mid - vw + stp * i11, xb5 = mid - vw + stp * (i11 - 1);
        ctx.lineTo((xa5 + xb5) / 2, vB);
        ctx.lineTo(xb5, vB - zig);
      }
      ctx.closePath(); ctx.clip();
      ctx.fillStyle = vg(ctx, vT, vB, '#D8342A', '#AE1E18', '#6B120E');
      ctx.fillRect(mid - vw, vT - 2, vw * 2, valH + 4);
      for (i11 = 0; i11 < pl; i11++) {
        var fx5 = mid - vw + stp * i11;
        var fd = ctx.createLinearGradient(fx5, 0, fx5 + stp, 0);
        fd.addColorStop(0,    'rgba(26,6,4,0.42)');
        fd.addColorStop(0.34, 'rgba(255,150,120,0.24)');
        fd.addColorStop(1,    'rgba(26,6,4,0.44)');
        ctx.fillStyle = fd;
        ctx.fillRect(fx5, vT - 2, stp + 0.8, valH + 4);
      }
      barrel(ctx, mid - vw, mid + vw, vT - 2, valH + 4, 0.34);
      ctx.restore();
      occlude(ctx, mid - vw, mid + vw, vB - zig * 0.35, 13, 0.34);
    })();

    /* a pale course, then blue / green / yellow / red over the valance */
    (function () {
      var bands = [['#F2E9D4', 0.28], ['#1E3E9E', 0.18], ['#1E8A3C', 0.18],
                   ['#E8BE1E', 0.18], ['#C42A20', 0.18]];
      var bw2 = hw * 1.02, yb = hTop;
      for (var i12 = 0; i12 < bands.length; i12++) {
        var bh2 = bandsH * bands[i12][1];
        ctx.fillStyle = bands[i12][0];
        ctx.fillRect(mid - bw2, yb, bw2 * 2, bh2 + 0.4);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(mid - bw2, yb, bw2 * 2, bh2 * 0.22);
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.fillRect(mid - bw2, yb + bh2 * 0.82, bw2 * 2, bh2 * 0.18);
        yb += bh2;
      }
      barrel(ctx, mid - bw2, mid + bw2, hTop, bandsH, 0.30);
    })();

    /* --- the thirteen rings ---------------------------------------------- */
    occlude(ctx, mid - R * 0.40, mid + R * 0.40, hTop - 6, 14, 0.45);
    var sy0 = hTop, ringStep = rH / 13;
    /* A stupa spire is a SHORT, BROAD stepped cone — near enough as wide at
       its foot as the harmika it stands on, and about as tall as it is wide.
       Tall and thin it reads as a radio mast. */
    var rw0 = Rx * 0.252, rw1 = rw0 * 0.36;
    for (var i = 0; i < 13; i++) {
      var w2 = rw0 + (rw1 - rw0) * (i / 12), yy = sy0 - i * ringStep;
      ctx.fillStyle = vg(ctx, yy - ringStep, yy, '#FDF0C8', '#C89533', '#7A5218');
      ctx.fillRect(mid - w2, yy - ringStep, w2 * 2, ringStep + 0.3);
      barrel(ctx, mid - w2, mid + w2, yy - ringStep, ringStep + 0.3, 0.55);
      ctx.fillStyle = 'rgba(255,246,220,0.55)';       // lit arris
      ctx.fillRect(mid - w2, yy - ringStep, w2 * 2, 1.1);
      ctx.fillStyle = 'rgba(48,30,10,0.55)';          // shadowed foot
      ctx.fillRect(mid - w2, yy - 0.9, w2 * 2, 1.5);
      ctx.fillStyle = 'rgba(30,18,6,0.22)';           // cast onto the ring below
      ctx.fillRect(mid - w2 - 1.4, yy, w2 * 2 + 2.8, 2);
    }

    /* --- the pinnacle -----------------------------------------------------
     * Bottom to top: a saffron skirt with a wavy hem; a blue / white / red
     * band; a lace fringe; a gilt DRUM carrying a dark repoussé frieze; a low
     * cap; then a vase, a stack of discs and a slender needle braced by two
     * diagonal rods. Not a parasol — no visible ribs, and taller than it is
     * wide.
     *
     * It sits well above the eye, so its horizontal rims bulge UP at the
     * centre: seen from below, the near edge of a circle sits HIGHER on screen.
     * The dome's courses further down are near enough at eye level to bulge the
     * other way, and getting it backwards here makes a finial look like a hat.
     * -------------------------------------------------------------------- */
    var sTop = sy0 - rH;                   // head of the thirteen rings
    /* Height of the whole assembly. Whether this reads as a pinnacle or a party
       hat comes down to the drum's width against it — 2.8 : 1, and much flatter
       is a brim rather than a drum. */
    var A  = rH * 1.028;
    var dw = rw1 * 1.45;                   // gilt drum, half-width
    var sw = rw1 * 1.58;                   // saffron skirt at the hem
    var K2 = 0.10;                         // how far below the rims we are

    function rimY(yc, r, th) { return yc - K2 * r * Math.cos(th); }

    /* a ring seen from below: both edges arc, the front of each riding high */
    function bandPath(yT, yB, rT2, rB2, hemWave) {
      var N = 30, i, th;
      ctx.beginPath();
      for (i = 0; i <= N; i++) {
        th = -Math.PI / 2 + (Math.PI * i) / N;
        var xt = mid + Math.sin(th) * rT2;
        if (i === 0) ctx.moveTo(xt, rimY(yT, rT2, th));
        else ctx.lineTo(xt, rimY(yT, rT2, th));
      }
      for (i = N; i >= 0; i--) {
        th = -Math.PI / 2 + (Math.PI * i) / N;
        var yb = rimY(yB, rB2, th);
        if (hemWave) yb += Math.sin(th * 7) * hemWave;
        ctx.lineTo(mid + Math.sin(th) * rB2, yb);
      }
      ctx.closePath();
    }

    /* Everything above stops at the spire HEAD, not over it: a hem or collar
       lapping down onto the top ring buries it, leaving twelve to count, and
       thirteen is the entire point of them. */
    var collarH = A * 0.055;
    var collarT = sTop - collarH;
    var ySkirtB = collarT + A * 0.012;     // the hem just kisses the collar
    var ySkirtT = ySkirtB - A * 0.135;
    var yBandT  = ySkirtT - A * 0.11;
    var yDrumB  = yBandT  - A * 0.02;
    var yDrumT  = yDrumB  - A * 0.235;
    var yCapT   = yDrumT  - A * 0.055;
    var yVaseT  = yCapT   - A * 0.22;
    var yTip    = yVaseT  - A * 0.25;

    /* the saffron skirt, flaring from the drum out to the hem */
    (function () {
      var wave = A * 0.020;
      bandPath(ySkirtT, ySkirtB, dw, sw, wave);
      ctx.save(); ctx.clip();
      var box = ySkirtB - ySkirtT + A * 0.14;
      ctx.fillStyle = vg(ctx, ySkirtT - 3, ySkirtB + wave,
                         '#F9C233', '#E08A10', '#98520A');
      ctx.fillRect(mid - sw - 3, ySkirtT - A * 0.06, sw * 2 + 6, box);
      var np = 15;
      for (var i5 = 0; i5 < np; i5++) {
        var xa3 = mid - sw + (sw * 2 * i5) / np, xb3 = xa3 + (sw * 2) / np;
        var fg = ctx.createLinearGradient(xa3, 0, xb3, 0);
        fg.addColorStop(0,   'rgba(120,62,6,0.34)');
        fg.addColorStop(0.4, 'rgba(255,236,164,0.26)');
        fg.addColorStop(1,   'rgba(120,62,6,0.36)');
        ctx.fillStyle = fg;
        ctx.fillRect(xa3, ySkirtT - A * 0.06, xb3 - xa3 + 0.7, box);
      }
      barrel(ctx, mid - sw, mid + sw, ySkirtT - A * 0.06, box, 0.42);
      ctx.restore();
    })();

    /* the blue / white / red band */
    (function () {
      var cols3 = ['#2E58A6', '#F3EEE3', '#B8241C'];
      var h3 = (ySkirtT - yBandT) / 3;
      for (var i6 = 0; i6 < 3; i6++) {
        var ya3 = yBandT + h3 * i6;
        bandPath(ya3, ya3 + h3 + 0.4, dw * 0.98, dw);
        ctx.save(); ctx.clip();
        ctx.fillStyle = cols3[i6];
        ctx.fillRect(mid - dw - 2, ya3 - 2, dw * 2 + 4, h3 + 5);
        barrel(ctx, mid - dw, mid + dw, ya3 - 2, h3 + 5, 0.5);
        ctx.restore();
      }
    })();

    /* the lace fringe under the drum */
    (function () {
      // it hangs OVER the tricolour, so keep it short or it eats the band
      var teeth = 17, step3 = (dw * 2) / teeth, drop = A * 0.024;
      ctx.fillStyle = '#C89533';
      for (var i7 = 0; i7 < teeth; i7++) {
        var xa4 = mid - dw + step3 * i7;
        var thm = Math.asin(Math.max(-1, Math.min(1, (xa4 + step3 / 2 - mid) / dw)));
        var yb4 = rimY(yDrumB, dw, thm);
        ctx.beginPath();
        ctx.moveTo(xa4, yb4);
        ctx.lineTo(xa4 + step3, yb4);
        ctx.lineTo(xa4 + step3 / 2, yb4 + drop);
        ctx.closePath(); ctx.fill();
      }
    })();

    /* the drum, and the dark frieze around it */
    (function () {
      bandPath(yDrumT, yDrumB, dw, dw);
      ctx.save(); ctx.clip();
      var hh3 = yDrumB - yDrumT;
      ctx.fillStyle = hg(ctx, mid - dw, mid + dw, '#8A5F28', '#FDF0C8', '#7A5218');
      ctx.fillRect(mid - dw - 2, yDrumT - 2, dw * 2 + 4, hh3 + 4);

      var fT = yDrumT + hh3 * 0.30, fH = hh3 * 0.46;
      ctx.fillStyle = 'rgba(46,28,10,0.55)';
      ctx.fillRect(mid - dw - 2, fT, dw * 2 + 4, fH);
      var motifs = 15, ms = (dw * 2) / motifs;
      for (var i8 = 0; i8 < motifs; i8++) {
        var mx = mid - dw + ms * (i8 + 0.5);
        ctx.fillStyle = 'rgba(250,224,158,0.55)';
        ctx.beginPath();
        ctx.arc(mx, fT + fH * 0.5, Math.max(1, ms * 0.22), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(250,224,158,0.30)';
        ctx.fillRect(mx - 0.5, fT + 1.5, 1, fH - 3);
      }
      barrel(ctx, mid - dw, mid + dw, yDrumT - 2, hh3 + 4, 0.42);
      ctx.restore();
      // lit arris along the drum's head
      ctx.strokeStyle = 'rgba(255,248,222,0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (var i9 = 0; i9 <= 24; i9++) {
        var th9 = -Math.PI / 2 + (Math.PI * i9) / 24;
        var x9 = mid + Math.sin(th9) * dw, y9 = rimY(yDrumT, dw, th9);
        if (i9 === 0) ctx.moveTo(x9, y9); else ctx.lineTo(x9, y9);
      }
      ctx.stroke();
    })();

    /* the cap over the drum */
    var cw2 = dw * 0.94;
    ctx.fillStyle = hg(ctx, mid - cw2, mid + cw2, '#8A5F28', '#FDF0C8', '#7A5218');
    ctx.beginPath();
    ctx.moveTo(mid - cw2, rimY(yDrumT, cw2, -Math.PI / 2));
    ctx.quadraticCurveTo(mid, yCapT - (yDrumT - yCapT) * 0.8,
                         mid + cw2, rimY(yDrumT, cw2, Math.PI / 2));
    ctx.lineTo(mid + cw2, yDrumT);
    ctx.lineTo(mid - cw2, yDrumT);
    ctx.closePath(); ctx.fill();

    /* the vase, its discs and the stem. A tall pale bulb with full ellipses
     * ruled across it reads as a head with shoulders — so the bulb stays in the
     * LOWER half, the discs sit above it as thin plates rather than rings on
     * the body, and a bare stem carries the eye up to the needle. */
    (function () {
      var vh = yCapT - yVaseT, vw = dw * 0.34, bulbT = yCapT - vh * 0.55;
      ctx.fillStyle = hg(ctx, mid - vw, mid + vw, '#6B4715', '#FFEDB4', '#5E3F14');
      ctx.beginPath();
      ctx.moveTo(mid - vw * 0.46, yCapT);
      ctx.bezierCurveTo(mid - vw * 1.06, yCapT - vh * 0.16,
                        mid - vw * 0.94, bulbT + vh * 0.06,
                        mid - vw * 0.34, bulbT);
      ctx.lineTo(mid + vw * 0.34, bulbT);
      ctx.bezierCurveTo(mid + vw * 0.94, bulbT + vh * 0.06,
                        mid + vw * 1.06, yCapT - vh * 0.16,
                        mid + vw * 0.46, yCapT);
      ctx.closePath(); ctx.fill();

      var dz = [[0.58, 0.60], [0.73, 0.43], [0.85, 0.29]];
      for (var i10 = 0; i10 < dz.length; i10++) {
        var dy = yCapT - vh * dz[i10][0], dwd = vw * dz[i10][1];
        ctx.fillStyle = hg(ctx, mid - dwd, mid + dwd, '#6B4715', '#FFF0C0', '#6B4715');
        ctx.fillRect(mid - dwd, dy, dwd * 2, Math.max(1.6, vh * 0.07));
      }
      ctx.fillStyle = vg(ctx, yVaseT, yCapT - vh * 0.84, '#FFF0C0', '#B98634');
      ctx.fillRect(mid - vw * 0.16, yVaseT, vw * 0.32, vh * 0.18);
    })();

    /* the two braces, and the needle they meet at */
    (function () {
      var braceY = yVaseT - (yVaseT - yTip) * 0.62;
      ctx.lineCap = 'round';
      [-1, 1].forEach(function (sg2) {
        var fx2 = mid + sg2 * dw * 0.84;
        ctx.strokeStyle = '#7A5218'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(fx2, yDrumT); ctx.lineTo(mid, braceY); ctx.stroke();
        ctx.strokeStyle = '#F0CE7E'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(fx2, yDrumT); ctx.lineTo(mid, braceY); ctx.stroke();
        ctx.fillStyle = '#FDF0C8';
        ctx.beginPath(); ctx.arc(fx2, yDrumT, 2.6, 0, Math.PI * 2); ctx.fill();
      });
      var nw = Math.max(1.6, dw * 0.075);
      ctx.fillStyle = vg(ctx, yTip, yVaseT, '#FFF6D8', '#D9A441', '#7A5218');
      ctx.beginPath();
      ctx.moveTo(mid - nw, yVaseT);
      ctx.lineTo(mid - nw * 0.28, yTip + (yVaseT - yTip) * 0.10);
      ctx.lineTo(mid, yTip);
      ctx.lineTo(mid + nw * 0.28, yTip + (yVaseT - yTip) * 0.10);
      ctx.lineTo(mid + nw, yVaseT);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FDF0C8';
      ctx.beginPath(); ctx.arc(mid, braceY, nw * 1.5, 0, Math.PI * 2); ctx.fill();
    })();

    /* the collar the flag lines are tied to — at the FOOT of the pinnacle, not
       at the needle: every rope converges just under the saffron skirt. */
    var anchorY = collarT + collarH * 0.5;
    ctx.fillStyle = hg(ctx, mid - rw1 * 1.2, mid + rw1 * 1.2,
                       '#7A5218', '#FDF0C8', '#6B4715');
    ctx.fillRect(mid - rw1 * 1.2, collarT, rw1 * 2.4, collarH);
    ctx.fillStyle = 'rgba(255,248,222,0.55)';
    ctx.fillRect(mid - rw1 * 1.2, collarT, rw1 * 2.4, 1.2);
    for (var kb = -3; kb <= 3; kb++) {
      var kx = mid + kb * rw1 * 0.36, kr = Math.max(1.2, A * 0.016);
      ctx.fillStyle = '#B98634';          // knobs, not holes
      ctx.beginPath(); ctx.arc(kx, collarT + collarH * 0.48, kr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,246,214,0.7)';
      ctx.beginPath();
      ctx.arc(kx - kr * 0.3, collarT + collarH * 0.48 - kr * 0.3, kr * 0.45,
              0, Math.PI * 2);
      ctx.fill();
    }
    occlude(ctx, mid - rw1 * 1.2, mid + rw1 * 1.2, sTop, 10, 0.42);

    var cy = yTip;
    var gl = ctx.createRadialGradient(mid, yDrumB, 0, mid, yDrumB, A * 2.4);
    gl.addColorStop(0, 'rgba(245,212,138,0.18)');
    gl.addColorStop(1, 'rgba(245,212,138,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(mid, yDrumB, A * 2.4, 0, Math.PI * 2); ctx.fill();

    /* The ground line: a whitewashed masonry platform, so coursed stone rather
       than carved timber. */
    (function () {
      /* Quiet. It is the ground line, not an object — at terrace brightness a
         full-width bar becomes the lightest thing on the page and pulls the eye
         straight off the building. */
      ctx.fillStyle = vg(ctx, y - 7, y + 9, '#BDB3A0', '#8E8676', '#4E483C');
      ctx.fillRect(x0, y - 7, x1 - x0, 16);
      ctx.fillStyle = 'rgba(246,240,226,0.45)';
      ctx.fillRect(x0, y - 7, x1 - x0, 1.4);
      ctx.fillStyle = 'rgba(10,7,5,0.6)';
      ctx.fillRect(x0, y + 7, x1 - x0, 2.4);
      ctx.fillStyle = 'rgba(14,10,6,0.30)';
      var n2 = Math.max(8, Math.round((x1 - x0) / 74));
      for (var i4 = 1; i4 < n2; i4++) {
        ctx.fillRect(x0 + ((x1 - x0) * i4) / n2, y - 5, 1.3, 12);
      }
      texture(ctx, x0, y - 7, x1 - x0, 16, 0.12);
    })();
    stupa.summit = { x: mid, y: anchorY };
    stupa.domeHalf = Rx;
    /* Visible height above the cornice: the pinnacle's tip down to the ground
       line, which is what Ht measures here. */
    stupa.height = Ht;
    /* Where the gilt catches the light. The crown is baked once per layout, so
       anything that has to RESPOND — the glow lifting as the cursor nears it —
       cannot live in the bake: the crown publishes the point and the scene
       draws the live part on top. */
    stupa.lantern = { x: mid, y: yDrumB, r: A * 2.4 };

    /* ---- where each named member actually is --------------------------------
     * This function is the only place the proportions exist, so anything
     * outside it that wants to point at a member would otherwise re-derive them
     * off Rx and drift the moment one is retuned. scene.js hangs its hot-points
     * off these; nothing here changes what is drawn.
     *
     * Page coordinates. Everything is a box except the dome, which is the upper
     * half of the ellipse it is painted as — a box round a dome takes in two
     * large corners of sky.
     * ---------------------------------------------------------------------- */
    stupa.parts = {
      /* the whole finial assembly, skirt to needle */
      gajur:   { kind: 'rect', x0: mid - sw * 1.25,  x1: mid + sw * 1.25,
                                y0: yTip - A * 0.06, y1: collarT,
                                cx: mid, cy: (yTip + yDrumB) / 2 },
      /* the stepped cone between harmika and finial. Its head is the taper's
         narrow end, so the box is the FOOT's width throughout — cut to the
         taper it would miss a click on the top rings. */
      rings:   { kind: 'rect', x0: mid - rw0 * 1.10, x1: mid + rw0 * 1.10,
                                y0: sTop,            y1: sy0,
                                cx: mid, cy: (sTop + sy0) / 2 },
      /* Nothing reads this yet. It is INSIDE `harmika` deliberately — the eyes
         are painted on the harmika's face, so a click on them is a correct
         click for either, and whichever member is being asked about decides
         which box is consulted. */
      eyes:    { kind: 'rect', x0: mid - hw * 0.86,  x1: mid + hw * 0.86,
                                y0: eyeY - hw * 0.26, y1: eyeY + hw * 0.24,
                                cx: mid, cy: eyeY },
      /* the block entire — bands, valance and painted face */
      harmika: { kind: 'rect', x0: mid - hw * 1.04,  x1: mid + hw * 1.04,
                                y0: hTop,            y1: hBot,
                                cx: mid, cy: (faceT + hBot) / 2 },
      dome:    { kind: 'dome', cx: mid, cy: base, rx: Rx, ry: Ry },
      /* The course carrying the Dhyani Buddha niches. The THINNEST thing
         published here — a few pixels tall at a small window — so anything
         pointing at it should aim at its centre line rather than expect to
         land inside it. */
      niches:  { kind: 'rect', x0: mid - nw2,        x1: mid + nw2,
                                y0: ny2 - nicheH,    y1: ny2,
                                cx: mid, cy: ny2 - nicheH / 2 },
      /* The Vedika: the three mandala terraces and their capping course, taken
         together, because that is how the drawing reads them — one white
         stepped mass. The WIDEST thing on the building. */
      vedika:  { kind: 'rect', x0: mid - W1,         x1: mid + W1,
                                y0: y - terrH - plinthH, y1: y,
                                cx: mid, cy: y - terrH * 0.5 }
    };
  }

  global.CROWNS = { stupa: stupa };
})(window);
