// POST /api/define  { word, original }
// Returns a brief gloss for Shakespearean words not covered by shakespeareswords.com.
// Results are cached permanently in Netlify Blobs — first lookup pays the Claude cost,
// every subsequent request worldwide is served from the blob store instantly.
import { getStore } from '@netlify/blobs'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `You are a concise Early Modern English glossary assistant. Given a Shakespearean word or inflected form, respond with a single raw JSON object — no markdown, no code fences — in this exact shape: {"gloss":"<brief modern English meaning, 2–6 words>","note":"<optional: grammatical note, e.g. third-person singular of desire>"}. Include "note" only when the word is an inflected or contracted form. Never explain, never elaborate beyond these two fields.`

export default async (request) => {
  const { word, original } = await request.json()
  const key = word?.trim().toLowerCase()
  if (!key) return new Response(JSON.stringify(null), { status: 400, headers: { 'Content-Type': 'application/json' } })

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=31536000',
  }

  // Serve from permanent universal cache if available
  try {
    const store = getStore('shakespeare-define')
    const cached = await store.get(key)
    if (cached !== null) return new Response(cached, { headers })
  } catch {}

  // Call Claude for an uncached word
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
    const client = new Anthropic({ apiKey })
    const userContent = original && original !== key
      ? `word: "${key}", modern equivalent: "${original}"`
      : `word: "${key}"`
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    })
    const json = msg.content[0].text.trim()
    JSON.parse(json) // validate before caching
    try { const store = getStore('shakespeare-define'); await store.set(key, json) } catch {}
    return new Response(json, { headers })
  } catch {
    return new Response(JSON.stringify(null), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }
}

export const config = { path: '/api/define' }
