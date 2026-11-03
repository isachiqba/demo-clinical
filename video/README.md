# The walkthrough video

## Three cuts

| | **commercial** | **commercial-es** | **annotated** |
|---|---|---|---|
| For | sending to prospects | Spanish-speaking prospects | walking someone through the demo |
| Interface | English | Spanish | English |
| Captions and voice | English | Spanish | English |
| Captions say | what the software does | what the software does | plus "simulated" at each step |
| Red SIMULATED badge | no | no | yes, over the offer sequence |
| Says "sample data" | once, on the closing card | once, on the closing card | throughout |
| Voice | `en_GB-alba-medium` | `es_ES-sharvard-medium` | `en_GB-alba-medium` |

Both are the same take of the same real application, and in both the app's own DEMO
banners, its "Simulated message" badge and its "Nothing is sent: no email, no text
message" line stay on screen — those are part of the product, not the film.

The Spanish cut is a separate filming run, not a dub: the application itself is in
Spanish, because the app carries a full `es` locale. `scripts/film.mjs` seeds the language
into `sessionStorage` before the first paint, so no language switch happens on camera, and
every string it clicks on comes from the `UI` table at the top of the script, copied from
`src/i18n/locales/*.ts`. If a label changes in the app, the run fails on that step instead
of filming something wrong.

Per cut, where `<cut>` is `commercial`, `commercial-es` or `annotated`:

| File | What it is |
|---|---|
| `lorba-medical-demo-<cut>-1080p.mp4` | The film to send out. 1920×1080, 25 fps, H.264 + AAC, 2:00, ~20 MB, narrated. |
| `lorba-medical-demo-<cut>-1080p.webm` | The same take without audio, straight out of the recorder (VP9). |
| `lorba-medical-demo.<cut>.srt` | The on-screen captions as a subtitle track. |
| `voice-over.<cut>.md` | The narration, timed. Generated — do not edit by hand. |
| `narration.<cut>.json` | The narration source. Edit this. |
| `cues.<cut>.json` | Caption times, written by the recorder and read by the narrator. |

The caption wording for each cut lives in the `COPY` table at the top of
`scripts/film.mjs`.

## Remaking it

```sh
npm run build                                               # the recorder films dist/, so build first
npm run preview -- --host 127.0.0.1 --port 4178 --strictPort
VARIANT=commercial node scripts/film.mjs                    # ~2 min: it is filmed in real time
VARIANT=commercial node scripts/narrate.mjs                 # speaks the script and writes the MP4
```

`VARIANT` defaults to `commercial` and `LOCALE` to `en`; the Spanish cut is
`LOCALE=es VARIANT=commercial`. The cuts are independent — re-filming one leaves the
others alone.

Adding another language means a voice from the `rhasspy/piper-voices` set, an entry in the
`UI` table (the labels the run clicks on), one in `COPY` (the captions) and a
`narration.commercial-<lang>.json`. It only works for languages the app itself speaks.

Node 20 or newer, for Playwright.

## How it is put together

There is no video editor here, so the film is shot as one continuous take and the editing
happens live in the page: `scripts/film.mjs` injects an overlay that draws the English
captions, the title cards and the section fades, and the zooms are a CSS transform on the
app root, centred on whatever is being read. What Playwright records is already cut
together — nothing is assembled afterwards.

`scripts/narrate.mjs` then speaks each line with piper, places it at the caption it
belongs to, mixes the lot into one track and muxes it with the picture. It refuses to
build if a line runs past its beat, so the voice can never talk over the next section.

Everything on screen is the real application at `/`, `/book` and `/demo/reception`. No
screen, state or figure was mocked up, and the scripted demo scenario is loaded before
filming — off camera, by seeding `sessionStorage` from a throwaway tab, so the front
desk's "Load sample scenario" click stays out of shot.

The run asserts the things the story depends on: that the scripted appointment `LM-7F3K`
is the one open before it is cancelled, and that the freed time matches two people on the
waitlist. If either is untrue it stops rather than filming a weaker story.

## Tools, and what they cost

- **Playwright** — already a dev dependency. Records VP9/WebM at 1920×1080.
- **ffmpeg-static** — added as a dev dependency. A full ffmpeg build; the one Playwright
  ships is cut down to VP9/WebM and cannot write MP4. Free, no account.
- **piper** — not in the repo. An offline, open-source speech synthesiser, installed under
  `~/.cache/piper`: the `piper_linux_x86_64` release and the `en_GB-alba-medium` voice from
  the `rhasspy/piper-voices` model set. Free, no account, no network at build time. Point
  `PIPER` and `PIPER_VOICES` elsewhere if it lives somewhere else on your machine.

## One thing to watch

`scripts/film.mjs` films the **built** app from `dist/`, not the dev server. An early take
was shot against a `dist/` three minutes older than `src/data/demoScenario.ts`, and in that
build the scripted appointment `LM-7F3K` did not exist — reception answered "Load the
sample scenario first." and the waitlist demo lost one of its two candidates. The source
was fine the whole time. Always `npm run build` before filming.
