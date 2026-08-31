import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const POPOVER_WIDTH = 240
const VIEWPORT_MARGIN = 12

// Cross-cutting "jump to Learn tab" action, dispatched as a DOM event rather
// than threaded as a prop through every parent between here and App — InfoTip
// is nested many levels deep in Watchlist/Backtest/Lab/Portfolio, and none of
// those layers otherwise need to know navigation exists.
export function navigateToLearnConcept(conceptId) {
  window.dispatchEvent(new CustomEvent('tt:learn-nav', { detail: conceptId }))
}

export default function InfoTip({ text, learnId }) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Popovers anchor left by default; flip to right-aligned when that would
  // run past the viewport edge (common for icons near the right side of a card).
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setAlignRight(rect.left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_MARGIN)
  }, [open])

  return (
    <span className="info-tip" ref={ref}>
      <button
        type="button"
        className="info-tip-btn"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-label="More info"
        aria-expanded={open}
      >
        i
      </button>
      {open && (
        <span className={`info-tip-popover${alignRight ? ' align-right' : ''}`} onClick={(e) => e.stopPropagation()}>
          {text}
          {learnId && (
            <button
              type="button"
              className="info-tip-learn-more"
              onClick={(e) => {
                e.stopPropagation()
                navigateToLearnConcept(learnId)
                setOpen(false)
              }}
            >
              Learn more →
            </button>
          )}
        </span>
      )}
    </span>
  )
}
