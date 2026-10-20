import { describe, expect, it } from 'vitest'
import { clefForMidi, decomposeRest, durationValue, midiKey, splitBeamColorStops } from './notation'

describe('notation', () => {
  it('maps register and pitch to the proper clef and key', () => {
    expect(clefForMidi(48)).toBe('bass')
    expect(clefForMidi(60)).toBe('treble')
    expect(midiKey(60)).toBe('c/4')
    expect(midiKey(61)).toBe('c#/4')
  })

  it('maps note lengths and decomposes rests', () => {
    expect(durationValue(0.5)).toBe('8')
    expect(durationValue(1.5)).toBe('qd')
    expect(decomposeRest(2.5)).toEqual(['h', '8'])
  })

  it('splits beam colors at the exact midpoint without blending', () => {
    expect(splitBeamColorStops('#319c71', '#785ca7')).toEqual([
      { offset: '0%', color: '#319c71' },
      { offset: '49.99%', color: '#319c71' },
      { offset: '50%', color: '#785ca7' },
      { offset: '100%', color: '#785ca7' },
    ])
  })
})