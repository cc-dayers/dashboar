import type { ReactNode } from 'react'
import BoarMark from './BoarMark'

interface Props {
  left?:  ReactNode
  right?: ReactNode
}

export default function PanelTopBar({ left, right }: Props) {
  return (
    <div style={{
      position:     'relative',
      background:   '#fff',
      borderBottom: '1px solid #e2e8f0',
      padding:      '14px 24px',
      display:      'flex',
      alignItems:   'center',
      gap:          '12px',
      flexWrap:     'wrap',
      flexShrink:   0,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>{left}</div>

      <a
        href="/"
        style={{
          position:  'absolute',
          left:      '50%',
          top:       '50%',
          transform: 'translate(-50%, -50%)',
          display:   'flex',
          opacity:   0.75,
          transition:'opacity 0.15s',
          textDecoration: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.75')}
      >
        <BoarMark size={28} />
      </a>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  )
}
