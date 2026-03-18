// GET /api/shakespeare?q=word
// Proxies to shakespeareswords.com and returns with long-lived cache headers
// so the browser caches definitions across page refreshes.
export default async (request) => {
  const url    = new URL(request.url)
  const word   = url.searchParams.get('q') ?? ''
  const key    = word.trim().toLowerCase()

  if (!key) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

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

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        // Elizabethan definitions don't change — cache for 7 days
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ parameters: '[]' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/shakespeare' }
