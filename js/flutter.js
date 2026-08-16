/* flutter.js — the wind in the prayer flags.
 *
 * Decides how hard the flags are being moved; the sound itself is Bells.wind,
 * and the cloth it speaks for is drawn in drawLungta.
 *
 * A LEVEL, NOT AN EVENT. Nothing discrete happens when a hand goes through a
 * line of prayer flags — what you hear is one continuous noise that rises and
 * falls. So this computes a single number, how much air is in the flags, and
 * the bed follows it.
 *
 * IT WATCHES THE HAND, NOT THE CORD. A lungta line is pinned at both ends with
 * under two percent slack, so it is a taut cable: under ambient wind its nodes
 * already travel about as far per step as a brisk hand adds. Measured, the
 * weather outruns the hand on both mean per-node travel and peak-against-mean
 * contrast, so no threshold on the cord's own motion can separate them.
 * (drawLungta is built around the same fact — the flutter is drawn on the
 * cloth, not simulated on the cord.)
 *
 * So each cord carries an excitation instead: energy in from the pointer while
 * the hand is inside its field, leaking away on its own. The weather can never
 * trip it, the coupling uses the same falloff and radius as the cloth solver so
 * what you hear is the set of lines you can see moving, and it outlives the
 * gesture by about a second.
 * -------------------------------------------------------------------------- */
(function (global) {
  'use strict';

  /* The pointer's reach, in pixels. The scene hands the same number to
     Cloth.applyPointer, so the sound and the shove cannot disagree about which
     lines the hand is in. */
  var PTR_R = 150;
  /* What one step of contact adds, set against the decay below so the gestures
     SEPARATE: a drift settles a line at about a third of the ceiling, a brisk
     sweep at two thirds, a flick pins it. Much higher and every touch
     saturates and sounds like every other. */
  var EXC_IN = 0.014;
  /* What survives one step: a line let go falls back under the trigger in
     about a second. Slower and a flicked line goes on talking after it has
     visibly stopped moving. */
  var EXC_KEEP = 0.980;
  var EXC_MAX  = 1.2;
  /* How much total excitation counts as a full gust. Summed across the lines
     rather than taken from the loudest — a hand through the middle of the fan
     is in four cords at once, and that IS more air than a hand at the end of
     one. Leaves a plain sweep at about three quarters. */
  var GUST = 4.5;

  /* How fast the hand must move to count as working the cloth, and the ceiling
     past which faster stops adding. Higher than the cloth solver's own cap of
     1: a flick through the flags should be louder than a stroll, and a cap at
     walking pace makes a fast pass silent. */
  var SPEED_UNIT = 9;
  var SPEED_MAX  = 2.5;

  /* Both of the numbers above are PER STEP, so they move with the physics rate
     the scene is running at — see the note on STEP_SCALE in scene.js. Cached
     rather than recomputed in poll(), which runs every step. */
  var excIn = EXC_IN, excKeep = EXC_KEEP;

  var Flutter = {
    R: PTR_R,

    /* `scale` is how many 120Hz steps one step now stands for. Called once by
       the scene at startup; the defaults above are the 120Hz case. */
    pace: function (scale) {
      excIn = EXC_IN * scale;
      excKeep = Math.pow(EXC_KEEP, scale);
    },

    /* Give a line its share of the wind. `size` is for the drawing's own use —
       the bed is one voice for the whole fan, so nothing is pitched per line.
       Called once per line at build time. */
    arm: function (lc, size) {
      lc.size = size;
      lc.snd = { exc: 0 };
      return lc;
    },

    /* The hand's speed in the units above, from a scene's pointer. */
    speed: function (ptr) {
      if (!ptr.active) return 0;
      return Math.min(SPEED_MAX,
        (Math.abs(ptr.vx) + Math.abs(ptr.vy) * 0.6) / SPEED_UNIT);
    },

    /* One physics step's worth. Returns the level it asked the bed for, 0 to
       1, which is for the debug window and nothing else. */
    poll: function (lines, ptr, speed, now, W, bells) {
      var total = 0, wx = 0;

      for (var i = 0; i < lines.length; i++) {
        var lc = lines[i], sd = lc.snd;
        if (!sd) continue;

        /* Nearest approach of the hand to this cord. Both rows, because the
           lower one is the hem of the cloth and brushing that is brushing the
           flag rather than the string it hangs on. */
        if (speed > 0.01) {
          var n = lc.cols * 2, d2 = Infinity;
          for (var k = 0; k < n; k++) {
            var dx = ptr.x - lc.x[k], dy = ptr.y - lc.y[k];
            var d = dx * dx + dy * dy;
            if (d < d2) d2 = d;
          }
          if (d2 < PTR_R * PTR_R) {
            var q = 1 - Math.sqrt(d2) / PTR_R;
            sd.exc += q * q * speed * excIn;
            if (sd.exc > EXC_MAX) sd.exc = EXC_MAX;
          }
        }
        sd.exc *= excKeep;

        total += sd.exc;
        /* where the wind is coming from: the excitation-weighted middle of the
           lines that are actually moving, so a hand in the left of the fan is
           heard on the left */
        wx += sd.exc * lc.x[lc.cols >> 1];
      }

      var level = Math.min(1, total / GUST);
      var pan = total > 0.001 ? ((wx / total) / W) * 1.7 - 0.85 : 0;
      bells.wind(level, pan);
      return level;
    }
  };

  global.Flutter = Flutter;
})(window);
