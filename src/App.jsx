import { useState, useEffect, useCallback, useRef } from 'react'
import { translate, prewarmCommon } from '@/learifier-api'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { glossaryService } from '@/lib/glossaryService'
import { createHandlers, cap, isBlank, deriveTags } from '@/lib/glossaryHandlers'
import { ListView } from '@/components/list-view'
import { DetailView } from '@/components/detail-view'

const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }

export default function GlossaryApp() {
  const [trans, setTrans] = useState({ words: [], loading: false, error: null, activeWord: null })
  const [s, setS]         = useState({ terms: [], search: '', selected: null, view: 'list', loading: true, error: null, localTerm: null, fetchingIPA: false, flashId: null })
  const sRef          = useRef(s);        useEffect(() => { sRef.current = s }, [s])
  const pendingAddRef = useRef(null)
  const update = u => setS(p => typeof u === 'function' ? u(p) : { ...p, ...u })

  useEffect(() => { prewarmCommon() }, [])

  useEffect(() => {
    glossaryService.getAllTerms()
      .then(terms => update({ terms, tags: deriveTags(terms), error: null, loading: false }))
      .catch(err  => update({ error: err.message || 'Failed to load.', loading: false }))
  }, [])

  useEffect(() => {
    const handler = e => {
      if (e.key !== 'Escape' || document.querySelector('[data-state="open"]')) return
      e.preventDefault(); document.activeElement?.tagName !== 'BODY' && document.activeElement.blur()
      const cur = sRef.current; if (cur.view !== 'detail') return
      const term = cur.localTerm || cur.selected
      if (isBlank(term) && term?.id) {
        update(p => ({ ...p, terms: p.terms.filter(t => t.id !== term.id), view: 'list', selected: null, localTerm: null }))
        glossaryService.deleteTerm(term.id).catch(console.error)
      } else { update({ view: 'list', selected: null, localTerm: null }) }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    if (!s.flashId) return
    const t = setTimeout(() => update({ flashId: null }), 2000)
    if (s.view === 'list') setTimeout(() => document.getElementById(`term-${s.flashId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    return () => clearTimeout(t)
  }, [s.flashId, s.view])

  const autoGenerateIPA = useCallback(debounce(async word => {
    if (!word || sRef.current.localTerm?.ipa?.trim()) return
    update({ fetchingIPA: true })
    const ipa = await glossaryService.getIPA(word).catch(() => null)
    update(p => p.localTerm?.term?.trim().toLowerCase() === word.toLowerCase() && !p.localTerm.ipa?.trim()
      ? { ...p, localTerm: { ...p.localTerm, ipa }, fetchingIPA: false }
      : { ...p, fetchingIPA: false })
  }, 1500), [])

  const handleTranslate = async () => {
    const text = sRef.current.search.trim(); if (!text) return
    setTrans(t => ({ ...t, loading: true, error: null, words: [] }))
    try {
      const result = await translate(text, words => setTrans(t => ({ ...t, loading: false, words })))
      if (!result?.length || result.every(w => w.type === 'untranslated')) { setTrans(t => ({ ...t, loading: false })); return }
      const termData = { term: cap(result.map(w => w.display).join(' ')), definition: cap(text), words: result, ipa: '', tags: [] }
      glossaryService.addTerm(termData).then(id => setS(p => ({ ...p, terms: [{ id, ...termData }, ...p.terms] }))).catch(console.error)
    } catch (e) { setTrans(t => ({ ...t, error: e.message, loading: false })) }
  }

  const h = {
    ...createHandlers({ sRef, update, pendingAddRef, autoGenerateIPA }),
    updateSearch: val => { update({ search: val }); setTrans({ words: [], loading: false, error: null, activeWord: null }) },
  }

  const sortedTerms  = [...(s.terms || [])].sort((a, b) => (a.term || '').localeCompare(b.term || '', undefined, { sensitivity: 'base' }))
  const matchedTermId = s.search.trim() ? s.terms.find(t => (t.term || '').toLowerCase().includes(s.search.toLowerCase()) || (t.definition || '').toLowerCase().includes(s.search.toLowerCase()))?.id ?? null : null
  const showGoButton  = s.search.trim() && !matchedTermId && !trans.loading && !trans.words.length

  return (
    <div className="w-full max-w-xl mx-auto min-h-screen bg-background flex flex-col">
      <Toaster />
      <div className="flex-none px-4 pt-8 pb-0 text-center">
        <h1 className="text-5xl font-bold text-primary">Shake-o-Lingo</h1>
        <h2 className="text-xl text-muted-foreground mt-2">Learn Shakespeare's English</h2>
      </div>
      {s.loading && <div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" /><p className="text-muted-foreground">Loading glossary…</p></div></div>}
      {s.error   && <div className="flex-1 flex items-center justify-center p-4"><Alert variant="destructive" className="max-w-sm"><AlertDescription className="mb-4">{s.error}</AlertDescription><Button onClick={() => window.location.reload()}>Try Again</Button></Alert></div>}
      {!s.loading && !s.error && (s.view === 'list'
        ? <ListView s={s} h={h} trans={trans} setTrans={setTrans} showGoButton={showGoButton} handleTranslate={handleTranslate} sortedTerms={sortedTerms} matchedTermId={matchedTermId} />
        : <DetailView s={s} h={h} autoGenerateIPA={autoGenerateIPA} />)}
    </div>
  )
}
