import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { aky } from '../bridge';
import { Btn, Row, ScreenTitle } from '../components/primitives';
import type { ModSort, ModrinthHit } from '@shared/types';

const PAGE = 20;

type View = 'browse' | 'installed';

const SORTS: { id: ModSort; label: string }[] = [
  { id: 'relevance', label: 'релевантность' },
  { id: 'downloads', label: 'загрузки' },
  { id: 'updated', label: 'обновлённые' },
  { id: 'newest', label: 'новые' }
];

function fmtDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function Mods() {
  const { instances, selectedInstanceId, selectInstance, refresh, setError } = useApp();
  const inst = instances.find((i) => i.id === selectedInstanceId) ?? null;

  const [view, setView] = useState<View>('browse');
  const [files, setFiles] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ModSort>('relevance');
  const [page, setPage] = useState(0);
  const [hits, setHits] = useState<ModrinthHit[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(
    async (q: string, s: ModSort, p: number) => {
      if (!inst) return;
      setLoading(true);
      try {
        const res = await aky.invoke('modrinth:search', {
          query: q,
          mcVersion: inst.mcVersion,
          loader: inst.loader,
          offset: p * PAGE,
          sort: s
        });
        setHits(res.hits);
        setTotal(res.totalHits);
      } catch {
        setError('modrinth недоступен · проверь сеть');
      } finally {
        setLoading(false);
      }
    },
    [inst, setError]
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void search(query, sort, page), query ? 350 : 0);
    return () => clearTimeout(debounce.current);
  }, [query, sort, page, search]);

  useEffect(() => setPage(0), [inst?.id, query, sort]);

  const loadFiles = useCallback(async () => {
    if (!inst) return;
    setFiles(await aky.invoke('mods:listFiles', { instanceId: inst.id }));
  }, [inst]);

  useEffect(() => {
    if (view === 'installed') void loadFiles();
  }, [view, inst?.id, loadFiles]);

  const removeFile = async (filename: string) => {
    if (!inst) return;
    try {
      await aky.invoke('mods:deleteFile', { instanceId: inst.id, filename });
      await loadFiles();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const install = async (projectId: string) => {
    if (!inst) return;
    setBusy(projectId);
    try {
      await aky.invoke('modrinth:install', { projectId, instanceId: inst.id });
      setInstalled((s) => new Set(s).add(projectId));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const selStyle: React.CSSProperties = {
    background: 'var(--ink-800)', border: '1px solid var(--line)', borderRadius: 'var(--r-control)',
    height: 32, padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone-100)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScreenTitle
        kicker={`modrinth api v2 · ${total} найдено`}
        title="Моды"
        right={
          <select value={selectedInstanceId ?? ''} onChange={(e) => selectInstance(e.target.value)} style={selStyle}>
            {instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.mcVersion} · {i.loader}
              </option>
            ))}
          </select>
        }
      />

      <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
          {([['browse', 'каталог'], ['installed', `установленные · ${inst?.modsCount ?? 0}`]] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, padding: '6px 10px', textTransform: 'uppercase',
                background: view === v ? 'var(--ink-800)' : 'transparent',
                border: '1px solid', borderColor: view === v ? 'var(--signal)' : 'var(--line)',
                borderRadius: 'var(--r-control)',
                color: view === v ? 'var(--bone-100)' : 'var(--bone-400)', cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {view === 'browse' && (
          <>
            <input
              type="text"
              value={query}
              placeholder="поиск · вводи, ищется само"
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, maxWidth: 320, fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, padding: '6px 10px',
                    background: sort === s.id ? 'var(--ink-800)' : 'transparent',
                    border: '1px solid', borderColor: sort === s.id ? 'var(--signal)' : 'var(--line)',
                    borderRadius: 'var(--r-control)',
                    color: sort === s.id ? 'var(--bone-100)' : 'var(--bone-400)', cursor: 'pointer'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {view === 'installed' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {files.map((f) => (
            <Row key={f} style={{ padding: '0 32px', height: 44 }}>
              <span className="t-mono" style={{ flex: 1, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {f}
              </span>
              <Btn kind="hazard" style={{ height: 24, padding: '0 10px', fontSize: 9 }} onClick={() => void removeFile(f)}>
                удалить
              </Btn>
            </Row>
          ))}
          {files.length === 0 && (
            <div className="t-mono t-dim" style={{ padding: 32, fontSize: 11 }}>
              0 файлов в mods/ · ставь из каталога
            </div>
          )}
        </div>
      )}

      {view === 'browse' && (
      <>

      <div style={{ flex: 1, overflowY: 'auto', opacity: loading ? 0.5 : 1, transition: 'opacity var(--t-base) var(--ease)' }}>
        {inst?.loader === 'vanilla' && (
          <div className="t-mono" style={{ padding: '16px 32px', fontSize: 11, color: 'var(--hazard)', borderBottom: '1px solid var(--line)' }}>
            vanilla не поддерживает моды · выбери профиль с fabric/forge
          </div>
        )}
        {hits.map((h) => {
          const done = installed.has(h.projectId);
          return (
            <Row key={h.projectId} style={{ height: 64, padding: '0 32px' }}>
              <div
                style={{
                  width: 40, height: 40, flexShrink: 0, background: 'var(--ink-800)',
                  border: '1px solid var(--line)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden'
                }}
              >
                {h.iconUrl ? (
                  <img src={h.iconUrl} alt="" width={40} height={40} style={{ objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span className="t-mono" style={{ fontSize: 14, color: 'var(--bone-400)' }}>
                    {h.title.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <a
                    href={`https://modrinth.com/mod/${h.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="t-display"
                    style={{ fontSize: 13, color: 'var(--bone-100)', textDecoration: 'none', borderBottom: '1px solid transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = 'var(--signal)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = 'transparent')}
                    title="открыть на modrinth"
                  >
                    {h.title}
                  </a>
                  <span className="t-mono t-dim" style={{ fontSize: 10 }}>{h.categories.slice(0, 3).join(' · ')}</span>
                </div>
                <div className="t-dim" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                  {h.description}
                </div>
              </div>
              <div className="t-mono t-dim" style={{ fontSize: 11, width: 110, textAlign: 'right', flexShrink: 0 }}>
                <div>{fmtDownloads(h.downloads)} ↓</div>
                <div style={{ fontSize: 9, marginTop: 2 }}>{fmtDownloads(h.follows)} ★</div>
              </div>
              {done ? (
                <span className="t-mono" style={{ fontSize: 10, color: 'var(--signal)', width: 92, textAlign: 'center', flexShrink: 0 }}>
                  установлен
                </span>
              ) : (
                <Btn
                  style={{ height: 26, padding: '0 12px', fontSize: 10, width: 92, flexShrink: 0 }}
                  disabled={busy === h.projectId || inst?.loader === 'vanilla'}
                  onClick={() => void install(h.projectId)}
                >
                  {busy === h.projectId ? '…' : 'установить'}
                </Btn>
              )}
            </Row>
          );
        })}
        {!loading && hits.length === 0 && (
          <div className="t-mono t-dim" style={{ padding: 32, fontSize: 11 }}>ничего не найдено</div>
        )}
      </div>

      {pages > 1 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            padding: '12px 32px', borderTop: '1px solid var(--line)', flexShrink: 0
          }}
        >
          <Btn style={{ height: 26, padding: '0 12px', fontSize: 10 }} disabled={page === 0} onClick={() => setPage(page - 1)}>
            ← prev
          </Btn>
          <span className="t-mono t-dim" style={{ fontSize: 11 }}>
            <span style={{ color: 'var(--bone-100)' }}>{page + 1}</span> / {pages}
          </span>
          <Btn style={{ height: 26, padding: '0 12px', fontSize: 10 }} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            next →
          </Btn>
        </div>
      )}
      </>
      )}
    </div>
  );
}
