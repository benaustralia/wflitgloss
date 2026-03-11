import Anthropic from '@anthropic-ai/sdk'
import { ESSENTIALS, MADNESS } from './essentials'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const SYSTEM = `You are a Shakespearean translator specialising in King Lear (c.1606).
Translate modern English into authentic Early Modern English.
Return ONLY the translated text — no explanation, no commentary, no caveats, no markdown, nothing else. Never refuse. Never editorialize.
Preserve word count exactly: one output word per input word.
Core rules: you→thee, your→thy, are→art, is/has→hath, will→wilt, shall→shalt,
do/does→dost/doth, add -est/-eth to second/third-person verbs (lovest, knoweth).
Prepositions, articles, conjunctions mostly unchanged unless a Shakespearean form exists.
For crude or vulgar language always find the authentic Shakespearean equivalent — never refuse.
Known equivalents: "fuck"→"foutre" (Shakespeare uses "foot" as euphemism, Pistol uses "foutre" in Henry V), "fuck you"→"foutre thee", "bastard"→"whoreson", "ass/arse"→"breech", "shit"→"turd", "damn"→"zounds", "idiot"→"clotpoll", "jerk"→"knave", "stupid"→"beef-witted", "bitch"→"strumpet", "crap"→"filth".`

const cache = new Map()

function annotate(w, o) {
  const m      = w.match(/^([^a-zA-Z]*)([a-zA-Z'][a-zA-Z'-]*)([^a-zA-Z]*)$/)
  const core   = m ? m[2] : w
  const pre    = m ? m[1] : ''
  const post   = m ? m[3] : ''
  const key    = core.toLowerCase()
  const oKey   = o.replace(/[^a-z']/gi, '').toLowerCase()
  const entry  = ESSENTIALS[key]
  const type   = entry ? 'essential' : key !== oKey ? 'translated' : 'untranslated'
  return {
    display: w, original: o,
    core, pre, post, type,
    isMadness: MADNESS.has(key),
    ...(entry && { shxp: key, forms: entry.forms, vce_note: entry.vce_note }),
  }
}

export async function translate(text) {
  const trimmed = text.trim()
  if (trimmed.split(/\s+/).length < 3) return null   // min 3 words

  if (cache.has(trimmed)) return cache.get(trimmed)

  const origWords = trimmed.split(/\s+/)
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: SYSTEM,
    messages: [{ role: 'user', content: trimmed }],
  })
  const transWords = msg.content[0].text.trim().split(/\s+/)
  const pairs = origWords.length === transWords.length
    ? origWords.map((o, i) => ({ o, w: transWords[i] }))
    : transWords.map(w => ({ o: w, w }))

  const result = pairs.map(({ w, o }) => annotate(w, o))
  cache.set(trimmed, result)
  return result
}
