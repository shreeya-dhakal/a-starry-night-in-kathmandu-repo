/* scene.js — layout, rendering, input, and the loop.
 *
 * A starry night in Kathmandu.
 *
 * The building is drawn once into an offscreen canvas and blitted. What is live
 * is the lungta strung off its mast, the wall of prayer wheels at its foot, and
 * the gilt at the summit: a hand passed along the wall turns the drums, cloth.js
 * runs the flag lines, and the pinnacle brightens as the cursor nears it.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var bells = new window.Bells();
  var Cloth = window.Cloth;
  var CROWNS = window.CROWNS;
  /* deciding when a flag line speaks — see flutter.js */
  var Flutter = window.Flutter;

  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* There is one building and it is the chaitya. `current` is kept as a name
     because the crown, its content and its hot-points are all read out of
     tables keyed by it, and a one-key table is still the right shape. */
  var current = 'stupa';
  var lang = 'en';

  /* A LOOKING mode, not a second design: `?wall=0` takes the mani wall away and
     leaves the building alone in the window, which gives it more of the height
     to be judged in while the crown is being worked on. It does not touch the
     chrome. */
  var SHOWWALL = !/[?&]wall=(0|off|false|no)\b/i.test(location.search);

  /* The hint names what is actually in front of you: the flags off the mast
     and the wall of drums at the foot. `bare` is the crown-looking view, where
     the foot is empty and the flags are all there is to touch. */
  var UI = {
    en: { eyebrow: 'A starry night in Kathmandu', sound: 'Sound', about: 'About',
          hint: { stupa: '[ Stir the flags • Spin the wheels ]',
                  bare:  '[ Stir the flags ]' } },
    ne: { eyebrow: 'काठमाडौंको ताराभरी रात', sound: 'आवाज', about: 'बारेमा',
          hint: { stupa: '[ लुङ्दर हल्लाउनुहोस् • चक्र घुमाउनुहोस् ]',
                  bare:  '[ लुङ्दर हल्लाउनुहोस् ]' } }
  };

  /* ---- what you are looking at --------------------------------------------
   * The building's name, a line on what it is, and its architectural style.
   * Only the screen-reader mirror says the style out loud; the plate names the
   * monument, because that is what you are standing in front of.
   *
   * Both languages throughout — a page that offers a language switch and then
   * answers half of it in English is worse than an imperfect sentence. The
   * Nepali is machine-translated and unreviewed; see the README.
   * ---------------------------------------------------------------------- */
  var PLACE = {
    stupa: {
      name:         { en: 'Boudhanath', ne: 'बौद्धनाथ' },
      architecture: { en: 'Stupa',      ne: 'स्तूप'      },
      body: {
        en: 'Boudhanath Stupa also known as Khasti Chaitya, situated in ' +
            'Kathmandu, Nepal, is a major sacred landmark representing the ' +
            'enlightened mind of all Buddhas.',
        ne: 'बौद्धनाथ स्तूप, जसलाई खास्ति चैत्य पनि भनिन्छ, नेपालको ' +
            'काठमाडौंमा अवस्थित छ। यो सबै बुद्धहरूको प्रबुद्ध चित्तको ' +
            'प्रतीक मानिने एक प्रमुख पवित्र स्थल हो।'
      }
    }
  };

  /* ---- the hot-points -----------------------------------------------------
   * Eight members of the stupa, each with its name and a line on what it is.
   *
   * ANCHORED TO THE CROWN, NOT TO THE PAGE. Every `at` reads the geometry
   * crowns.js publishes for its member, so a node cannot drift from the thing
   * it points at when the building resizes and nothing here restates a
   * proportion that lives in crowns.js. Two are not crown members at all: the
   * flags come off a live lungta line, the wheels off the baked rack.
   *
   * The offsets are the only judgement in the table. A stupa is symmetrical and
   * every member's centre is on one axis, so eight nodes at eight centres would
   * be a dotted line up the middle; each is pushed off to alternating sides
   * instead. They are fractions of the member's own size so they stay INSIDE
   * it — spread a narrow member as hard as a wide one and its node lands out in
   * the sky, pointing at nothing.
   * ---------------------------------------------------------------------- */
  var SPOTS = {

  stupa: [
    { key: 'lungta',
      name: { en: 'Prayer Flags (Lung Ta)', ne: 'लुङ्दर (लुङ् ता)' },
      body: { en: 'Prayer flags consist of five different colors including blue representing sky, white representing air, red representing water, green representing water, and yellow representing the earth. While the 5 colored flag flutters in the wind, they carry mantras with the air and spread their blessings.',
              ne: 'प्रार्थना झण्डामा पाँच फरक रङहरू हुन्छन् जसमा नीलोले आकाशको प्रतिनिधित्व गर्दछ, सेतोले हावाको प्रतिनिधित्व गर्दछ, रातोले पानीको प्रतिनिधित्व गर्दछ, हरियोले पानीको प्रतिनिधित्व गर्दछ र पहेंलोले पृथ्वीको प्रतिनिधित्व गर्दछ। पाँच रङका झण्डाहरू हावामा फहराउँदा, तिनीहरूले हावासँगै मन्त्रहरू बोकेर आशीर्वाद फैलाउँछन्।' },
      at: function () {
        /* on the cloth itself, a little out along one of the lines — it moves
           when the line moves, which is the point of putting it there */
        var lc = lungta[Math.min(3, lungta.length - 1)];
        if (!lc) return null;
        lc.sampleRow(0, lc.rowLength(0) * 0.52, SAMP);
        return { x: SAMP.x, y: SAMP.y - 6 };
      } },

    { key: 'vedika',
      name: { en: 'Vedika (Stepped Plinth / Base Mandala)', ne: 'वेदिका (मण्डल आधार)' },
      body: { en: 'The three-tiered mandala platform that elevates the sacred structure and forms the main path for clockwise circumambulation (pradakshina).',
              ne: 'तीन तहको मण्डल चौतारी, जसले यो पवित्र संरचनालाई उचाल्छ र घडीको दिशामा गरिने परिक्रमा (प्रदक्षिणा)को मुख्य बाटो बनाउँछ।' },
      at: function () { return off('vedika', 0.62, 0); } },

    { key: 'anda',
      name: { en: 'Garbha / Anda (The Hemispherical Dome)', ne: 'गर्भ / अण्ड (अर्धगोलाकार गुम्बज)' },
      body: { en: 'The whitewashed dome of the Boudhanath stupa also called the Anda(अण्ड) in Sanskrit, represents the limitless compassion of Buddha and the boundlessness of the universe. Its smooth round structure represents water elements and a spiritual womb that holds relics.',
              ne: 'बौद्धनाथ स्तूपको सेतो रंगले पोतिएको गुम्बज, जसलाई संस्कृतमा अण्ड (अण्ड) पनि भनिन्छ, बुद्धको असीम करुणा र ब्रह्माण्डको असीमतालाई प्रतिनिधित्व गर्दछ। यसको चिल्लो गोलाकार संरचनाले पानी तत्वहरू र अवशेषहरू राख्ने आध्यात्मिक गर्भलाई प्रतिनिधित्व गर्दछ।' },
      at: function () {
        var P = crownParts();
        var d = P && P.dome;
        if (!d) return null;
        /* on the dome's own face, up and to the left of its spring line */
        return { x: d.cx - d.rx * 0.52, y: d.cy - d.ry * 0.62 };
      } },

    { key: 'devakostha',
      name: { en: 'Devakostha (Buddha Niches)', ne: 'देवकोष्ठ (बुद्ध कोठा)' },
      body: { en: 'Carved shrines embedded around the dome’s base housing the Dhyani Buddhas facing the cardinal directions.',
              ne: 'गुम्बजको फेदमा कुँदिएका कोठाहरू, जसभित्र चारै दिशा हेरेर ध्यानी बुद्धहरू विराजमान छन्।' },
      at: function () { return off('niches', -0.66, 0); } },

    { key: 'harmika',
      name: { en: 'Harmika (The Wisdom Tower)', ne: 'हर्मिका (ज्ञानको गजुर)' },
      body: { en: 'In the top square base part of the stupa, also known as the “Harmika”, the symbolic eyes of Buddha are painted. The eye is painted in all four directions, representing the Buddha’s eye of wisdom and compassion. It symbolizes the all-seeing ability of Buddha. In between the eyes, the spiral shape represents the nose of Buddha that represents Nirvana.',
              ne: 'स्तूपको माथिल्लो वर्गाकार आधार भागमा, जसलाई "हर्मिका" पनि भनिन्छ, बुद्धका प्रतीकात्मक आँखाहरू चित्रित गरिएका छन्। आँखा चारै दिशामा चित्रित गरिएको छ, जसले बुद्धको बुद्धि र करुणाको आँखालाई प्रतिनिधित्व गर्दछ। यसले बुद्धको सर्वदृष्टि क्षमताको प्रतीक हो। आँखाको बीचमा, सर्पिल आकारले बुद्धको नाकलाई प्रतिनिधित्व गर्दछ जसले निर्वाणलाई प्रतिनिधित्व गर्दछ।' },
      at: function () { return off('harmika', -0.72, 0.1); } },

    { key: 'bhuwana',
      name: { en: 'Trayodashi Bhuwana (The 13 Tier Spire)', ne: 'त्रयोदशी भुवन (तेह्र तले शिखर)' },
      body: { en: 'Above the square base part, the thirteen steps golden tier structures of the stupa represent thirteen steps to enlightenment. The steps represent the spiritual development stages that a Buddhist practitioner must pass to attain Buddhahood. It is believed that passing all thirteen steps liberates one from samsara and gets Nirvana.',
              ne: 'वर्गाकार आधार भाग माथि, स्तूपको तेह्र खुड्किला सुनौलो तहको संरचनाले ज्ञान प्राप्तिको तेह्र खुड्किलालाई प्रतिनिधित्व गर्दछ। यी खुड्किलाहरूले बौद्ध साधकले बुद्धत्व प्राप्त गर्न पार गर्नुपर्ने आध्यात्मिक विकासका चरणहरूलाई प्रतिनिधित्व गर्दछन्। सबै तेह्र खुड्किलाहरू पार गर्नाले संसारबाट मुक्ति मिल्छ र निर्वाण प्राप्त हुन्छ भन्ने विश्वास गरिन्छ।' },
      at: function () { return off('rings', 0.72, 0.05); } },

    { key: 'gajur',
      name: { en: 'Gajur (The Golden Pinnacle)', ne: 'गजुर (स्वर्ण शिखा)' },
      body: { en: 'Gajur, or the central spire, crowns the stupa and symbolizes the spiritual summit.',
              ne: 'गजुर, वा केन्द्रीय शिखर, स्तूपको मुकुट हो र आध्यात्मिक शिखरको प्रतीक हो।'},
      at: function () { return off('gajur', -0.62, -0.12); } },

    { key: 'mani',
      name: { en: 'Prayer Wheels (Mani Wheels)', ne: 'माने (मणि चक्र)' },
      body: { en: 'The prayer wheels placed at the circular edge of the stupa are inscribed with the mantra “Om Mani Padme Hum.” Devotees and practitioners spin them during kora to gain blessing and compassion.',
              ne: 'स्तूपको गोलाकार किनारामा राखिएका प्रार्थना चक्रहरूमा "ओम मणि पद्मे हम" मन्त्र कुँदिएको छ। भक्तहरू र साधकहरूले आशीर्वाद र करुणा प्राप्त गर्न कोराको समयमा तिनीहरूलाई घुमाउँछन्।' },
      at: function () {
        if (!wheelRow.length) return null;
        /* the MIDDLE drum, and high on it. The wall is a row of seven
           identical objects and the eye goes to the centre of it; a node low
           on a barrel sits in the busiest part of the copper, and high on the
           middle drum puts it against the dark of the rail. */
        var w = wheelRow[wheelRow.length >> 1];
        return { x: w.x, y: w.y - 24 };
      } },
  ] };

  /* The table of nodes. The counter counts against this list. */
  function spotsFor() { return SPOTS[current] || []; }

  /* The crown's published geometry. Read at the moment it is wanted rather
     than cached: every box in it is a multiple of the dome's half-width, and
     that changes with the window. */
  function crownParts() { return CROWNS[current].parts || null; }

  /* A point on a published member, pushed off its centre by a share of its own
     half-width and half-height. Fractions rather than pixels, so a node sits in
     the same place on the member at every size. */
  function off(key, fx, fy) {
    var P = crownParts();
    var b = P && P[key];
    if (!b) return null;
    return { x: b.cx + (b.x1 - b.x0) * 0.5 * fx,
             y: b.cy + (b.y1 - b.y0) * 0.5 * fy };
  }

  // blue, white, red, green, yellow — the fixed order, and weathered. Clean
  // saturated versions of these read as papel picado rather than lungta.
  var FLAGS = ['#2F5FA8', '#EDE6D6', '#C6392A', '#2E7D4F', '#E0A82E'];
  var W = 0, H = 0, dpr = 1;
  var stageX0 = 0, stageX1 = 0, coreX0 = 0, coreX1 = 0, crownY = 0;
  var lungta = [], stars = [], haze = [];
  /* scratch frame filled by Cloth.sampleRow — reused rather than allocated,
     since it is written once per flag per frame */
  var SAMP = { x: 0, y: 0, tx: 1, ty: 0, hx: 0, hy: 1 };
  /* the same bargain for the flutter: the turn at each strip boundary of one
     flag, and where that boundary lands across it. Written and read inside a
     single pass of drawLungta, so fixed slots are all this ever needs. */
  var SWING = [0, 0, 0, 0, 0], POS = [0, 0, 0, 0, 0];
  var rackCv = null, rackBox = null;
  /* the gilt at the summit, and how far up its hover glow currently is */
  var lantern = null, lanternLit = 0;
  var wheelRow = [], drive = null, wheelSpan = 60;
  var time = 0;
  /* ---- the hand -------------------------------------------------------------
   * `tx, ty` is where the mouse actually is; `x, y` is where the SCENE thinks
   * it is, chasing it — see stepPointer. Everything a hand can touch reads x/y,
   * so the easing is in one place.
   *
   * WHY NOT THE RAW POSITION. Pointer sampling is bad in two ways, and both
   * showed. It is IRREGULAR — a 1000Hz mouse delivers a cluster of events in
   * one frame and none the next, so a hand at constant speed gave velocities
   * jumping by 5x frame to frame, every spike landing in the cloth as a shove.
   * And it is QUANTISED — integer-pixel positions make a slow drag a staircase,
   * and a differentiated staircase is a square wave.
   *
   * Easing the position fixes both, including for the velocity, which is
   * measured off the EASED motion rather than off the events. In steady state
   * the eased point travels at the true speed — the lag is constant, so the
   * per-frame difference is real. Only the transients change: a flick ramps in
   * over a few frames and rings out instead of stopping dead.
   * -------------------------------------------------------------------------- */
  var pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999,
                  vx: 0, vy: 0, active: false };
  /* How much of the gap the scene closes each frame; 1 is no easing. Low enough
     to smooth both a 1000Hz mouse and a staircase, high enough that the cursor
     never feels like it is dragging something — at 0.3 the point sits about two
     frames behind the mouse. */
  var PTR_EASE = 0.30;

  /* The line the drums stand on. Set by placeCrown, because where they go is
     part of placing the building; see the block there. */
  var wheelLine = 0;

  /* how much wind is in the flags right now, 0 to 1 — read by __dbg, and the
     one number flutter.js hands to the bed */
  var windLevel = 0;

  var GRAVITY = 1750;
  var WIND    = reduced ? 55 : 230;
  var STEP    = 1 / 120;
  /* Seven drums on the wall, and a constant rather than a fit to the width.
     See the mani wall in build(). */
  var MANI_COUNT = 7;
  /* ---- how a drum keeps turning after you let go --------------------------
   * A prayer wheel is a heavy brass barrel on a spindle: it takes a moment to
   * get going and coasts for several seconds. Both halves matter — instant
   * speed reads as an animation being switched on, stopping with the hand reads
   * as weightless.
   *
   * MANI_INERTIA is how much of the hand's speed reaches the drum in one step,
   * set from the CONTACT rather than the impulse: a hand crossing one drum's
   * reach is in it for about sixteen physics steps, so the per-step figure must
   * be small enough that sixteen add up to most of a turn rather than to the
   * cap. An order of magnitude too high and every drum saturates on the first
   * frame of contact, together, and the row moves as one unit.
   *
   * MANI_FRICTION is the share of angular velocity surviving one step: at
   * 120Hz, 0.990 brings a full-speed drum to rest in about five seconds.
   *
   * MANI_STICTION is the speed below which it is simply stopped — exponential
   * decay never reaches zero, and a drum creeping imperceptibly for the rest of
   * the session is worse than one that comes to rest.
   * ---------------------------------------------------------------------- */
  var MANI_INERTIA  = 0.16;
  var MANI_FRICTION = reduced ? 0.975 : 0.990;
  var MANI_STICTION = 0.004;
  var MANI_MAX      = 1.3;
  /* ---- how the cloth moves --------------------------------------------------
   * FLUTTER is how far a flag turns about its cord at the peak, in radians, and
   * it is bounded at both ends. Much under it is a shimmer — twelve pixels of
   * cloth leaning a ninth of a radian moves about a pixel, so the line reads as
   * a static string of stamps. Much over it and the fan is BUNTING: enough
   * cloth is near edge-on at any moment that the row reads as leaning triangles
   * rather than squares seen at an angle, and a prayer flag is a square.
   *
   * WAVE is how much of that turn is spread ACROSS one flag rather than applied
   * to all of it at once — the flag is drawn in vertical strips (see SLICES),
   * each a little further along the wave, so the ripple runs through the cloth
   * instead of the whole square rocking as a board. This is most of what reads
   * as fluidity; the amplitude only makes it visible. It is also the other half
   * of the bunting problem: the strip widths carry their own foreshortening, so
   * a wave steep enough to put one edge near edge-on while the other is
   * square-on tapers the cloth into a wedge. Under a radian across one flag it
   * stays a square with a curve in it.
   *
   * RATE is the wave's base speed, in radians a second. Deliberately unhurried:
   * quick and small is a shimmer, big and slow is cloth.
   * -------------------------------------------------------------------------- */
  var FLUTTER = reduced ? 0.05 : 0.42;
  var WAVE    = 0.85;
  var RATE    = reduced ? 1.2 : 2.4;
  /* Strips per flag. One is a flat quad, which is what `reduced` gets: the
     ripple is the part of this that is motion for motion's sake. Three is
     enough to read as a curve at this size and holds the per-frame drawImage
     count for the whole fan to about six hundred. */
  var SLICES = reduced ? 1 : 3;
  /* The wave's own clock, ACCUMULATED rather than read off `time`. The rate
     rises with the wind, and rate * time would jump the phase by minutes' worth
     of wave every time the level moved — so the phase is integrated and only
     its speed is allowed to change. */
  var flutPhase = 0;
  /* how far out of focus the type goes by the time it is under the floor */
  var FLOOR_BLUR = 5.5;

  var skyCv = document.createElement('canvas');
  var skyCtx = skyCv.getContext('2d');
  var twinklers = [];
  var flagCv = [];        // one baked sprite per colour
  var crownCv = document.createElement('canvas');
  var crownCtx = crownCv.getContext('2d');
  var crownH = 0;

  function hasRack() { return SHOWWALL; }

  /* The room the mani wall takes under the building: its own depth plus the
     shadow gap above it (the gap is the one number here chosen by eye).
     rackSpan is read off the same function that will place the timber, so the
     reserve and the drawing cannot drift. Zero under `?wall=0`. */
  var RACK_GAP = 40;
  function footReserve() {
    if (!hasRack()) return 0;
    var rs = rackSpan(0);
    return (rs.bot - rs.top) + RACK_GAP;
  }

  /* The axis the building is drawn about, and the only way the box around it is
     ever set. placeCrown resizes it while fitting the crown to the frame, so
     what frameStage sets is a starting guess rather than the answer. */
  var coreMid = 0;
  function setCoreWidth(w) {
    coreX0 = coreMid - w / 2;
    coreX1 = coreMid + w / 2;
  }

  /* ---- the box the building is drawn in ------------------------------------
   * Pulled out of layout() because a re-frame must NOT go through layout(),
   * which re-seeds the sky and would give a different set of stars.
   * ---------------------------------------------------------------------- */
  function frameStage() {
    stageX0 = 24;
    stageX1 = W - 24;
    /* "The middle" plainly means the middle of the window. */
    var mid = (stageX0 + stageX1) / 2;
    var stageW = stageX1 - stageX0;
    var coreW = Math.min(780, stageW * 0.58);
    /* 58% of the stage is right on anything wide, and wrong on a NARROW window:
       crowns.js sizes the building off the width it is given, so 58% of a
       narrow stage is a small building marooned in a tall empty field. So it
       may take up to 92%, but only as far as it needs to reach a reasonable
       share of the height available. On anything wide this never binds. */
    var availH = H - footReserve();
    var wantW = Math.min(stageW * 0.92, (availH * 0.44) / 0.56);
    if (wantW > coreW) coreW = wantW;
    coreMid = mid;
    setCoreWidth(coreW);
  }

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    frameStage();
    /* placeCrown BEFORE paintSky, because the sky bakes a halo around the
       pinnacle and that halo is positioned off crownY — and finding crownY
       takes a bake of its own. The other order paints the sky around where the
       building was last time, and on the very first layout around zero. */
    seedSky();
    placeCrown();
    paintSky(); bakeFlags();
    build();
    showMarks(); placeMarks(); paintTally();
  }

  /* Where the ground line goes, and the bake that follows from it.

     The building has to end up in the MIDDLE, and that takes two bakes: the
     crown caps its own height by a rule of its own (0.56 of the span, against a
     headroom floor) that lives in crowns.js and should keep living there. So
     rather than restate it — bake once with the line pushed as low as it goes,
     read back what the crown says it drew, put the line where that height lands
     centred, and bake again.

     The probe has to be the LOW line: from the ordinary line a short window
     reports a height squashed by the headroom above it, gets centred for that
     number, then finds room to grow into on the second bake and sits high.

     Twice per layout, not per frame. */
  function placeCrown() {
    /* The building and its furniture are ONE object. `?wall=0` has the window
       to itself; with the wall standing, the wall is part of the composition
       and is carried up to just under the ground line so the pair centres
       together — building, shadow gap, wall. Left on the floor it reads as a
       separate thing with a band of empty air above it. */
    var reserve = footReserve();

    /* ---- filling the frame --------------------------------------------------
     * The crown sizes itself as a fraction of the span it is given, and that
     * fraction describes how tall the building is for its width, not how big it
     * should be drawn. So the box is not an input; the frame is — 48 clear at
     * the top, whatever the wall holds at the bottom, building fills the rest —
     * and the SPAN is solved for by measuring: bake, read back the height,
     * scale by how far off target it was, bake again.
     *
     * Measured rather than derived on purpose: restating the fraction here
     * would put the same constant in two files, to drift the first time the
     * crown was retuned.
     * ---------------------------------------------------------------------- */
    var target = H - 96 - reserve;

    /* WHAT is measured matters. The obvious probe — bake at the guessed width,
       read the height, scale — is wrong: at a wide guess the crown is often
       taller than the room above the probe line, so what comes back is the ROOM
       rather than the crown's own rule, and every correction after that scales
       off a number with nothing to do with the span. It then crawls toward the
       target a tenth at a time and runs out of passes short of it.

       So the probe is deliberately NARROW. At 360 the crown is under 300 and
       cannot reach the room, so the height returned is purely its fraction of
       the span and the span the target needs falls straight out of it. */
    crownY = Math.max(348, H - reserve - 8);
    var PROBE = 360;
    setCoreWidth(PROBE);
    paintCrown();
    var frac = (CROWNS[current].height || PROBE * 0.5) / PROBE;

    /* The whole window less a margin, not the stage: the stupa is a broad low
       form and needs every pixel to reach the target height — at the stage
       measure it is width-bound on anything narrow and comes out short. Where
       it runs past the chrome it passes behind it, which reads as the building
       continuing under rather than as one that has been cut. */
    var wMax = W - 40;
    setCoreWidth(Math.max(140, Math.min(wMax, target / frac)));
    paintCrown();
    var h = CROWNS[current].height || H * 0.40;

    /* And then it has to settle. The clamp is the headroom the crown asks for
       above it; under that it quietly shrinks to fit, which is the thing
       centring is meant to stop. A loop rather than a line because the crown
       caps its height against the room ABOVE ITS GROUND LINE, so moving that
       line can change the height it was moved for. Two passes settle it, and
       the exit is on the height being stable rather than on a pass count. */
    for (var fix = 0; fix < 3; fix++) {
      crownY = Math.max(h + 48, (H - (h + reserve)) / 2 + h);
      paintCrown();
      var h2 = CROWNS[current].height || h;
      if (Math.abs(h2 - h) < 1) break;
      h = h2;
    }
    /* Where the drums stand, published for buildRack. */
    wheelLine = crownY + RACK_GAP - rackSpan(0).top;
  }

  /* ---- sky ---------------------------------------------------------------- */

  function seedSky() {
    stars = [];
    var band = H * 0.66;
    var count = Math.min(420, Math.round(W * band / 2600));
    for (var i = 0; i < count; i++) {
      var t = Math.pow(Math.random(), 2.1);
      stars.push({ x: Math.random() * W, y: t * band,
                   r: 0.35 + Math.random() * 1.15, a: 0.25 + Math.random() * 0.6,
                   tw: 0.5 + Math.random() * 1.6, ph: Math.random() * 6.28 });
    }
    haze = [];
    for (var k = 0; k < 5; k++) {
      haze.push({ x: W * (0.12 + Math.random() * 0.76), y: H * (0.05 + Math.random() * 0.32),
                  r: Math.max(W, H) * (0.18 + Math.random() * 0.22),
                  c: k % 2 ? '46,58,102' : '78,58,96', a: 0.05 + Math.random() * 0.05 });
    }
  }

  /* The sky never changes, so it is baked once rather than repainted as eight
     full-screen composites every frame. Only a few stars twinkle live. */
  function paintSky() {
    skyCv.width = Math.max(1, Math.floor(W * dpr));
    skyCv.height = Math.max(1, Math.floor(H * dpr));
    var c = skyCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070B18'); g.addColorStop(0.26, '#0C1023');
    g.addColorStop(0.50, '#151325'); g.addColorStop(0.72, '#1B1411');
    g.addColorStop(1, '#0B0806');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    for (var k = 0; k < haze.length; k++) {
      var hz = haze[k];
      var rg = c.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.r);
      rg.addColorStop(0, 'rgba(' + hz.c + ',' + hz.a + ')');
      rg.addColorStop(1, 'rgba(' + hz.c + ',0)');
      c.fillStyle = rg; c.fillRect(0, 0, W, H * 0.82);
    }

    /* A star that twinkles must NOT also be baked, or the live pass can only
       add to one already there — it brightens and returns but never dims, which
       is the one thing twinkling is. The bake gets the quiet majority; the
       chosen few are left out of it and drawn live. */
    var band = H * 0.66;
    twinklers = [];
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var fade = 1 - st.y / band;
      if (fade <= 0) continue;
      st.base = st.a * fade * fade;
      st.cool = i % 9 === 0;
      if (!reduced && st.base > 0.22 && twinklers.length < 130) {
        twinklers.push(st);
        continue;                                  // left out of the bake
      }
      c.globalAlpha = st.base;
      c.fillStyle = st.cool ? '#CFE0F5' : '#F3ECDC';
      c.beginPath(); c.arc(st.x, st.y, st.r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;


    /* The glow off the town belongs to the GROUND rather than the window. 0.42
       of the height is where the cornice sits in the ordinary layout, so the
       constant stands there. Under `?wall=0` the building is centred instead,
       and a band keyed to the window would start halfway up it — the horizon
       painted over the building rather than behind it — so it uses crownY. */
    var warmTop = SHOWWALL ? H * 0.42 : crownY;
    var warm = c.createLinearGradient(0, warmTop, 0, H);
    warm.addColorStop(0, 'rgba(150,84,38,0)');
    warm.addColorStop(1, 'rgba(150,84,38,0.22)');
    c.fillStyle = warm; c.fillRect(0, warmTop, W, H - warmTop);

    var mid = (coreX0 + coreX1) / 2;
    var halo = c.createRadialGradient(mid, crownY - 130, 0, mid, crownY - 130, (coreX1 - coreX0) * 0.95);
    halo.addColorStop(0, 'rgba(217,164,65,0.13)');
    halo.addColorStop(0.5, 'rgba(193,80,46,0.05)');
    halo.addColorStop(1, 'rgba(217,164,65,0)');
    c.fillStyle = halo; c.fillRect(0, 0, W, H);
  }

  /* Prayer flags are block-printed cotton, not coloured rectangles: a border
     rule, a printed cartouche, blocks of mantra, a sewn head, a frayed hem and
     the shading of cloth left out in weather. Far too much to draw a hundred
     times a frame, so each colour is baked once and blitted.

     FLAG_W/H are the AUTHORING size. What gets drawn is flagDraw, set from the
     dome's half-width — a real flag is about 0.063 of it, and 0.075 is a small
     concession so the script survives. Left at the authoring size they read as
     bunting. */
  var FLAG_W = 25, FLAG_H = 27;
  var flagDraw = 12;

  function bakeFlags() {
    flagCv = FLAGS.map(function (col, idx) {
      var S = 4, cv = document.createElement('canvas');
      cv.width = FLAG_W * S; cv.height = FLAG_H * S;
      var c = cv.getContext('2d');
      c.setTransform(S, 0, 0, S, 0, 0);

      c.fillStyle = col;
      c.fillRect(0, 0, FLAG_W, FLAG_H);

      // sewn head, folded over the cord
      c.fillStyle = 'rgba(0,0,0,0.30)';
      c.fillRect(0, 0, FLAG_W, 3.2);
      c.fillStyle = 'rgba(0,0,0,0.14)';
      c.fillRect(0, 3.2, FLAG_W, 0.8);

      var ink = (idx === 1) ? 'rgba(46,30,18,0.80)' : 'rgba(16,10,6,0.66)';
      c.fillStyle = ink; c.strokeStyle = ink;

      /* At this size a lungta is a printed page, not a picture: the wind horse
         at 25px is a blob that reads as a dog, so the emblem is a cartouche and
         the flag is carried by the density of script around it — which is what
         the eye registers on a real one anyway. */
      function script(y0, x0, x1, h, step, jitter) {
        for (var xx = x0; xx < x1 - 0.8; xx += step) {
          var seed = ((xx * 31 + y0 * 17 + idx * 7) | 0) % 7;
          if (jitter && seed === 0) { continue; }          // word breaks
          c.globalAlpha = 0.30 + (seed % 4) * 0.075;
          c.fillRect(xx, y0, step * 0.62, h);
        }
        c.globalAlpha = 1;
      }

      c.lineWidth = 0.55;
      c.strokeRect(1.7, 4.8, FLAG_W - 3.4, FLAG_H - 6.6);

      // the four corner seals
      [[3.2, 6.2], [FLAG_W - 6.4, 6.2], [3.2, FLAG_H - 8.4], [FLAG_W - 6.4, FLAG_H - 8.4]]
        .forEach(function (p2) {
          c.globalAlpha = 0.5;
          c.strokeRect(p2[0], p2[1], 3.2, 3.2);
          c.globalAlpha = 0.34;
          c.fillRect(p2[0] + 0.8, p2[1] + 0.8, 1.6, 1.6);
          c.globalAlpha = 1;
        });

      // the central cartouche — a different seal on each colour, because a
      // set of five identical flags is the tell that it is not real
      var bx = FLAG_W / 2 - 5, by = FLAG_H / 2 - 3.6, bw = 10, bh = 7.6;
      c.globalAlpha = 0.30; c.fillRect(bx, by, bw, bh); c.globalAlpha = 1;
      c.lineWidth = 0.6; c.strokeRect(bx, by, bw, bh);
      c.globalAlpha = 0.62;
      if (idx === 0) {                                   // stepped form
        c.fillRect(bx + 4, by + 1.4, 2, 5); c.fillRect(bx + 2.6, by + 3, 4.8, 1.2);
        c.fillRect(bx + 1.6, by + 5, 6.8, 1.2);
      } else if (idx === 1) {                            // sun over moon
        c.beginPath(); c.arc(bx + 5, by + 3, 1.7, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(bx + 5, by + 5.8, 2, Math.PI, Math.PI * 2); c.fill();
      } else if (idx === 2) {                            // knot
        c.fillRect(bx + 2.2, by + 2, 5.6, 1.1); c.fillRect(bx + 2.2, by + 4.4, 5.6, 1.1);
        c.fillRect(bx + 3, by + 2, 1.1, 3.6); c.fillRect(bx + 6, by + 2, 1.1, 3.6);
      } else if (idx === 3) {                            // vase
        c.fillRect(bx + 3.4, by + 1.4, 3.2, 1.1);
        c.fillRect(bx + 2.4, by + 2.8, 5.2, 3.6);
      } else {                                           // column of script
        for (var q = 0; q < 4; q++) c.fillRect(bx + 2, by + 1.2 + q * 1.6, 6, 0.9);
      }
      c.globalAlpha = 1;

      // dense script filling everything the cartouche does not
      script(5.6, 3.0, FLAG_W - 3.0, 0.85, 1.7, true);
      script(7.4, 7.2, FLAG_W - 7.2, 0.85, 1.7, true);
      script(9.2, 3.0, FLAG_W - 3.0, 0.85, 1.7, true);
      script(11.4, 2.9, bx - 0.6, 0.85, 1.7, true);
      script(11.4, bx + bw + 0.6, FLAG_W - 2.9, 0.85, 1.7, true);
      script(13.6, 2.9, bx - 0.6, 0.85, 1.7, true);
      script(13.6, bx + bw + 0.6, FLAG_W - 2.9, 0.85, 1.7, true);
      script(FLAG_H - 8.0, 3.0, FLAG_W - 3.0, 0.85, 1.7, true);
      script(FLAG_H - 6.2, 3.0, FLAG_W - 3.0, 0.85, 1.7, true);
      script(FLAG_H - 4.4, 5.0, FLAG_W - 5.0, 0.85, 1.7, true);

      // sun-bleached through the middle
      var bleach = c.createLinearGradient(0, 0, FLAG_W, 0);
      bleach.addColorStop(0, 'rgba(255,250,238,0)');
      bleach.addColorStop(0.5, 'rgba(255,250,238,0.15)');
      bleach.addColorStop(1, 'rgba(255,250,238,0)');
      c.fillStyle = bleach; c.fillRect(0, 3.2, FLAG_W, FLAG_H - 3.2);

      // cloth: lit at the head, falling away at the hem, one soft fold
      var sh = c.createLinearGradient(0, 0, 0, FLAG_H);
      sh.addColorStop(0, 'rgba(255,255,255,0.13)');
      sh.addColorStop(0.4, 'rgba(255,255,255,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.32)');
      c.fillStyle = sh; c.fillRect(0, 0, FLAG_W, FLAG_H);

      var fold = c.createLinearGradient(FLAG_W * 0.55, 0, FLAG_W * 0.88, 0);
      fold.addColorStop(0, 'rgba(0,0,0,0)');
      fold.addColorStop(0.5, 'rgba(0,0,0,0.20)');
      fold.addColorStop(1, 'rgba(255,255,255,0.07)');
      c.fillStyle = fold; c.fillRect(0, 3.2, FLAG_W, FLAG_H - 3.2);

      // a straight hem: it is a rectangle of cloth, not bunting
      c.fillStyle = 'rgba(0,0,0,0.26)';
      c.fillRect(0, FLAG_H - 1.1, FLAG_W, 1.1);
      return cv;
    });
  }

  /* Scintillation, not a pulse. Real twinkling is air, not a dimmer, so two
     sines at rates that do not divide into each other beat against one another
     and the star never repeats a pattern you can follow. The brightest few gain
     a short cross-flare at their peak — the diffraction spike an eye makes —
     which is what reads as sparkle rather than as fading in and out. */
  function drawSky() {
    ctx.drawImage(skyCv, 0, 0, W, H);
    if (reduced) return;
    for (var i = 0; i < twinklers.length; i++) {
      var st = twinklers[i];
      var tw = 0.50 + 0.34 * Math.sin(time * st.tw + st.ph)
                    + 0.16 * Math.sin(time * st.tw * 2.7 + st.ph * 3.1);
      if (tw < 0.04) continue;
      ctx.globalAlpha = Math.min(1, st.base * tw * 1.55);
      ctx.fillStyle = st.cool ? '#CFE0F5' : '#F3ECDC';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r * (0.85 + tw * 0.3), 0, Math.PI * 2);
      ctx.fill();

      if (tw > 0.86 && st.r > 1.0) {
        var f = (tw - 0.86) / 0.14, len = st.r * (2.4 + f * 3.4);
        ctx.globalAlpha = st.base * f * 0.5;
        ctx.strokeStyle = '#F3ECDC';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(st.x - len, st.y); ctx.lineTo(st.x + len, st.y);
        ctx.moveTo(st.x, st.y - len); ctx.lineTo(st.x, st.y + len);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function paintCrown() {
    crownH = crownY + 90;
    crownCv.width = Math.max(1, Math.floor(W * dpr));
    crownCv.height = Math.max(1, Math.floor(crownH * dpr));
    crownCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    crownCtx.clearRect(0, 0, W, crownH);
    CROWNS[current](crownCtx, coreX0, coreX1, crownY);
    toneCrown();
    var rx = CROWNS[current].domeHalf || (coreX1 - coreX0) * 0.21;
    flagDraw = Math.max(7, rx * 0.075);
  }

  /* ---- grading the stupa into the night ------------------------------------
   * Straight out of crowns.js the bake is a pale flat cut-out, and nothing in
   * the night sky behind it is near paper-white, so the eye reads it as
   * belonging to a different picture. So it is graded, and every step is a
   * lighting operation rather than a repaint:
   *
   *   EXPOSURE. brightness() scales the channels, so the whitewash comes down
   *   to lit lime and every fold and highlight keeps its relationship to the
   *   others. Set so the median lands about a stop above the sky's darks.
   *
   *   COLOUR. Dropping exposure alone gives grey, since the whites were nearly
   *   neutral. saturate() opens what colour is in them and the warm pass puts
   *   the butter lamps back.
   *
   *   GRAIN. The last tell, and the one that survives any amount of colour
   *   work: the drawn crown is perfectly smooth where a photograph never is.
   *
   * Applied here rather than in crowns.js on purpose — every white in there was
   * chosen against the ones around it, and editing forty literals would lose
   * that reasoning to a global mood change.
   * ---------------------------------------------------------------------- */
  var GRADE = {
    exposure: 0.52,          // scales every channel: the whole point
    colour:   1.38,          // what is left of the tint after that
    warm:     '150,84,38',   // the butter lamps at its foot
    warmA:    0.20,
    grain:    0.055
  };

  var gradeCv = document.createElement('canvas');
  var grainCv = null;

  /* A tile of noise, cut once. Two-sided — light specks as well as dark — so
     it reads as film rather than as dirt on the lens. */
  function grainTile() {
    if (grainCv) return grainCv;
    var N = 96;
    grainCv = document.createElement('canvas');
    grainCv.width = grainCv.height = N;
    var g = grainCv.getContext('2d');
    var img = g.createImageData(N, N);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random();
      var up = v > 0.5;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = up ? 255 : 0;
      /* most of the tile is empty: a speck every few pixels is grain, a value
         on every pixel is static */
      img.data[i + 3] = v > 0.86 || v < 0.14 ? 255 : 0;
    }
    g.putImageData(img, 0, 0);
    return grainCv;
  }

  function toneCrown() {
    var w = crownCv.width, h = crownCv.height;
    if (!w || !h) return;

    /* Exposure and colour, through a scratch canvas — a canvas cannot filter
       itself, and the alpha has to survive so the sky stays empty. */
    gradeCv.width = w; gradeCv.height = h;
    var g = gradeCv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.filter = 'brightness(' + GRADE.exposure + ') saturate(' + GRADE.colour + ')';
    g.drawImage(crownCv, 0, 0);
    g.filter = 'none';

    crownCtx.save();
    crownCtx.setTransform(1, 0, 0, 1, 0, 0);
    crownCtx.clearRect(0, 0, w, h);
    crownCtx.drawImage(gradeCv, 0, 0);

    /* Everything from here only lands where the building already is. */
    crownCtx.globalCompositeOperation = 'source-atop';

    /* The warm comes from BELOW. Flat, it is a sepia filter — the whole
       building goes brown and the gilt at the summit ends the same colour as
       the terraces. The real thing is lit from the ground by butter lamps and
       from above by nothing but sky, so it runs amber at the plinth and cold at
       the finial: full wash at the ground line, gone by the top of the dome. */
    var top = (crownY - (CROWNS[current].height || h / dpr)) * dpr;
    var wg = crownCtx.createLinearGradient(0, top, 0, crownY * dpr);
    wg.addColorStop(0, 'rgba(' + GRADE.warm + ',0)');
    wg.addColorStop(0.55, 'rgba(' + GRADE.warm + ',' + (GRADE.warmA * 0.45).toFixed(3) + ')');
    wg.addColorStop(1, 'rgba(' + GRADE.warm + ',' + GRADE.warmA + ')');
    crownCtx.fillStyle = wg;
    crownCtx.fillRect(0, 0, w, h);

    crownCtx.globalAlpha = GRADE.grain;
    var pat = crownCtx.createPattern(grainTile(), 'repeat');
    crownCtx.fillStyle = pat;
    crownCtx.fillRect(0, 0, w, h);

    crownCtx.restore();
  }

  function rackSpan(wheelY) {
    var rh = 52, capH = 7, railH = 22, clear = 22;
    var railTop = wheelY - rh / 2 - capH - clear;
    var railBot = wheelY + rh / 2 + capH + clear;
    return { railTop: railTop, railBot: railBot,
             top: railTop - railH, bot: railBot + railH + 4 };
  }

  function bakeRack() {
    if (!wheelRow.length) { rackCv = null; return; }
    var y = wheelRow[0].y, rw = 23, rh = 52, capH = 7;
    var x0 = wheelRow[0].x - rw - 34;
    var x1 = wheelRow[wheelRow.length - 1].x + rw + 34;
    var railH = 22;
    var sp = rackSpan(y);
    var railTop = sp.railTop, railBot = sp.railBot;
    var top = sp.top, bot = sp.bot;

    rackBox = { x: x0, y: top, w: x1 - x0, h: bot - top };
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(rackBox.w * dpr));
    cv.height = Math.max(1, Math.ceil(rackBox.h * dpr));
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, -rackBox.x * dpr, -rackBox.y * dpr);

    /* Spindles first, so the timber covers where they enter it — drawn after,
       they lay a bar across the carving and the wheel reads as stuck on the
       front of the rack rather than hung inside it. */
    for (var s2 = 0; s2 < wheelRow.length; s2++) {
      var sx2 = wheelRow[s2].x;
      [[railTop, y - rh / 2 - capH], [y + rh / 2 + capH, railBot]]
        .forEach(function (seg) {
          var a = seg[0], len = seg[1] - seg[0];
          g.fillStyle = '#241710';
          g.fillRect(sx2 - 2.6, a, 5.2, len);
          g.fillStyle = 'rgba(196,156,116,0.26)';
          g.fillRect(sx2 - 2.6, a, 1.2, len);
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(sx2 + 1.6, a, 1, len);
        });
    }

    carvedRail(g, x0, x1, railTop, railH);
    carvedRail(g, x0, x1, railBot, railH);
    var oc = g.createLinearGradient(0, railTop + railH / 2, 0, railTop + railH / 2 + 22);
    oc.addColorStop(0, 'rgba(8,4,2,0.5)');
    oc.addColorStop(1, 'rgba(8,4,2,0)');
    g.fillStyle = oc;
    g.fillRect(x0, railTop + railH / 2, x1 - x0, 22);

    rackCv = cv;
  }

  /* One prayer-flag line, on the cloth solver. Row 0 is the cord, pinned at
     both ends; row 1 is the free lower edge of the cloth.

     The cord is laid out along the parabola it will hang in rather than along
     the chord, so it starts at rest: a cable of span L and sag d has arc length
     L(1 + 8d^2/3L^2), which inverts to d = L*sqrt(3(slack-1)/8). Laid straight
     and left for the slack to pull down, every line snaps on frame one.

     ROPES, NOT STRINGS. A lungta line should answer a hand the way slack cotton
     does — a long smooth undulation that dies out — rather than the way a
     plucked string does, which is a kink that snaps back through plumb and
     rings. Two stiffnesses decide which you get:

       BEND is the whole difference. Near zero the cord has no resistance to
       kinking, so a push puts a CORNER in it and the corner is what travels —
       a guitar string. Raised, the corner opens into an arc before it has
       moved a line, and what travels is a wave.

       STRUCTURAL sets the wave's speed. A stiff link passes a disturbance to
       its neighbour within one relaxation pass, so a shove reaches the hem at
       once and reads as a snap; a slack one carries it down over several
       frames. The three relaxation passes in physics() are the other half —
       the link still holds the line's LENGTH over a few steps, just not within
       one. */
  function makeLine(x1, y1, x2, y2, slack, phase) {
    var N = 20;
    var lc = new Cloth({ cols: N, rows: 2, x0: 0, y0: 0, dx: 1, dy: 1, mass: 1 });
    var dx = x2 - x1, dy = y2 - y1;
    var L = Math.sqrt(dx * dx + dy * dy);
    var sag = L * Math.sqrt(Math.max(0, 3 * (slack - 1) / 8));
    var fh = flagDraw * (FLAG_H / FLAG_W);
    for (var c = 0; c < N; c++) {
      var t = c / (N - 1);
      lc.moveTo(lc.at(c, 0), x1 + dx * t, y1 + dy * t + 4 * sag * t * (1 - t));
      lc.moveTo(lc.at(c, 1), x1 + dx * t, y1 + dy * t + 4 * sag * t * (1 - t) + fh);
    }
    lc.pin(0, 0); lc.pin(N - 1, 0);
    lc.link({ structural: 0.95, shear: 0.40, bend: 0.06 });
    lc.phase = phase;
    return lc;
  }

  function build() {
    lungta = [];
    wheelRow = []; drive = null;

    var coreW = coreX1 - coreX0;
    var stageW = stageX1 - stageX0;
    var mid = (coreX0 + coreX1) / 2;

    /* `?wall=0` is a view of the building alone and keeps no furniture at
       all, which is why this asks hasRack(). */
    if (hasRack()) buildRack(coreW);
    else { rackCv = null; rackBox = null; }
    buildLungta(mid, coreW, stageW);
    mirrorForScreenReaders();
  }

  /* Lungta off the summit, on the cloth solver: row 0 is the cord and row 1
     is the free lower edge, so each flag gets its lean and skew from the sheet
     it is cut from rather than from a fudge factor applied to a sprite. */
  function buildLungta(mid, coreW, stageW) {
    var summit = CROWNS[current].summit || { x: mid, y: crownY - 300 };
    lantern = CROWNS[current].lantern || null;
    for (var side = -1; side <= 1; side += 2) {
      for (var f = 0; f < 6; f++) {
        var t = f / 5;
        var ax = mid + side * (coreW * 0.20 + t * (stageW * 0.5 - coreW * 0.20 - 6));
        /* A FRACTION of the run from summit to ground, never a pixel offset off
           the ground line: the building is centred, so the cornice moves with
           the window. Fixed offsets flatten the fan on a tall page and, on a
           short one, land the outer ends BELOW THE GROUND LINE — flags sinking
           into the terrace. As a fraction the splay holds at any height. */
        var ay = summit.y + (crownY - summit.y) * (0.50 + t * 0.36);
        var lc = makeLine(summit.x, summit.y, ax, ay,
                          1.018 + t * 0.016, (ax / W) * 6.0);
        /* and its voice: `size` pitches the cloth, a short steep line carrying
           small quick flags and a long low one broader ones. See flutter.js. */
        Flutter.arm(lc, 0.82 + t * 0.42);
        lungta.push(lc);
      }
    }
  }

  /* The mani wall: seven drums in a carved frame at the foot of the terraces. */
  function buildRack(coreW) {
    var wn = MANI_COUNT;
    /* The wall is carried up to the foot of the terraces, and placeCrown has
       already worked out where. */
    var y = wheelLine;

    /* The wall belongs to the BUILDING, so it is cut to the vedika that
       crowns.js publishes. bakeRack throws its carved frame 57px past the outer
       drum at each end, so the drums are inset by that much and the FRAME is
       what lands on the terraces' edges. The pitch has a floor: a building too
       narrow to space seven drums gets a wall slightly wider than itself rather
       than seven drums touching. */
    var mid = (coreX0 + coreX1) / 2;
    var ved = (CROWNS[current].parts || {}).vedika;
    var frameW = ved ? ved.x1 - ved.x0 : coreW;
    var pitch = Math.max(54, (frameW - 114) / (wn - 1));
    var w0 = mid - (pitch * (wn - 1)) / 2;
    for (var w = 0; w < wn; w++) {
      wheelRow.push({ x: w0 + pitch * w, y: y,
                      phase: w * 3.1, spin: 0, vel: 0 });
    }
    drive = { floor: 0, last: -1, nextAt: 0, count: 0 };
    /* boxes butt up against each other, so there is no dead air between two
       drums for the hand to cross without sounding either */
    wheelSpan = pitch;
    bakeRack();
  }

  /* Everything on the page is drawn on canvas, so this carries the same thing
     in words for a screen reader — and it has to carry THE SAME thing. */
  function mirrorForScreenReaders() {
    var c = PLACE[current].architecture;
    /* It has to describe the page that is actually there — and with `?wall=0`
       the foot is bare, so the wall is only announced when it was built. */
    var flags = lungta.length > 0;
    var foot = wheelRow.length ? ', with a row of prayer wheels at its foot' : '';
    var acts = [];
    if (flags) acts.push('through the lines to stir the flags and hear the cloth');
    if (wheelRow.length) acts.push('along the wheels to turn them');
    document.getElementById('srtext').innerHTML =
      '<h2>' + c.en + ' — ' + c.ne + '</h2>' +
      '<p>' + c.en + ' at night' +
      (flags ? ', strung with prayer flags' : '') + foot + '.' +
      (acts.length ? ' Move the pointer ' + acts.join(', or ') + '.' : '') +
      '</p>';
  }

  /* ---- physics ------------------------------------------------------------ */

  function windAt(now, phase) {
    return (Math.sin(now * 0.31 + phase) * 0.55 +
            Math.sin(now * 0.13 + phase * 1.7) * 0.45 +
            Math.sin(now * 0.74 + phase * 0.6) * 0.16) * WIND;
  }

  /* One box per drum, so walking a hand along the rack whirrs them one at a
     time in the order your hand meets them. A wheel only speaks when it is
     being turned — rightward, over the rack — so drifting back over the row is
     silent, which is what the real object does too. */
  function wheelAt(x) {
    if (!wheelRow.length) return -1;
    var half = wheelSpan * 0.5;
    for (var i = 0; i < wheelRow.length; i++) {
      if (x >= wheelRow[i].x - half && x <= wheelRow[i].x + half) return i;
    }
    return -1;
  }

  function pollWheels(nowS, onRack, rightward) {
    if (!drive) return;
    if (!onRack || !rightward) { drive.last = -1; return; }
    var w = wheelAt(pointer.x);
    if (w < 0) { drive.last = -1; return; }
    if (w !== drive.last) {
      /* one whirr per drum entered, floored in time so a flick along the row
         is a run of wheels rather than a single smear */
      if (nowS >= drive.nextAt) {
        var v = Math.max(0.2, Math.min(1, pointer.vx / 30));
        bells.whirr(v, (wheelRow[w].x / W) * 1.7 - 0.85);
        drive.nextAt = nowS + 0.075;
        drive.count++;
      }
      drive.last = w;
    }
  }

  function physics(dt) {
    time += dt;
    /* The flutter runs faster when there is more air in the fan, so a hand
       through the flags speeds the wave up as well as widening it — that pair
       is what makes a gust read as a gust rather than as the volume changing.
       windLevel is last step's, which is a frame behind and does not matter at
       this rate. */
    flutPhase += dt * (RATE + 2.1 * windLevel);
    var now = performance.now();
    var i;

    /* The cloth acts only while the hand is MOVING, or a cursor left sitting in
       a flag line holds a permanent bulge in it. Pointer velocity decays every
       frame, so the lines let go on their own shortly after the hand stops. */
    var grip = 0;
    if (pointer.active) {
      grip = Math.min(1, (Math.abs(pointer.vx) + Math.abs(pointer.vy) * 0.6) / 9);
    }



    for (i = 0; i < lungta.length; i++) {
      var lc = lungta[i];
      lc.addWind(windAt(time, lc.phase) * 1.15, 0.35);
      if (grip > 0.01) {
        lc.applyPointer(pointer.x, pointer.y, pointer.vx, pointer.vy,
                        Flutter.R, 170, 700 * grip);
      }
      lc.integrate(dt, 0.988, GRAVITY);
      lc.relax(3);
    }

    /* and the flags, which sound on every crown that flies them. See
       flutter.js — the trigger reads the HAND rather than the cord's motion,
       and the reason that is not the other way round is written down there. */
    windLevel = Flutter.poll(lungta, pointer, Flutter.speed(pointer),
                             time, W, bells);

    /* Proximity, not a hit test: a hard in-or-out boundary on something that is
       a soft glow to begin with reads as a light switch. Eased in PHYSICS
       rather than in render, so the glow comes up at the same speed on a slow
       machine as a fast one. */
    if (lantern) {
      var want = 0;
      if (pointer.active) {
        var reach = lantern.r * 0.85;
        var ldx = pointer.x - lantern.x, ldy = pointer.y - lantern.y;
        var ld = Math.sqrt(ldx * ldx + ldy * ldy);
        if (ld < reach) { var q2 = 1 - ld / reach; want = q2 * q2; }
      }
      lanternLit += (want - lanternLit) * (want > lanternLit ? 0.05 : 0.02);
    }

    /* ---- the wheels --------------------------------------------------------
     * EACH DRUM CARRIES ITS OWN MOMENTUM. One shared angle on one shared speed
     * moves the row as a unit — push one and all seven answer. A real rack does
     * not: you walk it, and what you leave behind is seven drums at seven
     * speeds, each coasting down from whenever your hand was on it. So every
     * wheel integrates its own angular velocity, and nothing but the hand over
     * it and friction touches that.
     *
     * ONE DIRECTION ONLY. A prayer wheel is turned clockwise, which from where
     * you stand is left to right. A leftward hand does not reverse the drum, it
     * BRAKES it — what a palm laid against a turning wheel does.
     * -------------------------------------------------------------------- */
    if (drive) {
      var rightward = pointer.active && pointer.vx > 0.6;
      var leftward  = pointer.active && pointer.vx < -0.6;

      var onRack = false;
      if (pointer.active && rackBox) {
        var pad = 46;
        onRack = pointer.x > rackBox.x - pad && pointer.x < rackBox.x + rackBox.w + pad &&
                 pointer.y > rackBox.y - pad && pointer.y < rackBox.y + rackBox.h + pad;
      }

      /* The hand's contribution, in the drum's units. This is a UNIT
         CONVERSION rather than a taste knob: pointer.v is px per pointer
         EVENT and events arrive at frame rate, so 0.02 puts a brisk pass
         (~20px an event) at the speed the row is meant to reach. */
      var hand = (onRack && rightward) ? pointer.vx * 0.020 : 0;

      for (var wi2 = 0; wi2 < wheelRow.length; wi2++) {
        var wh = wheelRow[wi2];

        /* How much of the hand this drum gets. A palm is a little wider than
           one barrel, so the reach is most of the pitch and falls off across
           it: the drum under your hand takes nearly all of it and the next one
           picks up a fraction, which is what makes the row spin up in SEQUENCE.
           Widen this and the seven converge on one speed again. */
        if (hand > 0) {
          var gap = Math.abs(pointer.x - wh.x) / (wheelSpan * 0.9);
          if (gap < 1) wh.vel += hand * (1 - gap * gap) * MANI_INERTIA;
        }

        /* A palm laid against a turning drum from the other side. It brakes
           hard and it cannot push the wheel past zero into reverse. */
        if (leftward && onRack &&
            Math.abs(pointer.x - wh.x) < wheelSpan * 0.75) {
          wh.vel *= 0.90;
        }

        wh.vel *= MANI_FRICTION;
        if (wh.vel > MANI_MAX) wh.vel = MANI_MAX;
        if (wh.vel < MANI_STICTION) wh.vel = 0;
        wh.spin += wh.vel;
      }

      pollWheels(time, onRack, rightward);
    }
  }

  /* ---- drawing ------------------------------------------------------------ */

  /* A prayer flag is sewn to the cord along its TOP EDGE and the cloth then
     hangs plumb — it does not sit square to the line. So the transform is a
     shear, not a rotation: the x-axis runs along the cord, the y-axis stays
     world-vertical no matter how steeply the line falls. Rotating them to the
     tangent glues them on like bunting.
     The cloth also trails whatever the cord is doing, so lateral velocity
     leans the hang, and gravity pulls it back to plumb when the line stills. */
  function drawLungta(lc, idx) {
    var cols = lc.cols, i;
    // the cord: row 0 of the sheet
    ctx.lineCap = 'round';
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(150,120,74,0.9)' : 'rgba(38,26,14,0.65)';
      ctx.lineWidth = pass ? 1.2 : 2.4;
      ctx.beginPath();
      ctx.moveTo(lc.x[0], lc.y[0]);
      for (i = 1; i < cols - 1; i++) {
        ctx.quadraticCurveTo(lc.x[i], lc.y[i],
                             (lc.x[i] + lc.x[i + 1]) / 2, (lc.y[i] + lc.y[i + 1]) / 2);
      }
      ctx.lineTo(lc.x[cols - 1], lc.y[cols - 1]);
      ctx.stroke();
    }

    /* Every flag is placed and oriented BY THE SHEET. sampleRow returns the
       point on the cord, the unit tangent along it, and the unit vector down to
       the free lower edge — exactly the two basis vectors the cloth is drawn
       in, so the lean and the skew are simulated rather than guessed at. */
    var L = lc.rowLength(0), k = 0;
    var fw = flagDraw, fh = fw * (FLAG_H / FLAG_W);
    /* bare cord for a stretch off the summit — starting at the anchor ties
       every line into one dense knot up there */
    for (var dist = fw * 3.6; dist < L - fw; dist += fw * 1.06, k++) {
      lc.sampleRow(0, dist, SAMP);
      var sprite = flagCv[(k + idx) % flagCv.length];
      if (!sprite) continue;
      var tx = SAMP.tx, ty = SAMP.ty;
      // a line running leftward has a tangent pointing back at the summit,
      // which would hang the cloth from its hem
      if (tx < 0) { tx = -tx; ty = -ty; }
      var seed = (k * 7 + idx * 11) % 9;
      var sc = 0.94 + seed * 0.018;

      /* ---- the flutter ------------------------------------------------------
       * Done on the FLAG, not as a force on the cord, because the cord cannot
       * answer one: pinned at both ends with three percent slack it is a taut
       * cable, and a force large enough to move it visibly would throw the
       * whole line about. A real lungta line is the same — the rope barely
       * stirs and the cloth does all the moving.
       *
       * So each flag turns about the cord it is sewn to, on a wave travelling
       * along the line and THROUGH THE FLAG. The turn is sampled at each strip
       * boundary rather than once per square, so one edge can be coming toward
       * you while the other goes away; that is the difference between cloth and
       * a rocking board, and why this is a loop rather than one transform. Two
       * terms at unrelated rates keep the row out of a visible pulse.
       *
       * ---- THE STRIPS MUST NOT BE VISIBLE ------------------------------------
       * A prayer flag is one piece of cloth; the moment you can SEE where it
       * was cut up, the technique has failed. Two ways to break it:
       *
       *   HANGING EACH STRIP AT ITS OWN ANGLE. Rotating the hang vector per
       *   strip is torsion — it pivots each strip about its own top corner, so
       *   they fan apart and the lower edge becomes a row of kinks. A rippling
       *   flag is a DEVELOPABLE surface: its vertical lines stay parallel and
       *   only the spacing between them varies. So there is ONE hang vector for
       *   the whole flag and the wave lives entirely in the strip widths.
       *
       *   OVERLAPPING THE DESTINATION ALONE. Coincident edges still seam —
       *   both strips antialias against the sky, and two half-covered edges
       *   make a three-quarter-covered pixel. Widening the destination without
       *   the SOURCE stretches this strip's own content; widened together it
       *   carries the neighbour's actual pixels at this strip's scale, so the
       *   join is sub-pixel and the next strip paints over it anyway.
       * ---------------------------------------------------------------------- */
      var ph = dist * 0.026 - flutPhase + lc.phase;
      /* A hand in the fan widens the wave as well as speeding it up. Half
         again at a full gust, which is the top of what the cloth can take
         before the wedging above sets in. */
      var amp = FLUTTER * (1 + 0.5 * windLevel);

      /* Sample the turn at every strip boundary, and accumulate the projected
         width as we go: POS[b] is where boundary b lands along the tangent, in
         flag-widths, before centring. */
      var nb = SLICES, mean = 0;
      for (var b = 0; b <= nb; b++) {
        var p = ph + (b / nb) * WAVE;
        var turn = Math.sin(p) * 0.62 + Math.sin(p * 1.87 + seed) * 0.38;
        SWING[b] = turn * amp;
        mean += SWING[b];
      }
      mean /= nb + 1;
      POS[0] = 0;
      for (b = 0; b < nb; b++) {
        // the strip's own foreshortening, from the mean of its two edges
        POS[b + 1] = POS[b] +
          Math.cos((SWING[b] + SWING[b + 1]) * 0.5) / nb;
      }
      var half = POS[nb] * 0.5;

      /* ONE hang vector for the whole flag, off the mean of the turn — see the
         note above. */
      var cs = Math.cos(mean), sn = Math.sin(mean);
      var hx = (SAMP.hx * cs - SAMP.hy * sn) * fh * sc;
      var hy = (SAMP.hx * sn + SAMP.hy * cs) * fh * sc;

      /* One alpha for the whole flag, off its mean foreshortening. Per-strip
         shading would be more correct, but at three strips it bands, which is
         worse than being flat. */
      ctx.globalAlpha = (0.88 + (seed % 3) * 0.04) * (0.84 + 0.16 * POS[nb]);
      var ux = tx * fw * sc, uy = ty * fw * sc;         // one flag-width, in px
      var sw = sprite.width / nb;
      for (b = 0; b < nb; b++) {
        var w0 = POS[b] - half, wid = POS[b + 1] - POS[b];
        // a tenth of a strip of the NEXT one's pixels, to deny the antialiaser
        // a seam. None on the last, so the flag's outer edge stays exact.
        var over = b < nb - 1 ? sw * 0.1 : 0;

        ctx.save();
        ctx.transform(ux * wid, uy * wid, hx, hy,
                      SAMP.x + ux * w0, SAMP.y + uy * w0);
        ctx.drawImage(sprite, sw * b, 0, sw + over, sprite.height,
                      0, -0.06, 1 + over / sw, 1);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---- the mani wall ------------------------------------------------------
   * Aged copper drums in a dark carved rail: two registers of raised script
   * divided by mouldings, one soft specular down the barrel. Drawn for a side
   * view — you never look into the top of a drum, so a cap shows its flare and
   * only a sliver of the face above it.
   *
   * Not red paint and bright brass but old copper gone almost black in the
   * recesses, so what you read is the RAISED work catching a warm light against
   * it. That inversion is most of the difference.
   * ---------------------------------------------------------------------- */

  var W_CU_HI  = '#E8B888';
  var W_CU_LIT = '#C08050';
  var W_CU     = '#8A5430';
  var W_CU_MID = '#5C3520';
  var W_CU_DK  = '#2A1710';
  var W_LINE = 'rgba(30,14,6,0.85)';

  /* A collar on a drum, seen from the side: a flared cap, widest at the lip
   * where it overhangs and drawing in to a small face. `up` mirrors it for the
   * foot.
   *
   * The rule: from the side you only ever see HALF of any rim — the near half
   * of the lip (bulging down toward you) and the far half of the top face
   * (bulging up and away). Drawing either as a complete ellipse is a top-down
   * cue that makes the cap read as pasted on however well it is shaded, so the
   * silhouette is those two half-arcs and the flare between them, and nothing
   * closes into a ring. The foot's underside is not visible at all, so where it
   * meets the drum is just a straight line. */
  function metalCollar(cx, yA, rw, h, up) {
    var rOut = rw * 1.12, rIn = rw * 0.80;
    var ryOut = rOut * 0.15, ryIn = rIn * 0.15;
    var sgn = up ? -1 : 1;
    var yB = yA + sgn * h;

    var body = ctx.createLinearGradient(cx - rOut, 0, cx + rOut, 0);
    body.addColorStop(0,    '#1E1008');
    body.addColorStop(0.14, W_CU_MID);
    body.addColorStop(0.34, W_CU_LIT);
    body.addColorStop(0.44, W_CU_HI);
    body.addColorStop(0.58, W_CU);
    body.addColorStop(0.82, W_CU_MID);
    body.addColorStop(1,    '#1A0D06');

    function silhouette() {
      ctx.beginPath();
      ctx.moveTo(cx - rOut, yA);
      ctx.quadraticCurveTo(cx - rOut * 0.98, yA + sgn * h * 0.55, cx - rIn, yB);
      if (up) {
        // far half of the top face, bulging up and away
        ctx.ellipse(cx, yB, rIn, ryIn, 0, Math.PI, 0, false);
        ctx.quadraticCurveTo(cx + rOut * 0.98, yA + sgn * h * 0.55, cx + rOut, yA);
        // near half of the lip, bulging down toward the viewer
        ctx.ellipse(cx, yA, rOut, ryOut, 0, 0, Math.PI, false);
      } else {
        // near half of the foot rim, bulging down
        ctx.ellipse(cx, yB, rIn, ryIn, 0, Math.PI, 0, true);
        ctx.quadraticCurveTo(cx + rOut * 0.98, yA + sgn * h * 0.55, cx + rOut, yA);
        ctx.lineTo(cx - rOut, yA);       // hidden behind the drum
      }
      ctx.closePath();
    }

    silhouette();
    ctx.fillStyle = body; ctx.fill();
    ctx.strokeStyle = W_LINE; ctx.lineWidth = 1.1; ctx.stroke();

    // engraved hatching, following the flare
    ctx.save(); silhouette(); ctx.clip();
    ctx.strokeStyle = 'rgba(18,8,3,0.42)'; ctx.lineWidth = 0.9;
    for (var hx = -rOut; hx < rOut; hx += 4.2) {
      ctx.beginPath();
      ctx.moveTo(cx + hx, yA);
      ctx.lineTo(cx + hx + sgn * 2.2, yB);
      ctx.stroke();
    }
    // the flare turns under near the lip, so it darkens there
    var turn = ctx.createLinearGradient(0, yA - sgn * h * 0.5, 0, yA + sgn * ryOut);
    turn.addColorStop(0, 'rgba(30,18,4,0)');
    turn.addColorStop(1, 'rgba(30,18,4,0.45)');
    ctx.fillStyle = turn;
    ctx.fillRect(cx - rOut, Math.min(yA + sgn * ryOut, yA - sgn * h), rOut * 2, h + ryOut * 2);
    ctx.restore();

    if (up) {
      // the top face: a shallow ellipse, and this one IS whole, because you
      // are looking slightly down onto it
      var f = ctx.createLinearGradient(0, yB - ryIn, 0, yB + ryIn);
      f.addColorStop(0, W_CU_HI);
      f.addColorStop(0.55, W_CU_LIT);
      f.addColorStop(1, W_CU_MID);
      ctx.fillStyle = f;
      ctx.beginPath(); ctx.ellipse(cx, yB, rIn, ryIn, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = W_LINE; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(cx, yB, rIn, ryIn, 0, 0, Math.PI * 2); ctx.stroke();

      // the lip overhangs, so its underside is in shadow and it casts
      ctx.fillStyle = 'rgba(28,12,4,0.42)';
      ctx.beginPath();
      ctx.ellipse(cx, yA, rOut, ryOut, 0, 0, Math.PI, false);
      ctx.ellipse(cx, yA - 1.6, rOut, ryOut, 0, Math.PI, 0, true);
      ctx.fill();
    }
  }

  function glyph(x, y, sc, seed) {
    ctx.lineWidth = 1.5 * sc; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 3.4 * sc, y - 3.4 * sc);
    ctx.lineTo(x + 3.4 * sc, y - 3.4 * sc);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 1.6 * sc, y - 3.4 * sc);
    ctx.quadraticCurveTo(x - 3 * sc, y + 0.6 * sc, x - 0.4 * sc, y + 2.2 * sc);
    ctx.stroke();
    if (seed % 2) {
      ctx.beginPath();
      ctx.moveTo(x + 2 * sc, y - 3.4 * sc); ctx.lineTo(x + 2 * sc, y + 1.4 * sc);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x + 1.8 * sc, y + 0.2 * sc, 1.6 * sc, -0.6, 2.4);
      ctx.stroke();
    }
  }

  /* ---- SAL --------------------------------------------------------------
   * Shorea robusta: the timber a Newar beam is cut from, and why the woodwork
   * here is warm rather than neutral. A dense red-brown that oxidises almost to
   * black in the recesses and keeps a coppery flash where light catches it, and
   * its grain is coarse and straight with long open pores — which is what the
   * ruled figure below draws, not a wood-effect texture.
   *
   * One palette for every carved member: the two rails are the same piece of
   * joinery seen twice, and two sets of colours would put the top of the object
   * in one wood and the bottom in another.
   * -------------------------------------------------------------------- */
  var SAL = {
    lit:  '#7A4A28',       // the arris that catches the lamp
    face: '#4A2C18',       // the flat of the plank
    body: '#2E1A0E',
    deep: '#180D06',
    dark: '#0A0503',       // the bottom of a cut
    pore: 'rgba(168,116,70,0.10)',
    arris: 'rgba(198,148,94,0.28)',
    groove: 'rgba(4,2,1,0.85)'
  };

  /* What the carving functions are cutting in. A module-level name rather than
     an argument on carvedRail, because it has to reach the relief() closures
     and the grain pass inside them as well as the fills. */
  var WOOD = SAL;
  var BRASS = {
    lit:  '#F0D089',
    face: '#C9922F',
    body: '#8A6420',
    deep: '#4A340E'
  };

  /* A Newar carved rail, in Sal. The vocabulary is what sits on a torana or a
   * window frame: a bead-and-reel fillet along the head, a running vine (lata)
   * with a rosette at every node, and a lotus-petal course along the foot.
   *
   * Relief is faked the way the carving reads — every cut gets a lit arris
   * up-and-left and a black groove down-and-right. One flat outline in a
   * lighter colour reads as a drawing ON the timber rather than a cut INTO it.
   *
   * `courses`: 'shallow' drops the lotus course, because a member half the
   * depth cannot carry three registers without them running into each other. */
  function carvedRail(g, x0, x1, cy, h, courses) {
    var top = cy - h / 2, bot = cy + h / 2, wdt = x1 - x0;
    var full = courses !== 'shallow';

    var grd = g.createLinearGradient(0, top, 0, bot);
    grd.addColorStop(0,    WOOD.lit);
    grd.addColorStop(0.16, WOOD.face);
    grd.addColorStop(0.62, WOOD.body);
    grd.addColorStop(1,    WOOD.dark);
    g.fillStyle = grd;
    g.fillRect(x0, top, wdt, h);

    g.save();
    g.beginPath(); g.rect(x0, top, wdt, h); g.clip();

    /* The grain. Sal is coarse and STRAIGHT — long open pores running the
       length of the plank — so the figure is near-parallel rules with a shallow
       bow, not the swirl a figured wood would have. */
    g.strokeStyle = WOOD.pore; g.lineWidth = 0.7;
    for (var gy = top + 1.5; gy < bot; gy += 2.4) {
      g.beginPath();
      g.moveTo(x0, gy);
      g.bezierCurveTo(x0 + wdt * 0.3, gy + 1.1, x0 + wdt * 0.7, gy - 1.1, x1, gy + 0.3);
      g.stroke();
    }

    function relief(draw) {
      g.save(); g.translate(-0.7, -0.7);
      g.strokeStyle = WOOD.arris; draw(); g.restore();
      g.save(); g.translate(0.9, 0.9);
      g.strokeStyle = WOOD.groove; draw(); g.restore();
    }

    var fy = top + h * (full ? 0.17 : 0.20);                  // bead and reel
    g.lineWidth = 1.1;
    relief(function () {
      g.beginPath();
      for (var bx = x0 + 5; bx < x1; bx += 12) {
        g.moveTo(bx + 1.9, fy);
        g.arc(bx, fy, 1.9, 0, Math.PI * 2);
        g.moveTo(bx + 3.6, fy - 1.4); g.lineTo(bx + 5.6, fy - 1.4);
        g.moveTo(bx + 3.6, fy + 1.4); g.lineTo(bx + 5.6, fy + 1.4);
      }
      g.stroke();
    });

    var vy = top + h * (full ? 0.52 : 0.62), amp = h * 0.15, per = 36;
    g.lineWidth = 1.5;
    relief(function () {
      g.beginPath();
      for (var vx = x0; vx < x1; vx += per) {
        g.moveTo(vx, vy);
        g.bezierCurveTo(vx + per * 0.22, vy - amp * 2.1,
                          vx + per * 0.50, vy - amp, vx + per * 0.50, vy);
        g.bezierCurveTo(vx + per * 0.50, vy + amp,
                          vx + per * 0.78, vy + amp * 2.1, vx + per, vy);
      }
      g.stroke();
    });
    g.lineWidth = 1;
    relief(function () {                                      // rosette per node
      g.beginPath();
      for (var rx = x0 + per * 0.5; rx < x1; rx += per) {
        g.moveTo(rx + 2.5, vy);
        g.arc(rx, vy, 2.5, 0, Math.PI * 2);
        for (var pt = 0; pt < 6; pt++) {
          var a = (pt / 6) * Math.PI * 2;
          g.moveTo(rx, vy);
          g.lineTo(rx + Math.cos(a) * 2.5, vy + Math.sin(a) * 2.5);
        }
      }
      g.stroke();
    });

    if (full) {                                               // lotus petals
      var ly = bot - h * 0.11, lw = 11;
      g.lineWidth = 1.2;
      relief(function () {
        g.beginPath();
        for (var px = x0; px < x1; px += lw) {
          g.moveTo(px, ly + 2.4);
          g.quadraticCurveTo(px + lw * 0.5, ly - 4.8, px + lw, ly + 2.4);
        }
        g.stroke();
      });
    }

    g.restore();

    g.fillStyle = 'rgba(224,178,124,0.22)';
    g.fillRect(x0, top, wdt, 1.3);
    g.fillStyle = 'rgba(6,3,1,0.6)';
    g.fillRect(x0, bot - 1.5, wdt, 1.5);
    g.strokeStyle = 'rgba(10,5,2,0.8)'; g.lineWidth = 1.2;
    g.strokeRect(x0, top, wdt, h);
  }

  function drawWheelRow() {
    if (!wheelRow.length || !drive) return;
    var y = wheelRow[0].y, rw = 23, rh = 52, capH = 7;
    var x0 = wheelRow[0].x - rw - 34, x1 = wheelRow[wheelRow.length - 1].x + rw + 34;
    var railH = 22;
    var railTop = y - rh / 2 - capH - 22, railBot = y + rh / 2 + capH + 22;

    /* The rack is baked once per layout and blitted: re-cutting the vine, the
       rosettes, the bead-and-reel and the lotus course every frame — each
       stroked twice for relief — was several hundred path operations for an
       image that never changes. Only the drums are live. */
    if (rackCv) ctx.drawImage(rackCv, rackBox.x, rackBox.y, rackBox.w, rackBox.h);

    var topBand = y - rh * 0.34, botBand = y + rh * 0.34;
    var midA = y - rh * 0.055, midB = y + rh * 0.055;
    var reg1 = (topBand + midA) / 2, reg2 = (midB + botBand) / 2;

    for (var i = 0; i < wheelRow.length; i++) {
      var wx = wheelRow[i].x;

      var aura = ctx.createRadialGradient(wx, y, 0, wx, y, 108);
      aura.addColorStop(0, 'rgba(198,124,64,0.12)');
      aura.addColorStop(1, 'rgba(198,124,64,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(wx, y, 108, 0, Math.PI * 2); ctx.fill();

      /* Aged copper, not paint. The drum is a dark body with the raised work
         catching a warm light — so the ground is nearly black and the script
         is the lightest thing on it. */
      var body = ctx.createLinearGradient(wx - rw, 0, wx + rw, 0);
      body.addColorStop(0,    '#150A05');
      body.addColorStop(0.14, '#38200F');
      body.addColorStop(0.34, '#6B4023');
      body.addColorStop(0.46, '#8A5433');
      body.addColorStop(0.60, '#623920');
      body.addColorStop(0.84, '#2B170C');
      body.addColorStop(1,    '#0F0603');
      ctx.fillStyle = body;
      ctx.fillRect(wx - rw, y - rh / 2, rw * 2, rh);

      ctx.save();
      ctx.beginPath(); ctx.rect(wx - rw, y - rh / 2, rw * 2, rh); ctx.clip();

      // the sunk ground each register of script stands out of
      ctx.fillStyle = 'rgba(14,7,3,0.52)';
      ctx.fillRect(wx - rw, topBand, rw * 2, midA - topBand);
      ctx.fillRect(wx - rw, midB, rw * 2, botBand - midB);

      /* This drum's own angle, not the row's. See the physics — each barrel
         coasts down from whenever the hand was last on it, so the script on
         one can be halfway round while its neighbour has stopped. */
      var period = 15;
      var off = (((wheelRow[i].spin + wheelRow[i].phase) % period) + period) % period;
      for (var m = -2; m < 7; m++) {
        var mx = wx - rw + m * period - off + period / 2;
        ctx.strokeStyle = 'rgba(14,6,2,0.85)';          // the groove under it
        glyph(mx + 1.1, reg1 + 1.1, 1.7, m + i);
        glyph(mx + 1.1, reg2 + 1.1, 1.7, m + i + 2);
        ctx.strokeStyle = 'rgba(232,176,118,0.95)';     // the lit raised face
        glyph(mx, reg1, 1.7, m + i);
        glyph(mx, reg2, 1.7, m + i + 2);
      }

      // the fine course between the two registers
      ctx.lineWidth = 1;
      for (var f2 = -3; f2 < 14; f2++) {
        var fx = wx - rw + f2 * 5.6 - off * 0.37;
        ctx.strokeStyle = 'rgba(12,5,2,0.7)';
        ctx.beginPath();
        ctx.moveTo(fx + 0.9, midA + 2.2); ctx.lineTo(fx + 0.9, midB - 1.4);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(214,158,104,0.6)';
        ctx.beginPath();
        ctx.moveTo(fx, midA + 1.6); ctx.lineTo(fx, midB - 2);
        ctx.stroke();
      }

      var spec = ctx.createLinearGradient(wx - rw, 0, wx + rw, 0);
      spec.addColorStop(0,    'rgba(10,4,1,0.55)');
      spec.addColorStop(0.30, 'rgba(255,206,158,0.06)');
      spec.addColorStop(0.42, 'rgba(255,224,188,0.20)');
      spec.addColorStop(0.54, 'rgba(255,206,158,0.04)');
      spec.addColorStop(1,    'rgba(10,4,1,0.5)');
      ctx.fillStyle = spec;
      ctx.fillRect(wx - rw, y - rh / 2, rw * 2, rh);
      ctx.restore();

      // the raised mouldings, in the same metal as the drum
      [[topBand, 3.6], [midA, 2.2], [midB, 2.2], [botBand, 3.6]]
        .forEach(function (bd) {
          var bg = ctx.createLinearGradient(wx - rw, 0, wx + rw, 0);
          bg.addColorStop(0,    '#20110A');
          bg.addColorStop(0.16, '#5C3520');
          bg.addColorStop(0.38, '#A46B3E');
          bg.addColorStop(0.48, '#C88C56');
          bg.addColorStop(0.64, '#8A5430');
          bg.addColorStop(1,    '#1C0F08');
          ctx.fillStyle = bg;
          ctx.fillRect(wx - rw, bd[0] - bd[1] / 2, rw * 2, bd[1]);
          ctx.fillStyle = 'rgba(240,196,146,0.34)';
          ctx.fillRect(wx - rw, bd[0] - bd[1] / 2, rw * 2, 0.9);
          ctx.fillStyle = 'rgba(8,3,1,0.55)';
          ctx.fillRect(wx - rw, bd[0] + bd[1] / 2 - 0.9, rw * 2, 0.9);
        });

      ctx.strokeStyle = W_LINE; ctx.lineWidth = 1.2;
      ctx.strokeRect(wx - rw, y - rh / 2, rw * 2, rh);

      metalCollar(wx, y - rh / 2, rw, capH, true);
      metalCollar(wx, y + rh / 2, rw, capH, false);
    }
  }

  function drawLanternGlow() {
    if (!lantern || lanternLit < 0.004) return;
    var k = lanternLit;
    ctx.globalCompositeOperation = 'lighter';
    var g1 = ctx.createRadialGradient(lantern.x, lantern.y, 0,
                                      lantern.x, lantern.y, lantern.r * 1.25);
    g1.addColorStop(0, 'rgba(255,225,158,' + (0.30 * k).toFixed(3) + ')');
    g1.addColorStop(0.45, 'rgba(240,190,110,' + (0.10 * k).toFixed(3) + ')');
    g1.addColorStop(1, 'rgba(240,190,110,0)');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(lantern.x, lantern.y, lantern.r * 1.25, 0, Math.PI * 2);
    ctx.fill();

    var cr = lantern.r * 0.30;
    var g2 = ctx.createRadialGradient(lantern.x, lantern.y, 0, lantern.x, lantern.y, cr);
    g2.addColorStop(0, 'rgba(255,248,222,' + (0.38 * k).toFixed(3) + ')');
    g2.addColorStop(1, 'rgba(255,236,180,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(lantern.x, lantern.y, cr, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  /* Order is the whole illusion. The flag lines are drawn BEHIND the building
     so the near halves of them pass in front of nothing and the far halves
     disappear behind the dome, and the mani wall goes down last because it is
     the object nearest the eye. */
  function render() {
    drawSky();
    for (var i = 0; i < lungta.length; i++) drawLungta(lungta[i], i);
    ctx.drawImage(crownCv, 0, 0, W, crownH);
    drawLanternGlow();
    drawWheelRow();
  }

  /* ---- loop ---------------------------------------------------------------- */
  var last = performance.now(), acc = 0;
  /* exposed so frame cost can be read without a profiler */
  var perf = window.__perf = { draw: 0, frame: 0, phys: 0, steps: 0 };
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now; acc += dt;
    var guard = 0;
    var tp = performance.now();
    /* Before the physics, not after: the step that runs this frame should act
       on where the hand has got to this frame. */
    stepPointer();
    /* Cap hard at 3. At 8 a slow frame buys itself more physics steps,
       which makes the next frame slower still — the classic death spiral. */
    while (acc >= STEP && guard < 3) { physics(STEP); acc -= STEP; guard++; }
    if (acc > STEP * 3) acc = 0;
    perf.phys = perf.phys * 0.92 + (performance.now() - tp) * 0.08;
    perf.steps = perf.steps * 0.92 + guard * 0.08;
    var t0 = performance.now();
    render();
    if (!markBox.hidden) placeMarks();
    perf.draw = perf.draw * 0.92 + (performance.now() - t0) * 0.08;
    perf.frame = perf.frame * 0.92 + dt * 1000 * 0.08;
    requestAnimationFrame(frame);
  }

  /* ---- input / chrome ------------------------------------------------- */

  /* ---- getting the audio started ------------------------------------------
   * A browser will not let a page make a sound until it has had a GESTURE, and
   * a gesture means a press. This page's whole interaction is hover — a hand
   * over the flags and along the drums — so a visitor could sweep the field for
   * a minute and conclude it was silent.
   *
   * Three things between that and silence:
   *
   *   Every press tries, wherever it lands.
   *
   *   MOVING tries too. It is refused for free on a page never pressed, but a
   *   context suspended by a background tab comes back on the next stir of the
   *   hand rather than needing another click. resume() is idempotent, and the
   *   guard below makes this one boolean test per event once it is running.
   *
   *   And if it is still not running, the SOUND BUTTON breathes until the audio
   *   is live — the one thing moving on a still page is the one worth pressing.
   * ---------------------------------------------------------------------- */
  function live() { return !!(bells.ctx && bells.ctx.state === 'running'); }

  var wakePending = false;
  function wake() {
    if (live()) return;
    bells.init(); bells.resume();
    /* The state does not change synchronously — resume() is a promise on some
       engines — so the button is repainted a moment later rather than now. One
       timer at a time: this runs on every pointer move until the audio is up,
       and a fresh timeout per move would queue hundreds of repaints. */
    if (wakePending) return;
    wakePending = true;
    setTimeout(function () { wakePending = false; paintChrome(); }, 160);
  }
  /* An event only ever moves the TARGET. The position and the velocity are the
     frame loop's, at the frame loop's regular interval — which is the point. */
  function movePointer(x, y) {
    if (pointer.tx < -9000) { pointer.x = x; pointer.y = y; }
    pointer.tx = x; pointer.ty = y;
    pointer.active = true;
  }

  /* Once a frame, before the physics that reads it. */
  function stepPointer() {
    if (!pointer.active) { pointer.vx *= 0.80; pointer.vy *= 0.80; return; }
    var ex = (pointer.tx - pointer.x) * PTR_EASE;
    var ey = (pointer.ty - pointer.y) * PTR_EASE;
    pointer.x += ex; pointer.y += ey;
    /* Velocity in px per frame, the units everything downstream was tuned in,
       measured off the eased motion. A second light smoothing: the easing has
       taken the spikes out, this takes out the last of the stepping. */
    pointer.vx = pointer.vx * 0.55 + ex * 0.45;
    pointer.vy = pointer.vy * 0.55 + ey * 0.45;
  }
  window.addEventListener('pointermove', function (e) {
    wake(); movePointer(e.clientX, e.clientY);
  });
  window.addEventListener('pointerdown', function (e) { wake(); movePointer(e.clientX, e.clientY); });
  /* Three ways the hand can leave, and all have to drop the field —
     pointerleave alone misses focus going to another window with the cursor
     still over the canvas. The velocity is left to stepPointer to bleed off
     rather than zeroed here, so a hand leaving mid-sweep lets go of the cloth
     the way it would if it had merely stopped. */
  function release() {
    pointer.active = false;
    pointer.tx = -9999; pointer.ty = -9999;
  }
  document.addEventListener('pointerleave', release);
  window.addEventListener('blur', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', wake, { once: true });
  var langBtn = document.getElementById('lang');
  var soundBtn = document.getElementById('sound');
  var aboutBtn = document.getElementById('aboutBtn');
  var aboutBox = document.getElementById('about');
  function paintChrome() {
    var u = UI[lang];
    document.getElementById('eyebrow').textContent = u.eyebrow;
    /* The crown-looking view has nothing under the building, so it must not
       invite anyone to spin drums that are not there. */
    document.getElementById('hint').textContent =
      hasRack() ? u.hint.stupa : u.hint.bare;
    /* the name of the building, and what it is */
    var pl = PLACE[current];
    var plate = document.getElementById('plate');
    plate.hidden = !pl;
    if (pl) {
      document.getElementById('placeName').textContent = pl.name[lang] || pl.name.en;
      /* Falls back to English per FIELD rather than per entry, so a plate that
         has a name in both scripts and a paragraph in one still shows the
         translated name instead of dropping the whole block back to English. */
      document.getElementById('placeBody').textContent = pl.body[lang] || pl.body.en;
    }

    soundBtn.textContent = u.sound + (bells.muted ? ' ✕' : ' ●');
    /* breathing until there is actually audio to hear — see wake() */
    soundBtn.classList.toggle('is-idle', !live() && !bells.muted);
    langBtn.textContent = lang === 'en' ? 'नेपाली' : 'English';
    /* Only the button label switches. The card behind it is a person writing
       about herself, so its Nepali is hers to write, not this file's. */
    aboutBtn.textContent = u.about;
    document.documentElement.lang = lang === 'en' ? 'en' : 'ne';
  }
  langBtn.addEventListener('click', function () {
    lang = lang === 'en' ? 'ne' : 'en';
    labelMarks();
    /* An open panel has to follow the language too. labelMarks() rewrites the
       nodes' own labels, but the card is already filled — left alone it sits
       there in the language you just switched out of. */
    if (openSpot) fillSpot(openSpot);
    build(); paintChrome();
  });
  soundBtn.addEventListener('click', function () { wake(); bells.setMuted(!bells.muted); paintChrome(); });

  /* ---- about --------------------------------------------------------------
   * Who made this. It opens over the middle of the scene rather than beside a
   * node, and it is the one panel on the page with a link in it — which is why
   * its own pointerdown is stopped here. The window-level closer below listens
   * on pointerdown, and a press inside the card would otherwise close it out
   * from under the link before the click could land.
   * ---------------------------------------------------------------------- */
  function aboutOpen() { return aboutBox.classList.contains('is-in'); }

  function openAbout() {
    closeSpot();
    aboutBox.hidden = false;
    aboutBtn.setAttribute('aria-expanded', 'true');
    /* a frame between being laid out and being told to grow — same bargain the
       hot-point card makes in openAt */
    requestAnimationFrame(function () { aboutBox.classList.add('is-in'); });
  }

  function closeAbout() {
    if (!aboutOpen()) return;
    aboutBox.classList.remove('is-in');
    aboutBtn.setAttribute('aria-expanded', 'false');
    setTimeout(function () { if (!aboutOpen()) aboutBox.hidden = true; }, 320);
  }

  /* The button swallows its own pointerdown as well, so the closer cannot fire
     between the press and the click and turn every second press into a
     reopen. */
  aboutBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  aboutBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    wake();                       // a press is a gesture, so the audio may start
    if (aboutOpen()) closeAbout(); else openAbout();
  });
  aboutBox.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  document.getElementById('aboutClose').addEventListener('click', function (e) {
    e.stopPropagation();
    closeAbout();
  });

  /* ---- the hot-points, in the page ----------------------------------------
   * The markers are real DOM buttons rather than dots on the canvas. On canvas
   * they would need their own hit testing, hover state and focus ring and would
   * still be invisible to a keyboard and a screen reader; as buttons they are
   * tabbable, announce their own names, and the hover label is two lines of
   * CSS. The canvas underneath keeps every gesture it had, because the field
   * only ever listens on `window`.
   *
   * Built once and then only MOVED — the flags' node rides a line that is
   * blowing about, and the rest travel on resize. A transform per node per
   * frame: no layout, no reflow.
   * ---------------------------------------------------------------------- */
  var markBox = document.getElementById('marks');
  var spotBox = document.getElementById('spot');
  var spotNameEl = document.getElementById('spotName');
  var spotBodyEl = document.getElementById('spotBody');
  var marks = [], openSpot = null, builtFor = null;
  /* which nodes have been opened, per building. In memory only — a record of
     this sitting, not something worth writing to a visitor's disk. */
  var opened = {};

  function buildMarks() {
    markBox.innerHTML = '';
    builtFor = current;
    marks = spotsFor().map(function (sp) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mark';
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', 'spot');
      var tip = document.createElement('span');
      tip.className = 'tip';
      b.appendChild(tip);
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleSpot(sp);
      });
      markBox.appendChild(b);
      return { def: sp, el: b, tip: tip, x: 0, y: 0 };
    });
    labelMarks();
  }

  function labelMarks() {
    marks.forEach(function (m) {
      var n = m.def.name[lang] || m.def.name.en;
      m.tip.textContent = n;
      m.el.setAttribute('aria-label', n);
    });
    if (openSpot) fillSpot(openSpot);
    paintTally();
  }

  /* Where each node is, this frame. A member the crown does not publish — or a
     line that has not been built yet — simply has no node rather than one at
     the origin. */
  function placeMarks() {
    if (!marks.length) return;
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i], at = null;
      try { at = m.def.at(); } catch (e) { at = null; }
      if (!at) { m.el.style.display = 'none'; continue; }
      if (m.el.style.display === 'none') m.el.style.display = '';
      /* half a pixel is under the resolution of a glow this soft, and skipping
         the write keeps a still scene from touching the DOM at all */
      if (Math.abs(at.x - m.x) > 0.5 || Math.abs(at.y - m.y) > 0.5) {
        m.x = at.x; m.y = at.y;
        m.el.style.transform = 'translate(' + at.x.toFixed(1) + 'px,' +
                                              at.y.toFixed(1) + 'px)';
      }
    }
  }

  /* Nodes read against nodes there are. Devanagari figures in Nepali: the page
     already draws the numeral १ on the harmika and calls it a nose, so a
     counter beside it in ASCII would be the one untranslated number here. */
  var NUM_NE = '०१२३४५६७८९';
  function figures(n) {
    var t = String(n);
    if (lang !== 'ne') return t;
    return t.replace(/[0-9]/g, function (d) { return NUM_NE.charAt(+d); });
  }

  function paintTally() {
    var el = document.getElementById('tally');
    if (!el) return;
    var all = spotsFor();
    if (!all.length) { el.hidden = true; return; }
    var seen = opened[current] || {};
    var n = 0, k;
    for (k in seen) if (seen[k]) n++;
    el.hidden = false;
    el.textContent = figures(n) + ' / ' + figures(all.length) + ' ' +
                     (lang === 'ne' ? 'खोलिएको' : 'opened');
    el.setAttribute('aria-label',
      (lang === 'ne' ? 'खोलिएका बुँदा: ' : 'Points opened: ') + n + ' / ' + all.length);
  }

  function fillSpot(sp) {
    spotNameEl.textContent = sp.name[lang] || sp.name.en;
    spotBodyEl.textContent = sp.body[lang] || sp.body.en;
  }

  /* The card opens FROM its node: the transform origin is the corner nearest
     it, so it grows out of the thing it describes rather than appearing over
     it. Kept inside the window, too. */
  function openAt(sp) {
    var m = marks.filter(function (x) { return x.def === sp; })[0];
    if (!m) return;
    closeAbout();                 // one panel at a time
    fillSpot(sp);
    spotBox.hidden = false;

    var pad = 16, gap = 18;
    var w = spotBox.offsetWidth, h = spotBox.offsetHeight;
    var right = m.x + gap, left = m.x - gap - w;
    var x = (right + w + pad < W) ? right : (left > pad ? left : Math.max(pad, (W - w) / 2));
    var y = Math.min(Math.max(pad, m.y - h * 0.35), H - h - pad);
    spotBox.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    spotBox.style.transformOrigin = (x > m.x ? 'left' : 'right') + ' ' +
                                    (m.y > y + h * 0.5 ? 'bottom' : 'top');
    /* a frame between being laid out and being told to grow, or the transition
       has nothing to run from */
    requestAnimationFrame(function () { spotBox.classList.add('is-in'); });

    marks.forEach(function (x2) {
      var on = x2.def === sp;
      x2.el.classList.toggle('is-open', on);
      x2.el.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    openSpot = sp;

    /* Counted on the first open and never again — it is how much of the
       building you have read, not how many times you pressed. */
    var seen = opened[current] || (opened[current] = {});
    if (!seen[sp.key]) { seen[sp.key] = 1; paintTally(); }
  }

  function closeSpot() {
    if (!openSpot) return;
    openSpot = null;
    spotBox.classList.remove('is-in');
    marks.forEach(function (m) {
      m.el.classList.remove('is-open');
      m.el.setAttribute('aria-expanded', 'false');
    });
    /* hidden only after it has finished shrinking, so the close is as smooth
       as the open */
    setTimeout(function () { if (!openSpot) spotBox.hidden = true; }, 320);
  }

  function toggleSpot(sp) {
    if (openSpot === sp) closeSpot();
    else openAt(sp);
  }

  function showMarks() {
    if (builtFor !== current) buildMarks();
    /* The nodes hang off the members crowns.js publishes as `parts`, so the
       gate is a table AND a frame of reference to hang it on. Each node's own
       at() then decides whether it has an anchor yet. */
    var want = spotsFor().length > 0 && !!crownParts();
    markBox.hidden = !want;
    if (!want) closeSpot();
  }

  document.getElementById('spotClose').addEventListener('click', closeSpot);
  /* Anywhere else closes it — including the canvas, which is the thing you go
     back to. The card itself stops the click before it gets here. */
  spotBox.addEventListener('click', function (e) { e.stopPropagation(); });
  window.addEventListener('pointerdown', function () { closeSpot(); closeAbout(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSpot(); closeAbout(); }
  });

  buildMarks();

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 120); });

  layout();
  paintChrome();
  requestAnimationFrame(frame);

  /* Step the simulation synchronously with the pointer parked at (x, y) moving
     at (vx, vy). Headless Chrome starves requestAnimationFrame under a
     virtual-time budget, so this is the only way to exercise the real physics
     from a script. */
  window.__poke = function (x, y, vx, vy, steps) {
    if (x !== null) {
      /* parked, so the target IS the position — stepPointer is not in this
         path at all and the velocity is imposed rather than measured */
      pointer.x = x; pointer.y = y; pointer.tx = x; pointer.ty = y;
      pointer.vx = vx; pointer.vy = vy; pointer.active = true;
    } else {
      pointer.active = false;
    }
    for (var s = 0; s < steps; s++) {
      physics(STEP);
      if (x !== null) { pointer.vx = vx; pointer.vy = vy; }
    }
  };

  /* The crown's own pixels, read off the bake rather than the composite: the
     bake has a transparent sky, so anything with alpha is building. Luminance
     and saturation measured this way are what GRADE above is set against. */
  window.__grade = function () {
    var d = crownCtx.getImageData(0, 0, crownCv.width, crownCv.height).data;
    var L = [], S = [], n = 0, sl = 0, ss = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      var r = d[i], g = d[i + 1], b = d[i + 2];
      var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      var sat = mx ? (mx - mn) / mx : 0;
      L.push(lum); S.push(sat); sl += lum; ss += sat; n++;
    }
    L.sort(function (a, b) { return a - b; });
    S.sort(function (a, b) { return a - b; });
    return { crown: current, px: n,
             lum: +(sl / n).toFixed(1), lumP50: +L[(n * 0.5) | 0].toFixed(0),
             lumP90: +L[(n * 0.9) | 0].toFixed(0),
             sat: +(ss / n).toFixed(3), satP50: +S[(n * 0.5) | 0].toFixed(3) };
  };

  /* a read-only window onto the live state, for checking input and hit-box
     behaviour without a debugger attached */
  window.__dbg = function () {
    return {
      crownY: crownY, crownH: CROWNS[current].height || 0,
      wheelLine: wheelLine, wheels: wheelRow.length,
      lines: lungta.length, wind: +windLevel.toFixed(3),
      exc: lungta.map(function (l) { return l.snd ? l.snd.exc : 0; }),
      ptr: { x: pointer.x, y: pointer.y, vx: pointer.vx, on: pointer.active },
      /* per drum — the row has no single speed. `spin` is the fastest of them,
         which is what a "is anything turning" check wants. */
      spin: wheelRow.reduce(function (m, w) { return Math.max(m, w.vel); }, 0),
      wheelVel: wheelRow.map(function (w) { return w.vel; }),
      wheelNotes: drive ? drive.count : 0,
      lantern: lantern, lit: lanternLit, rack: rackBox
    };
  };
})();
