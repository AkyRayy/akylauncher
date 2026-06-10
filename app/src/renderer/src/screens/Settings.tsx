import { useEffect, useState } from 'react';
import { useApp } from '../state/store';
import { aky } from '../bridge';
import { Btn, ScreenTitle, Tabs } from '../components/primitives';
import type { JavaRuntime } from '@shared/types';

type Tab = 'general' | 'ai';

function Block(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--line)' }}>
      <div className="t-label" style={{ marginBottom: 12 }}>{props.label}</div>
      {props.children}
    </div>
  );
}

export function Settings() {
  const [tab, setTab] = useState<Tab>('general');
  const { settings, selectedInstanceId, instances } = useApp();
  const inst = instances.find((i) => i.id === selectedInstanceId) ?? null;

  if (!settings) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScreenTitle kicker={inst ? `профиль · ${inst.name}` : 'глобальные'} title="Настройки" />
      <div style={{ padding: '0 32px' }}>
        <Tabs
          items={[
            { id: 'general', label: 'общие' },
            { id: 'ai', label: 'ии токен' }
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'general' ? <GeneralTab /> : <AiTab />}
      </div>
    </div>
  );
}

function GeneralTab() {
  const { settings, refresh, selectedInstanceId, instances } = useApp();
  const inst = instances.find((i) => i.id === selectedInstanceId) ?? null;
  const [javas, setJavas] = useState<JavaRuntime[]>([]);
  const [ram, setRam] = useState(inst?.ramMb ?? settings?.defaultRamMb ?? 4096);

  useEffect(() => {
    void aky.invoke('java:list').then(setJavas);
  }, []);
  useEffect(() => {
    if (inst) setRam(inst.ramMb);
  }, [inst?.id, inst]);

  if (!settings) return null;
  const maxRam = Math.min(settings.maxRamMb, 32768);

  const commitRam = async (value: number) => {
    if (inst) await aky.invoke('instances:update', { id: inst.id, patch: { ramMb: value } });
    else await aky.invoke('settings:set', { patch: { defaultRamMb: value } });
    await refresh();
  };

  return (
    <>
      <Block label={`память · ${(ram / 1024).toFixed(1).replace('.0', '')}G`}>
        <input
          type="range"
          min={2048}
          max={maxRam}
          step={512}
          value={ram}
          onChange={(e) => setRam(Number(e.target.value))}
          onMouseUp={() => void commitRam(ram)}
        />
        <div className="t-mono t-dim" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 8 }}>
          <span>2G</span>
          <span style={{ color: 'var(--bone-100)' }}>{(ram / 1024).toFixed(1)}G</span>
          <span>{Math.round(maxRam / 1024)}G</span>
        </div>
      </Block>

      <Block label="папка игры">
        <div className="t-mono" style={{ fontSize: 12, background: 'var(--ink-800)', border: '1px solid var(--line)', padding: '8px 12px', borderRadius: 2 }}>
          {settings.gameDir}
        </div>
      </Block>

      <Block label={`java · найдено ${javas.length}`}>
        {javas.map((j) => (
          <div key={j.path} style={{ display: 'flex', gap: 16, alignItems: 'center', height: 36, borderBottom: '1px solid var(--line)' }}>
            <span className="t-mono" style={{ width: 64, fontSize: 12, color: 'var(--signal)' }}>{j.major}</span>
            <span className="t-mono t-dim" style={{ flex: 1, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.path}</span>
            <span className="t-mono t-dim" style={{ fontSize: 10 }}>{j.source}</span>
          </div>
        ))}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {[8, 17, 21].map((m) => (
            <Btn
              key={m}
              style={{ fontSize: 10 }}
              onClick={() => void aky.invoke('java:ensure', { major: m }).then(() => aky.invoke('java:list').then(setJavas))}
            >
              установить {m}
            </Btn>
          ))}
        </div>
      </Block>

      <Block label="окно игры">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            defaultValue={inst?.windowWidth ?? settings.windowWidth}
            style={{ width: 96, fontFamily: 'var(--font-mono)', fontSize: 12 }}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (inst) void aky.invoke('instances:update', { id: inst.id, patch: { windowWidth: v } }).then(refresh);
              else void aky.invoke('settings:set', { patch: { windowWidth: v } }).then(refresh);
            }}
          />
          <span className="t-mono t-dim">×</span>
          <input
            type="number"
            defaultValue={inst?.windowHeight ?? settings.windowHeight}
            style={{ width: 96, fontFamily: 'var(--font-mono)', fontSize: 12 }}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (inst) void aky.invoke('instances:update', { id: inst.id, patch: { windowHeight: v } }).then(refresh);
              else void aky.invoke('settings:set', { patch: { windowHeight: v } }).then(refresh);
            }}
          />
          <span className="t-mono t-dim" style={{ fontSize: 10 }}>px</span>
        </div>
      </Block>

      <Block label="jvm flags">
        <input
          type="text"
          placeholder="-XX:+UseG1GC -XX:MaxGCPauseMillis=50"
          defaultValue={(inst?.jvmArgs ?? settings.jvmArgs).join(' ')}
          style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 11 }}
          onBlur={(e) => {
            const args = e.target.value.split(/\s+/).filter(Boolean);
            if (inst) void aky.invoke('instances:update', { id: inst.id, patch: { jvmArgs: args } }).then(refresh);
            else void aky.invoke('settings:set', { patch: { jvmArgs: args } }).then(refresh);
          }}
        />
      </Block>

      <Block label={`скины в игре · ${settings.skinsInGame ? 'вкл' : 'выкл'}`}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() =>
              void aky.invoke('settings:set', { patch: { skinsInGame: !settings.skinsInGame } }).then(refresh)
            }
            style={{
              width: 44,
              height: 22,
              background: settings.skinsInGame ? 'var(--signal)' : 'var(--ink-800)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-control)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background var(--t-base) var(--ease)'
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: settings.skinsInGame ? 24 : 2,
                width: 16,
                height: 16,
                background: settings.skinsInGame ? 'var(--ink-950)' : 'var(--bone-400)',
                transition: 'left var(--t-base) var(--ease)'
              }}
            />
          </button>
          <span className="t-dim" style={{ fontSize: 11, maxWidth: 480 }}>
            authlib-injector + ely.by: скин подтянется в игру по нику. Зарегистрируй такой же ник на
            ely.by и загрузи туда свой скин — увидишь его на себе и других игроках.
          </span>
        </div>
      </Block>
    </>
  );
}

function AiTab() {
  const { settings, refresh, setError } = useApp();
  const [key, setKey] = useState(settings?.groqApiKey ?? '');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'testing' | 'ok' | 'fail'>('idle');

  if (!settings) return null;
  const connected = settings.groqApiKey.trim().length > 0;

  const save = async () => {
    setStatus('saving');
    await aky.invoke('settings:set', { patch: { groqApiKey: key.trim() } });
    await refresh();
    setStatus('idle');
  };

  const test = async () => {
    setStatus('testing');
    try {
      await aky.invoke('settings:set', { patch: { groqApiKey: key.trim() } });
      await refresh();
      await aky.invoke('ai:analyze', { lines: ['ping: проверка связи, ошибок нет'], context: 'проверка ключа' });
      setStatus('ok');
    } catch (e) {
      setStatus('fail');
      setError((e as Error).message);
    }
  };

  return (
    <>
      <Block label={`groq api · ${connected ? 'подключён' : 'не настроен'}`}>
        <p className="t-dim" style={{ fontSize: 12, maxWidth: 560, marginBottom: 16 }}>
          ИИ-диагност читает хвост лога консоли и объясняет, что сломалось и как починить:
          краши модов, нехватка RAM, неверная Java, конфликты Mixin. Ключ хранится локально
          и используется только для запросов к Groq из бэкенда лаунчера.
        </p>
        <div className="t-label" style={{ marginBottom: 6 }}>api-ключ</div>
        <div style={{ display: 'flex', gap: 8, maxWidth: 640 }}>
          <input
            type={reveal ? 'text' : 'password'}
            value={key}
            placeholder="gsk_…"
            onChange={(e) => { setKey(e.target.value); setStatus('idle'); }}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--ink-800)', border: '1px solid var(--line)', borderRadius: 2, height: 32, padding: '0 12px', color: 'var(--bone-100)', outline: 'none' }}
          />
          <Btn onClick={() => setReveal(!reveal)} style={{ fontSize: 10 }}>
            {reveal ? 'скрыть' : 'показать'}
          </Btn>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <Btn kind="signal" onClick={() => void save()} disabled={status === 'saving'}>
            сохранить
          </Btn>
          <Btn onClick={() => void test()} disabled={status === 'testing' || !key.trim()}>
            {status === 'testing' ? 'проверяю…' : 'проверить ключ'}
          </Btn>
          {status === 'ok' && (
            <span className="t-mono" style={{ fontSize: 11, color: 'var(--signal)' }}>ключ работает</span>
          )}
          {status === 'fail' && (
            <span className="t-mono" style={{ fontSize: 11, color: 'var(--hazard)' }}>проверка не прошла</span>
          )}
        </div>
      </Block>

      <Block label="модель">
        <div className="t-mono" style={{ fontSize: 12 }}>llama-3.3-70b-versatile</div>
        <div className="t-dim" style={{ fontSize: 11, marginTop: 4 }}>
          быстрый инференс groq · бесплатный лимит достаточен для диагностики
        </div>
      </Block>

      <Block label="как получить ключ">
        <ol className="t-mono t-dim" style={{ fontSize: 11, lineHeight: 2, paddingLeft: 20 }}>
          <li>console.groq.com → регистрация</li>
          <li>API Keys → Create API Key</li>
          <li>скопируй ключ gsk_… сюда и нажми «сохранить»</li>
          <li>в консоли появится кнопка «анализ лога»</li>
        </ol>
      </Block>
    </>
  );
}
