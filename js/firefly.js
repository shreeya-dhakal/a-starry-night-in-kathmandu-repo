/* firefly.js — three of them, keeping the pointer company.
 *
 * THEY ARE NOT THE CURSOR. One of them standing in for the arrow reads as a
 * decorated cursor rather than as anything alive, and it costs you the one mark
 * on screen that says where a click will land. So the arrow stays and these
 * follow it.
 *
 * THEY LAG, AND THAT IS THE POINT. A glow pinned to the pointer is a sprite.
 * What reads as an insect is arriving LATE and never quite straight — easing
 * toward its own station near the pointer, overshooting when the pointer stops,
 * with a slow wander on top.
 *
 * AND THEY MUST NOT MOVE TOGETHER. Three copies of one flight path is a
 * formation, and a formation is a machine. Everything that could be shared is
 * per-insect and deliberately incommensurate: the orbit, the spring, the wander
 * rates, the blink clock, and the weight of light each one carries.
 *
 * THE LANTERN BLINKS, IT DOES NOT THROB. A real one is a pulse with a hard rise
 * and a long decay, seconds apart — off one sine it is a dimmer. So brightness
 * is a slow envelope with an occasional proper flash on top, and the three
 * flash out of step.
 *
 * No dependencies and no hook into the scene: this file can be added or deleted
 * without touching scene.js.
 * ------------------------------------------------------------------------- */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc) return;

  var cv, ctx, on = false, raf = null;
  var px = -1, py = -1;              // where the pointer is
  var seen = false;

  /* One entry per insect. The numbers share no common factor, so the three
     never fall into step however long the page is left open.

       ox, oy   its station relative to the pointer, in px. Clear of the arrow,
                and a third of a turn apart so the three surround the pointer
                rather than queueing on one side.
       spin     how fast that station swings around the pointer, and which way.
                At one shared rate the three hold a rigid triangle; at rates
                that divide into each other they meet in the same place every
                time round. Different speeds with one reversed keeps them from
                ever settling into a figure.
       k, drag  its spring. The loose one wallows, the tight one darts.
       w1..w4   the wander, two rates an axis, none dividing into another, so
                the idle drift never closes into a loop.
       amp      how wide that wander is.
       glow     its lantern's weight, and `beat` the clock it flashes on.
       size     body scale. The dim one is also the small one, so it reads as
                further off and the group gets some depth. */
  var BUGS = [
    { ox:  46, oy: -14, spin:  0.17, k: 0.052, drag: 0.87,
      w1: 0.90, w2: 2.30, w3: 1.10, w4: 2.70, amp: 1.00,
      glow: 1.00, beat: 0.62, blip: 1.35, size: 1.00, phase: 0.0 },
    { ox: -14, oy:  50, spin: -0.11, k: 0.034, drag: 0.905,
      w1: 0.61, w2: 1.73, w3: 0.79, w4: 2.11, amp: 1.45,
      glow: 0.80, beat: 0.43, blip: 0.97, size: 0.86, phase: 2.4 },
    { ox: -37, oy: -33, spin:  0.23, k: 0.071, drag: 0.845,
      w1: 1.37, w2: 3.10, w3: 1.63, w4: 2.41, amp: 0.70,
      glow: 0.60, beat: 0.29, blip: 1.71, size: 0.74, phase: 4.9 }
  ];

  function makeCanvas() {
    cv = doc.createElement('canvas');
    cv.id = 'firefly';
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;' +
                       'pointer-events:none;z-index:60';
    doc.body.appendChild(cv);
    ctx = cv.getContext('2d');
    size();
  }

  function size() {
    if (!cv) return;
    var dpr = global.devicePixelRatio || 1;
    cv.width  = Math.max(1, Math.round(global.innerWidth  * dpr));
    cv.height = Math.max(1, Math.round(global.innerHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function lantern(g, b, k, t) {
    var s = b.size;
    var R = 26 * s * (0.75 + k * 0.55);
    var x = b.x, y = b.y;

    g.save();
    g.globalCompositeOperation = 'lighter';

    var haze = g.createRadialGradient(x, y, 0, x, y, R);
    haze.addColorStop(0,    'rgba(190,255,140,' + (0.30 * k).toFixed(3) + ')');
    haze.addColorStop(0.35, 'rgba(150,220,90,'  + (0.13 * k).toFixed(3) + ')');
    haze.addColorStop(1,    'rgba(90,160,40,0)');
    g.fillStyle = haze;
    g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();

    var cr = 5.2 * s;
    var core = g.createRadialGradient(x, y, 0, x, y, cr);
    core.addColorStop(0,   'rgba(244,255,214,' + (0.95 * k).toFixed(3) + ')');
    core.addColorStop(0.5, 'rgba(206,247,132,' + (0.70 * k).toFixed(3) + ')');
    core.addColorStop(1,   'rgba(160,220,70,0)');
    g.fillStyle = core;
    g.beginPath(); g.arc(x, y, cr, 0, Math.PI * 2); g.fill();
    g.restore();

    /* The body, drawn over the light. Small, dark, and turned to face the way
       it is travelling — a beetle rather than a dot, and the turn is what
       stops it reading as a bead being dragged. */
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    var ang = sp > 0.4 ? Math.atan2(b.vy, b.vx)
                       : Math.sin(t * 0.7 + b.phase) * 0.6;
    g.save();
    g.translate(x, y); g.rotate(ang); g.scale(s, s);
    g.fillStyle = 'rgba(38,32,18,0.80)';
    g.beginPath(); g.ellipse(-1.6, 0, 3.4, 1.9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(232,255,176,' + (0.30 + 0.55 * k).toFixed(3) + ')';
    g.beginPath(); g.ellipse(1.5, 0, 2.5, 1.7, 0, 0, Math.PI * 2); g.fill();
    // wings, a blur rather than a shape at this size
    g.fillStyle = 'rgba(226,236,210,0.13)';
    g.beginPath(); g.ellipse(-1.2, -2.4, 3.6, 1.5, -0.35, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(-1.2,  2.4, 3.6, 1.5,  0.35, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function frame(ms) {
    raf = global.requestAnimationFrame(frame);
    if (!on || !ctx) return;
    var t = ms / 1000;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!seen) return;

    for (var i = 0; i < BUGS.length; i++) {
      var b = BUGS[i];

      /* A spring toward its own station beside the pointer, heavily damped,
         plus a wander that never switches off. */
      var wx = (Math.sin(t * b.w1 + b.phase) * 9 +
                Math.sin(t * b.w2 + b.phase * 1.7) * 3.5) * b.amp;
      var wy = (Math.cos(t * b.w3 + b.phase * 0.6) * 8 +
                Math.sin(t * b.w4 + b.phase) * 3.0) * b.amp;
      /* The station turns slowly around the pointer, each at its own rate, so
         the three trade places instead of holding a fixed triangle. The phase
         is deliberately NOT in here: it would rotate each station off its own
         starting angle by a different amount, throwing away the third-of-a-turn
         spacing and clumping all three beside the cursor. */
      var sw = t * b.spin;
      var cs = Math.cos(sw), sn = Math.sin(sw);
      var tx = px + (b.ox * cs - b.oy * sn) + wx;
      var ty = py + (b.ox * sn + b.oy * cs) + wy;

      b.vx += (tx - b.x) * b.k; b.vy += (ty - b.y) * b.k;
      b.vx *= b.drag; b.vy *= b.drag;
      b.x += b.vx; b.y += b.vy;

      /* The lantern: a slow envelope, with a real flash every few seconds. The
         flash rides a sharp power curve so it snaps on and falls away. */
      var slow = 0.42 + 0.30 * (0.5 + 0.5 * Math.sin(t * b.blip + b.phase));
      var beat = 0.5 + 0.5 * Math.sin(t * b.beat + b.phase);
      var k = Math.min(1, slow + 0.55 * Math.pow(beat, 7)) * b.glow;
      lantern(ctx, b, k, t);
    }
  }

  /* On wherever there is a canvas to be over — and a pointer to keep company.
     On a touch screen there is no hovering pointer for them to follow, so all
     three would sit wherever the last tap was: a full-screen canvas, cleared
     every frame and carrying six radial gradients, for three insects standing
     still. They are the first thing to go on a small machine. */
  function start() {
    if (!doc.getElementById('stage')) return;
    if (global.matchMedia && global.matchMedia('(pointer: coarse)').matches) return;
    makeCanvas();
    global.addEventListener('resize', size);
    global.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      /* First sight: drop each of them onto its own station rather than at the
         pointer, or all three fly out of the cursor like a puff of smoke. */
      if (!seen) {
        seen = true;
        for (var i = 0; i < BUGS.length; i++) {
          BUGS[i].x = px + BUGS[i].ox; BUGS[i].y = py + BUGS[i].oy;
          BUGS[i].vx = 0; BUGS[i].vy = 0;
        }
      }
    }, { passive: true });
    on = true;
    doc.documentElement.classList.add('firefly-on');
    raf = global.requestAnimationFrame(frame);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(this);
