import { useState, useEffect, useCallback, useRef } from 'react';
import { TranslationPanel, WordTokens } from '@/components/learifier';
import { WordSheet } from '@/components/word-sheet';
import { translate, warmWord } from '@/learifier-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, ArrowLeft, Volume2, Sparkles } from 'lucide-react';
import { Footer } from '@/components/footer';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { glossaryService } from '@/lib/glossaryService';

const debounce = (func, wait) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); }; };

export default function GlossaryApp() {
  const [translation, setTranslation] = useState({ words: [], loading: false, error: null, activeWord: null });
  const [s, setS] = useState({ terms: [], search: '', selected: null, view: 'list', loading: true, error: null, localTerm: null, importJson: '', importStatus: '', isGeneratingAudio: false, fetchingIPA: false, flashId: null });
  
  // Create a ref that always points to the latest state to avoid stale closures in async handlers
  const sRef = useRef(s);
  useEffect(() => { sRef.current = s; }, [s]);

  const update = (u) => setS(p => typeof u === 'function' ? u(p) : { ...p, ...u });

  const handleTranslate = async () => {
    const text = sRef.current.search.trim();
    if (!text) return;
    setTranslation(t => ({ ...t, loading: true, error: null, words: [] }));
    try {
      const result = await translate(text);
      if (!result?.length) { setTranslation(t => ({ ...t, loading: false })); return; }
      setTranslation(t => ({ ...t, words: result, loading: false }));
      // Skip save if nothing was actually translated
      if (result.every(w => w.type === 'untranslated')) return;
      const elizabethan = result.map(w => w.display).join(' ');
      const termData = {
        term: elizabethan.charAt(0).toUpperCase() + elizabethan.slice(1),
        definition: text.charAt(0).toUpperCase() + text.slice(1),
        words: result,
        ipa: '', tags: [],
      };
      glossaryService.addTerm(termData)
        .then(termId => setS(prev => ({ ...prev, terms: [{ id: termId, ...termData }, ...prev.terms] })))
        .catch(e => console.error('Auto-save failed:', e));
    } catch (e) {
      setTranslation(t => ({ ...t, error: e.message, loading: false }));
    }
  };

  const updateSearch = (val) => {
    update({ search: val });
    setTranslation({ words: [], loading: false, error: null, activeWord: null });
  };

  const pendingAddRef = useRef(null);
  useEffect(() => { (async () => { try { update({ loading: true, error: null }); const allTerms = await glossaryService.getAllTerms(); const allTags = [...new Set(allTerms.flatMap(term => term.tags || []))].sort(); update({ terms: allTerms, tags: allTags, error: null, loading: false }); } catch (err) { const errorMessage = err.message || 'Failed to load data. Please check Firebase configuration.'; console.error('Failed to load glossary data:', err); update({ error: errorMessage, loading: false }); } })(); }, []);
  useEffect(() => { 
    const handleEscape = async (e) => { 
      if (e.key === 'Escape') {
        if (document.querySelector('[data-state="open"]')) return;
        e.preventDefault();
        const currentState = sRef.current;
        if (document.activeElement && document.activeElement.tagName !== 'BODY') { 
          document.activeElement.blur(); 
        } 
        if (currentState.view === 'detail') { 
          const term = currentState.localTerm || currentState.selected; 
          const shouldDelete = term && term.id && (!term.term || term.term.trim() === '') && (!term.definition || term.definition.trim() === '') && (!term.ipa || term.ipa.trim() === '') && (!term.tags || term.tags.length === 0); 
          if (shouldDelete && term.id) { 
            update((prevState) => ({ ...prevState, terms: prevState.terms.filter(t => t.id !== term.id), view: 'list', selected: null, localTerm: null })); 
            glossaryService.deleteTerm(term.id).catch(err => console.error('Failed to delete blank term:', err)); 
          } else {
            update({ view: 'list', selected: null, localTerm: null });
          }
        }
      }
    };
    document.addEventListener('keydown', handleEscape, true); 
    return () => document.removeEventListener('keydown', handleEscape, true); 
  }, []); // Empty deps because we use sRef
  useEffect(() => {
    if (s.flashId) {
      const timer = setTimeout(() => update({ flashId: null }), 2000);
      return () => clearTimeout(timer);
    }
  }, [s.flashId]);
  useEffect(() => {
    if (s.flashId && s.view === 'list') {
      // Small delay to ensure rendering is complete
      setTimeout(() => {
        const element = document.getElementById(`term-${s.flashId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [s.flashId, s.view]);

  // const debouncedSave = useCallback(debounce(async (field, value) => { if (!s.selected) return; try { await glossaryService.updateTerm(s.selected.id, { [field]: value }); update({ terms: s.terms.map(t => t.id === s.selected.id ? {...t, [field]: value} : t), selected: {...s.selected, [field]: value} }); if (field === 'tags') { const allTags = [...new Set(s.terms.flatMap(term => term.tags || []))].sort(); update({ tags: allTags }); } } catch (err) { update({ error: 'Failed to save. Please try again.' }); } }, 500), [s.selected, s.terms]);

  const h = {
    inputChange: (field, value) => {
      // Use direct capitalization if field is term or definition
      let processedValue = value;
      if ((field === 'term' || field === 'definition') && value.length > 0) {
        processedValue = value.charAt(0).toUpperCase() + value.slice(1);
      }

      update(prev => ({ 
        ...prev, 
        localTerm: { ...prev.localTerm, [field]: processedValue } 
      }));
      
      if (field === 'term' && processedValue.trim().length > 2 && (!sRef.current.localTerm?.ipa || sRef.current.localTerm.ipa.trim() === '')) {
        h.autoGenerateIPA(processedValue.trim());
      }
    },
    autoGenerateIPA: useCallback(debounce(async (word) => {
      if (!word) return;
      
      // Check if IPA is already filled to avoid overwriting user input
      if (sRef.current.localTerm?.ipa && sRef.current.localTerm.ipa.trim() !== '') {
        console.log('IPA already exists, skipping auto-generation');
        return;
      }

      update({ fetchingIPA: true });
      try {
        const ipa = await glossaryService.getIPA(word);
        if (ipa) {
          update(prev => {
            // Only update if the term still matches AND IPA is still empty
            if (prev.localTerm?.term?.trim().toLowerCase() === word.toLowerCase() && (!prev.localTerm.ipa || prev.localTerm.ipa.trim() === '')) {
              return { ...prev, localTerm: { ...prev.localTerm, ipa }, fetchingIPA: false };
            }
            return { ...prev, fetchingIPA: false };
          });
        } else {
          update({ fetchingIPA: false });
        }
      } catch (err) {
        console.error('Auto-IPA generation failed:', err);
        update({ fetchingIPA: false });
      }
    }, 1500), []),
    save: async () => {
      update({ loading: true });
      
      // Use a self-executing async function to handle the logic
      (async () => {
        try {
          // Get the latest state from the ref
          const currentState = sRef.current;
          
          if (!currentState || !currentState.selected) {
            console.warn('Save called but no term selected in sRef');
            update({ loading: false });
            return;
          }

          const selectedId = currentState.selected.id;
          console.log('Starting save for ID:', selectedId);
          
          // Auto-add pending tag if user typed it but didn't click Add
          let termToSave = { ...currentState.localTerm };

          // Auto-capitalize first letter of term and definition
          if (termToSave.term && termToSave.term.trim()) {
            const trimmed = termToSave.term.trim();
            termToSave.term = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
          }
          if (termToSave.definition && termToSave.definition.trim()) {
            const trimmed = termToSave.definition.trim();
            termToSave.definition = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
          }

          if (currentState.newTag && currentState.newTag.trim()) {
            const tagToAdd = currentState.newTag.trim();
            if (!termToSave.tags?.includes(tagToAdd)) {
              termToSave.tags = [...(termToSave.tags || []), tagToAdd];
              console.log('Auto-adding pending tag:', tagToAdd);
            }
          }

          // Auto-wrap IPA with slashes if missing
          if (termToSave.ipa && termToSave.ipa.trim()) {
            let ipa = termToSave.ipa.trim();
            if (!ipa.startsWith('/')) ipa = '/' + ipa;
            if (!ipa.endsWith('/')) ipa = ipa + '/';
            termToSave.ipa = ipa;
          }

          // If there's a pending add, wait for it to complete
          let actualId = selectedId;
          if (pendingAddRef.current) {
            console.log('Waiting for pending add to complete...');
            const resolvedId = await pendingAddRef.current;
            if (resolvedId) {
              actualId = resolvedId;
              console.log('Pending add resolved to real ID:', actualId);
            }
          }

          if (!actualId) {
             console.error('Cannot save: no actualId found');
             throw new Error("No valid Firestore ID found for term");
          }

          // Strip ID before saving to Firestore
          const { id: _, ...dataToSave } = termToSave;
          console.log('Saving to Firestore:', actualId, dataToSave);
          await glossaryService.updateTerm(actualId, dataToSave);
          
          update(current => {
            // Find the term in the list. It might still have the temp ID if the 'add' update hasn't run yet.
            const updatedTerms = current.terms.map(t => 
              (t.id === actualId || t.id === selectedId) ? { ...t, ...dataToSave, id: actualId } : t
            );
            
            const allTags = [...new Set(updatedTerms.flatMap(term => term.tags || []))].sort();

            console.log('State update after save successful');
            return {
              ...current,
              terms: updatedTerms,
              selected: null,
              localTerm: null,
              view: 'list',
              loading: false,
              flashId: actualId,
              tags: allTags,
              newTag: ''
            };
          });
          toast.success('Saved successfully');
        } catch (err) {
          console.error('Save failed error details:', err);
          update({ loading: false });
          toast.error(err.message || 'Failed to save');
        }
      })();
    },
    add: async (searchTerm = '') => {
      const initialTerm = searchTerm ? searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1) : '';
      const tempId = Date.now().toString();
      const termData = { term: initialTerm, definition: "", ipa: "", tags: [] };
      const newTerm = { id: tempId, ...termData };

      update(prev => ({
        ...prev,
        terms: [newTerm, ...prev.terms],
        selected: newTerm,
        localTerm: newTerm,
        view: 'detail',
        search: searchTerm ? '' : prev.search
      }));

      if (initialTerm.length > 2) {
        h.autoGenerateIPA(initialTerm);
      }

      pendingAddRef.current = (async () => {
        try {
          const termId = await glossaryService.addTerm(termData);
          update(prev => ({
            ...prev,
            terms: prev.terms.map(t => t.id === tempId ? { ...t, id: termId } : t),
            selected: prev.selected?.id === tempId ? { ...prev.selected, id: termId } : prev.selected,
            localTerm: prev.localTerm?.id === tempId ? { ...prev.localTerm, id: termId } : prev.localTerm
          }));
          pendingAddRef.current = null;
          return termId;
        } catch (err) {
          update(prev => ({
            ...prev,
            error: 'Failed to add term. Please try again.',
            terms: prev.terms.filter(t => t.id !== tempId),
            view: 'list',
            selected: null,
            localTerm: null
          }));
          pendingAddRef.current = null;
          return null;
        }
      })();
    },
    deleteTerm: async (termId) => { 
      try { 
        await glossaryService.deleteTerm(termId); 
        update(prev => {
          const newTerms = prev.terms.filter(t => t.id !== termId); 
          const allTags = [...new Set(newTerms.flatMap(term => term.tags || []))].sort(); 
          return { ...prev, terms: newTerms, tags: allTags, view: 'list', selected: null, localTerm: null };
        });
      } catch (err) { 
        update({ error: 'Failed to delete term. Please try again.' }); 
      } 
    },
    goBack: async () => {
      const currentState = sRef.current;
      const term = currentState.localTerm || currentState.selected;
      const isBlank = term && term.id && (!term.term || term.term.trim() === '') && (!term.definition || term.definition.trim() === '') && (!term.ipa || term.ipa.trim() === '') && (!term.tags || term.tags.length === 0);

      if (isBlank && term?.id) {
        update(prev => ({ ...prev, terms: prev.terms.filter(t => t.id !== term.id), view: 'list', selected: null, localTerm: null }));
        glossaryService.deleteTerm(term.id).catch(err => console.error('Failed to delete blank term:', err));
      } else if (term?.id) {
        await h.save();
      } else {
        update({ view: 'list', selected: null, localTerm: null });
      }
    },
    speak: async (termOrText = null) => {
      let text = '';
      let termObj = null;

      // Get latest state from ref to avoid stale closure
      const currentState = sRef.current;

      if (typeof termOrText === 'string') {
        text = termOrText;
        // Try to find the term object if passed as string (from list view)
        termObj = currentState.terms.find(t => t.term === text);
      } else if (termOrText && typeof termOrText === 'object') {
        // Passed as object (future proofing)
        termObj = termOrText;
        text = termObj.term;
      } else {
        // Fallback to localTerm (detail view)
        termObj = currentState.localTerm;
        text = termObj?.term;
      }

      if (!text || currentState.isGeneratingAudio) return;

      // 1. Check if we have a cached URL in the term object
      if (termObj && termObj.audioUrl) {
        const audio = new Audio(termObj.audioUrl);
        audio.play().catch(e => console.error('Playback error:', e));
        return;
      }

      const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
      if (!apiKey) {
        console.error('No ElevenLabs API key found. Set VITE_ELEVENLABS_API_KEY in .env.local');
        return;
      }

      update({ isGeneratingAudio: true });

      try {
        const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/IKne3meq5aSn9XLyUdCD', {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.3, similarity_boost: 0.3, style: 0.2, use_speaker_boost: true }
          })
        });

        if (response.ok) {
          const audioBlob = await response.blob();

          // Play immediately
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          audio.play()
            .then(() => update({ isGeneratingAudio: false }))
            .catch(e => {
              console.error('Audio playback error:', e);
              update({ isGeneratingAudio: false });
            });

          // 2. Upload to Firebase Storage if we have a valid term ID
          if (termObj && termObj.id && !termObj.id.match(/^\d+$/)) { // Check if ID is not temp timestamp
            try {
              const storageRef = ref(storage, `audio/${termObj.id}.mp3`);
              await uploadBytes(storageRef, audioBlob);
              const downloadUrl = await getDownloadURL(storageRef);

              // 3. Update Firestore with new URL
              await glossaryService.updateTerm(termObj.id, { audioUrl: downloadUrl });

              // Update local state
              update(prev => ({
                ...prev,
                terms: prev.terms.map(t => t.id === termObj.id ? { ...t, audioUrl: downloadUrl } : t),
                localTerm: prev.localTerm && prev.localTerm.id === termObj.id ? { ...prev.localTerm, audioUrl: downloadUrl } : prev.localTerm,
                selected: prev.selected && prev.selected.id === termObj.id ? { ...prev.selected, audioUrl: downloadUrl } : prev.selected
              }));

            } catch (uploadError) {
              console.error('Failed to cache audio:', uploadError);
            }
          }
        } else {
          console.error('ElevenLabs API error:', response.status, response.statusText);
          update({ isGeneratingAudio: false });
        }
      } catch (error) {
        console.error('ElevenLabs error:', error);
        update({ isGeneratingAudio: false });
      }
    },
    exportTerms: () => {
      const currentState = sRef.current;
      const exportData = currentState.terms.map(({ id, ...term }) => term); 
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }); 
      const url = URL.createObjectURL(blob); 
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `shakelear-export-${new Date().toISOString().split('T')[0]}.json`; 
      document.body.appendChild(a); 
      a.click(); 
      document.body.removeChild(a); 
      URL.revokeObjectURL(url); 
      toast.success('Exported successfully'); 
    },
    importTerms: async () => {
      try {
        update({ importStatus: 'Importing...' });
        const currentState = sRef.current;
        const terms = JSON.parse(currentState.importJson); 
        let success = 0; 
        for (const term of terms) { 
          // If IPA is missing, try to fetch it
          if (!term.ipa || term.ipa.trim() === '') {
            try {
              const fetchedIpa = await glossaryService.getIPA(term.term);
              if (fetchedIpa) term.ipa = fetchedIpa;
            } catch (ipaErr) {
              console.warn(`Failed to fetch IPA for ${term.term}:`, ipaErr);
            }
          }
          await glossaryService.addTerm({
            ...term,
            term: term.term.charAt(0).toUpperCase() + term.term.slice(1),
            definition: term.definition ? term.definition.charAt(0).toUpperCase() + term.definition.slice(1) : ''
          }); 
          success++; 
          update({ importStatus: `✅ Imported ${success}/${terms.length}` });
        } 
        toast.success(`Imported ${success} terms successfully`); 
        update({ importStatus: '', importJson: '' }); 
        const allTerms = await glossaryService.getAllTerms(); 
        const allTags = [...new Set(allTerms.flatMap(term => term.tags || []))].sort(); 
        update({ terms: allTerms, tags: allTags }); 
      } catch (err) { 
        update({ importStatus: `Import failed: ${err.message}` }); 
        toast.error(err.message); 
      } 
    },
    cleanupBlankEntries: async () => {
      try {
        update({ importStatus: 'Cleaning up blank entries...' });
        const currentState = sRef.current;
        const blankTerms = currentState.terms.filter(term => !term.term || term.term.trim() === '' || term.term === 'Untitled'); 
        let deleted = 0; 
        for (const term of blankTerms) { 
          await glossaryService.deleteTerm(term.id); 
          deleted++; 
        } 
        update({ importStatus: `✅ Cleaned up ${deleted} blank entries!` }); 
        const allTerms = await glossaryService.getAllTerms(); 
        const allTags = [...new Set(allTerms.flatMap(term => term.tags || []))].sort(); 
        update({ terms: allTerms, tags: allTags }); 
      } catch (err) { 
        update({ importStatus: `❌ Cleanup failed: ${err.message}` }); 
      } 
    },
    clearAllEntries: async () => {
      try {
        update({ importStatus: 'Clearing all entries...' });
        const currentState = sRef.current;
        let deleted = 0;
        for (const term of currentState.terms) {
          await glossaryService.deleteTerm(term.id);
          deleted++;
        }
        update({ importStatus: `✅ Cleared ${deleted} entries!`, terms: [] });
      } catch (err) {
        update({ importStatus: `❌ Clear failed: ${err.message}` });
      }
    },
    capitalizeAllEntries: async () => {
      try {
        update({ importStatus: 'Capitalizing all entries...' });
        const currentState = sRef.current;
        let count = 0;
        for (const term of currentState.terms) {
          let updated = false;
          const updates = {};
          
          if (term.term && term.term.trim()) {
            const trimmed = term.term.trim();
            const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
            if (capitalized !== term.term) {
              updates.term = capitalized;
              updated = true;
            }
          }
          
          if (term.definition && term.definition.trim()) {
            const trimmed = term.definition.trim();
            const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
            if (capitalized !== term.definition) {
              updates.definition = capitalized;
              updated = true;
            }
          }

          if (updated) {
            await glossaryService.updateTerm(term.id, updates);
            count++;
          }
        }
        update({ importStatus: `✅ Capitalized ${count} entries!` });
        const allTerms = await glossaryService.getAllTerms();
        update({ terms: allTerms });
      } catch (err) {
        update({ importStatus: `❌ Capitalization failed: ${err.message}` });
      }
    }
  };

  const getSortedTerms = () =>
    (s.terms || []).slice().sort((a, b) => (a.term || '').localeCompare(b.term || '', undefined, { sensitivity: 'base' }));

  const matchedTermId = s.search.trim()
    ? (s.terms.find(t =>
        (t.term || '').toLowerCase().includes(s.search.toLowerCase()) ||
        (t.definition || '').toLowerCase().includes(s.search.toLowerCase())
      )?.id ?? null)
    : null;

  useEffect(() => {
    if (matchedTermId) {
      const el = document.getElementById(`term-${matchedTermId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [matchedTermId]);

  const showGoButton = s.search.trim() && !matchedTermId && !translation.loading && !translation.words.length;

  if (s.loading) return <div className="w-full max-w-xl mx-auto min-h-screen bg-background flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div><p className="text-muted-foreground">Loading glossary...</p></div></div>;
  if (s.error) return <div className="w-full max-w-xl mx-auto min-h-screen bg-background flex items-center justify-center p-4"><div className="text-center"><div className="text-destructive mb-4">⚠️</div><p className="text-destructive mb-4">{s.error}</p><Button onClick={() => window.location.reload()}>Try Again</Button></div></div>;

  return <div className="w-full max-w-xl mx-auto min-h-screen bg-background flex flex-col">
    <Toaster />
    <div className="flex-none px-4 pt-8 pb-0 text-center">
      <div className="flex items-center justify-center">
        <h1 className="text-5xl font-bold text-primary animate-in fade-in slide-in-from-bottom-4 duration-1000">Shake-o-Lingo</h1>
      </div>
      <h2 className="text-xl text-muted-foreground mt-2 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-100">Learn Shakespeare's English</h2>
    </div>
    {(s.view === 'list' ? <div className="flex flex-col flex-1 w-full">
        {/* Search bar */}
        <div className="flex gap-2 items-center px-4 pt-4 pb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Type anything in modern English..."
              value={s.search}
              onChange={(e) => updateSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && showGoButton && handleTranslate()}
              className="w-full pl-10 h-10 text-sm"
            />
          </div>
          {showGoButton && (
            <div className="relative shrink-0">
              <span className="absolute inset-0 rounded-md bg-primary animate-ping opacity-40 pointer-events-none" />
              <Button className="relative" onClick={handleTranslate}>Go</Button>
            </div>
          )}
        </div>

        {/* Auto-translation panel — appears immediately below search when active */}
        {(translation.loading || translation.words.length > 0 || translation.error) && s.search.trim() && (
          <div className="px-4 pb-4 border-b border-border">
            {translation.loading && (
              <p className="text-muted-foreground text-sm italic animate-pulse py-4">Translating…</p>
            )}
            {translation.error && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>{translation.error}</AlertDescription>
              </Alert>
            )}
            {translation.words.length > 0 && (
              <TranslationPanel
                words={translation.words}
                loading={false}
                onTap={(word) => setTranslation(t => ({ ...t, activeWord: word }))}
              />
            )}
          </div>
        )}

        {/* Term list */}
        <div className="flex-1 relative">
          <ScrollArea className="h-full">
            <div className="divide-y divide-border">
              {getSortedTerms().map(term => (
                <div
                  key={term.id}
                  id={`term-${term.id}`}
                  className={`p-4 flex flex-col gap-2 transition-all duration-700 ${matchedTermId === term.id ? 'bg-primary/20' : s.flashId === term.id ? 'bg-primary/20' : ''}`}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Button size="icon" variant="ghost" onClick={() => h.speak(term.term)} disabled={s.isGeneratingAudio}>
                      <Volume2 />
                    </Button>
                    {term.words
                      ? <WordTokens words={term.words} onTap={(word) => setTranslation(t => ({ ...t, activeWord: word }))} />
                      : <div className="font-medium text-base text-foreground break-words">{term.term || 'Untitled'}</div>
                    }
                    {term.ipa && <div className="text-sm text-muted-foreground font-mono">{term.ipa}</div>}
                  </div>
                  {term.definition && (
                    <div className="text-sm text-muted-foreground line-clamp-2 break-words">{term.definition}</div>
                  )}
                </div>
              ))}
              {getSortedTerms().length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No terms yet</div>
              )}
            </div>
          </ScrollArea>
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
        </div>
        <WordSheet word={translation.activeWord} onClose={() => setTranslation(t => ({ ...t, activeWord: null }))} />
        <Footer onClearAll={s.terms.length > 0 ? () => { if (window.confirm(`Delete all ${s.terms.length} entries?`)) h.clearAllEntries(); } : null} />
      </div> : <div className="flex flex-col w-full">
      <div className="flex-none p-4 border-b border-border bg-background flex items-center sticky top-0 z-10">
        <div className="flex-1">
          <Button variant="ghost" onClick={h.goBack}><ArrowLeft />Back</Button>
        </div>
        <span className="text-lg font-medium truncate max-w-xs text-center">{s.localTerm?.term || 'New Shakespearean Phrase'}</span>
        <div className="flex-1"></div>
      </div>
      {/* Constrain form width for better readability on large screens */}
      <div className="p-4 space-y-4 w-full max-w-xl mx-auto">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Shakespearean phrase" value={s.localTerm?.term || ''} onChange={(e) => h.inputChange('term', e.target.value)} className="flex-1 h-12 text-lg font-medium" />
          </div>
        </div>
        <div className="relative">
          <Input 
            placeholder={s.fetchingIPA ? "Fetching pronunciation..." : "IPA"} 
            value={s.localTerm?.ipa || ''} 
            onChange={(e) => h.inputChange('ipa', e.target.value)} 
            className={`w-full h-12 text-base font-mono pr-10 ${s.fetchingIPA ? 'animate-pulse text-muted-foreground' : ''}`} 
          />
          <Button
            size="icon"
            variant="ghost"
            className={`absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary ${s.fetchingIPA ? 'animate-spin' : ''}`}
            onClick={() => sRef.current.localTerm?.term && h.autoGenerateIPA(sRef.current.localTerm.term.trim())}
            disabled={s.fetchingIPA}
          >
            <Sparkles />
          </Button>
        </div>
        <Textarea placeholder="Modern English phrase" value={s.localTerm?.definition || ''} onChange={(e) => h.inputChange('definition', e.target.value)} className="w-full min-h-40 text-base resize-none" rows={10} />
      </div>
      <div className="flex-none p-4 border-t border-border bg-background">
        <div className="flex justify-end gap-2 w-full max-w-xl mx-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the term
                  "{s.localTerm?.term || 'Untitled'}".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { h.deleteTerm(s.selected.id); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={h.save} disabled={s.loading}>Save</Button>
        </div>
      </div>
      <Footer />
    </div>)}
  </div>;
}