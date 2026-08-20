import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import OpenAI from 'openai'
import path from 'node:path'

type Turn = { role: 'assistant' | 'user'; text: string }
type Sentiment = 'neutral' | 'worried' | 'distressed' | 'positive' | 'urgent'
const app = express()
const port = Number(process.env.PORT || 3001)
app.use(cors())
app.use(express.json())

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const system = `You are Maya, a calm, warm health-screening assistant. You are not a doctor and do not diagnose.
Have a short, natural English intake conversation. Ask exactly one clear question at a time. Gently gather: preferred name, main concern, onset/duration, severity (1-10), related symptoms, and any urgent red flags. Use the user's answers; never repeat something already answered. Be conversational, not robotic. Keep responses under 45 words. If they mention emergency warning signs (severe breathing difficulty, chest pain, stroke symptoms, fainting, suicidal thoughts), kindly advise immediate emergency care. Do not give treatment instructions.`

function detectSentiment(text: string): Sentiment {
  const answer = text.toLowerCase()
  if (/(chest pain|can't breathe|cannot breathe|difficulty breathing|passed out|fainted|suicid|kill myself|stroke|one side.*weak)/.test(answer)) return 'urgent'
  if (/(unbearable|worst|terrified|panic|can't cope|cannot cope|severe pain|crying|hopeless)/.test(answer)) return 'distressed'
  if (/(worried|anxious|scared|afraid|nervous|concerned|stress)/.test(answer)) return 'worried'
  if (/(better|improving|fine|okay now|good|relieved|not too bad)/.test(answer)) return 'positive'
  return 'neutral'
}

function acknowledgement(sentiment: Sentiment) {
  if (sentiment === 'urgent') return "I’m sorry you’re experiencing that. Because this could need urgent attention, please contact local emergency services or seek immediate in-person care."
  if (sentiment === 'distressed') return "I’m really sorry this feels so difficult. Thank you for telling me — we’ll take this one step at a time."
  if (sentiment === 'worried') return "That sounds worrying. I’m glad you mentioned it, and I’ll help make sure the key details are captured."
  if (sentiment === 'positive') return "I’m glad to hear there may be some improvement. Let’s still capture a few details clearly."
  return ''
}

function fallback(history: Turn[]) {
  const answerCount = history.filter(t => t.role === 'user').length
  const latestAnswer = [...history].reverse().find(turn => turn.role === 'user')?.text || ''
  const sentiment = detectSentiment(latestAnswer)
  const questions = [
    "Hi, I’m Maya. I’ll ask a few quick questions to help capture what’s going on. What name would you like me to use?",
    "Thank you. What’s the main health concern you’d like to talk about today?",
    "I understand. When did this begin, or how long has it been going on?",
    "On a scale from 1 to 10, how intense does it feel right now?",
    "Are you noticing any other symptoms, such as fever, breathing changes, nausea, dizziness, or anything else that worries you?"
  ]

  const nextQuestion = answerCount < questions.length
    ? questions[answerCount]
    : "Thank you for sharing that. I have the essentials for your summary now. If there’s anything important we missed, please tell me; otherwise, you can end the call whenever you’re ready."
  const prefix = acknowledgement(sentiment)
  if (sentiment === 'urgent') return prefix
  return prefix ? `${prefix} ${nextQuestion}` : nextQuestion
}

app.post('/api/respond', async (req, res) => {
  const history = (req.body.history || []) as Turn[]
  const latestAnswer = [...history].reverse().find(turn => turn.role === 'user')?.text || ''
  const sentiment = detectSentiment(latestAnswer)
  try {
    if (!client) return res.json({ text: fallback(history), mode: 'demo', sentiment })
    const sentimentContext = `The last response appears ${sentiment}. Acknowledge that emotional tone briefly and naturally before continuing, unless neutral. Do not overstate or diagnose emotions.`
    const completion = await client.chat.completions.create({ model, temperature: 0.55, max_tokens: 110, messages: [{ role: 'system', content: `${system}\n${sentimentContext}` }, ...history.map(t => ({ role: t.role, content: t.text }))] })
    res.json({ text: completion.choices[0]?.message.content || fallback(history), mode: 'ai', sentiment })
  } catch {
    res.json({ text: fallback(history), mode: 'demo', sentiment, warning: 'AI service was unavailable, so Maya continued in demo mode.' })
  }
})

app.post('/api/report', async (req, res) => {
  const history = (req.body.history || []) as Turn[]
  const transcript = history.map(t => `${t.role === 'user' ? 'Patient' : 'Maya'}: ${t.text}`).join('\n')
  const prompt = `Create a concise, non-diagnostic health call summary from this transcript. Return ONLY valid JSON with string fields: patientName, mainConcern, duration, severity, relatedSymptoms, followUp, and a boolean complete. Use “Not discussed” where absent. Be careful not to invent information. Transcript:\n${transcript}`
  try {
    if (client) {
      const completion = await client.chat.completions.create({ model, temperature: 0.15, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You produce accurate medical-intake summaries without diagnoses.' }, { role: 'user', content: prompt }] })
      return res.json(JSON.parse(completion.choices[0]?.message.content || '{}'))
    }
  } catch { /* use safe local report */ }
  const userText = history.filter(t => t.role === 'user').map(t => t.text).join(' ')
  res.json({ patientName: 'Not discussed', mainConcern: userText || 'No concern was recorded', duration: 'Not discussed', severity: 'Not discussed', relatedSymptoms: 'Not discussed', followUp: userText ? 'A clinician can review this summary if symptoms continue or worsen.' : 'The call ended before enough information was collected.', complete: history.filter(t => t.role === 'user').length >= 3 })
})

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

const clientBuild = path.join(process.cwd(), 'dist')
app.use(express.static(clientBuild))
app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.accepts('html')) return next()
  res.sendFile(path.join(clientBuild, 'index.html'))
})

app.listen(port, () => console.log(`Sahayog is listening on port ${port}`))
