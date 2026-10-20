import { Midi } from '@tonejs/midi'

export type ScoreNote = {
  id: string
  midi: number
  beat: number
  duration: number
  color: string
  track: string
}

export type ParsedMidi = {
  notes: ScoreNote[]
  timeSignature: [number, number]
  tempo: number
}

export function parseMidiBytes(data: ArrayBuffer): ParsedMidi {
  const midi = new Midi(data)
  const notes = midi.tracks.flatMap((track, trackIndex) => track.notes.map((note, noteIndex) => ({
    id: `${trackIndex}-${noteIndex}-${note.ticks}`,
    midi: note.midi,
    beat: note.ticks / midi.header.ppq,
    duration: note.durationTicks / midi.header.ppq,
    color: '#333333',
    track: track.name || `トラック ${trackIndex + 1}`,
  }))).sort((left, right) => left.beat - right.beat || left.midi - right.midi)
  const signature = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4]
  return {
    notes,
    timeSignature: [signature[0], signature[1]],
    tempo: midi.header.tempos[0]?.bpm ?? 120,
  }
}

export async function parseMidiFile(file: File): Promise<ParsedMidi> {
  return parseMidiBytes(await file.arrayBuffer())
}