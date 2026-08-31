import { useRef, useState } from 'react'

// Small non-interactive trend line for Watchlist cards — a glance, not an analysis.
export function Sparkline({ values, width = 96, height = 28, color }) {
  if (!values || values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="sparkline">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Full price/value trend chart with hover crosshair + tooltip, per the dataviz
// interaction guideline that a line chart ships hover by default. `series` is
// an array of { date, value }.
export function TrendChart({ series, color = '#4f8ef7', height = 240, yFormat = (v) => `$${v.toFixed(0)}` }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const svgRef = useRef(null)
  const width = 640

  if (!series || series.length < 2) {
    return <div className="empty-state">Not enough data to chart.</div>
  }

  const padding = { top: 16, right: 16, bottom: 26, left: 60 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const values = series.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const xFor = (i) => padding.left + (i / (series.length - 1)) * innerW
  const yFor = (v) => padding.top + innerH - ((v - min) / range) * innerH

  const linePoints = series.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)}`).join(' ')
  const baseline = padding.top + innerH
  const areaPoints = `${xFor(0).toFixed(1)},${baseline.toFixed(1)} ${linePoints} ${xFor(series.length - 1).toFixed(1)},${baseline.toFixed(1)}`

  function handleMove(e) {
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * width
    const ratio = Math.min(1, Math.max(0, (relX - padding.left) / innerW))
    setHoverIdx(Math.round(ratio * (series.length - 1)))
  }

  const hovered = hoverIdx !== null ? series[hoverIdx] : null
  const yTicks = [0, 0.5, 1].map((t) => min + t * range)
  const xTickIdxs = [0, Math.floor((series.length - 1) * 0.5), series.length - 1]
  const gradId = `trendFill-${color.replace('#', '')}`

  return (
    <div className="trend-chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        className="trend-chart"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(v)} y2={yFor(v)} className="chart-gridline" />
            <text x={padding.left - 8} y={yFor(v)} textAnchor="end" dominantBaseline="middle" className="chart-axis-label">
              {yFormat(v)}
            </text>
          </g>
        ))}
        {xTickIdxs.map((idx) => (
          <text key={idx} x={xFor(idx)} y={height - 6} textAnchor="middle" className="chart-axis-label">
            {series[idx].date.slice(5)}
          </text>
        ))}
        <polygon points={areaPoints} fill={`url(#${gradId})`} stroke="none" />
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hovered && (
          <>
            <line x1={xFor(hoverIdx)} x2={xFor(hoverIdx)} y1={padding.top} y2={baseline} className="chart-crosshair" />
            <circle cx={xFor(hoverIdx)} cy={yFor(hovered.value)} r="4" fill={color} stroke="var(--panel)" strokeWidth="2" />
          </>
        )}
      </svg>
      {hovered && (
        <div
          className="chart-tooltip"
          style={{ left: `${Math.min(88, Math.max(4, (xFor(hoverIdx) / width) * 100))}%` }}
        >
          <div className="chart-tooltip-date">{hovered.date}</div>
          <div className="chart-tooltip-value">{yFormat(hovered.value)}</div>
        </div>
      )}
    </div>
  )
}
