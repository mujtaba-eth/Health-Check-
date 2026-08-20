import { useEffect, useRef, useState } from 'react'
import { apiUrl } from './config'

type Turn = { role: 'assistant' | 'user'; text: string }
type Report = { patientName: string; mainConcern: string; duration: string; severity: string; relatedSymptoms: string; followUp: string; complete: boolean }
declare global { interface Window { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition } }
interface SpeechRecognition extends EventTarget { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: (e: SpeechRecognitionEvent) => void; onend: () => void; onerror: () => void }
interface SpeechRecognitionEvent { results: { [key: number]: { [key: number]: { transcript: string }; isFinal: boolean }; length: number } }

const starter = 'Hi, I’m Maya. I’ll ask a few quick questions to help capture what’s going on. What name would you like me to use?'
const indianFemaleVoices = ['microsoft heera', 'heera', 'neerja', 'priya', 'veena', 'lekha', 'kalpana']
const preferredFemaleVoices = ['zira', 'aria', 'jenny', 'samantha', 'karen', 'female']

function chooseMayaVoice() {
  const voices = window.speechSynthesis.getVoices()
  const isIndianEnglish = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().startsWith('en-in')
  return voices.find(voice => isIndianEnglish(voice) && indianFemaleVoices.some(name => voice.name.toLowerCase().includes(name)))
    ?? voices.find(isIndianEnglish)
    ?? voices.find(voice => preferredFemaleVoices.some(name => voice.name.toLowerCase().includes(name)))
    ?? voices.find(voice => voice.lang.toLowerCase().startsWith('en'))
}

export default function App() {
  const [status, setStatus] = useState<'idle' | 'speaking' | 'listening' | 'thinking' | 'ended'>('idle')
  const [history, setHistory] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [notice, setNotice] = useState('')
  const recognition = useRef<SpeechRecognition | null>(null)
  const transcriptEnd = useRef<HTMLDivElement>(null)
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, status])
  useEffect(() => () => { window.speechSynthesis.cancel(); recognition.current?.stop() }, [])

  const speak = (text: string) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = chooseMayaVoice() ?? null
    utterance.rate = .94; utterance.pitch = 1.12
    utterance.onstart = () => setStatus('speaking')
    utterance.onend = () => setStatus('listening')
    utterance.onerror = () => setStatus('listening')
    window.speechSynthesis.speak(utterance)
  }
  const startCall = () => { setHistory([{ role: 'assistant', text: starter }]); setReport(null); setNotice(''); speak(starter) }
  const listen = () => {
    const Engine = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Engine) { setNotice('Voice recognition is not available in this browser. You can type your response below.'); return }
    window.speechSynthesis.cancel()
    const r = new Engine(); recognition.current = r; r.continuous = false; r.interimResults = false; r.lang = 'en-IN'
    r.onresult = e => { const text = e.results[e.results.length - 1][0].transcript.trim(); setDraft(text); send(text) }
    r.onerror = () => { setStatus('listening'); setNotice('I didn’t catch that. Please try again or type your response.') }
    r.onend = () => { if (status === 'listening') setStatus('listening') }
    setStatus('listening'); r.start()
  }
  const send = async (text = draft) => {
    if (!text.trim() || status === 'thinking' || status === 'ended') return
    recognition.current?.stop(); setDraft(''); setStatus('thinking'); setNotice('')
    const next = [...history, { role: 'user' as const, text: text.trim() }]; setHistory(next)
    try {
      const response = await fetch(apiUrl('/api/respond'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: next }) })
      const data = await response.json(); const updated = [...next, { role: 'assistant' as const, text: data.text }]; setHistory(updated); if (data.warning) setNotice(data.warning); speak(data.text)
    } catch { const text = 'I’m having trouble connecting right now. Please try again in a moment.'; setHistory([...next, { role: 'assistant', text }]); setNotice('The local server is unavailable. Run npm run dev and try again.'); setStatus('listening') }
  }
  const endCall = async () => {
    window.speechSynthesis.cancel(); recognition.current?.stop(); setStatus('thinking')
    try { const response = await fetch(apiUrl('/api/report'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history }) }); setReport(await response.json()) }
    catch { setReport({ patientName: 'Not discussed', mainConcern: 'A report could not be generated while the server is offline.', duration: 'Not discussed', severity: 'Not discussed', relatedSymptoms: 'Not discussed', followUp: 'Please restart the local server and try again.', complete: false }) }
    setStatus('ended')
  }
  const live = status !== 'idle' && status !== 'ended'
  return <main>
    <nav><div className="brand"><span>✦</span> sasahayog <small>HEALTH</small></div><div className="secure">● Private &amp; confidential</div></nav>
    <section className="hero"><p className="eyebrow">VOICE HEALTH SCREENING</p><h1>A calmer start to<br/><em>feeling heard.</em></h1><p className="intro">A short conversation to help you organize what you’re experiencing before your next care decision.</p></section>
    <section className="call-card">
      <div className="agent"><div className={'orb ' + status}><i></i><i></i><i></i></div><div><p className="agent-name">Maya <span>• Health guide</span></p><p className="agent-state">{status === 'speaking' ? 'Speaking…' : status === 'thinking' ? 'Thinking…' : status === 'listening' ? 'Listening' : status === 'ended' ? 'Call complete' : 'Ready when you are'}</p></div><div className="pulse">{live && <><b></b><b></b><b></b><b></b><b></b></>}</div></div>
      <div className="conversation">{history.length ? history.map((t, i) => <div className={'bubble ' + t.role} key={i}>{t.text}</div>) : <div className="empty"><span>✦</span><p>When you’re ready, Maya will guide the conversation one question at a time.</p></div>}<div ref={transcriptEnd}/></div>
      {notice && <p className="notice">{notice}</p>}
      <div className="controls">{!live && <button className="primary" onClick={startCall}>{status === 'ended' ? 'Start another call' : 'Start call'} <span>→</span></button>}{live && <><button className="mic" disabled={status === 'thinking' || status === 'speaking'} onClick={listen}>⌁</button><div className="type"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Or type your answer…"/><button onClick={() => send()}>Send</button></div><button className="end" onClick={endCall}>End call</button></>}</div>
    </section>
    {report && <section className="report"><div><p className="eyebrow">YOUR CALL SUMMARY</p><h2>Here’s what we heard.</h2><p className="report-note">This is a conversation summary, not a diagnosis. Please seek professional medical advice for any health concerns.</p></div><div className="report-grid"><Item label="Main concern" value={report.mainConcern}/><Item label="Duration" value={report.duration}/><Item label="Severity" value={report.severity}/><Item label="Related symptoms" value={report.relatedSymptoms}/></div><div className="follow"><b>Suggested follow-up</b><p>{report.followUp}</p></div></section>}
    <footer>For informational screening only. In an emergency, contact your local emergency services immediately.</footer>
  </main>
}
function Item({ label, value }: { label: string; value: string }) { return <div className="report-item"><span>{label}</span><p>{value}</p></div> }
