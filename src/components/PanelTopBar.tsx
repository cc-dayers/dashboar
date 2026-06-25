import type { ReactNode } from 'react'

interface Props {
  left?:   ReactNode
  center?: ReactNode
  right?:  ReactNode
}

export default function PanelTopBar({ left, center, right }: Props) {
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

      {center && (
        <div style={{
          position:  'absolute',
          left:      '50%',
          top:       '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          {center}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  )
}
