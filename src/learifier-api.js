import { ESSENTIALS, MADNESS } from './essentials'

const cache         = new Map()
const wordCache     = new Map()
const inflightCache = new Map()
const datamuseCache = new Map()

if (typeof window !== 'undefined') {
  window.__log = window.__log ?? []
  window.__logReport = () => window.__log.join('\n')
}
function diag(msg) { console.log(msg); if (typeof window !== 'undefined') window.__log.push(msg) }

const STOPWORDS = new Set([
  'i','me','my','we','us','our','you','your','he','him','his','she','her','it','its','they','them','their',
  'this','that','these','those','a','an','the','in','on','at','to','for','of','by','with','from','up','into',
  'and','but','or','nor','so','as','if','is','are','was','were','be','been','have','has','had','do','does',
  'did','will','would','shall','should','may','might','must','can','could','not','no','yes','very','just','also',
])

async function getSynonyms(word) {
  const key = word.toLowerCase()
  if (datamuseCache.has(key)) return datamuseCache.get(key)
  try {
    const res = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(key)}&max=15`)
    const results = await res.json()
    const synonyms = results.map(r => r.word).filter(w => !w.includes(' ') && w !== key).slice(0, 8)
    datamuseCache.set(key, synonyms)
    return synonyms
  } catch { datamuseCache.set(key, []); return [] }
}

async function fetchFromShakespeare(key) {
  if (wordCache.has(key)) return wordCache.get(key)
  if (inflightCache.has(key)) return inflightCache.get(key)

  const queryKey = key
    .replace(/['\u2018\u2019\u02bc]/g, '')
    .replace(/\bfavor/g, 'favour').replace(/\bcolor/g, 'colour')
    .replace(/\bhonor/g, 'honour').replace(/\bneighbor/g, 'neighbour')

  const t0 = performance.now()
  const promise = (async () => {
    try {
      const res  = await fetch(`/api/shakespeare?q=${encodeURIComponent(queryKey)}`)
      const data = await res.json()
      const raw  = JSON.parse(data.parameters)
      const results = Array.isArray(raw) ? raw : []
      const norm = s => s.toLowerCase().replace(/['\u2018\u2019]/g, '').replace(/our/g, 'or')
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
    } finally { inflightCache.delete(key) }
  })()

  inflightCache.set(key, promise)
  return promise
}

const COMMON_WORDS = ['thee','thy','thou','art','hath','doth','wilt','shalt','dost','hast','wherefore','whither','thine','ye','nay']
export function prewarmCommon() {
  COMMON_WORDS.forEach((w, i) => { if (!wordCache.has(w)) setTimeout(() => fetchFromShakespeare(w).catch(() => {}), i * 80) })
}

export function warmWord(word) {
  const key = (word.forms?.[0] ?? word.core).toLowerCase()
  if (!wordCache.has(key)) fetchFromShakespeare(key).catch(() => {})
  if (word.original) {
    const origKey = word.original.replace(/[^a-z']/gi, '').toLowerCase()
    if (origKey && origKey !== key && !wordCache.has(origKey)) fetchFromShakespeare(origKey).catch(() => {})
  }
}

export async function lookupShakespeare(word, originalWord = null) {
  const key     = word.toLowerCase()
  const origKey = originalWord ? originalWord.replace(/[^a-z']/gi, '').toLowerCase() : null
  const t0      = performance.now()

  diag(`[shxp] lookup "${key}"${origKey && origKey !== key ? ` + "${origKey}"` : ''} | cache: primary=${wordCache.has(key)}, fallback=${origKey && origKey !== key ? wordCache.has(origKey) : 'n/a'}`)

  const [primary, fallback] = await Promise.all([
    fetchFromShakespeare(key),
    origKey && origKey !== key ? fetchFromShakespeare(origKey) : Promise.resolve(null),
  ])
  const { exact, related } = primary

  let direct = exact
  if (originalWord && exact.length > 1) {
    const cleanOrig = originalWord.replace(/[^a-z']/gi, '')
    const synonyms  = await getSynonyms(cleanOrig)
    const terms     = new Set([cleanOrig.toLowerCase(), ...synonyms])
    const relevant  = exact.filter(h => h.Definition.toLowerCase().split(/[\s,;()'"\[\]]+/).some(dw => dw.length > 2 && terms.has(dw)))
    if (relevant.length > 0) direct = relevant
  }

  let relatedEntries = related
  if (exact.length === 0 && fallback) relatedEntries = [...related, ...fallback.exact, ...fallback.related]

  diag(`[shxp] lookup "${key}" done → ${direct.length} direct, ${relatedEntries.length} related (${Math.round(performance.now() - t0)}ms total)`)
  return { direct, related: relatedEntries }
}

function annotate(w, o) {
  const m     = w.match(/^([^a-zA-Z]*)([a-zA-Z'][a-zA-Z'-]*)([^a-zA-Z]*)$/)
  const core  = m ? m[2] : w, pre = m ? m[1] : '', post = m ? m[3] : ''
  const key   = core.toLowerCase(), oKey = o.replace(/[^a-z']/gi, '').toLowerCase()
  const entry = ESSENTIALS[key]
  const type  = entry ? 'essential' : key !== oKey ? 'translated' : 'untranslated'
  return { display: w, original: o, core, pre, post, type, isMadness: MADNESS.has(key), ...(entry && { shxp: key, forms: entry.forms, vce_note: entry.vce_note }) }
}

export async function translate(text, onProgress) {
  const trimmed = text.trim()
  if (trimmed.split(/\s+/).length < 3) return null
  if (cache.has(trimmed)) { const r = cache.get(trimmed); onProgress?.(r); return r }

  const origWords    = trimmed.split(/\s+/)
  const contentWords = [...new Set(origWords.map(w => w.replace(/[^a-zA-Z']/g, '').toLowerCase()).filter(w => w.length >= 4 && !STOPWORDS.has(w)))]
  const lookups      = await Promise.all(contentWords.map(async w => ({ word: w, synonyms: await getSynonyms(w) })))
  const vocabHints   = lookups.filter(({ synonyms }) => synonyms.length > 0).map(({ word, synonyms }) => `${word}: ${synonyms.join(', ')}`).join(' | ')

  const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: trimmed, vocabHints }) })
  if (!res.ok) throw new Error(`Translation API error: ${res.status}`)

  const reader = res.body.getReader(), decoder = new TextDecoder()
  let fullText = '', buffer = ''

  const buildWords = t => {
    const tw = t.trim().split(/\s+/).filter(Boolean)
    if (!tw.length) return []
    const pairs = origWords.length === tw.length ? origWords.map((o, i) => ({ o, w: tw[i] })) : tw.map(w => ({ o: w, w }))
    return pairs.map(({ w, o }) => annotate(w, o))
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    fullText += chunk; buffer += chunk
    if (/\s/.test(buffer)) { onProgress?.(buildWords(fullText)); buffer = '' }
  }

  const result = buildWords(fullText)
  cache.set(trimmed, result)
  onProgress?.(result)
  return result
}
