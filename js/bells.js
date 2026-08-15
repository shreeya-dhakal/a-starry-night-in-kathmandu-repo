/* bells.js — what the page sounds like, synthesised.
 *
 * Two voices, and they are the two things you can touch: a prayer wheel being
 * pushed round, and the air in the flags. Both are noise-based rather than
 * pitched, because neither object makes a note.
 *
 * No audio files: everything here is generated, so it works offline and there
 * is nothing to load.
 */
(function (global) {
  'use strict';

  function Bells() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
  }

  /* Browsers will not let audio start without a gesture, so this is called
   * from the first pointer or key event rather than at load. */
  Bells.prototype.init = function () {
    if (this.ctx) return;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    var ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;

    // a little air off the top so the partials do not get glassy
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 5200;
    this.tone.Q.value = 0.4;

    // procedural room, so there is no impulse-response file to ship
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeRoom(2.6, 2.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.30;
    this.dry = ctx.createGain();
    this.dry.gain.value = 0.85;

    /* A compressor rides the whole bus, so a hand run fast along the row
       cannot stack a dozen near-simultaneous whirrs into a bang. */
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -26;
    this.comp.knee.value = 22;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.22;

    this.bus = ctx.createGain();

    this.bus.connect(this.comp);
    this.comp.connect(this.tone);
    this.tone.connect(this.dry);
    this.tone.connect(this.verb);
    this.verb.connect(this.wet);
    this.dry.connect(this.master);
    this.wet.connect(this.master);
    this.master.connect(ctx.destination);

    this.ready = true;
  };

  Bells.prototype.resume = function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  Bells.prototype.makeRoom = function (seconds, decay) {
    var rate = this.ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = this.ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  };

  Bells.prototype.setMuted = function (m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  };

  /* ---- a prayer wheel being pushed round -----------------------------------
   * Three things at once at a real mani wall: the low rumble of a heavy drum on
   * its spindle, a brief metallic scrape as it takes the push, and the knock of
   * the weighted chain coming round. So: noise through a bandpass that falls as
   * the drum settles, a low body tone under it, and a wooden click on top.
   *
   * Short and quiet, with its own gap floor — a hand walking the row fires one
   * per drum, and anything with a tail turns a run into a smear.
   * ------------------------------------------------------------------------ */
  Bells.prototype.WHIRR_GAP = 0.045;

  Bells.prototype.whirr = function (velocity, pan) {
    if (!this.ready || this.muted) return;
    var ctx = this.ctx, t = ctx.currentTime;
    if (t - (this.lastWhirr || -1) < this.WHIRR_GAP) return;
    this.lastWhirr = t;

    var v = Math.max(0.15, Math.min(1, velocity));
    var dur = 0.26 + v * 0.16;

    var out = ctx.createGain();
    out.gain.value = 1;
    if (ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan || 0));
      out.connect(p); p.connect(this.bus);
    } else {
      out.connect(this.bus);
    }

    /* the rumble: noise, bandpassed, the band falling as the drum takes up.
       The slow ripple in the envelope is the drum being not quite true on its
       spindle — dead-flat noise sounds like a hiss, not like a bearing. */
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      var e = i / len;
      d[i] = (Math.random() * 2 - 1) * (1 - e) * (0.45 + 0.55 * Math.sin(e * 22));
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;

    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(430 + v * 320, t);
    bp.frequency.exponentialRampToValueAtTime(190, t + dur);

    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.150 * v, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(ng); ng.connect(out);
    src.start(t); src.stop(t + dur + 0.02);

    // the body of the drum, which is what makes it read as heavy rather than
    // as a hiss with a click on the front
    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(104 + Math.random() * 12, t);
    osc.frequency.exponentialRampToValueAtTime(72, t + dur);
    var og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(0.085 * v, t + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
    osc.connect(og); og.connect(out);
    osc.start(t); osc.stop(t + dur);

    this.transient(t, v * 0.7, out);
  };

  /* ---- wind in the flags ---------------------------------------------------
   * Three things make it wind rather than static:
   *
   *   BROWN NOISE, not white. Integrating puts the energy at the bottom where
   *   moving air actually is; white noise is a hiss.
   *
   *   THE BAND OPENS WITH THE GUST. A stronger wind is a brighter one, so the
   *   lowpass tracks the level rather than sitting at a fixed cutoff. This is
   *   most of what makes a swell read as a gust.
   *
   *   IT IS NEVER STEADY. A held level still breathes, on two slow rates that
   *   do not divide into each other.
   * ------------------------------------------------------------------------ */
  Bells.prototype.windGraph = function () {
    if (this.wnd) return this.wnd;
    var ctx = this.ctx, t = ctx.currentTime;

    /* four seconds of brown noise, looped. Long enough that the loop point is
       not a rhythm, short enough to be cheap to build. */
    var len = Math.floor(ctx.sampleRate * 4);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;      // leaky integrator: brown
      d[i] = last * 3.2;
    }
    /* seam: cross-fade the last tenth of a second into the first, or the loop
       ticks once every four seconds */
    var xf = Math.floor(ctx.sampleRate * 0.1);
    for (var j = 0; j < xf; j++) {
      var a = j / xf;
      d[j] = d[j] * a + d[len - xf + j] * (1 - a);
    }

    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 120;               // below this it is rumble, not air

    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    lp.Q.value = 0.7;

    /* the note a line of cloth and cord makes in a wind — shallow, or it turns
       into a whistle, and low, so it sits under the drums rather than in them */
    var peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 640;
    peak.Q.value = 0.9;
    peak.gain.value = 2;

    var gain = ctx.createGain();
    gain.gain.value = 0.0001;

    /* the gusting, in the graph rather than in the caller: two slow rates on
       the gain so a held hand still gives an unsteady wind */
    var g1 = ctx.createOscillator(), g1a = ctx.createGain();
    g1.frequency.value = 0.13; g1a.gain.value = 0.30;
    var g2 = ctx.createOscillator(), g2a = ctx.createGain();
    g2.frequency.value = 0.37; g2a.gain.value = 0.16;
    g1.connect(g1a); g2.connect(g2a);

    var swell = ctx.createGain();           // what the LFOs ride
    swell.gain.value = 1;
    g1a.connect(swell.gain); g2a.connect(swell.gain);

    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    src.connect(hp); hp.connect(lp); lp.connect(peak);
    peak.connect(gain); gain.connect(swell);
    if (pan) { swell.connect(pan); pan.connect(this.bus); }
    else swell.connect(this.bus);

    src.start(t); g1.start(t); g2.start(t);
    this.wnd = { src: src, lp: lp, gain: gain, pan: pan };
    return this.wnd;
  };

  /* level 0..1: how hard the flags are being moved. pan -1..1: which side of
     the fan it comes from. Called every step, so it has to stay cheap —
     setTargetAtTime is a one-pole filter in the audio thread, which costs
     nothing here and never steps. */
  Bells.prototype.wind = function (level, pan) {
    if (!this.ready) return;
    if (this.muted && !this.wnd) return;
    var w = this.windGraph(), ctx = this.ctx, t = ctx.currentTime;
    var v = Math.max(0, Math.min(1, level || 0));

    /* Up quickly and down slowly: a gust arrives faster than it leaves, and the
       long release keeps a line sounding while it settles after your hand has
       gone. */
    var rising = v > (this.wLast || 0);
    this.wLast = v;
    w.gain.gain.setTargetAtTime(0.036 * v * v * Math.sqrt(v),
                                t, rising ? 0.26 : 0.60);
    /* and the band opens with it, but not far — a lungta line in wind is nearer
       a rush than a hiss, and more brightness reads as harsh at the top. */
    w.lp.frequency.setTargetAtTime(380 + 1250 * v, t, 0.35);
    if (w.pan) w.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan || 0)), t, 0.4);
  };

  /* The knock of the weighted chain coming round. Without it the drum fades in
     rather than being pushed. */
  Bells.prototype.transient = function (t, v, dest) {
    var ctx = this.ctx;
    var len = Math.floor(ctx.sampleRate * 0.03);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;

    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.9;

    var g = ctx.createGain();
    g.gain.value = 0.05 * v;

    src.connect(bp); bp.connect(g); g.connect(dest);
    src.start(t);
    src.stop(t + 0.05);
  };

  global.Bells = Bells;
})(window);
