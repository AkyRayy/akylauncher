import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { aky } from '../bridge';
import { Btn, ScreenTitle, SegmentBar } from '../components/primitives';
import type { GameLogLine } from '@shared/types';

const LEVEL_COLOR: Record<GameLogLine['level'], string> = {
  INFO: 'var(--bone-400)',
  WARN: '#d9a93c',
  ERROR: 'var(--hazard)',
  DEBUG: '#5e6357'
};

type LevelFilter = 'ALL' | 'INFO' | 'WARN' | 'ERROR';

export function Console() {
  const { log, game, instances, progress, settings, setScreen, clearLog } = useApp();
  const [filter, setFilter] = useState<LevelFilter>('ALL');
  const [ai, setAi] = useState<{ state: 'idle' | 'busy' | 'done'; text: string }>({ state: 'idle', text: '' });
  const endRef = useRef<HTMLDivElement>(null);
  const inst = instances.find((i) => i.id === game.instanceId);

  const visible = filter === 'ALL' ? log : log.filter((l) => l.level === filter);
  const hasAiKey = Boolean(settings?.groqApiKey?.trim());
  const errorCount = log.filter((l) => l.level === 'ERROR').length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
  }, [visible.length]);

  const analyze = async () => {
    setAi({ state: 'busy', text: '' });
    try {
      const lines = log.map((l) => `[${l.level}] ${l.text}`);
      const context = inst
        ? `${inst.name} · minecraft ${inst.mcVersion} · ${inst.loader} · ${inst.ramMb}MB RAM · ${inst.modsCount} модов`
        : 'процесс не запущен';
      const res = await aky.invoke('ai:analyze', { lines, context });
      setAi({ state: 'done', text: res.text });
    } catch (e) {
      setAi({ state: 'done', text: `АНАЛИЗ НЕДОСТУПЕН: ${(e as Error).message}` });
    }
  };

  const uptime = game.startedAt ? Math.floor((Date.now() - game.startedAt) / 1000) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScreenTitle
        kicker={
          game.running
            ? `pid ${game.pid} · ${inst?.name ?? ''} · uptime ${Math.floor(uptime / 60)}m ${uptime % 60}s`
            : 'процесс не запущен'
        }
        title="Консоль"
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={clearLog} disabled={log.length === 0} title="очистить лог">
              очистить
            </Btn>
            {hasAiKey ? (
              <Btn
                onClick={() => void analyze()}
                disabled={ai.state === 'busy' || log.length === 0}
                style={errorCount > 0 ? { borderColor: 'var(--signal)' } : undefined}
                title="отправить хвост лога в groq"
              >
                {ai.state === 'busy' ? 'анализирую…' : `ии-анализ${errorCount > 0 ? ` · ${errorCount} err` : ''}`}
              </Btn>
            ) : (
              <Btn onClick={() => setScreen('settings')} title="нужен groq api-ключ" style={{ fontSize: 10 }}>
                ии выключен · настроить
              </Btn>
            )}
            {game.running && (
              <Btn kind="hazard" onClick={() => void aky.invoke('game:kill')}>
                kill process
              </Btn>
            )}
          </div>
        }
      />

      {progress && progress.phase !== 'done' && (
        <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--line)' }}>
          <SegmentBar ratio={progress.ratio} hazard={progress.phase === 'error'} />
          <div className="t-mono" style={{ fontSize: 11, marginTop: 8, color: 'var(--bone-400)' }}>
            {progress.label} · {progress.message}
            {progress.speedBps > 0 && ` · ${(progress.speedBps / 1024 / 1024).toFixed(1)} MB/s`}
          </div>
        </div>
      )}

      {ai.state !== 'idle' && (
        <div
          className="corner-marks"
          style={{
            margin: '16px 32px 0',
            border: '1px solid var(--line)',
            background: 'var(--ink-900)',
            maxHeight: 220,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 16px',
              borderBottom: '1px solid var(--line)',
              flexShrink: 0
            }}
          >
            <span className="t-label">диагност · groq</span>
            <button
              onClick={() => setAi({ state: 'idle', text: '' })}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--bone-400)', fontFamily: 'var(--font-mono)', fontSize: 11
              }}
            >
              закрыть ✕
            </button>
          </div>
          <div
            className="t-mono"
            style={{
              padding: '12px 16px', fontSize: 12, lineHeight: 1.7, overflowY: 'auto',
              whiteSpace: 'pre-wrap', userSelect: 'text'
            }}
          >
            {ai.state === 'busy' ? (
              <span className="t-dim">читаю лог · жду ответ groq…</span>
            ) : (
              ai.text.split('\n').map((line, i) => {
                const head = /^(ДИАГНОЗ|ПРИЧИНА|РЕШЕНИЕ)(:?)/.exec(line);
                return (
                  <div key={i}>
                    {head ? (
                      <>
                        <span style={{ color: 'var(--signal)' }}>{head[1]}{head[2]}</span>
                        {line.slice(head[0].length)}
                      </>
                    ) : (
                      line
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, padding: '12px 32px', borderBottom: '1px solid var(--line)' }}>
        {(['ALL', 'INFO', 'WARN', 'ERROR'] as LevelFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '4px 12px',
              background: filter === f ? 'var(--ink-800)' : 'transparent',
              border: '1px solid',
              borderColor: filter === f ? 'var(--signal)' : 'var(--line)',
              borderRadius: 'var(--r-control)',
              color: filter === f ? 'var(--bone-100)' : 'var(--bone-400)',
              cursor: 'pointer'
            }}
          >
            {f}
            {f === 'ERROR' && errorCount > 0 && ` · ${errorCount}`}
          </button>
        ))}
        <span className="t-mono t-dim" style={{ fontSize: 10, marginLeft: 'auto', alignSelf: 'center' }}>
          {visible.length} строк
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 32px',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.7,
          userSelect: 'text'
        }}
      >
        {visible.length === 0 && <span className="t-dim">лог пуст · запусти игру кнопкой PLAY</span>}
        {visible.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <span style={{ color: '#5e6357', flexShrink: 0 }}>
              {new Date(l.ts).toTimeString().slice(0, 8)}
            </span>
            <span style={{ color: LEVEL_COLOR[l.level], flexShrink: 0, width: 48 }}>{l.level}</span>
            <span style={{ color: l.level === 'ERROR' ? 'var(--hazard)' : 'var(--bone-100)', wordBreak: 'break-all' }}>
              {l.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
