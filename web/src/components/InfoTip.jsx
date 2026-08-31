import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const POPOVER_WIDTH = 260
const VIEWPORT_MARGIN = 12
const POPOVER_GAP = 6

// Cross-cutting "jump to Learn tab" action, dispatched as a DOM event rather
// than threaded as a prop through every parent between here and App — InfoTip
// is nested many layers deep in Watchlist/Backtest/Lab/Portfolio/Watch, none of
// those layers otherwise need to know navigation exists.
export function navigateToLearnConcept(conceptId) {
  window.dispatchEvent(new CustomEvent('tt:learn-nav', { detail: conceptId }))
}

export default function InfoTip({ text, learnId }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const btnRef = useRef(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (
        !btnRef.current?.contains(e.target) &&
        !popoverRef.current?.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    // Any scroll — including inside a scrollable table wrapper, not just the
    // page — invalidates the popover's fixed position. Close it instead of
    // leaving it visually detached from the icon that opened it.
    function handleDismiss() {
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleDismiss, true)
    window.addEventListener('resize', handleDismiss)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleDismiss, true)
      window.removeEventListener('resize', handleDismiss)
    }
  }, [open])

  // Rendered through a portal to document.body with viewport-fixed coordinates
  // computed from the trigger button's own bounding rect. A plain absolutely-
  // positioned popover gets silently clipped by ANY ancestor with
  // overflow:auto/hidden (e.g. every table wrapped in .table-wrap) even when
  // it's nowhere near the real viewport edge — escaping via portal sidesteps
  // every such ancestor at once instead of special-casing each one.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const overflowsRight = rect.left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_MARGIN
    setCoords({
      top: rect.bottom + POPOVER_GAP,
      left: overflowsRight ? rect.right - POPOVER_WIDTH : rect.left,
    })
  }, [open])

  return (
    <span className="info-tip">
      <button
        ref={btnRef}
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
      {open && coords && createPortal(
        <span
          ref={popoverRef}
          className="info-tip-popover"
          style={{ top: coords.top, left: coords.left }}
          onClick={(e) => e.stopPropagation()}
        >
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
        </span>,
        document.body
      )}
    </span>
  )
}
