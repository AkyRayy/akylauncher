import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { aky } from '../bridge';
import { Btn, Row, ScreenTitle } from '../components/primitives';

function facePixels(nick: string): string[] {
  let h = 2166136261;
  for (const c of nick) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const skin = ['#9c7a52', '#8a6a45', '#b08a5e', '#7a5c3c'];
  const px: string[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const isEye = y === 4 && x === 1;
      const c = isEye ? '#ffffff' : y < 2 ? '#3a2f23' : skin[Math.floor(rand() * skin.length)]!;
      px[y * 8 + x] = c;
      px[y * 8 + (7 - x)] = isEye ? '#4a6e3a' : c;
    }
    if (y === 4) { px[y * 8 + 2] = '#1b2a16'; px[y * 8 + 5] = '#1b2a16'; }
  }
  return px;
}

function Face({ nick, skinUrl, size = 64 }: { nick: string; skinUrl?: string | null; size?: number }) {
  const px = useMemo(() => facePixels(nick), [nick]);
  const cell = size / 8;

  if (skinUrl) {
    return (
      <div style={{ width: size, height: size, flexShrink: 0, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <img
          src={skinUrl}
          alt=""
          draggable={false}
          style={{
            width: size * 8,
            height: size * 8,
            imageRendering: 'pixelated',
            marginLeft: -size,
            marginTop: -size,
            display: 'block'
          }}
        />
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', flexShrink: 0, border: '1px solid var(--line)' }}>
      {px.map((c, i) => (
        <div key={i} style={{ width: cell - 0.25, height: cell, background: c }} />
      ))}
    </div>
  );
}

export function Profiles() {
  const { profiles, refresh, setError } = useApp();
  const [nick, setNick] = useState('');
  const [skins, setSkins] = useState<Record<string, string>>({});

  const loadSkins = async () => {
    const entries: Record<string, string> = {};
    for (const p of profiles) {
      if (p.skinPath) {
        const res = await aky.invoke('profiles:getSkin', { id: p.id });
        if (res.dataUrl) entries[p.id] = res.dataUrl;
      }
    }
    setSkins(entries);
  };

  useEffect(() => {
    void loadSkins();
  }, [profiles]);

  const add = async () => {
    try {
      await aky.invoke('profiles:createOffline', { nickname: nick.trim() });
      setNick('');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const uploadSkin = async (id: string) => {
    try {
      const res = await aky.invoke('profiles:setSkin', { id });
      if (res.ok) await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeSkin = async (id: string) => {
    await aky.invoke('profiles:clearSkin', { id });
    await refresh();
  };

  const active = profiles.find((p) => p.active);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScreenTitle kicker={`offline mode · ${profiles.length} аккаунтов`} title="Аккаунты" />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={nick}
              placeholder="ник · 3–16 символов"
              onChange={(e) => setNick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void add()}
              style={{ width: 280, fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
            <Btn kind="signal" onClick={() => void add()}>добавить</Btn>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {profiles.map((p) => (
              <Row
                key={p.id}
                active={p.active}
                onClick={() => void aky.invoke('profiles:setActive', { id: p.id }).then(refresh)}
                style={{ height: 64, padding: '0 32px' }}
              >
                <Face nick={p.nickname} skinUrl={skins[p.id]} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-display" style={{ fontSize: 14 }}>{p.nickname}</div>
                  <div className="t-mono t-dim" style={{ fontSize: 10, marginTop: 2 }}>{p.uuid}</div>
                </div>
                <span className="t-mono t-dim" style={{ fontSize: 10 }}>
                  {p.skinPath ? 'свой скин' : 'авто'}
                </span>
                {p.active && <span className="t-mono" style={{ fontSize: 10, color: 'var(--signal)' }}>активен</span>}
                <Btn
                  style={{ height: 24, padding: '0 8px', fontSize: 9 }}
                  onClick={() => void uploadSkin(p.id)}
                  title="загрузить png 64×64"
                >
                  скин
                </Btn>
                <Btn
                  kind="hazard"
                  style={{ height: 24, padding: '0 8px', fontSize: 9 }}
                  onClick={() => void aky.invoke('profiles:delete', { id: p.id }).then(refresh)}
                >
                  ✕
                </Btn>
              </Row>
            ))}
            {profiles.length === 0 && (
              <div className="t-mono t-dim" style={{ padding: 32, fontSize: 11 }}>0 аккаунтов · добавь ник</div>
            )}
          </div>
        </div>

        <div
          className="dot-matrix"
          style={{
            width: 280,
            flexShrink: 0,
            borderLeft: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16
          }}
        >
          {active ? (
            <>
              <Face nick={active.nickname} skinUrl={skins[active.id]} size={128} />
              <div className="t-display" style={{ fontSize: 18 }}>{active.nickname}</div>
              <div className="t-mono t-dim" style={{ fontSize: 9, maxWidth: 200, textAlign: 'center', wordBreak: 'break-all' }}>
                {active.uuid}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn style={{ fontSize: 10 }} onClick={() => void uploadSkin(active.id)}>
                  загрузить скин
                </Btn>
                {active.skinPath && (
                  <Btn kind="hazard" style={{ fontSize: 10 }} onClick={() => void removeSkin(active.id)}>
                    сбросить
                  </Btn>
                )}
              </div>
              <div className="t-mono t-dim" style={{ fontSize: 9 }}>png 64×64 · classic или slim</div>
            </>
          ) : (
            <span className="t-mono t-dim" style={{ fontSize: 11 }}>нет активного аккаунта</span>
          )}
        </div>
      </div>
    </div>
  );
}
