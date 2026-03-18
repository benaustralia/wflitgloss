import { useState, useEffect, useCallback, useRef } from 'react';
import { TranslationPanel, WordTokens, TranslationKey } from '@/components/learifier';
import { WordSheet } from '@/components/word-sheet';
import { translate, prewarmCommon } from '@/learifier-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Footer } from '@/components/footer';
import { glossaryService } from '@/lib/glossaryService';
import { cn } from '@/lib/utils';

const debounce = (fn, wait) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait) } }
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
const isBlank = t => t && (!t.term?.trim()) && (!t.definition?.trim()) && (!t.ipa?.trim()) && (!t.tags?.length)
const deriveTags = terms => [...new Set(terms.flatMap(t => t.tags || []))].sort()

export default function GlossaryApp() {
  const [trans, setTrans] = useState({ words: [], loading: false, error: null, activeWord: null });
  const [s, setS] = useState({ terms: [], search: '', selected: null, view: 'list', loading: true, error: null, localTerm: null, importJson: '', importStatus: '', fetchingIPA: false, flashId: null, newTag: '' });
  const sRef = useRef(s);
  useEffect(() => { sRef.current = s }, [s]);
  const update = u => setS(p => typeof u === 'function' ? u(p) : { ...p, ...u });
  const pendingAddRef = useRef(null);

  useEffect(() => { prewarmCommon() }, []);

  useEffect(() => {
    (async () => {
      try {
        const allTerms = await glossaryService.getAllTerms();
        update({ terms: allTerms, tags: deriveTags(allTerms), error: null, loading: false });
      } catch (err) { update({ error: err.message || 'Failed to load data.', loading: false }) }
    })()
  }, []);

  useEffect(() => {
    const handler = async e => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-state="open"]')) return;
      e.preventDefault();
      document.activeElement?.tagName !== 'BODY' && document.activeElement.blur();
      const cur = sRef.current;
      if (cur.view === 'detail') {
        const term = cur.localTerm || cur.selected;
        if (isBlank(term) && term?.id) {
          update(p => ({ ...p, terms: p.terms.filter(t => t.id !== term.id), view: 'list', selected: null, localTerm: null }));
          glossaryService.deleteTerm(term.id).catch(console.error);
        } else {
          update({ view: 'list', selected: null, localTerm: null });
        }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  useEffect(() => {
    if (!s.flashId) return;
    const timer = setTimeout(() => update({ flashId: null }), 2000);
    if (s.view === 'list') setTimeout(() => document.getElementById(`term-${s.flashId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return () => clearTimeout(timer);
  }, [s.flashId, s.view]);

  const handleTranslate = async () => {
    const text = sRef.current.search.trim();
    if (!text) return;
    setTrans(t => ({ ...t, loading: true, error: null, words: [] }));
    try {
      const result = await translate(text, words => setTrans(t => ({ ...t, loading: false, words })));
      if (!result?.length) { setTrans(t => ({ ...t, loading: false })); return }
      if (result.every(w => w.type === 'untranslated')) return;
      const termData = { term: cap(result.map(w => w.display).join(' ')), definition: cap(text), words: result, ipa: '', tags: [] };
      glossaryService.addTerm(termData)
        .then(id => setS(p => ({ ...p, terms: [{ id, ...termData }, ...p.terms] })))
        .catch(e => console.error('Auto-save failed:', e));
    } catch (e) { setTrans(t => ({ ...t, error: e.message, loading: false })) }
  };

  const autoGenerateIPA = useCallback(debounce(async word => {
    if (!word || (sRef.current.localTerm?.ipa?.trim())) return;
    update({ fetchingIPA: true });
    try {
      const ipa = await glossaryService.getIPA(word);
      update(p => {
        if (p.localTerm?.term?.trim().toLowerCase() === word.toLowerCase() && !p.localTerm.ipa?.trim())
          return { ...p, localTerm: { ...p.localTerm, ipa }, fetchingIPA: false };
        return { ...p, fetchingIPA: false };
      });
    } catch { update({ fetchingIPA: false }) }
  }, 1500), []);

  const h = {
    inputChange: (field, value) => {
      const v = (field === 'term' || field === 'definition') ? cap(value) : value;
      update(p => ({ ...p, localTerm: { ...p.localTerm, [field]: v } }));
      if (field === 'term' && v.trim().length > 2 && !sRef.current.localTerm?.ipa?.trim()) autoGenerateIPA(v.trim());
    },
    save: async () => {
      update({ loading: true });
      (async () => {
        try {
          const cur = sRef.current;
          if (!cur?.selected) { update({ loading: false }); return }
          let data = { ...cur.localTerm };
          if (data.term?.trim()) data.term = cap(data.term.trim());
          if (data.definition?.trim()) data.definition = cap(data.definition.trim());
          if (cur.newTag?.trim() && !data.tags?.includes(cur.newTag.trim()))
            data.tags = [...(data.tags || []), cur.newTag.trim()];
          if (data.ipa?.trim()) {
            let ipa = data.ipa.trim();
            if (!ipa.startsWith('/')) ipa = '/' + ipa;
            if (!ipa.endsWith('/')) ipa += '/';
            data.ipa = ipa;
          }
          let actualId = cur.selected.id;
          if (pendingAddRef.current) actualId = (await pendingAddRef.current) || actualId;
          const { id: _, ...payload } = data;
          await glossaryService.updateTerm(actualId, payload);
          update(p => {
            const terms = p.terms.map(t => (t.id === actualId || t.id === cur.selected.id) ? { ...t, ...payload, id: actualId } : t);
            return { ...p, terms, selected: null, localTerm: null, view: 'list', loading: false, flashId: actualId, tags: deriveTags(terms), newTag: '' };
          });
          toast.success('Saved successfully');
        } catch (err) { update({ loading: false }); toast.error(err.message || 'Failed to save') }
      })();
    },
    add: async (searchTerm = '') => {
      const tempId = Date.now().toString();
      const termData = { term: cap(searchTerm), definition: '', ipa: '', tags: [] };
      const newTerm = { id: tempId, ...termData };
      update(p => ({ ...p, terms: [newTerm, ...p.terms], selected: newTerm, localTerm: newTerm, view: 'detail', search: searchTerm ? '' : p.search }));
      if (termData.term.length > 2) autoGenerateIPA(termData.term);
      pendingAddRef.current = (async () => {
        try {
          const id = await glossaryService.addTerm(termData);
          update(p => ({ ...p, terms: p.terms.map(t => t.id === tempId ? { ...t, id } : t), selected: p.selected?.id === tempId ? { ...p.selected, id } : p.selected, localTerm: p.localTerm?.id === tempId ? { ...p.localTerm, id } : p.localTerm }));
          pendingAddRef.current = null;
          return id;
        } catch {
          update(p => ({ ...p, terms: p.terms.filter(t => t.id !== tempId), view: 'list', selected: null, localTerm: null, error: 'Failed to add term.' }));
          pendingAddRef.current = null;
          return null;
        }
      })();
    },
    deleteTerm: async id => {
      try {
        await glossaryService.deleteTerm(id);
        update(p => { const terms = p.terms.filter(t => t.id !== id); return { ...p, terms, tags: deriveTags(terms), view: 'list', selected: null, localTerm: null } });
      } catch { update({ error: 'Failed to delete term.' }) }
    },
    goBack: async () => {
      const cur = sRef.current;
      const term = cur.localTerm || cur.selected;
      if (isBlank(term) && term?.id) {
        update(p => ({ ...p, terms: p.terms.filter(t => t.id !== term.id), view: 'list', selected: null, localTerm: null }));
        glossaryService.deleteTerm(term.id).catch(console.error);
      } else if (term?.id) { await h.save() }
      else { update({ view: 'list', selected: null, localTerm: null }) }
    },
    exportTerms: () => {
      const data = sRef.current.terms.map(({ id, ...t }) => t);
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: `shakelear-export-${new Date().toISOString().split('T')[0]}.json` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast.success('Exported successfully');
    },
    importTerms: async () => {
      try {
        update({ importStatus: 'Importing...' });
        const terms = JSON.parse(sRef.current.importJson);
        let success = 0;
        for (const term of terms) {
          if (!term.ipa?.trim()) { try { const ipa = await glossaryService.getIPA(term.term); if (ipa) term.ipa = ipa } catch {} }
          await glossaryService.addTerm({ ...term, term: cap(term.term), definition: cap(term.definition || '') });
          update({ importStatus: `✅ Imported ${++success}/${terms.length}` });
        }
        toast.success(`Imported ${success} terms successfully`);
        update({ importStatus: '', importJson: '' });
        const allTerms = await glossaryService.getAllTerms();
        update({ terms: allTerms, tags: deriveTags(allTerms) });
      } catch (err) { update({ importStatus: `Import failed: ${err.message}` }); toast.error(err.message) }
    },
    cleanupBlankEntries: async () => {
      try {
        update({ importStatus: 'Cleaning up blank entries...' });
        const blanks = sRef.current.terms.filter(t => !t.term?.trim() || t.term === 'Untitled');
        for (const t of blanks) await glossaryService.deleteTerm(t.id);
        update({ importStatus: `✅ Cleaned up ${blanks.length} blank entries!` });
        const allTerms = await glossaryService.getAllTerms();
        update({ terms: allTerms, tags: deriveTags(allTerms) });
      } catch (err) { update({ importStatus: `❌ Cleanup failed: ${err.message}` }) }
    },
    clearAllEntries: async () => {
      try {
        update({ importStatus: 'Clearing all entries...' });
        for (const t of sRef.current.terms) await glossaryService.deleteTerm(t.id);
        update({ importStatus: `✅ Cleared entries!`, terms: [] });
      } catch (err) { update({ importStatus: `❌ Clear failed: ${err.message}` }) }
    },
    capitalizeAllEntries: async () => {
      try {
        update({ importStatus: 'Capitalizing all entries...' });
        let count = 0;
        for (const term of sRef.current.terms) {
          const updates = {};
          if (term.term?.trim()) { const c = cap(term.term.trim()); if (c !== term.term) updates.term = c }
          if (term.definition?.trim()) { const c = cap(term.definition.trim()); if (c !== term.definition) updates.definition = c }
          if (Object.keys(updates).length) { await glossaryService.updateTerm(term.id, updates); count++ }
        }
        update({ importStatus: `✅ Capitalized ${count} entries!` });
        const allTerms = await glossaryService.getAllTerms();
        update({ terms: allTerms });
      } catch (err) { update({ importStatus: `❌ Capitalization failed: ${err.message}` }) }
    },
  };

  const sortedTerms = [...(s.terms || [])].sort((a, b) => (a.term || '').localeCompare(b.term || '', undefined, { sensitivity: 'base' }));
  const matchedTermId = s.search.trim() ? (s.terms.find(t => (t.term || '').toLowerCase().includes(s.search.toLowerCase()) || (t.definition || '').toLowerCase().includes(s.search.toLowerCase()))?.id ?? null) : null;

  useEffect(() => {
    matchedTermId && document.getElementById(`term-${matchedTermId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [matchedTermId]);

  const showGoButton = s.search.trim() && !matchedTermId && !trans.loading && !trans.words.length;

  if (s.loading) return (
    <div className="w-full max-w-xl mx-auto min-h-screen bg-background flex items-center justify-center">
      <div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" /><p className="text-muted-foreground">Loading glossary...</p></div>
    </div>
  );
  if (s.error) return (
    <div className="w-full max-w-xl mx-auto min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center"><div className="text-destructive mb-4">⚠️</div><p className="text-destructive mb-4">{s.error}</p><Button onClick={() => window.location.reload()}>Try Again</Button></div>
    </div>
  );

  return (
    <div className="w-full max-w-xl mx-auto min-h-screen bg-background flex flex-col">
      <Toaster />
      <div className="flex-none px-4 pt-8 pb-0 text-center">
        <h1 className="text-5xl font-bold text-primary animate-in fade-in slide-in-from-bottom-4 duration-1000">Shake-o-Lingo</h1>
        <h2 className="text-xl text-muted-foreground mt-2 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-100">Learn Shakespeare's English</h2>
      </div>

      {s.view === 'list' ? (
        <div className="flex flex-col flex-1 w-full">
          <div className="flex gap-2 items-center px-4 pt-4 pb-2">
            <Input placeholder="Type anything in modern English..." value={s.search}
              onChange={e => { update({ search: e.target.value }); setTrans({ words: [], loading: false, error: null, activeWord: null }) }}
              onKeyDown={e => e.key === 'Enter' && showGoButton && handleTranslate()}
              className="w-full h-10 text-sm" />
            {showGoButton && (
              <Button size="icon" onClick={handleTranslate} aria-label="Translate to Shakespearean"
                className="shrink-0 bg-transparent border border-violet-500 text-violet-500 hover:bg-violet-500/10 hover:border-violet-400 ring-2 ring-violet-500/30 animate-pulse">
                <Sparkles className="h-4 w-4" />
              </Button>
            )}
          </div>

          <TranslationKey />

          {(trans.loading || trans.words.length > 0 || trans.error) && s.search.trim() && (
            <div className="px-4 pb-4 border-b border-border">
              {trans.loading && <p className="text-muted-foreground text-sm italic animate-pulse py-4">Translating…</p>}
              {trans.error && <Alert variant="destructive" className="mt-2"><AlertDescription>{trans.error}</AlertDescription></Alert>}
              {trans.words.length > 0 && <TranslationPanel words={trans.words} loading={false} onTap={word => setTrans(t => ({ ...t, activeWord: word }))} />}
            </div>
          )}

          <div className="flex-1 relative">
            <ScrollArea className="h-full">
              <div className="divide-y divide-border">
                {sortedTerms.map(term => (
                  <div key={term.id} id={`term-${term.id}`}
                    className={cn('p-4 flex flex-col gap-2 transition-all duration-700', (matchedTermId === term.id || s.flashId === term.id) && 'bg-violet-500/15')}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {term.words
                        ? <WordTokens words={term.words} onTap={word => setTrans(t => ({ ...t, activeWord: word }))} />
                        : <div className="font-medium text-base text-foreground break-words">{term.term || 'Untitled'}</div>}
                      {term.ipa && <div className="text-sm text-muted-foreground font-mono">{term.ipa}</div>}
                    </div>
                    {term.definition && <div className="text-sm text-muted-foreground line-clamp-2 break-words">{term.definition}</div>}
                  </div>
                ))}
                {sortedTerms.length === 0 && <div className="p-8 text-center text-muted-foreground">No terms yet</div>}
              </div>
            </ScrollArea>
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </div>
          <WordSheet word={trans.activeWord} onClose={() => setTrans(t => ({ ...t, activeWord: null }))} />
          <Footer onClearAll={s.terms.length > 0 ? () => { if (window.confirm(`Delete all ${s.terms.length} entries?`)) h.clearAllEntries() } : null} />
        </div>
      ) : (
        <div className="flex flex-col w-full">
          <div className="flex-none p-4 border-b border-border bg-background flex items-center sticky top-0 z-10">
            <div className="flex-1"><Button variant="ghost" onClick={h.goBack}><ArrowLeft />Back</Button></div>
            <span className="text-lg font-medium truncate max-w-xs text-center">{s.localTerm?.term || 'New Shakespearean Phrase'}</span>
            <div className="flex-1" />
          </div>
          <div className="p-4 space-y-4 w-full max-w-xl mx-auto">
            <Input placeholder="Shakespearean phrase" value={s.localTerm?.term || ''} onChange={e => h.inputChange('term', e.target.value)} className="h-12 text-lg font-medium" />
            <div className="relative">
              <Input placeholder={s.fetchingIPA ? 'Fetching pronunciation...' : 'IPA'}
                value={s.localTerm?.ipa || ''} onChange={e => h.inputChange('ipa', e.target.value)}
                className={cn('w-full h-12 text-base font-mono pr-10', s.fetchingIPA && 'animate-pulse text-muted-foreground')} />
              <Button size="icon" variant="ghost" disabled={s.fetchingIPA}
                className={cn('absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary', s.fetchingIPA && 'animate-spin')}
                onClick={() => sRef.current.localTerm?.term && autoGenerateIPA(sRef.current.localTerm.term.trim())}>
                <Sparkles />
              </Button>
            </div>
            <Textarea placeholder="Modern English phrase" value={s.localTerm?.definition || ''}
              onChange={e => h.inputChange('definition', e.target.value)} className="w-full min-h-40 text-base resize-none" rows={10} />
          </div>
          <div className="flex-none p-4 border-t border-border bg-background">
            <div className="flex justify-end gap-2 w-full max-w-xl mx-auto">
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive">Delete</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete "{s.localTerm?.term || 'Untitled'}".</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => h.deleteTerm(s.selected.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button onClick={h.save} disabled={s.loading}>Save</Button>
            </div>
          </div>
          <Footer />
        </div>
      )}
    </div>
  );
}
