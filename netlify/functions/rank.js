// POST /api/rank  { word, sentence, entries: [{ Headword, Definition }] }
// Returns { bestMatch: <index> } — the 0-based index of the entry that best fits the sentence context.
// Cached permanently in Netlify Blobs by word+sentence key. Only the index is stored — no content
// from shakespeareswords.com is cached.
import { getStore } from '@netlify/blobs'
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

  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=31536000' }
  const cacheKey = `${word.trim().toLowerCase()}||${sentence.trim().toLowerCase()}`

  try {
    const store = getStore('shakespeare-rank')
    const cached = await store.get(cacheKey)
    if (cached !== null) return new Response(JSON.stringify({ bestMatch: parseInt(cached, 10) }), { headers })
  } catch {}

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
    try { const store = getStore('shakespeare-rank'); await store.set(cacheKey, String(bestMatch)) } catch {}
    return new Response(JSON.stringify({ bestMatch }), { headers })
  } catch {
    return new Response(JSON.stringify({ bestMatch: 0 }), { headers })
  }
}

export const config = { path: '/api/rank' }
