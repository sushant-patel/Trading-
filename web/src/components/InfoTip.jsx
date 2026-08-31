import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const POPOVER_WIDTH = 240
const VIEWPORT_MARGIN = 12

export default function InfoTip({ text }) {
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
        onClick={() => setOpen((o) => !o)}
        aria-label="More info"
        aria-expanded={open}
      >
        i
      </button>
      {open && (
        <span className={`info-tip-popover${alignRight ? ' align-right' : ''}`}>{text}</span>
      )}
    </span>
  )
}
