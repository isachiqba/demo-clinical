/**
 * Speaks the narration and lays it over the film.
 *
 *   node scripts/narrate.mjs
 *
 * Each line in video/narration.en.json belongs to the caption cue of the same index in
 * video/cues.json, and is placed at that cue's start. A line that runs past the next cue
 * is reported rather than silently talked over the following beat.
 *
 * Needs piper (see video/README.md); ffmpeg comes from the ffmpeg-static package.
 */
import { execFile, spawn } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import ffmpeg from 'ffmpeg-static'

const run = promisify(execFile)

const PIPER = process.env.PIPER ?? join(homedir(), '.cache/piper/dist/piper/piper')
const VOICES = process.env.PIPER_VOICES ?? join(homedir(), '.cache/piper/voices')
const WORK = 'video/.speech'
const SILENT = 'video/lorba-medical-demo-1080p.webm'
const OUT_MP4 = 'video/lorba-medical-demo-1080p.mp4'

/** piper reads its text on stdin and waits for ever if that pipe is left open. */
const speak = (model, file, text) =>
  new Promise((resolve, reject) => {
    const child = spawn(PIPER, ['--model', model, '--output_file', file])
    let noise = ''
    child.stderr.on('data', (chunk) => { noise += chunk })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`piper failed (${code}): ${noise.slice(-300)}`)))
    child.stdin.end(`${text}\n`)
  })

/** ffmpeg-static ships no ffprobe, so the length is read back off ffmpeg's own report. */
const lengthOf = async (file) => {
  const { stderr } = await run(ffmpeg, ['-hide_banner', '-i', file]).catch((error) => error)
  const found = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(stderr ?? '')
  if (!found) throw new Error(`could not read the length of ${file}`)
  return Number(found[1]) * 3600 + Number(found[2]) * 60 + Number(found[3])
}

const main = async () => {
  const { length, cues } = JSON.parse(await readFile('video/cues.json', 'utf8'))
  const script = JSON.parse(await readFile('video/narration.en.json', 'utf8'))
  if (script.lines.length !== cues.length) {
    throw new Error(`${script.lines.length} lines for ${cues.length} cues`)
  }

  await rm(WORK, { recursive: true, force: true })
  await mkdir(WORK, { recursive: true })
  const model = join(VOICES, `${script.voice}.onnx`)

  const spoken = []
  for (const [index, text] of script.lines.entries()) {
    const file = join(WORK, `${String(index).padStart(2, '0')}.wav`)
    await speak(model, file, text)
    const seconds = await lengthOf(file)
    const start = cues[index].start
    const room = (index + 1 < cues.length ? cues[index + 1].start : length) - start
    spoken.push({ file, start, seconds, room })
    const over = seconds - room
    console.log(
      `${String(index).padStart(2, ' ')}  ${start.toFixed(1).padStart(5)}s  ` +
        `spoken ${seconds.toFixed(1)}s / room ${room.toFixed(1)}s` +
        (over > 0.15 ? `   OVER by ${over.toFixed(1)}s — shorten this line` : '')
    )
  }

  const overruns = spoken.filter((line) => line.seconds - line.room > 0.15)
  if (overruns.length && !process.env.FORCE) {
    throw new Error(`${overruns.length} line(s) run past their beat; shorten them or set FORCE=1`)
  }

  // Every line is delayed to its own cue and the lot is mixed down to one track, then
  // laid under the picture. normalize=0 keeps a single speaking voice at full level.
  const inputs = spoken.flatMap((line) => ['-i', line.file])
  const delays = spoken
    .map((line, index) => `[${index + 1}:a]adelay=${Math.round(line.start * 1000)}:all=1[d${index}]`)
    .join(';')
  const mix = spoken.map((_, index) => `[d${index}]`).join('')
  const filter =
    `${delays};${mix}amix=inputs=${spoken.length}:normalize=0:dropout_transition=0[voice];` +
    `[voice]apad,atrim=0:${length.toFixed(3)},aresample=48000[a]`

  await run(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', SILENT,
    ...inputs,
    '-filter_complex', filter,
    '-map', '0:v:0', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-level', '4.0', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    OUT_MP4
  ])

  console.log('\nnarrated:', OUT_MP4, `(${(await lengthOf(OUT_MP4)).toFixed(1)}s)`)
}

main().catch((error) => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
