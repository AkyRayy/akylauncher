import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';

export function Btn(props: {
  children: ReactNode;
  onClick?: () => void;
  kind?: 'signal' | 'ghost' | 'hazard';
  disabled?: boolean;
  style?: CSSProperties;
  title?: string;
}) {
  const { kind = 'ghost', disabled } = props;
  const [hover, setHover] = useState(false);
  const base: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    height: 32,
    padding: '0 16px',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-control)',
    background: 'transparent',
    color: 'var(--bone-100)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'all var(--t-fast) var(--ease)',
    position: 'relative'
  };
  if (kind === 'signal') {
    Object.assign(base, {
      background: 'var(--signal)',
      color: 'var(--ink-950)',
      border: '1px solid var(--signal)',
      fontWeight: 700
    });
    if (hover && !disabled) Object.assign(base, { background: '#d8ff41', borderColor: '#d8ff41' });
  } else if (kind === 'hazard') {
    Object.assign(base, { color: 'var(--hazard)', borderColor: hover && !disabled ? 'var(--hazard)' : 'var(--line)' });
  } else if (hover && !disabled) {
    Object.assign(base, { borderColor: 'var(--bone-400)' });
  }
  return (
    <button
      style={{ ...base, ...props.style }}
      className={hover && !disabled && kind !== 'signal' ? 'corner-marks' : undefined}
      onClick={props.onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={props.title}
    >
      {props.children}
    </button>
  );
}

export function SegmentBar(props: { ratio: number; hazard?: boolean }) {
  const SEGMENTS = 24;
  const filled = Math.round(props.ratio * SEGMENTS);
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 8,
            background: i < filled ? (props.hazard ? 'var(--hazard)' : 'var(--signal)') : 'var(--ink-800)',
            transition: 'background var(--t-fast) var(--ease)'
          }}
        />
      ))}
    </div>
  );
}

export function Tabs<T extends string>(props: {
  items: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
      {props.items.map((it) => {
        const active = it.id === props.active;
        return (
          <button
            key={it.id}
            onClick={() => props.onChange(it.id)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: active ? '2px solid var(--signal)' : '2px solid transparent',
              color: active ? 'var(--bone-100)' : 'var(--bone-400)',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color var(--t-fast) var(--ease)'
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function Row(props: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={props.active ? 'corner-marks' : undefined}
      onClick={props.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 16px',
        height: 48,
        borderBottom: '1px solid var(--line)',
        background: props.active ? 'var(--ink-900)' : hover ? 'var(--ink-900)' : 'transparent',
        cursor: props.onClick ? 'pointer' : 'default',
        transition: 'background var(--t-fast) var(--ease)',
        ...props.style
      }}
    >
      {props.children}
    </div>
  );
}

export function ScreenTitle(props: { kicker: string; title: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        padding: '32px 32px 24px',
        borderBottom: '1px solid var(--line)'
      }}
    >
      <div>
        <div className="t-label" style={{ marginBottom: 8 }}>
          {props.kicker}
        </div>
        <h1 className="t-display" style={{ fontSize: 28, lineHeight: 1 }}>
          {props.title}
        </h1>
      </div>
      {props.right}
    </div>
  );
}
