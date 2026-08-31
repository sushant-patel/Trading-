import { useEffect, useRef, useState } from 'react'

export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
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
      {open && <span className="info-tip-popover">{text}</span>}
    </span>
  )
}
