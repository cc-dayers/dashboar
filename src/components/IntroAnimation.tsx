import { useEffect, useRef, useState } from 'react'
import './IntroAnimation.css'

// ── Config ────────────────────────────────────────────────────────────────────

const N_TB = 18   // bulbs along top and bottom
const N_LR = 5    // bulbs along left and right
const STAGGER = 0.018 // seconds between each bulb

// Total animation duration: last bulb end vs. text animation end, plus hold time
const TOTAL_BULBS   = 2 * N_TB + 2 * N_LR
const LAST_BULB_END = (TOTAL_BULBS - 1) * STAGGER + 0.15
const TEXT_END      = 0.65 + 0.6
const HOLD_MS       = Math.max(LAST_BULB_END, TEXT_END) * 1000 + 900

// ── Clockwise delay indices ───────────────────────────────────────────────────
//
// Top    (L→R):   0 .. N_TB-1
// Right  (T→B):   N_TB .. N_TB+N_LR-1
// Bottom (R→L):   rightmost gets N_TB+N_LR, leftmost gets 2*N_TB+N_LR-1
// Left   (B→T):   bottommost gets 2*N_TB+N_LR, topmost gets 2*N_TB+2*N_LR-1

const topDelays = Array.from({ length: N_TB }, (_, i) => i)

const rightDelays = Array.from({ length: N_LR }, (_, i) => N_TB + i)

// Position 0 = leftmost DOM node, but bottom-left lights up last → largest index
const bottomDelays = Array.from(
  { length: N_TB },
  (_, i) => N_TB + N_LR + (N_TB - 1 - i),
)

// Position 0 = topmost DOM node, but top lights up last → largest index
const leftDelays = Array.from(
  { length: N_LR },
  (_, i) => 2 * N_TB + N_LR + (N_LR - 1 - i),
)

// ── Sub-components ────────────────────────────────────────────────────────────

function Bulb({ delay }: { delay: number }) {
  return (
    <div
      className="intro-bulb"
      style={{ animationDelay: `${delay * STAGGER}s` }}
    />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  onDone: () => void
}

export default function IntroAnimation({ onDone }: Props) {
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const [animated, setAnimated] = useState(false)
  const [fading,   setFading]   = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setAnimated(true), 80)
    const t2 = setTimeout(() => setFading(true), HOLD_MS)
    const t3 = setTimeout(() => onDoneRef.current(), HOLD_MS + 450)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const skip = () => {
    setFading(true)
    setTimeout(() => onDoneRef.current(), 380)
  }

  return (
    <div
      className={`intro-overlay${fading ? ' intro-overlay--fade' : ''}`}
      onClick={skip}
    >
      <div className={`intro-board${animated ? ' intro-board--animate' : ''}`}>

        <div className="intro-lights intro-lights--top">
          {topDelays.map(d => <Bulb key={d} delay={d} />)}
        </div>

        <div className="intro-lights intro-lights--left">
          {leftDelays.map(d => <Bulb key={d} delay={d} />)}
        </div>

        <div className="intro-marquee-text">Survey Says</div>

        <div className="intro-lights intro-lights--right">
          {rightDelays.map(d => <Bulb key={d} delay={d} />)}
        </div>

        <div className="intro-lights intro-lights--bottom">
          {bottomDelays.map(d => <Bulb key={d} delay={d} />)}
        </div>

      </div>

      <p className="intro-skip-hint">click to skip</p>
    </div>
  )
}
