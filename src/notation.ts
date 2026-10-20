export type Clef = 'treble' | 'bass'

const durations = [
  { beats: 4, value: 'w' },
  { beats: 3, value: 'hd' },
  { beats: 2, value: 'h' },
  { beats: 1.5, value: 'qd' },
  { beats: 1, value: 'q' },
  { beats: 0.75, value: '8d' },
  { beats: 0.5, value: '8' },
  { beats: 0.375, value: '16d' },
  { beats: 0.25, value: '16' },
  { beats: 0.125, value: '32' },
]

export function clefForMidi(midi: number): Clef {
  return midi < 60 ? 'bass' : 'treble'
}

export function midiKey(midi: number) {
  const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
  return `${names[midi % 12]}/${Math.floor(midi / 12) - 1}`
}

export function durationValue(beats: number) {
  return durations.reduce((best, current) => Math.abs(current.beats - beats) < Math.abs(best.beats - beats) ? current : best).value
}

export function decomposeRest(beats: number) {
  const rests: string[] = []
  let remaining = Math.max(0, Math.round(beats * 32) / 32)
  while (remaining >= 0.125) {
    const duration = durations.find((candidate) => candidate.beats <= remaining + 0.001)
    if (!duration) break
    rests.push(duration.value)
    remaining = Math.round((remaining - duration.beats) * 32) / 32
  }
  return rests
}

export function splitBeamColorStops(leftColor: string, rightColor: string) {
  return [
    { offset: '0%', color: leftColor },
    { offset: '49.99%', color: leftColor },
    { offset: '50%', color: rightColor },
    { offset: '100%', color: rightColor },
  ]
}