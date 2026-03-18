import { useState, useEffect } from 'react'
import { subscribeToCredits, BUDGET } from '@/lib/credits'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SIZE = 44
const STROKE = 3.5
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

function ringColor(pct) {
  if (pct <= 0)   return '#9ca3af'  // grey — exhausted
  if (pct < 0.15) return '#ef4444'  // red — critical
  if (pct < 0.4)  return '#f97316'  // orange — low
  return '#22c55e'                   // green — healthy
}

function Ring({ size, strokeWidth, pct, color }) {
  const r      = (size - strokeWidth) / 2
  const c      = 2 * Math.PI * r
  const offset = c * (1 - pct)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} opacity={0.15} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
      />
      <text
        x={size/2} y={size/2}
        textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.22}
        fill={color}
        fontFamily="monospace"
        fontWeight="600"
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

export function CreditOrb() {
  const [credits, setCredits] = useState({ remaining: BUDGET, pct: 1, translations: 0 })
  const [open, setOpen]       = useState(true)

  useEffect(() => {
    const unsub = subscribeToCredits(setCredits)
    return unsub
  }, [])

  const { remaining, pct, translations } = credits
  const color = ringColor(pct)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="cursor-pointer hover:opacity-80 transition-opacity"
        aria-label="AI credit remaining"
      >
        <Ring size={SIZE} strokeWidth={STROKE} pct={pct} color={color} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          {/* Hidden title for accessibility */}
          <DialogHeader className="sr-only">
            <DialogTitle>AI Credits</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 pt-2">

            <h1 className="text-4xl font-bold text-primary text-center">Shake-o-Lingo</h1>

            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>
                <strong className="text-foreground">Shake-o-Lingo</strong> is a gift for the 2026 Whitefriars.
                Learn Shakespeare's English by typing modern English;{' '}
                <strong className="text-foreground">Claude.ai</strong> will translate for you.
                With generous permission from{' '}
                <a
                  href="https://www.shakespeareswords.com/Public/DavidAndBen.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground hover:underline"
                >
                  David Crystal &amp; Ben Crystal
                </a>
                , Elizabethan words in your entries are cross‑referenced with shakespeareswords.com.
              </p>
              <p>
                Finally, note that I am footing the bill for the Shake-o-Lingo AI credits, but the
                tank will eventually run dry — even though the site manages resources with
                Voyager-level efficiency. Like all digital dreams, Shake-o-Lingo is a 'walking
                shadow' and will be no more at the end of 2026.
              </p>
              <p>Enjoy learning Shakespeare's English,</p>
              <p>
                <strong className="text-foreground">Ben Hinton</strong><br />
                VCE Tutor (Melbourne) | Creator of Shake-o-Lingo
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 pt-2 border-t border-border">
              <Ring size={100} strokeWidth={7} pct={pct} color={color} />
              <p className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color }}>
                AI Credits
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                ${remaining.toFixed(2)}/${BUDGET.toFixed(2)} | {translations} translation{translations !== 1 ? 's' : ''}
              </p>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
