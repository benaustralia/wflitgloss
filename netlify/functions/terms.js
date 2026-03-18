// GET /api/terms — returns all glossary terms as plain JSON without requiring
// the client to load the Firebase SDK. Server-side Firestore REST fetch.
const PROJECT = 'wflitgloss'

function convertValue(v) {
  if ('stringValue'    in v) return v.stringValue
  if ('integerValue'   in v) return Number(v.integerValue)
  if ('doubleValue'    in v) return v.doubleValue
  if ('booleanValue'   in v) return v.booleanValue
  if ('nullValue'      in v) return null
  if ('timestampValue' in v) return { _seconds: Math.floor(new Date(v.timestampValue).getTime() / 1000) }
  if ('arrayValue'     in v) return (v.arrayValue.values ?? []).map(convertValue)
  if ('mapValue'       in v) return convertFields(v.mapValue.fields ?? {})
  return null
}

function convertFields(fields) {
  const obj = {}
  for (const [k, v] of Object.entries(fields ?? {})) obj[k] = convertValue(v)
  return obj
}

export default async (request) => {
  if (request.method !== 'GET') return new Response('', { status: 405 })

  const apiKey = process.env.VITE_FIREBASE_API_KEY
  let allDocs = [], pageToken = null

  // Paginate to handle >100 terms
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/terms`)
    url.searchParams.set('key', apiKey)
    url.searchParams.set('pageSize', '500')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetch(url.toString())
    if (!res.ok) return new Response(JSON.stringify({ error: 'Firestore error' }), { status: 502, headers: { 'Content-Type': 'application/json' } })

    const data = await res.json()
    const docs = (data.documents ?? []).map(doc => ({
      id: doc.name.split('/').pop(),
      ...convertFields(doc.fields),
    }))
    allDocs = allDocs.concat(docs)
    pageToken = data.nextPageToken ?? null
  } while (pageToken)

  // Sort newest-first by createdAt (mirrors the Firestore client behaviour)
  allDocs.sort((a, b) => (b.createdAt?._seconds ?? 0) - (a.createdAt?._seconds ?? 0) || b.id.localeCompare(a.id))

  return new Response(JSON.stringify(allDocs), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
    },
  })
}

export const config = { path: '/api/terms' }
