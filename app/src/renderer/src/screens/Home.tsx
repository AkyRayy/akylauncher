import { useState } from 'react';
import { useApp } from '../state/store';
import { aky } from '../bridge';
import { Btn, Row, SegmentBar } from '../components/primitives';
import type { InstanceConfig, LoaderKind } from '@shared/types';

function fmtAgo(iso: string | null): string {
  if (!iso) return 'никогда';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} дн назад`;
}

export function Home() {
  const { instances, profiles, selectedInstanceId, selectInstance, progress, game, setError, setScreen, refresh } =
    useApp();
  const inst = instances.find((i) => i.id === selectedInstanceId) ?? null;
  const profile = profiles.find((p) => p.active) ?? null;
  const [creating, setCreating] = useState(false);

  const launch = async () => {
    if (!inst) return;
    setScreen('console');
    try {
      await aky.invoke('game:launch', { instanceId: inst.id });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div
        className="dot-matrix"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: 40,
          minWidth: 0
        }}
      >
        <div className="t-label">{inst ? `profile · ${inst.name}` : 'profile · —'}</div>
        <div
          className="t-display"
          style={{
            fontSize: 'clamp(56px, 9vw, 96px)',
            lineHeight: 0.95,
            margin: '8px 0 16px',
            letterSpacing: '-0.01em'
          }}
        >
          {inst?.mcVersion ?? '—'}
        </div>

        <div className="t-mono" style={{ fontSize: 12, display: 'flex', gap: 24, color: 'var(--bone-400)', marginBottom: 32 }}>
          <span>
            <span style={{ color: 'var(--bone-100)' }}>{profile?.nickname ?? 'нет профиля'}</span> · offline
          </span>
          <span>{inst ? `${inst.loader}${inst.loader !== 'vanilla' ? '' : ''}` : ''}</span>
          <span>{inst ? `${inst.ramMb / 1024}G ram` : ''}</span>
          <span>{inst ? `${inst.modsCount} модов` : ''}</span>
        </div>

        {progress ? (
          <div style={{ width: 320 }}>
            <SegmentBar ratio={progress.ratio} hazard={progress.phase === 'error'} />
            <div className="t-mono" style={{ fontSize: 11, marginTop: 8, color: 'var(--bone-400)' }}>
              {progress.message}
              {progress.speedBps > 0 && ` · ${(progress.speedBps / 1024 / 1024).toFixed(1)} MB/s`}
            </div>
          </div>
        ) : (
          <Btn
            kind="signal"
            disabled={!inst || game.running}
            onClick={() => void launch()}
            style={{ width: 320, height: 48, fontSize: 14, letterSpacing: '0.14em' }}
          >
            {game.running ? 'игра запущена' : 'play'}
          </Btn>
        )}
      </div>

      <div
        style={{
          width: 360,
          flexShrink: 0,
          borderLeft: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span className="t-label">профили · {instances.length}</span>
          <Btn onClick={() => setCreating(true)} style={{ height: 26, padding: '0 10px', fontSize: 10 }}>
            + новый
          </Btn>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {instances.map((i) => (
            <Row key={i.id} active={i.id === selectedInstanceId} onClick={() => selectInstance(i.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-display" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {i.name}
                </div>
                <div className="t-mono t-dim" style={{ fontSize: 10, marginTop: 2 }}>
                  {i.loader} · {i.mcVersion} · {fmtAgo(i.lastPlayedAt)}
                </div>
              </div>
              {i.id === selectedInstanceId && (
                <span className="t-mono" style={{ color: 'var(--signal)', fontSize: 10 }}>
                  ●
                </span>
              )}
            </Row>
          ))}
          {instances.length === 0 && (
            <div className="t-mono t-dim" style={{ padding: 24, fontSize: 11 }}>
              0 профилей · создай первый
            </div>
          )}
        </div>

        {inst && <InstanceFooter inst={inst} onChanged={() => void refresh()} />}
      </div>

      {creating && <CreateInstanceDialog onClose={() => { setCreating(false); void refresh(); }} />}
    </div>
  );
}

function InstanceFooter({ inst, onChanged }: { inst: InstanceConfig; onChanged: () => void }) {
  const setError = useApp((s) => s.setError);
  const [exporting, setExporting] = useState(false);

  const exportZip = async () => {
    setExporting(true);
    try {
      const res = await aky.invoke('instances:export', { id: inst.id });
      if (res.ok) setError(`экспортировано · ${res.files} файлов · ${res.path}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: 16, display: 'flex', gap: 8 }}>
      <Btn
        style={{ flex: 1, fontSize: 10 }}
        title="открыть папку профиля"
        onClick={() => void aky.invoke('app:openDir', { instanceId: inst.id })}
      >
        папка
      </Btn>
      <Btn
        style={{ flex: 1, fontSize: 10 }}
        title="экспорт профиля в zip"
        disabled={exporting}
        onClick={() => void exportZip()}
      >
        {exporting ? '…' : 'экспорт'}
      </Btn>
      <Btn
        kind="hazard"
        style={{ flex: 1, fontSize: 10 }}
        onClick={() => {
          void aky.invoke('instances:delete', { id: inst.id }).then(onChanged);
        }}
      >
        удалить
      </Btn>
    </div>
  );
}

function CreateInstanceDialog({ onClose }: { onClose: () => void }) {
  const versions = useApp((s) => s.versions);
  const setError = useApp((s) => s.setError);
  const [name, setName] = useState('');
  const [mcVersion, setMcVersion] = useState(versions.find((v) => v.kind === 'release')?.id ?? '');
  const [loader, setLoader] = useState<LoaderKind>('vanilla');
  const releases = versions.filter((v) => v.kind === 'release').slice(0, 40);

  const create = async () => {
    try {
      await aky.invoke('instances:create', { name, mcVersion, loader });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const selStyle: React.CSSProperties = {
    background: 'var(--ink-800)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-control)',
    height: 32,
    padding: '0 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    width: '100%'
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(14,15,12,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50
      }}
      onClick={onClose}
    >
      <div
        className="corner-marks"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 400, background: 'var(--ink-900)', border: '1px solid var(--line)', padding: 24 }}
      >
        <div className="t-display" style={{ fontSize: 16, marginBottom: 20 }}>
          Новый профиль
        </div>
        <div className="t-label" style={{ marginBottom: 6 }}>имя</div>
        <input
          type="text"
          value={name}
          placeholder="MY BUILD"
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', marginBottom: 16 }}
        />
        <div className="t-label" style={{ marginBottom: 6 }}>версия</div>
        <select value={mcVersion} onChange={(e) => setMcVersion(e.target.value)} style={{ ...selStyle, marginBottom: 16 }}>
          {releases.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id}
            </option>
          ))}
        </select>
        <div className="t-label" style={{ marginBottom: 6 }}>загрузчик</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'] as LoaderKind[]).map((l) => (
            <button
              key={l}
              onClick={() => setLoader(l)}
              style={{
                flex: 1,
                height: 28,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                background: loader === l ? 'var(--ink-800)' : 'transparent',
                border: '1px solid',
                borderColor: loader === l ? 'var(--signal)' : 'var(--line)',
                borderRadius: 'var(--r-control)',
                color: loader === l ? 'var(--bone-100)' : 'var(--bone-400)',
                cursor: 'pointer'
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="signal" style={{ flex: 1 }} onClick={() => void create()}>
            создать
          </Btn>
          <Btn onClick={onClose}>отмена</Btn>
        </div>
      </div>
    </div>
  );
}
