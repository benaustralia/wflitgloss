import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TranslationPanel, WordTokens, TranslationKey } from '@/components/learifier'
import { WordSheet } from '@/components/word-sheet'
import { Footer } from '@/components/footer'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ListView({ s, h, trans, setTrans, showGoButton, handleTranslate, sortedTerms, matchedTermId }) {
  return (
    <div className="flex flex-col flex-1 w-full">
      <div className="flex gap-2 items-center px-4 pt-4 pb-2">
        <Input placeholder="Type anything in modern English..." value={s.search}
          onChange={e => { h.updateSearch(e.target.value) }}
          onKeyDown={e => e.key === 'Enter' && showGoButton && handleTranslate()}
          className="w-full h-10 text-base" />
        {showGoButton && (
          <Button size="icon" onClick={handleTranslate} aria-label="Translate"
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
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 overflow-hidden">
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
      <Footer />
    </div>
  )
}
