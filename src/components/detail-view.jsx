import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Footer } from '@/components/footer'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DetailView({ s, h, autoGenerateIPA }) {
  return (
    <div className="flex flex-col w-full">
      <div className="flex-none p-4 border-b border-border bg-background flex items-center sticky top-0 z-10">
        <div className="flex-1"><Button variant="ghost" onClick={h.goBack}><ArrowLeft />Back</Button></div>
        <span className="text-lg font-medium truncate max-w-xs text-center">{s.localTerm?.term || 'New Shakespearean Phrase'}</span>
        <div className="flex-1" />
      </div>

      <div className="p-4 space-y-4 w-full max-w-xl mx-auto">
        <Input placeholder="Shakespearean phrase" value={s.localTerm?.term || ''}
          onChange={e => h.inputChange('term', e.target.value)} className="h-12 text-lg font-medium" />
        <div className="relative">
          <Input placeholder={s.fetchingIPA ? 'Fetching pronunciation...' : 'IPA'}
            value={s.localTerm?.ipa || ''} onChange={e => h.inputChange('ipa', e.target.value)}
            className={cn('w-full h-12 text-base font-mono pr-10', s.fetchingIPA && 'animate-pulse text-muted-foreground')} />
          <Button size="icon" variant="ghost" disabled={s.fetchingIPA}
            className={cn('absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary', s.fetchingIPA && 'animate-spin')}
            onClick={() => s.localTerm?.term && autoGenerateIPA(s.localTerm.term.trim())}>
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
  )
}
