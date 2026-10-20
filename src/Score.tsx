import { useEffect, useMemo, useRef } from 'react'
import VexFlow, { Accidental, Beam, Formatter, Renderer, Stave, StaveNote } from 'vexflow/core'
import type { ScoreNote } from './music'
import { clefForMidi, decomposeRest, durationValue, midiKey, splitBeamColorStops, type Clef } from './notation'

type Props = {
  notes: ScoreNote[]
  selectedId: string | null
  selectedRestId: string | null
  restColors: Record<string, string>
  timeSignature: [number, number]
  onSelect: (id: string) => void
  onSelectRest: (id: string) => void
}

const barsPerLine = 4
const measureWidth = 220
VexFlow.setFonts('Bravura', 'Academico')

function restNotes(beats: number, clef: Clef) {
  return decomposeRest(beats).map((duration) => new StaveNote({
    keys: [clef === 'treble' ? 'b/4' : 'd/3'],
    duration,
    type: 'r',
    clef,
  }))
}

function noteLabel(midi: number) {
  const names = ['ド', 'ド#', 'レ', 'レ#', 'ミ', 'ファ', 'ファ#', 'ソ', 'ソ#', 'ラ', 'ラ#', 'シ']
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`
}

function Score({ notes, selectedId, selectedRestId, restColors, timeSignature, onSelect, onSelectRest }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const barDuration = timeSignature[0] * 4 / timeSignature[1]
  const barCount = Math.max(1, Math.ceil((Math.max(...notes.map((note) => note.beat + note.duration), 0) - 0.0001) / barDuration))
  const lineCount = Math.ceil(barCount / barsPerLine)
  const clefs = useMemo(() => {
    const result: Clef[] = []
    if (notes.some((note) => clefForMidi(note.midi) === 'treble')) result.push('treble')
    if (notes.some((note) => clefForMidi(note.midi) === 'bass')) result.push('bass')
    if (!result.length) result.push('treble')
    return result
  }, [notes])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false

    const renderScore = async () => {
      await Promise.all([
        document.fonts.load('30pt Bravura'),
        document.fonts.load('10pt Academico'),
      ])
      if (cancelled || !host.isConnected) return
      host.replaceChildren()

      for (let line = 0; line < lineCount; line += 1) {
      const system = document.createElement('div')
      system.className = 'score-system'
      system.setAttribute('aria-label', `譜面 ${line + 1}段目`)
      host.appendChild(system)
      const systemBars = Math.min(barsPerLine, barCount - line * barsPerLine)
      const renderer = new Renderer(system, Renderer.Backends.SVG)
      renderer.resize(18 + systemBars * measureWidth, 32 + clefs.length * 125)
      system.querySelector('svg')?.setAttribute('pointer-events', 'auto')
      const context = renderer.getContext()
      context.setFont('Arial', 10)
      const rendered: Array<{ note: StaveNote; source: ScoreNote[] }> = []
      const renderedRests: Array<{ note: StaveNote; id: string }> = []
      const noteByTickable = new Map<StaveNote, ScoreNote[]>()

      clefs.forEach((clef, staffIndex) => {
        for (let localBar = 0; localBar < systemBars; localBar += 1) {
          const bar = line * barsPerLine + localBar
          const barNotes = notes.filter((note) => Math.floor(note.beat / barDuration) === bar && clefForMidi(note.midi) === clef)
          const stave = new Stave(8 + localBar * measureWidth, 17 + staffIndex * 120, measureWidth)
          if (localBar === 0) stave.addClef(clef).addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`)
          stave.setContext(context).draw()

          const grouped = new Map<number, ScoreNote[]>()
          for (const note of barNotes) {
            const beat = Math.round((note.beat - bar * barDuration) * 32) / 32
            grouped.set(beat, [...(grouped.get(beat) ?? []), note])
          }

          const tickables: StaveNote[] = []
          let cursor = 0
          const appendRests = (beats: number, startBeat: number) => {
            for (const [index, rest] of restNotes(beats, clef).entries()) {
              const id = `rest-${bar}-${clef}-${Math.round(startBeat * 32)}-${index}`
              const color = restColors[id] ?? '#81857d'
              rest.setStyle({ fillStyle: color, strokeStyle: color })
              tickables.push(rest)
              renderedRests.push({ note: rest, id })
            }
          }
          for (const [start, chord] of [...grouped.entries()].sort(([a], [b]) => a - b)) {
            if (start > cursor + 0.001) appendRests(start - cursor, cursor)
            const tickable = new StaveNote({
              keys: chord.map((note) => midiKey(note.midi)),
              duration: durationValue(Math.max(...chord.map((note) => note.duration))),
              clef,
            })
            tickable.setStyle({ fillStyle: chord[0].color, strokeStyle: chord[0].color })
            tickable.setStemStyle({ strokeStyle: chord[0].color, fillStyle: chord[0].color })
            chord.forEach((note, index) => {
              if (midiKey(note.midi).split('/')[0].includes('#')) tickable.addModifier(new Accidental('#'), index)
              tickable.setKeyStyle(index, { fillStyle: note.color, strokeStyle: note.color })
            })
            tickables.push(tickable)
            rendered.push({ note: tickable, source: chord })
            noteByTickable.set(tickable, chord)
            cursor = Math.max(cursor, start + Math.max(...chord.map((note) => note.duration)))
          }
          if (!barNotes.length) appendRests(barDuration, 0)
          else if (cursor < barDuration - 0.001) appendRests(barDuration - cursor, cursor)
          if (tickables.length) {
            Formatter.FormatAndDraw(context, stave, tickables)
            const beams = Beam.generateBeams(tickables.filter((tickable) => !tickable.isRest()))
            for (const [beamIndex, beam] of beams.entries()) {
              beam.setContext(context).draw()
              const beamNotes = beam.getNotes() as StaveNote[]
              const leftSource = noteByTickable.get(beamNotes[0])?.[0]
              const rightSource = noteByTickable.get(beamNotes.at(-1)!)?.[0]
              if (!leftSource || !rightSource || leftSource.color === rightSource.color) {
                const beamGroup = beam.getSVGElement()
                if (beamGroup && leftSource) beamGroup.setAttribute('fill', leftSource.color)
                continue
              }
              const svg = system.querySelector('svg')
              const beamGroup = beam.getSVGElement()
              if (!svg || !beamGroup) continue
              const gradientId = `beam-color-${line}-${staffIndex}-${localBar}-${beamIndex}`
              const defs = svg.querySelector('defs') ?? svg.insertBefore(document.createElementNS('http://www.w3.org/2000/svg', 'defs'), svg.firstChild)
              const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
              gradient.id = gradientId
              gradient.setAttribute('gradientUnits', 'userSpaceOnUse')
              gradient.setAttribute('x1', String(beamNotes[0].getAbsoluteX()))
              gradient.setAttribute('x2', String(beamNotes.at(-1)!.getAbsoluteX()))
              gradient.setAttribute('y1', '0')
              gradient.setAttribute('y2', '0')
              for (const { offset, color } of splitBeamColorStops(leftSource.color, rightSource.color)) {
                const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
                stop.setAttribute('offset', offset)
                stop.setAttribute('stop-color', color)
                gradient.appendChild(stop)
              }
              defs.appendChild(gradient)
              beamGroup.querySelectorAll<SVGElement>('path, polygon').forEach((shape) => {
                shape.setAttribute('fill', `url(#${gradientId})`)
                shape.setAttribute('stroke', `url(#${gradientId})`)
              })
            }
          }
        }
      })

      for (const { note, source } of rendered) {
        const group = note.getSVGElement()
        if (!group) continue
        group.classList.add('score-note-group')
        group.classList.toggle('is-selected', source.some((item) => item.id === selectedId))
        group.addEventListener('click', () => onSelect(source[0].id))

        note.noteHeads.forEach((head, index) => {
          const headGroup = head.getSVGElement()
          const sourceNote = source[index]
          if (!headGroup || !sourceNote) return
          headGroup.setAttribute('data-note-id', sourceNote.id)
          headGroup.setAttribute('tabindex', '0')
          headGroup.setAttribute('role', 'button')
          headGroup.setAttribute('aria-label', `${noteLabel(sourceNote.midi)}、色を編集`)
          headGroup.classList.toggle('is-selected', sourceNote.id === selectedId)
          headGroup.addEventListener('click', (event) => {
            event.stopPropagation()
            onSelect(sourceNote.id)
          })
          headGroup.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') onSelect(sourceNote.id)
          })
        })

      }

      for (const { note, id } of renderedRests) {
        const group = note.getSVGElement()
        if (!group) continue
        group.classList.add('score-rest-group')
        group.classList.toggle('is-selected', id === selectedRestId)
        group.setAttribute('data-rest-id', id)
        group.setAttribute('tabindex', '0')
        group.setAttribute('role', 'button')
        group.setAttribute('aria-label', '休符、色を編集')
        group.addEventListener('click', () => onSelectRest(id))
        group.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelectRest(id)
        })
      }
      }
    }

    void renderScore()
    return () => { cancelled = true }
  }, [barCount, barDuration, clefs, lineCount, notes, onSelect, onSelectRest, restColors, selectedId, selectedRestId, timeSignature])

  return <div className="score-renderer" ref={hostRef} aria-label="五線譜" />
}

export default Score