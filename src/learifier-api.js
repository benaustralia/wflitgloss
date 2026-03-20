import { ESSENTIALS, MADNESS } from './essentials'

const cache = new Map(), wordCache = new Map(), inflightCache = new Map(), datamuseCache = new Map()

if (typeof window !== 'undefined') { window.__log = window.__log ?? []; window.__logReport = () => window.__log.join('\n') }
const diag = msg => { console.log(msg); if (typeof window !== 'undefined') window.__log.push(msg) }

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
    const syns = (await (await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(key)}&max=15`)).json()).map(r => r.word).filter(w => !w.includes(' ') && w !== key).slice(0, 8)
    datamuseCache.set(key, syns); return syns
  } catch { datamuseCache.set(key, []); return [] }
}

async function fetchFromShakespeare(key) {
  if (wordCache.has(key)) return wordCache.get(key)
  if (inflightCache.has(key)) return inflightCache.get(key)
  const queryKey = key.replace(/['\u2018\u2019\u02bc]/g,'').replace(/\bfavor/g,'favour').replace(/\bcolor/g,'colour').replace(/\bhonor/g,'honour').replace(/\bneighbor/g,'neighbour')
  const t0 = performance.now()
  const promise = (async () => {
    try {
      const raw = JSON.parse((await (await fetch(`/api/shakespeare?q=${encodeURIComponent(queryKey)}`)).json()).parameters)
      const results = Array.isArray(raw) ? raw : []
      const norm = s => s.toLowerCase().replace(/['\u2018\u2019]/g,'').replace(/our/g,'or')
      const nk = norm(key), valid = results.filter(r => r.Definition && !r.Headword.startsWith('Do you mean:'))
      const result = { exact: valid.filter(r => norm(r.Headword) === nk), related: valid.filter(r => norm(r.Headword) !== nk && norm(r.Headword).startsWith(nk)) }
      wordCache.set(key, result)
      diag(`[shxp] "${key}" → ${result.exact.length}e ${result.related.length}r (${Math.round(performance.now()-t0)}ms)`)
      return result
    } catch (err) {
      diag(`[shxp] "${key}" FAILED: ${err.message}`)
      const empty = { exact:[], related:[] }; wordCache.set(key, empty); return empty
    } finally { inflightCache.delete(key) }
  })()
  inflightCache.set(key, promise); return promise
}

const COMMON_WORDS = ['thee','thy','thou','art','hath','doth','wilt','shalt','dost','hast','wherefore','whither','thine','ye','nay']
export const prewarmCommon = () => COMMON_WORDS.forEach((w, i) => { if (!wordCache.has(w)) setTimeout(() => fetchFromShakespeare(w).catch(() => {}), i * 80) })

export function warmWord(word) {
  const key = (word.forms?.[0] ?? word.core).toLowerCase()
  if (!wordCache.has(key)) fetchFromShakespeare(key).catch(() => {})
  if (word.original) { const ok = word.original.replace(/[^a-z']/gi,'').toLowerCase(); if (ok && ok !== key && !wordCache.has(ok)) fetchFromShakespeare(ok).catch(() => {}) }
}

export async function lookupShakespeare(word, modernWord = null) {
  const key = word.toLowerCase(), modKey = modernWord ? modernWord.replace(/[^a-z']/gi,'').toLowerCase() : null
  const t0 = performance.now()
  diag(`[shxp] lookup "${key}"${modKey && modKey !== key ? ` + "${modKey}"` : ''}`)
  const [primary, fallback] = await Promise.all([fetchFromShakespeare(key), modKey && modKey !== key ? fetchFromShakespeare(modKey) : Promise.resolve(null)])
  const { exact, related } = primary
  const relatedOut = exact.length === 0 && fallback ? [...related, ...fallback.exact] : related
  diag(`[shxp] lookup "${key}" done → ${exact.length}d ${relatedOut.length}r (${Math.round(performance.now()-t0)}ms)`)
  return { direct: exact, related: relatedOut }
}

export function annotate(w, o) {
  if (w === '[modern]') return { display: o, original: o, core: o, pre: '', post: '', type: 'anachronistic', isMadness: false }
  const m = w.match(/^([^a-zA-Z]*)([a-zA-Z'][a-zA-Z'-]*)([^a-zA-Z]*)$/), core = m ? m[2] : w, pre = m ? m[1] : '', post = m ? m[3] : ''
  const key = core.toLowerCase(), oKey = o.replace(/[^a-z']/gi,'').toLowerCase(), entry = ESSENTIALS[key]
  const keyClean = key.replace(/[^a-z']/g,'')
  return { display: w, original: o, core, pre, post, type: entry ? 'essential' : keyClean !== oKey ? 'translated' : 'untranslated', isMadness: MADNESS.has(key), ...(entry && { shxp: key, forms: entry.forms, ...(entry.modern != null && { modern: entry.modern }), ...(entry.vce_note != null && { vce_note: entry.vce_note }) }) }
}

export async function translate(text, onProgress) {
  const trimmed = text.trim()
  if (trimmed.split(/\s+/).length < 3) return null
  if (cache.has(trimmed)) { const r = cache.get(trimmed); onProgress?.(r); return r }
  const origWords    = trimmed.split(/\s+/)
  const contentWords = [...new Set(origWords.map(w => w.replace(/[^a-zA-Z']/g,'').toLowerCase()).filter(w => w.length >= 4 && !STOPWORDS.has(w)))]
  const lookups      = await Promise.all(contentWords.map(async w => ({ word: w, synonyms: await getSynonyms(w) })))
  const vocabHints   = lookups.filter(({ synonyms }) => synonyms.length > 0).map(({ word, synonyms }) => `${word}: ${synonyms.join(', ')}`).join(' | ')
  const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: trimmed, vocabHints }) })
  if (!res.ok) throw new Error(`Translation API error: ${res.status}`)
  const reader = res.body.getReader(), decoder = new TextDecoder()
  let fullText = '', buffer = ''
  const origSet = new Set(origWords.map(w => w.replace(/[^a-z']/gi, '').toLowerCase()))
  const buildWords = t => {
    const tw = t.trim().split(/\s+/).filter(Boolean); if (!tw.length) return []
    if (origWords.length === tw.length) return origWords.map((o, i) => annotate(tw[i], o))
    return tw.map(w => {
      const word = annotate(w, w)
      const clean = word.core.toLowerCase()
      if (word.type === 'untranslated' && !origSet.has(clean) && !STOPWORDS.has(clean)) return { ...word, type: 'translated' }
      return word
    })
  }
  while (true) { const { done, value } = await reader.read(); if (done) break; const chunk = decoder.decode(value, { stream: true }); fullText += chunk; buffer += chunk; if (/\s/.test(buffer)) { onProgress?.(buildWords(fullText)); buffer = '' } }
  const result = buildWords(fullText); cache.set(trimmed, result); onProgress?.(result); return result
}
