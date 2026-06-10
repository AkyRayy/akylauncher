import { useEffect, useState } from 'react';
import { aky } from '../bridge';
import logo from '../../assets/icons/logo.png';
import type { UpdateInfo } from '@shared/types';

const btnStyle: React.CSSProperties = {
  width: 40,
  height: '100%',
  background: 'transparent',
  border: 'none',
  color: 'var(--bone-400)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  cursor: 'pointer'
};

export function Titlebar() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    void aky.invoke('app:checkUpdate').then(setUpdate).catch(() => undefined);
  }, []);

  return (
    <div
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--line)',
        background: 'var(--ink-950)',
        WebkitAppRegion: 'drag',
        flexShrink: 0
      } as React.CSSProperties}
    >
      <img src={logo} alt="" style={{ width: 20, height: 20, marginLeft: 10 }} draggable={false} />
      <span className="t-mono" style={{ fontSize: 11, letterSpacing: '0.1em', marginLeft: 10, color: 'var(--bone-400)' }}>
        AKYLAUNCHER <span style={{ color: 'var(--signal)' }}>v1.0 BETA</span>
      </span>

      {update?.available && update.url && (
        <a
          href={update.url}
          target="_blank"
          rel="noreferrer"
          className="t-mono"
          style={{
            marginLeft: 16,
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-950)',
            background: 'var(--signal)',
            padding: '2px 8px',
            borderRadius: 2,
            textDecoration: 'none',
            WebkitAppRegion: 'no-drag'
          } as React.CSSProperties}
          title={`доступно обновление ${update.latest}`}
        >
          update {update.latest}
        </a>
      )}

      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button style={btnStyle} onClick={() => void aky.invoke('win:minimize')} title="свернуть"
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--bone-100)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--bone-400)')}>
          —
        </button>
        <button style={btnStyle} onClick={() => void aky.invoke('win:maximize')} title="развернуть"
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--bone-100)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--bone-400)')}>
          ▢
        </button>
        <button style={btnStyle} onClick={() => void aky.invoke('win:close')} title="закрыть"
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--hazard)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--bone-400)'; }}>
          ✕
        </button>
      </div>
    </div>
  );
}
