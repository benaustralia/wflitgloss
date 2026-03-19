import { useState, useEffect } from 'react'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink } from 'lucide-react'
import { lookupShakespeare } from '@/learifier-api'

function EntryLink({ entry }) {
  return (
    <a
      href={`https://www.shakespeareswords.com/Public/Glossary.aspx?Id=${entry.Id}`}
      target="_blank" rel="noopener noreferrer"
      className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors no-underline group"
    >
      <div>
        <span className="text-sm font-medium text-foreground">{entry.Headword}</span>
        <span className="text-sm text-muted-foreground ml-2">{entry.Definition}</span>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
    </a>
  )
}

export function WordSheet({ word, onClose }) {
  const [entries, setEntries] = useState({ direct: [], related: [] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!word) return
    setEntries({ direct: [], related: [] })
    setLoading(true)
    const _diag = msg => { console.log(msg); if (typeof window !== 'undefined') (window.__log = window.__log ?? []).push(msg) }
    _diag(`[sheet] tap "${word.core}" — lookup start`)
    const t0 = performance.now()
    lookupShakespeare(word.forms?.[0] ?? word.core)
      .then(results => {
        const ms = Math.round(performance.now() - t0)
        _diag(`[sheet] "${word.core}" — ${results.direct.length + results.related.length} entries in ${ms}ms`)
        setEntries(results)
        setLoading(false)
      })
      .catch(err => { _diag(`[sheet] "${word.core}" ERROR: ${err.message}`); setLoading(false) })
  }, [word])

  const hasEntries = entries.direct.length > 0 || entries.related.length > 0

  return (
    <Drawer open={!!word} onOpenChange={open => !open && onClose()}>
      <DrawerContent className="max-h-[70vh] max-w-xl mx-auto">
        <div className="overflow-y-auto px-6 pt-2 pb-10">
          {word && <>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-violet-500 mb-2">Elizabethan Word</p>
            <h2 className="text-4xl font-bold mb-5 text-foreground">{word.forms?.[0] ?? word.core}</h2>

            {loading && (
              <div className="space-y-3 mb-6">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-4/5 rounded-lg" />
              </div>
            )}

            {!loading && !hasEntries && (
              <p className="text-sm text-muted-foreground italic">No Elizabethan entries found for this word.</p>
            )}

            {!loading && hasEntries && (
              <div className="mb-6">
                <a href="https://www.shakespeareswords.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity">
                  <img src="https://www.shakespeareswords.com/Images/ShakespearePortrait100px.png"
                    alt="Shakespeare's Words" className="h-12 w-12 rounded-full" />
                  <span className="text-xl font-semibold text-foreground">shakespeareswords.com</span>
                </a>
                {entries.direct.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {entries.direct.map(e => <EntryLink key={e.Id} entry={e} />)}
                  </div>
                )}
                {entries.related.length > 0 && (
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Related Word(s)</p>
                    <div className="space-y-2">
                      {entries.related.map(e => <EntryLink key={e.Id} entry={e} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
