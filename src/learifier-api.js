import { ESSENTIALS, MADNESS } from './essentials'

const cache         = new Map()
const wordCache     = new Map()  // shakespeareswords cache (word-sheet lookups)
const inflightCache = new Map()  // deduplicates concurrent fetches for the same word
const datamuseCache = new Map()

// Puppeteer-accessible diagnostic log —————————————————————————————————————
// Writes to window.__log so Puppeteer can call window.__log at any time.
// window.__logReport() returns a newline-joined summary string.
if (typeof window !== 'undefined') {
  window.__log = window.__log ?? []
  window.__logReport = () => window.__log.join('\n')
}
function diag(msg) {
  console.log(msg)
  if (typeof window !== 'undefined') window.__log.push(msg)
}
// —————————————————————————————————————————————————————————————————————————

const STOPWORDS = new Set([
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'it', 'its', 'they', 'them', 'their', 'this', 'that',
  'these', 'those', 'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of',
  'by', 'with', 'from', 'up', 'into', 'and', 'but', 'or', 'nor', 'so',
  'as', 'if', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may',
  'might', 'must', 'can', 'could', 'not', 'no', 'yes', 'very', 'just', 'also',
])

// Datamuse: get modern synonyms to guide Claude's Elizabethan word choice
async function getSynonyms(word) {
  const key = word.toLowerCase()
  if (datamuseCache.has(key)) return datamuseCache.get(key)
  try {
    const res = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(key)}&max=15`)
    const results = await res.json()
    const synonyms = results
      .map(r => r.word)
      .filter(w => !w.includes(' ') && w !== key)
      .slice(0, 8)
    datamuseCache.set(key, synonyms)
    return synonyms
  } catch {
    datamuseCache.set(key, [])
    return []
  }
}

// Raw shakespeareswords fetch, cached by headword.
// Returns { exact, related } — exact = headword matches key exactly,
// related = phrase entries starting with key (e.g. "sleep upon" for "sleep")
async function fetchFromShakespeare(key) {
  if (wordCache.has(key))    return wordCache.get(key)
  if (inflightCache.has(key)) return inflightCache.get(key)  // deduplicate concurrent requests

  // Strip apostrophes (crash the server) then normalise American → British spelling
  // so "ill-favored" queries as "ill-favoured" and finds the headword in the index
  const queryKey = key
    .replace(/['\u2018\u2019\u02bc]/g, '')
    .replace(/\bfavor/g, 'favour')
    .replace(/\bcolor/g, 'colour')
    .replace(/\bhonor/g, 'honour')
    .replace(/\bneighbor/g, 'neighbour')

  const t0 = performance.now()
  const promise = (async () => {
    try {
      const res  = await fetch(`/api/shakespeare?q=${encodeURIComponent(queryKey)}`)
      const data = await res.json()
      const raw     = JSON.parse(data.parameters)
      const results = Array.isArray(raw) ? raw : []
      // Normalise apostrophes and British/American -our/-or spelling variants
      // so "ill-favour'd" matches "ill-favored"
      const norm    = s => s.toLowerCase().replace(/['\u2018\u2019]/g, '').replace(/our/g, 'or')
      const normKey = norm(key)
      const valid   = results.filter(r => r.Definition && !r.Headword.startsWith('Do you mean:'))
      const exact   = valid.filter(r => norm(r.Headword) === normKey)
      const related = valid.filter(r => norm(r.Headword) !== normKey && norm(r.Headword).startsWith(normKey))
      const result  = { exact, related }
      wordCache.set(key, result)
      diag(`[shxp] fetch "${key}" (queried "${queryKey}") → ${exact.length} exact, ${related.length} related (${Math.round(performance.now() - t0)}ms)`)
      return result
    } catch (err) {
      diag(`[shxp] fetch "${key}" FAILED (${Math.round(performance.now() - t0)}ms): ${err.message}`)
      const empty = { exact: [], related: [] }
      wordCache.set(key, empty)
      return empty
    } finally {
      inflightCache.delete(key)
    }
  })()

  inflightCache.set(key, promise)
  return promise
}

// Warm the shakespeareswords cache for a single word on hover intent.
// Called from the word token's onMouseEnter — fires at most once per word per session.
// Pre-warm cache for the most frequent Elizabethan words so first taps are instant.
// Staggered 80ms apart to avoid a burst against shakespeareswords.com on load.
const COMMON_WORDS = [
  'thee', 'thy', 'thou', 'art', 'hath', 'doth', 'wilt', 'shalt',
  'dost', 'hast', 'wherefore', 'whither', 'thine', 'ye', 'nay',
]
export function prewarmCommon() {
  COMMON_WORDS.forEach((w, i) => {
    if (!wordCache.has(w)) setTimeout(() => fetchFromShakespeare(w).catch(() => {}), i * 80)
  })
}

export function warmWord(word) {
  const key = (word.forms?.[0] ?? word.core).toLowerCase()
  if (!wordCache.has(key)) fetchFromShakespeare(key).catch(() => {})
  if (word.original) {
    const origKey = word.original.replace(/[^a-z']/gi, '').toLowerCase()
    if (origKey && origKey !== key && !wordCache.has(origKey)) fetchFromShakespeare(origKey).catch(() => {})
  }
}

// shakespeareswords lookup — used by word-sheet after translation.
// Returns { direct: [], related: [] }
//   direct  = definitions for the exact Elizabethan word, filtered to contextual meaning
//   related = phrase entries (e.g. "sleep upon") or fallback entries from the original word
export async function lookupShakespeare(word, originalWord = null) {
  const key     = word.toLowerCase()
  const origKey = originalWord ? originalWord.replace(/[^a-z']/gi, '').toLowerCase() : null
  const t0      = performance.now()

  const primaryCached  = wordCache.has(key)
  const fallbackCached = origKey && origKey !== key ? wordCache.has(origKey) : null
  diag(`[shxp] lookup "${key}"${origKey && origKey !== key ? ` + "${origKey}"` : ''} | cache: primary=${primaryCached}, fallback=${fallbackCached ?? 'n/a'}`)

  // Fire both fetches in parallel — origKey fallback is needed if exact is empty
  const [primary, fallback] = await Promise.all([
    fetchFromShakespeare(key),
    origKey && origKey !== key ? fetchFromShakespeare(origKey) : Promise.resolve(null),
  ])
  const { exact, related } = primary

  // Filter exact matches to the definition(s) most relevant to the original meaning
  let direct = exact
  if (originalWord && exact.length > 1) {
    const cleanOrig = originalWord.replace(/[^a-z']/gi, '')
    const synonyms  = await getSynonyms(cleanOrig)
    const terms     = new Set([cleanOrig.toLowerCase(), ...synonyms])
    const relevant  = exact.filter(h => {
      const defWords = h.Definition.toLowerCase().split(/[\s,;()'"\[\]]+/)
      return defWords.some(dw => dw.length > 2 && terms.has(dw))
    })
    if (relevant.length > 0) direct = relevant
  }

  // If no exact entries, use the pre-fetched fallback entries
  let relatedEntries = related
  if (exact.length === 0 && fallback) {
    relatedEntries = [...related, ...fallback.exact, ...fallback.related]
  }

  diag(`[shxp] lookup "${key}" done → ${direct.length} direct, ${relatedEntries.length} related (${Math.round(performance.now() - t0)}ms total)`)
  return { direct, related: relatedEntries }
}

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

export async function translate(text, onProgress) {
  const trimmed = text.trim()
  if (trimmed.split(/\s+/).length < 3) return null

  if (cache.has(trimmed)) {
    const result = cache.get(trimmed)
    onProgress?.(result)
    return result
  }

  const origWords = trimmed.split(/\s+/)

  // Get Datamuse synonyms for content words in parallel (~600ms, cached after first use)
  const contentWords = [...new Set(
    origWords
      .map(w => w.replace(/[^a-zA-Z']/g, '').toLowerCase())
      .filter(w => w.length >= 4 && !STOPWORDS.has(w))
  )]
  const lookups = await Promise.all(
    contentWords.map(async w => ({ word: w, synonyms: await getSynonyms(w) }))
  )
  const vocabHints = lookups
    .filter(({ synonyms }) => synonyms.length > 0)
    .map(({ word, synonyms }) => `${word}: ${synonyms.join(', ')}`)
    .join(' | ')

  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: trimmed, vocabHints }),
  })
  if (!res.ok) throw new Error(`Translation API error: ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer   = ''

  const buildWords = (t) => {
    const transWords = t.trim().split(/\s+/).filter(Boolean)
    if (!transWords.length) return []
    const pairs = origWords.length === transWords.length
      ? origWords.map((o, i) => ({ o, w: transWords[i] }))
      : transWords.map(w => ({ o: w, w }))
    return pairs.map(({ w, o }) => annotate(w, o))
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    fullText += chunk
    buffer   += chunk
    // Fire on each complete word boundary
    if (/\s/.test(buffer)) {
      onProgress?.(buildWords(fullText))
      buffer = ''
    }
  }

  const result = buildWords(fullText)
  cache.set(trimmed, result)
  onProgress?.(result)
  return result
}
