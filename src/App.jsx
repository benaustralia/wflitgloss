import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Plus, Search, ArrowLeft, Tag, X, ChevronDown, Volume2, Package, Upload, Download, Trash2, Copy } from 'lucide-react';
import { glossaryService } from '@/lib/glossaryService';

const debounce = (func, wait) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; };
const APP_VERSION = "Version 9";

export default function GlossaryApp() {
  const [s, setS] = useState({ terms: [], search: '', selected: null, view: 'list', tags: [], selectedTag: 'all', loading: true, error: null, localTerm: null, newTag: '', importJson: '', importStatus: '', tagDropdownOpen: false, isGeneratingAudio: false });
  const update = (u) => setS(p => typeof u === 'function' ? u(p) : { ...p, ...u }) ;
  useEffect(() => { (async () => { try { update({ loading: true }); const allTerms = await glossaryService.getAllTerms(); const allTags = [...new Set(allTerms.flatMap(term => term.tags || []))].sort(); update({ terms: allTerms, tags: allTags, error: null, loading: false }); } catch (err) { update({ error: 'Failed to load data. Please check Firebase configuration.', loading: false }); } })(); }, []);
  useEffect(() => { update({ localTerm: s.selected }); }, [s.selected]);
  useEffect(() => { const handleClickOutside = (e) => { if (s.tagDropdownOpen && !e.target.closest('.tag-dropdown')) { update({ tagDropdownOpen: false }); } }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, [s.tagDropdownOpen]);
  useEffect(() => { const handleEscape = async (e) => { if (e.key === 'Escape') { e.preventDefault(); if (document.activeElement && document.activeElement.tagName !== 'BODY') { document.activeElement.blur(); } if (s.view === 'detail') { const term = s.localTerm || s.selected; const shouldDelete = term && term.id && (!term.term || term.term.trim() === '') && (!term.definition || term.definition.trim() === '') && (!term.ipa || term.ipa.trim() === '') && (!term.mandarin || term.mandarin.trim() === '') && (!term.tags || term.tags.length === 0); if (shouldDelete && term.id) { update((prevState) => ({ ...prevState, terms: prevState.terms.filter(t => t.id !== term.id), view: 'list', selected: null })); glossaryService.deleteTerm(term.id).catch(err => console.error('Failed to delete blank term:', err)); } else { update({ view: 'list', selected: null }); } } else if (s.view === 'import') { update({ view: 'list' }); } } }; document.addEventListener('keydown', handleEscape, true); return () => document.removeEventListener('keydown', handleEscape, true); }, [s.view, s.localTerm, s.selected]);

  const debouncedSave = useCallback(debounce(async (field, value) => { if (!s.selected) return; try { await glossaryService.updateTerm(s.selected.id, { [field]: value }); update({ terms: s.terms.map(t => t.id === s.selected.id ? {...t, [field]: value} : t), selected: {...s.selected, [field]: value} }); if (field === 'tags') { const allTags = [...new Set(s.terms.flatMap(term => term.tags || []))].sort(); update({ tags: allTags }); } } catch (err) { update({ error: 'Failed to save. Please try again.' }); } }, 500), [s.selected, s.terms]);

  const h = {
    inputChange: (field, value) => { update({ localTerm: { ...s.localTerm, [field]: value } }); debouncedSave(field, value); },
    add: async (searchTerm = '') => { const tempId = Date.now().toString(); const termData = { term: searchTerm, definition: "", ipa: "", mandarin: "", tags: [] }; const newTerm = { id: tempId, ...termData }; update({ terms: [newTerm, ...s.terms], selected: newTerm, view: 'detail', search: searchTerm ? '' : s.search }); try { const termId = await glossaryService.addTerm(termData); update({ terms: s.terms.map(t => t.id === tempId ? { ...t, id: termId } : t), selected: { ...newTerm, id: termId } }); } catch (err) { update({ error: 'Failed to add term. Please try again.', terms: s.terms.filter(t => t.id !== tempId), view: 'list', selected: null }); } },
    delete: async (termId) => { try { await glossaryService.deleteTerm(termId); const newTerms = s.terms.filter(t => t.id !== termId); const allTags = [...new Set(newTerms.flatMap(term => term.tags || []))].sort(); update({ terms: newTerms, tags: allTags }); } catch (err) { update({ error: 'Failed to delete term. Please try again.' }); } },
    goBack: async () => { const term = s.localTerm || s.selected; const shouldDelete = term && term.id && (!term.term || term.term.trim() === '') && (!term.definition || term.definition.trim() === '') && (!term.ipa || term.ipa.trim() === '') && (!term.mandarin || term.mandarin.trim() === '') && (!term.tags || term.tags.length === 0); if (shouldDelete) { const newTerms = s.terms.filter(t => t.id !== term.id); update({ terms: newTerms, view: 'list', selected: null }); glossaryService.deleteTerm(term.id).catch(err => console.error('Failed to delete blank term:', err)); } else { update({ view: 'list', selected: null }); } },
    addTag: () => { if (s.newTag.trim() && !s.localTerm.tags?.includes(s.newTag.trim())) { const updatedTags = [...(s.localTerm.tags || []), s.newTag.trim()]; update({ localTerm: { ...s.localTerm, tags: updatedTags }, newTag: '' }); debouncedSave('tags', updatedTags); } },
    removeTag: (tagToRemove) => { const updatedTags = s.localTerm.tags?.filter(tag => tag !== tagToRemove) || []; update({ localTerm: { ...s.localTerm, tags: updatedTags } }); debouncedSave('tags', updatedTags); },
    speak: async (termText = null) => { const text = termText || s.localTerm?.term; if (!text || s.isGeneratingAudio) return; const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY; console.log('ElevenLabs API Key:', apiKey ? 'Found' : 'Missing'); if (!apiKey) { console.error('No ElevenLabs API key found. Set VITE_ELEVENLABS_API_KEY in .env.local'); return; } update({ isGeneratingAudio: true }); try { console.log('Making ElevenLabs request for:', text); const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/IKne3meq5aSn9XLyUdCD', { method: 'POST', headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': apiKey }, body: JSON.stringify({ text: text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.3, similarity_boost: 0.3, style: 0.2, use_speaker_boost: true } }) }); console.log('ElevenLabs response status:', response.status); if (response.ok) { const audioBlob = await response.blob(); const audio = new Audio(); audio.preload = 'auto'; audio.crossOrigin = 'anonymous'; audio.src = URL.createObjectURL(audioBlob); audio.onloadeddata = () => { console.log('Audio playing...'); audio.play(); update({ isGeneratingAudio: false }); }; audio.onerror = (e) => { console.error('Audio playback error:', e); update({ isGeneratingAudio: false }); }; } else { console.error('ElevenLabs API error:', response.status, response.statusText); update({ isGeneratingAudio: false }); } } catch (error) { console.error('ElevenLabs error:', error); update({ isGeneratingAudio: false }); } },
    exportTerms: () => { const exportData = s.terms.map(({ id, ...term }) => term); const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `fingloss-export-${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); toast.success('Exported successfully'); },
    importTerms: async () => { try { update({ importStatus: 'Importing...' }); const terms = JSON.parse(s.importJson); let success = 0; for (const term of terms) { await glossaryService.addTerm(term); success++; } toast.success(`Imported ${success} terms successfully`); update({ importStatus: '', importJson: '' }); const allTerms = await glossaryService.getAllTerms(); const allTags = [...new Set(allTerms.flatMap(term => term.tags || []))].sort(); update({ terms: allTerms, tags: allTags }); } catch (err) { update({ importStatus: `Import failed: ${err.message}` }); toast.error(err.message); } },
    cleanupBlankEntries: async () => { try { update({ importStatus: 'Cleaning up blank entries...' }); const blankTerms = s.terms.filter(term => !term.term || term.term.trim() === '' || term.term === 'Untitled'); let deleted = 0; for (const term of blankTerms) { await glossaryService.deleteTerm(term.id); deleted++; } update({ importStatus: `✅ Cleaned up ${deleted} blank entries!` }); const allTerms = await glossaryService.getAllTerms(); const allTags = [...new Set(allTerms.flatMap(term => term.tags || []))].sort(); update({ terms: allTerms, tags: allTags }); } catch (err) { update({ importStatus: `❌ Cleanup failed: ${err.message}` }); } }
  };

  const getFilteredTerms = () => { let filtered = s.terms; if (s.selectedTag !== 'all') filtered = filtered.filter(term => term.tags?.includes(s.selectedTag)); if (s.search) filtered = filtered.filter(term => term.term.toLowerCase().includes(s.search.toLowerCase()) || term.definition.toLowerCase().includes(s.search.toLowerCase()) || term.mandarin?.toLowerCase().includes(s.search.toLowerCase()) || term.tags?.some(tag => tag.toLowerCase().includes(s.search.toLowerCase()))); return filtered; };

  if (s.loading) return <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen bg-background flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div><p className="text-muted-foreground">Loading glossary...</p></div></div>;
  if (s.error) return <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen bg-background flex items-center justify-center p-4"><div className="text-center"><div className="text-destructive mb-4">⚠️</div><p className="text-destructive mb-4">{s.error}</p><Button onClick={() => window.location.reload()}>Try Again</Button></div></div>;

  return <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen bg-background flex flex-col">
    <Toaster />
    {s.view === 'list' ? <div className="flex flex-col h-screen w-full">
        <div className="text-center mb-6 px-4 pt-8"><h1 className="text-5xl font-bold text-primary animate-in fade-in slide-in-from-bottom-4 duration-1000">fingloss</h1></div>
        <div className="flex gap-2 items-center px-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search" value={s.search} onChange={(e) => update({ search: e.target.value })} className="w-full pl-10 h-10 text-sm" onKeyDown={(e) => e.key === 'Enter' && s.search && !s.terms.length && h.add(s.search)} /></div>
          {s.tags.length > 0 && <div className="relative tag-dropdown">
            <Button variant="outline" size="sm" onClick={() => update({ tagDropdownOpen: !s.tagDropdownOpen })} className="whitespace-nowrap">
              <Tag />{s.selectedTag === 'all' ? 'All Tags' : s.selectedTag}<ChevronDown />
            </Button>
            {s.tagDropdownOpen && <div className="absolute top-full right-0 mt-1 w-48 bg-background border border-border rounded-md shadow-lg z-50">
              <div className="p-1">
                <Button variant={s.selectedTag === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => { update({ selectedTag: 'all', tagDropdownOpen: false }); }} className="w-full justify-start"><Tag />All Tags</Button>
                {s.tags.map(tag => <Button key={tag} variant={s.selectedTag === tag ? 'default' : 'ghost'} size="sm" onClick={() => { update({ selectedTag: tag, tagDropdownOpen: false }); }} className="w-full justify-start"><Tag />{tag}</Button>)}
              </div>
            </div>}
          </div>}
        </div>
        <div className="flex-1 relative">
          <ScrollArea className="h-full">
            <div className="divide-y divide-border">
              {getFilteredTerms().map(term => <div key={term.id} className="p-4 hover:bg-accent active:bg-accent/80 cursor-pointer transition-colors" onClick={() => { update({ selected: term, view: 'detail' }); }}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                  {term.term && <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); h.speak(term.term); }} disabled={s.isGeneratingAudio} className="h-6 w-6 -ml-1">
                    <Volume2 className="h-3.5 w-3.5" />
                  </Button>}
                  <div className="font-medium text-base text-foreground break-words">{term.term || "Untitled"}</div>
                  {term.ipa && <div className="text-sm text-muted-foreground font-mono">{term.ipa}</div>}
                  {term.mandarin && <div className="text-sm text-muted-foreground font-medium w-full md:w-auto">{term.mandarin}</div>}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2 break-words mb-2">{term.definition || "Tap to add definition"}</div>
                {term.tags && term.tags.length > 0 && <div className="flex flex-wrap gap-1">{term.tags.map(tag => <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary"><Tag className="h-2 w-2 mr-1" />{tag}</span>)}</div>}
              </div>)}
              {s.terms.length === 0 && <div className="p-8 text-center text-muted-foreground">{s.search ? 'No matches - press Enter to create' : 'No terms yet'}</div>}
            </div>
          </ScrollArea>
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
        </div>
        <div className="flex-none p-4"><div className="flex gap-2"><Button className="flex-1" onClick={() => h.add()}><Plus />Add Term</Button><Button className="flex-1" variant="outline" onClick={() => update({ view: 'import' })}><Package />Import/Export</Button></div></div>
        <div className="p-2 text-center">
          <p className="text-xs text-muted-foreground">{APP_VERSION}</p>
        </div>
      </div> : s.view === 'import' ? <div className="flex flex-col h-screen w-full">
      <div className="flex-none p-4 border-b border-border bg-background flex items-center">
        <div className="flex-1">
          <Button variant="ghost" onClick={() => update({ view: 'list' })}><ArrowLeft />Back</Button>
        </div>
        <span className="text-lg font-medium">Import Terms</span>
        <div className="flex-1"></div>
      </div>
      <div className="flex-1 flex flex-col p-4 gap-4">
        <div className="border rounded-lg p-4 bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">JSON Format</span>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText('[{"term": "Algorithm", "definition": "Step-by-step procedure", "ipa": "/ˈælɡərɪðəm/", "mandarin": "算法", "tags": ["computer-science"]}]'); toast.success('Copied to clipboard'); }}>
              <Copy />
              Copy
            </Button>
          </div>
          <pre className="text-xs font-mono overflow-x-auto">{`[{
  "term": "Algorithm",
  "definition": "Step-by-step procedure",
  "ipa": "/ˈælɡərɪðəm/",
  "mandarin": "算法",
  "tags": ["computer-science"]
}]`}</pre>
        </div>
        <Textarea placeholder="Paste your JSON array here..." value={s.importJson} onChange={(e) => update({ importJson: e.target.value })} className="flex-1 text-sm font-mono" />
        {s.importStatus && <Alert variant={s.importStatus.includes('❌') ? 'destructive' : 'default'}><AlertDescription>{s.importStatus}</AlertDescription></Alert>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={h.exportTerms}>
            <Upload />
            Export
          </Button>
          <Button onClick={h.importTerms} disabled={!s.importJson.trim()}>
            <Download />
            Import
          </Button>
        </div>
      </div>
      <div className="p-2 text-center">
        <p className="text-xs text-muted-foreground">{APP_VERSION}</p>
      </div>
    </div> : <div className="flex flex-col h-screen w-full">
      <div className="flex-none p-4 border-b border-border bg-background flex justify-between items-center">
        <Button variant="ghost" onClick={h.goBack}><ArrowLeft />Back</Button>
        <span className="text-lg font-medium truncate max-w-xs">{s.localTerm?.term || 'New Term'}</span>
        <Button variant="destructive" size="sm" onClick={() => { if (confirm('Delete this term?')) { h.delete(s.selected.id); update({ view: 'list', selected: null }); } }}>Delete</Button>
      </div>
      <ScrollArea className="flex-1"><div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Term" value={s.localTerm?.term || ''} onChange={(e) => h.inputChange('term', e.target.value)} className="flex-1 h-12 text-lg font-medium" />
            {s.localTerm?.term && (
              <Button size="sm" variant="outline" onClick={h.speak} disabled={s.isGeneratingAudio}>
                <Volume2 />
                {s.isGeneratingAudio ? 'Loading...' : 'Listen'}
              </Button>
            )}
          </div>
        </div>
        <Input placeholder="IPA" value={s.localTerm?.ipa || ''} onChange={(e) => h.inputChange('ipa', e.target.value)} className="w-full h-12 text-base font-mono" />
        <Input placeholder="Mandarin" value={s.localTerm?.mandarin || ''} onChange={(e) => h.inputChange('mandarin', e.target.value)} className="w-full h-12 text-base" />
        <Textarea placeholder="Definition" value={s.localTerm?.definition || ''} onChange={(e) => h.inputChange('definition', e.target.value)} className="w-full min-h-40 text-base resize-none" rows={10} />
        <div className="space-y-3">{s.localTerm?.tags && s.localTerm.tags.length > 0 && <div className="flex flex-wrap gap-2">{s.localTerm.tags.map(tag => <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary"><Tag className="h-3 w-3 mr-1" />{tag}<button onClick={() => h.removeTag(tag)} className="ml-2 hover:text-primary/80"><X className="h-3 w-3" /></button></span>)}</div>}<div className="flex gap-2"><Input placeholder="Tag" value={s.newTag} onChange={(e) => update({ newTag: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && h.addTag()} className="flex-1 text-sm" /><Button size="sm" variant="outline" onClick={h.addTag} disabled={!s.newTag.trim()}><Tag />Add</Button></div></div>
      </div></ScrollArea>
      <div className="p-2 text-center">
        <p className="text-xs text-muted-foreground">{APP_VERSION}</p>
      </div>
    </div>}
  </div>;
}