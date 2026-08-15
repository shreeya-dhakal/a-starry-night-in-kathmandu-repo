# A Starry Night in Kathmandu

An interactive rendering of **Boudhanath Stupa** (Khasti Chaitya) under a night sky — prayer flags strung off the summit that you can stir with your hand, a wall of prayer wheels at its foot that spin as you walk a cursor along them, and eight labelled members of the stupa you can open and read about, in English and Nepali.

Everything is drawn on a single `<canvas>`. There is no build step, no bundler, and no dependencies — `index.html` opens directly in a browser.

## Running it

Open `index.html` in any modern browser. That's it.

For local development over `http://` (some browsers restrict fonts and audio on `file://`):

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## What's on the page

| | |
|---|---|
| **Prayer flags (lungta)** | Real cloth simulation — Verlet integration with structural, shear and bend constraints. Your pointer pushes air into the lines; they carry on moving after your hand has gone. |
| **Prayer wheels (mani wall)** | A row of aged copper drums, each with its own hit-box. A hand passed along the wall turns them one at a time, the way you'd walk a real row. They keep spinning on inertia and slow to a stop under friction. |
| **The chaitya** | Baked once into an offscreen canvas and blitted, then graded into the night light. The whitewashed dome, the harmika eyes, the gilt spire. |
| **Eight hot-points** | Lungta, Vedika, Anda, Devakostha, Harmika, Bhuwana, Gajur, and the Mani wall — each with a name and a line on what it is. Real DOM buttons, so they're tabbable and screen-reader friendly. |
| **Sound** | Synthesised in the Web Audio API — no audio files. Two voices: the whirr of a drum being pushed round, and the air moving in the flags. Both noise-based, since neither object makes a note. |
| **Fireflies** | Three of them, following the pointer late and never quite straight. Each has its own orbit, spring, wander and blink clock. |
| **Bilingual** | English and नेपाली throughout — chrome, plate, and every hot-point. |

## Controls

- **Move your pointer** across the flags to stir them, along the wall to spin the wheels.
- **Sound** toggles audio (browsers require a gesture before any audio can start).
- **नेपाली / English** switches language; an open card follows the switch.
- **Click a marker** to open its card. `Esc`, the ✕, or a click anywhere else closes it.
- `?wall=0` — a looking mode that removes the mani wall and leaves the building alone in the window, so the crown gets the full height to be judged in.
- `prefers-reduced-motion` is respected.

## Files

```
index.html          markup + chrome; the canvas and the hot-point card
css/style.css       chrome styling, hot-point markers, Devanagari font stacks
js/scene.js         layout, rendering, input, and the loop (the big one)
js/crowns.js        the chaitya itself — filled and shaded, baked once
js/cloth.js         constrained particle grid, one per prayer-flag line
js/flutter.js       decides how hard the flags are being moved
js/bells.js         synthesised audio — whirr and wind
js/firefly.js       three fireflies; no hook into the scene, safe to delete
fonts/              Cormorant Garamond (OFL)
```

The physics is Thomas Jakobsen's scheme from *Advanced Character Physics* (GDC 2001), implemented in flat typed arrays rather than particle objects — at a couple of thousand points resolved several times per frame, that difference is the performance budget.

---

## Future work

Collected from feedback so far.

### 1. Om Mani Padme Hum — chanting and tone

Add the mantra to the soundscape, in two forms:

- **Ambient chanting** in the background, with a toggle button to turn it on and off.
- **A smooth tone on touch and gestures**, so interacting with the flags and wheels answers in the same voice rather than only in noise.

This is the most-requested item — it came up more than once.

### 2. People around the stupa

Small figures walking or just moving around the base. They don't need to be realistic — cartoonish is fine. The point is that small elements moving around the monument give life to it.

### 3. Dark and light mode

Add both, plus a **simulation mode** that picks the mode from the current time of day and lights the scene to match.

### 4. Live weather

Pull the actual weather at Boudha from a weather API and simulate it in the scene — rain, cloud, haze — alongside the time-of-day simulation above.

### 5. Tidy up the text

The Nepali is Google Translate output and could use a read from someone who speaks it. There's also one inherited mistake worth catching: the Lung Ta description calls both green *and* red "water" — red should be fire — in [scene.js:121-122](js/scene.js#L121-L122).

---

## Credits

Descriptions of the stupa and its parts come from the Wikipedia article on [Boudhanath](https://en.wikipedia.org/wiki/Boudhanath) and from [this piece on nirvanamala.com](https://nirvanamala.com/boudhanath-stupa-history-significance-cultural-insights/). Nepali translations via the Google Translate API.

Type is [Cormorant Garamond](fonts/OFL-CormorantGaramond.txt) (OFL). The cloth physics follows Thomas Jakobsen's *Advanced Character Physics* (GDC 2001).

Everything else — the drawing, the physics, the audio, the interaction — is written for this project.
