import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink, X } from 'lucide-react'
import { lookupShakespeare } from '@/learifier-api'

const DISMISS_THRESHOLD = 80

function EntryLink({ entry }) {
  return (
    <a
      href={`https://www.shakespeareswords.com/Public/Glossary.aspx?Id=${entry.Id}`}
      target="_blank"
      rel="noopener noreferrer"
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
  const sheetRef    = useRef(null)
  const backdropRef = useRef(null)
  const dragState   = useRef({ startY: 0, dragging: false })
  const [shown, setShown]     = useState(null)
  const [entries, setEntries] = useState({ direct: [], related: [] })

  // Animate out first, then notify parent — avoids useGSAP revert race
  const animateOut = useCallback(() => {
    gsap.to(sheetRef.current,    { y: '100%', duration: 0.3, ease: 'power2.in', overwrite: true, onComplete: onClose })
    gsap.to(backdropRef.current, { opacity: 0, pointerEvents: 'none', duration: 0.2, overwrite: true })
  }, [onClose])

  // Set initial off-screen state
  useLayoutEffect(() => {
    gsap.set(sheetRef.current,    { y: '100%' })
    gsap.set(backdropRef.current, { opacity: 0, pointerEvents: 'none' })
  }, [])

  // Animate in immediately, populate entries when fetch completes
  useEffect(() => {
    if (!word) return
    setShown(word)
    setEntries({ direct: [], related: [] })
    gsap.to(sheetRef.current,    { y: 0, duration: 0.42, ease: 'power3.out', overwrite: true })
    gsap.to(backdropRef.current, { opacity: 1, pointerEvents: 'auto', duration: 0.25, overwrite: true })
    const t0 = performance.now()
    const _diag = msg => { console.log(msg); if (typeof window !== 'undefined') (window.__log = window.__log ?? []).push(msg) }
    _diag(`[sheet] tap "${word.core}" — lookup start`)
    lookupShakespeare(word.forms?.[0] ?? word.core, word.vce_note ? null : word.original)
      .then(results => {
        const ms = Math.round(performance.now() - t0)
        const total = results.direct.length + results.related.length
        const empty = total === 0 && !word.vce_note
        _diag(`[sheet] "${word.core}" — ${total} entries in ${ms}ms${empty ? ' ⚠️ EMPTY' : ''}`)
        setEntries(results)
      })
      .catch(err => { const msg = `[sheet] "${word.core}" ERROR: ${err.message}`; console.error(msg); if (typeof window !== 'undefined') (window.__log ?? []).push(msg) })
  }, [word])

  // Escape key
  useEffect(() => {
    if (!word) return
    const handler = (e) => { if (e.key === 'Escape') { e.stopPropagation(); animateOut() } }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [word, animateOut])

  // Swipe to dismiss
  const onTouchStart = (e) => {
    dragState.current = { startY: e.touches[0].clientY, dragging: true }
  }
  const onTouchMove = (e) => {
    if (!dragState.current.dragging) return
    const dy = Math.max(0, e.touches[0].clientY - dragState.current.startY)
    gsap.set(sheetRef.current,    { y: dy })
    gsap.set(backdropRef.current, { opacity: Math.max(0, 1 - dy / 300) })
  }
  const onTouchEnd = (e) => {
    if (!dragState.current.dragging) return
    dragState.current.dragging = false
    const dy = Math.max(0, e.changedTouches[0].clientY - dragState.current.startY)
    if (dy > DISMISS_THRESHOLD) {
      gsap.to(sheetRef.current,    { y: '100%', duration: 0.25, ease: 'power2.in', overwrite: true, onComplete: onClose })
      gsap.to(backdropRef.current, { opacity: 0, pointerEvents: 'none', duration: 0.2, overwrite: true })
    } else {
      gsap.to(sheetRef.current,    { y: 0, duration: 0.3, ease: 'power3.out', overwrite: true })
      gsap.to(backdropRef.current, { opacity: 1, duration: 0.2, overwrite: true })
    }
  }

  return (
    <>
      <div
        ref={backdropRef}
        className="fixed inset-0 z-40 bg-black/60"
        onClick={animateOut}
      />
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-xl
                   bg-background border border-border rounded-2xl shadow-2xl
                   max-h-[70vh] flex flex-col"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Button variant="ghost" size="icon" className="absolute right-3 top-3 z-10" onClick={animateOut}>
          <X className="h-4 w-4" />
        </Button>

        {shown && (
          <div className="overflow-y-auto px-6 pt-5 pb-10">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-violet-500 mb-2">
              Elizabethan Word
            </p>
            <h2 className="text-4xl font-bold mb-5 text-foreground">
              {shown.forms?.[0] ?? shown.core}
            </h2>

            {entries.direct.length === 0 && entries.related.length === 0 && (
              <div className="space-y-3 mb-6">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-4/5 rounded-lg" />
              </div>
            )}

            {(entries.direct.length > 0 || entries.related.length > 0) && (
              <div className="mb-6">
                <a
                  href="https://www.shakespeareswords.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity"
                >
                  <img
                    src="https://www.shakespeareswords.com/Images/ShakespearePortrait100px.png"
                    alt="Shakespeare's Words"
                    className="h-12 w-12 rounded-full"
                  />
                  <span className="text-xl font-semibold text-foreground transition-colors">
                    shakespeareswords.com
                  </span>
                </a>

                {entries.direct.length > 0 && (
                  <div className="mb-4">
                    <div className="space-y-2">
                      {entries.direct.map((entry) => (
                        <EntryLink key={entry.Id} entry={entry} />
                      ))}
                    </div>
                  </div>
                )}

                {entries.related.length > 0 && (
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                      Related Word(s)
                    </p>
                    <div className="space-y-2">
                      {entries.related.map((entry) => (
                        <EntryLink key={entry.Id} entry={entry} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
