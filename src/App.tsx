import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Download, FileMusic, Music2, RotateCcw, Upload } from 'lucide-react'
import { parseMidiFile, type ScoreNote } from './music'
import './App.css'

const Score = lazy(() => import('./Score'))
const pitchNames = ['ド', 'ド#', 'レ', 'レ#', 'ミ', 'ファ', 'ファ#', 'ソ', 'ソ#', 'ラ', 'ラ#', 'シ']
const palette = ['#e4514b', '#d27631', '#d7a625', '#95a83a', '#319c71', '#348fae', '#496bb2', '#785ca7', '#ad5a9a', '#cb567f', '#8b6a55', '#68737d']
const demoNotes: ScoreNote[] = [
  { id: 'demo-1', midi: 64, beat: 0, duration: 1, color: palette[4], track: 'メロディ' },
  { id: 'demo-2', midi: 67, beat: 1, duration: 1, color: palette[7], track: 'メロディ' },
  { id: 'demo-3', midi: 69, beat: 2, duration: 1, color: palette[9], track: 'メロディ' },
  { id: 'demo-4', midi: 72, beat: 3, duration: 1, color: palette[0], track: 'メロディ' },
  { id: 'demo-5', midi: 74, beat: 4, duration: 1, color: palette[2], track: 'メロディ' },
  { id: 'demo-6', midi: 76, beat: 5, duration: 1, color: palette[4], track: 'メロディ' },
  { id: 'demo-7', midi: 72, beat: 6, duration: 2, color: palette[0], track: 'メロディ' },
]

function App() {
  const [notes, setNotes] = useState(demoNotes)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedRestId, setSelectedRestId] = useState<string | null>(null)
  const [restColors, setRestColors] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState('きらきら星.mid')
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4])
  const [tempo, setTempo] = useState(96)
  const [message, setMessage] = useState('')
  const scoreRef = useRef<HTMLDivElement>(null)
  const selected = notes.find((note) => note.id === selectedId)
  const selectedRestColor = selectedRestId ? restColors[selectedRestId] ?? '#81857d' : null
  const pitchCounts = useMemo(() => notes.reduce((counts, note) => {
    counts[note.midi % 12] = (counts[note.midi % 12] ?? 0) + 1
    return counts
  }, {} as Record<number, number>), [notes])
  const measureCount = Math.max(1, Math.ceil((Math.max(...notes.map((note) => note.beat + note.duration), 0) - 0.0001) / (timeSignature[0] * 4 / timeSignature[1])))

  async function loadMidi(file: File) {
    try {
      const parsed = await parseMidiFile(file)
      setNotes(parsed.notes.map((note) => ({ ...note, color: palette[note.midi % 12] })))
      setTimeSignature(parsed.timeSignature)
      setTempo(parsed.tempo)
      setFileName(file.name)
      setSelectedId(null)
      setSelectedRestId(null)
      setRestColors({})
      setMessage(`${parsed.notes.length} 音を読み込みました`)
    } catch {
      setMessage('MIDIを読み込めませんでした。標準MIDIファイルをご確認ください。')
    }
  }

  function setNoteColor(id: string, color: string) {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, color } : note))
  }

  function setPitchColor(pitch: number, color: string) {
    setNotes((current) => current.map((note) => note.midi % 12 === pitch ? { ...note, color } : note))
  }

  function selectNote(id: string) {
    setSelectedId(id)
    setSelectedRestId(null)
  }

  function selectRest(id: string) {
    setSelectedId(null)
    setSelectedRestId(id)
  }

  async function exportPng() {
    const svgs = scoreRef.current?.querySelectorAll<SVGSVGElement>('.score-system svg')
    if (!svgs?.length) return
    const rows = [...svgs].map((svg) => ({ svg, width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height }))
    const width = Math.max(...rows.map((row) => row.width))
    const height = rows.reduce((total, row) => total + row.height + 18, 18)
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    root.setAttribute('width', String(width))
    root.setAttribute('height', String(height))
    root.setAttribute('viewBox', `0 0 ${width} ${height}`)
    let y = 18
    for (const row of rows) {
      const svg = row.svg.cloneNode(true) as SVGSVGElement
      svg.setAttribute('x', '0')
      svg.setAttribute('y', String(y))
      root.appendChild(svg)
      y += row.height + 18
    }
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const context = canvas.getContext('2d')
      context?.scale(2, 2)
      context?.drawImage(image, 0, 0)
      URL.revokeObjectURL(url)
      const link = document.createElement('a')
      link.download = `${fileName.replace(/\.[^.]+$/, '')}-color.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      setMessage('PNGを書き出しました')
    }
    image.onerror = () => { URL.revokeObjectURL(url); setMessage('PNGを書き出せませんでした') }
    image.src = url
  }

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#home"><span className="brand-mark"><Music2 size={18} /></span>OTOIRO</a><span className="local-status">ローカルで処理中</span><button className="export-button" type="button" onClick={exportPng}><Download size={16} />PNGを書き出す</button></header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="section-title"><small>01 / SOURCE</small><h1>楽譜をひらく</h1></div>
        <label className="upload-control"><input type="file" accept=".mid,.midi,audio/midi" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadMidi(file) }} /><FileMusic size={19} /><span><strong>MIDIファイル</strong><small>音高とタイミングを読み込み</small></span><Upload size={15} /></label>
        <div className="side-rule" />
        <div className="section-title"><small>02 / PITCH COLORS</small><h2>音階のカラー</h2></div>
        <p className="side-hint">音名の色を変えると、同じ音すべてに反映されます。</p>
        <div className="pitch-list">{pitchNames.map((name, pitch) => <label className="pitch-row" key={name}><span className="pitch-dot" style={{ background: notes.find((note) => note.midi % 12 === pitch)?.color ?? palette[pitch] }} /><span>{name}</span><small>{pitchCounts[pitch] ?? 0}</small><input aria-label={`${name}の一括カラー`} type="color" value={notes.find((note) => note.midi % 12 === pitch)?.color ?? palette[pitch]} onChange={(event) => setPitchColor(pitch, event.target.value)} /></label>)}</div>
        <div className="sidebar-note">MIDIの音域からト音・ヘ音記号を自動配置</div>
      </aside>

      <section className="editor">
        <div className="editor-heading"><div><small>SCORE CANVAS</small><h2>カラー譜面</h2></div><button className="reset-button" type="button" aria-label="サンプルに戻す" title="サンプルに戻す" onClick={() => { setNotes(demoNotes); setTimeSignature([4, 4]); setTempo(96); setFileName('きらきら星.mid'); setSelectedId(null); setSelectedRestId(null); setRestColors({}) }}><RotateCcw size={16} /></button></div>
        <div className="file-strip"><FileMusic size={15} /><strong>{fileName}</strong><span>{notes.length} 音符</span></div>
        <div className="score-viewport" ref={scoreRef}><div className="paper"><div className="paper-meta"><span>音域に合わせてト音・ヘ音を自動配置</span><span>{timeSignature[0]}/{timeSignature[1]}　·　♩ = {Math.round(tempo)}</span></div><div className="score-scroll"><Suspense fallback={<div className="score-loading">譜面を描画しています…</div>}><Score notes={notes} selectedId={selectedId} selectedRestId={selectedRestId} restColors={restColors} timeSignature={timeSignature} onSelect={selectNote} onSelectRest={selectRest} /></Suspense></div><div className="paper-foot"><span>OTOIRO SCORE STUDIO</span><span>{measureCount} 小節</span></div></div></div>
        <div className="selection-bar">{selected ? <><span className="selected-chip" style={{ background: selected.color }} /><strong>{pitchNames[selected.midi % 12]}{Math.floor(selected.midi / 12) - 1}</strong><small>{selected.beat.toFixed(2)} 拍目 · {selected.duration.toFixed(2)} 拍</small><label>音符の色<input aria-label="選択した音符の色" type="color" value={selected.color} onChange={(event) => setNoteColor(selected.id, event.target.value)} /></label><button type="button" aria-label="選択解除" onClick={() => setSelectedId(null)}>×</button></> : selectedRestId && selectedRestColor ? <><span className="selected-chip" style={{ background: selectedRestColor }} /><strong>休符</strong><small>選択中の休符</small><label>休符の色<input aria-label="選択した休符の色" type="color" value={selectedRestColor} onChange={(event) => setRestColors((current) => ({ ...current, [selectedRestId]: event.target.value }))} /></label><button type="button" aria-label="選択解除" onClick={() => setSelectedRestId(null)}>×</button></> : <><span className="selection-star">✳</span><span>音符または休符を選択して色を変更できます</span></>}</div>
        {message && <div className="toast" role="status">{message}<button type="button" onClick={() => setMessage('')} aria-label="通知を閉じる">×</button></div>}
        <footer className="editor-footer"><span>{notes.length.toString().padStart(2, '0')} NOTES</span><span>PNG · 2× 解像度</span></footer>
      </section>
    </div>
  </main>
}

export default App