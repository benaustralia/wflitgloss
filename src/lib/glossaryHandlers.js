import { glossaryService } from './glossaryService'
import { toast } from 'sonner'

export const cap        = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
export const isBlank    = t => t && !t.term?.trim() && !t.definition?.trim() && !t.ipa?.trim() && !t.tags?.length
export const deriveTags = terms => [...new Set(terms.flatMap(t => t.tags || []))].sort()

export function createHandlers({ sRef, update, pendingAddRef, autoGenerateIPA }) {
  const h = {
    inputChange: (field, value) => {
      const v = (field === 'term' || field === 'definition') ? cap(value) : value
      update(p => ({ ...p, localTerm: { ...p.localTerm, [field]: v } }))
      if (field === 'term' && v.trim().length > 2 && !sRef.current.localTerm?.ipa?.trim()) autoGenerateIPA(v.trim())
    },

    save: async () => {
      const cur = sRef.current
      if (!cur?.selected) return
      let data = { ...cur.localTerm }
      if (data.term?.trim())       data.term       = cap(data.term.trim())
      if (data.definition?.trim()) data.definition = cap(data.definition.trim())
      if (data.ipa?.trim()) {
        let ipa = data.ipa.trim()
        if (!ipa.startsWith('/')) ipa = '/' + ipa
        if (!ipa.endsWith('/'))   ipa += '/'
        data.ipa = ipa
      }
      let actualId = cur.selected.id
      if (pendingAddRef.current) actualId = (await pendingAddRef.current) || actualId
      const { id: _, ...payload } = data
      try {
        await glossaryService.updateTerm(actualId, payload)
        update(p => {
          const terms = p.terms.map(t => (t.id === actualId || t.id === cur.selected.id) ? { ...t, ...payload, id: actualId } : t)
          return { ...p, terms, selected: null, localTerm: null, view: 'list', loading: false, flashId: actualId, tags: deriveTags(terms) }
        })
        toast.success('Saved')
      } catch (err) { toast.error(err.message || 'Failed to save') }
    },

    add: async (searchTerm = '') => {
      const tempId   = Date.now().toString()
      const termData = { term: cap(searchTerm), definition: '', ipa: '', tags: [] }
      const newTerm  = { id: tempId, ...termData }
      update(p => ({ ...p, terms: [newTerm, ...p.terms], selected: newTerm, localTerm: newTerm, view: 'detail', search: searchTerm ? '' : p.search }))
      if (termData.term.length > 2) autoGenerateIPA(termData.term)
      pendingAddRef.current = (async () => {
        try {
          const id = await glossaryService.addTerm(termData)
          update(p => ({ ...p,
            terms:     p.terms.map(t => t.id === tempId ? { ...t, id } : t),
            selected:  p.selected?.id  === tempId ? { ...p.selected,  id } : p.selected,
            localTerm: p.localTerm?.id === tempId ? { ...p.localTerm, id } : p.localTerm,
          }))
          pendingAddRef.current = null; return id
        } catch {
          update(p => ({ ...p, terms: p.terms.filter(t => t.id !== tempId), view: 'list', selected: null, localTerm: null }))
          pendingAddRef.current = null; return null
        }
      })()
    },

    deleteTerm: async id => {
      try {
        await glossaryService.deleteTerm(id)
        update(p => { const terms = p.terms.filter(t => t.id !== id); return { ...p, terms, tags: deriveTags(terms), view: 'list', selected: null, localTerm: null } })
      } catch { toast.error('Failed to delete') }
    },

    goBack: async () => {
      const term = sRef.current.localTerm || sRef.current.selected
      if (isBlank(term) && term?.id) {
        update(p => ({ ...p, terms: p.terms.filter(t => t.id !== term.id), view: 'list', selected: null, localTerm: null }))
        glossaryService.deleteTerm(term.id).catch(console.error)
      } else if (term?.id) { await h.save() }
      else { update({ view: 'list', selected: null, localTerm: null }) }
    },
  }
  return h
}
