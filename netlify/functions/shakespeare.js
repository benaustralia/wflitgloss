// GET /api/shakespeare?q=word
// Proxies to shakespeareswords.com and returns with long-lived cache headers
// so the browser caches definitions across page refreshes.
// Words with no glossary entry are stored in Netlify Blobs so all users
// benefit — we never ask shakespeareswords.com about them twice.
import { getStore } from '@netlify/blobs'

export default async (request) => {
  const url    = new URL(request.url)
  const word   = url.searchParams.get('q') ?? ''
  const key    = word.trim().toLowerCase()

  if (!key) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
  }

  // Check universal empty-word cache — if we already know this word has no
  // glossary entry, return immediately without touching shakespeareswords.com
  try {
    const store = getStore('shakespeare-empty')
    const knownEmpty = await store.get(key)
    if (knownEmpty !== null) {
      return new Response(JSON.stringify({ commandName: 'cmd_autocomplete', parameters: '[]' }), { headers })
    }
  } catch {}

  try {
    const upstream = await fetch(
      'https://www.shakespeareswords.com/ajax/AjaxResponder.aspx',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandName: 'cmd_autocomplete', parameters: key }),
      }
    )
    const data = await upstream.json()

    // If no useful entries, record this word as known-empty universally
    const results = (() => { try { return JSON.parse(data.parameters) } catch { return [] } })()
    const hasEntries = Array.isArray(results) && results.some(r => r.Definition && !r.Headword.startsWith('Do you mean:'))
    if (!hasEntries) {
      try { const store = getStore('shakespeare-empty'); await store.set(key, '1') } catch {}
    }

    return new Response(JSON.stringify(data), { headers })
  } catch (err) {
    return new Response(JSON.stringify({ parameters: '[]' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/shakespeare' }
