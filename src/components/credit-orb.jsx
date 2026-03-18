import { useState, useEffect } from 'react'
import { subscribeToCredits, BUDGET } from '@/lib/credits'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SIZE = 44, STROKE = 3.5, R = (SIZE - STROKE) / 2, C = 2 * Math.PI * R

const ringColor = (pct) =>
  pct <= 0 ? '#9ca3af' : pct < 0.15 ? '#ef4444' : pct < 0.4 ? '#f97316' : '#22c55e'

function Ring({ size, strokeWidth, pct, color }) {
  const r = (size - strokeWidth) / 2, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} opacity={0.15} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.22} fill={color} fontFamily="monospace" fontWeight="600">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

export function CreditOrb() {
  const [credits, setCredits] = useState({ remaining: BUDGET, pct: 1, translations: 0 })
  const [open, setOpen] = useState(() => !localStorage.getItem('shakelear-welcomed'))

  useEffect(() => subscribeToCredits(setCredits), [])

  const { remaining, pct, translations } = credits
  const color = ringColor(pct)

  return (
    <>
      <button onClick={() => setOpen(true)} className="cursor-pointer hover:opacity-80 transition-opacity" aria-label="AI credit remaining">
        <Ring size={SIZE} strokeWidth={STROKE} pct={pct} color={color} />
      </button>

      <Dialog open={open} onOpenChange={v => { if (!v) localStorage.setItem('shakelear-welcomed', '1'); setOpen(v) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader className="sr-only"><DialogTitle>AI Credits</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-5 pt-2">
            <h1 className="text-4xl font-bold text-primary text-center">Shake-o-Lingo</h1>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground text-center -mt-3">A 2026 Gift for Whitefriars</p>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Type modern English and watch <strong className="text-foreground">Claude.ai</strong> translate it into Shakespeare's English. With the generous permission of{' '}
                <a href="https://www.shakespeareswords.com/Public/DavidAndBen.aspx" target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:underline">David and Ben Crystal</a>
                , Elizabethan terms are cross‑referenced directly with{' '}
                <a href="https://www.shakespeareswords.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:underline">shakespeareswords.com</a>.
              </p>
              <p><strong className="text-foreground">A Note on the Run:</strong><br />
                While this site manages resources with Voyager-level efficiency, I am personally funding the AI credits. This "walking shadow" is a state-of-the-art pilot for 2026; once the tank runs dry, the curtain falls. Enjoy this frontier of Shakespearean learning while the lights are up.
              </p>
              <p><strong className="text-foreground">Ben Hinton</strong><br />VCE Tutor | Creator of Shake-o-Lingo</p>
            </div>
            <div className="flex flex-col items-center gap-2 pt-2 border-t border-border">
              <Ring size={100} strokeWidth={7} pct={pct} color={color} />
              <p className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color }}>AI Credits</p>
              <p className="text-xs text-muted-foreground font-mono">${remaining.toFixed(2)}/{BUDGET.toFixed(2)} | {translations} translation{translations !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
