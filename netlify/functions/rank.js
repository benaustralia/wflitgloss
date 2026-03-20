// POST /api/rank  { word, sentence, entries: [{ Headword, Definition }] }
// Returns { bestMatch: <index> } — the 0-based index of the entry that best fits the sentence context.
// Fast and cheap (single integer response). Not cached — depends on sentence context.
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `You are a Shakespeare scholar. Given a word, a sentence in Early Modern English, and a numbered list of dictionary definitions, respond with only the 0-based index (a single integer, nothing else) of the definition that best matches the word's meaning in that sentence.`

export default async (request) => {
  const { word, sentence, entries } = await request.json()
  if (!word || !sentence || !entries?.length) {
    return new Response(JSON.stringify({ bestMatch: 0 }), { headers: { 'Content-Type': 'application/json' } })
  }
  if (entries.length === 1) {
    return new Response(JSON.stringify({ bestMatch: 0 }), { headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
    const client = new Anthropic({ apiKey })
    const entryList = entries.map((e, i) => `${i}: ${e.Headword} — ${e.Definition}`).join('\n')
    const userContent = `word: "${word}"\nsentence: "${sentence}"\ndefinitions:\n${entryList}`
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5,
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    })
    const idx = parseInt(msg.content[0].text.trim(), 10)
    const bestMatch = isNaN(idx) || idx < 0 || idx >= entries.length ? 0 : idx
    return new Response(JSON.stringify({ bestMatch }), { headers: { 'Content-Type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ bestMatch: 0 }), { headers: { 'Content-Type': 'application/json' } })
  }
}

export const config = { path: '/api/rank' }
