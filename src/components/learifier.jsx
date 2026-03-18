import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { warmWord } from '@/learifier-api'

function WordToken({ word, onTap }) {
  const cls = [
    'word-token inline-block mr-[0.3em] my-1',
    word.type === 'essential'    && 'text-amber-500 font-bold cursor-pointer hover:text-amber-400',
    word.type === 'translated'   && 'text-foreground cursor-pointer hover:text-foreground/70',
    word.type === 'untranslated' && 'text-muted-foreground/50',
    word.isMadness               && 'madness-word',
  ].filter(Boolean).join(' ')

  const tappable = word.type === 'essential' || word.type === 'translated'
  return (
    <span
      className={cls}
      onMouseEnter={tappable ? () => warmWord(word) : undefined}
      onClick={tappable ? () => onTap(word) : undefined}
    >
      {word.pre}{word.core}{word.post}
    </span>
  )
}

const DOT = 'w-1.5 h-1.5 rounded-full inline-block'

export function WordTokens({ words, onTap }) {
  if (!words?.length) return null
  return (
    <p className="text-base leading-[2] flex flex-wrap">
      {words.map((word, i) => <WordToken key={i} word={word} onTap={onTap} />)}
    </p>
  )
}

export function TranslationPanel({ words, loading, onTap }) {
  const containerRef = useRef(null)
  const prevLen      = useRef(0)

  useGSAP(() => {
    const all = gsap.utils.toArray('.word-token', containerRef.current)
    if (all.length > prevLen.current) {
      if (prevLen.current > 0) gsap.set(all.slice(0, prevLen.current), { opacity: 1, y: 0, filter: 'blur(0px)' })
      gsap.fromTo(
        all.slice(prevLen.current),
        { opacity: 0, y: 12, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, stagger: 0.02, ease: 'power2.out' }
      )
    } else {
      if (all.length) gsap.set(all, { opacity: 1, y: 0, filter: 'blur(0px)' })
    }
    prevLen.current = all.length
    const madness = gsap.utils.toArray('.madness-word', containerRef.current)
    if (madness.length) gsap.to(madness, {
      x: 'random(-2.5, 2.5)', rotation: 'random(-2, 2)',
      duration: 0.18, repeat: -1, repeatRefresh: true,
    })
  }, { scope: containerRef, dependencies: [words], revertOnUpdate: true })

  if (loading) return (
    <p className="px-4 py-6 text-muted-foreground text-sm italic animate-pulse">Translating…</p>
  )

  if (!words.length) return null

  return (
    <div ref={containerRef} className="px-4 pt-4 pb-6">
      <p className="text-lg leading-[2.2] flex flex-wrap">
        {words.map((word, i) => <WordToken key={i} word={word} onTap={onTap} />)}
      </p>
      <div className="mt-4 flex items-center gap-5">
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-amber-500">
          <span className={`${DOT} bg-amber-500`} /> essential
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-foreground">
          <span className={`${DOT} bg-foreground`} /> translated
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
          <span className={`${DOT} bg-muted-foreground/50`} /> unchanged
        </span>
      </div>
    </div>
  )
}
