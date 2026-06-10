import { useState } from 'react';
import { useApp } from '../state/store';
import { aky } from '../bridge';
import { Btn, Row, ScreenTitle, SegmentBar, Tabs } from '../components/primitives';
import type { VersionKind } from '@shared/types';

type Filter = 'release' | 'snapshot' | 'old';

export function Versions() {
  const { versions, progress } = useApp();
  const [filter, setFilter] = useState<Filter>('release');
  const [installing, setInstalling] = useState<string | null>(null);

  const match = (k: VersionKind) =>
    filter === 'release' ? k === 'release' : filter === 'snapshot' ? k === 'snapshot' : k === 'old_beta' || k === 'old_alpha';
  const list = versions.filter((v) => match(v.kind)).slice(0, 120);

  const install = async (id: string) => {
    setInstalling(id);
    await aky.invoke('versions:install', { versionId: id });
  };

  const active = progress && progress.phase !== 'done' && progress.phase !== 'error';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScreenTitle kicker={`манифест mojang · ${versions.length} версий`} title="Версии" />
      <div style={{ padding: '0 32px' }}>
        <Tabs
          items={[
            { id: 'release', label: 'release' },
            { id: 'snapshot', label: 'snapshot' },
            { id: 'old', label: 'old beta' }
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {active && installing && (
        <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--line)' }}>
          <SegmentBar ratio={progress.ratio} />
          <div className="t-mono" style={{ fontSize: 11, marginTop: 8, color: 'var(--bone-400)' }}>
            {progress.label} · {progress.message}
            {progress.speedBps > 0 && ` · ${(progress.speedBps / 1024 / 1024).toFixed(1)} MB/s`}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {list.map((v) => (
          <Row key={v.id} style={{ padding: '0 32px' }}>
            <span className="t-mono" style={{ width: 120, fontSize: 13 }}>{v.id}</span>
            <span className="t-mono t-dim" style={{ width: 90, fontSize: 11 }}>{v.kind}</span>
            <span className="t-mono t-dim" style={{ flex: 1, fontSize: 11 }}>
              {new Date(v.releaseTime).toISOString().slice(0, 10)}
            </span>
            {v.installed ? (
              <span className="t-mono" style={{ fontSize: 10, color: 'var(--signal)' }}>установлена</span>
            ) : (
              <Btn
                style={{ height: 26, padding: '0 12px', fontSize: 10 }}
                disabled={Boolean(active)}
                onClick={() => void install(v.id)}
              >
                установить
              </Btn>
            )}
          </Row>
        ))}
      </div>
    </div>
  );
}
