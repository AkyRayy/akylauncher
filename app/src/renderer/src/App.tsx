import { useEffect } from 'react';
import { useApp } from './state/store';
import { Titlebar } from './components/Titlebar';
import { NavRail } from './components/NavRail';
import { Home } from './screens/Home';
import { Versions } from './screens/Versions';
import { Profiles } from './screens/Profiles';
import { Mods } from './screens/Mods';
import { Settings } from './screens/Settings';
import { Console } from './screens/Console';

export function App() {
  const screen = useApp((s) => s.screen);
  const error = useApp((s) => s.error);
  const setError = useApp((s) => s.setError);
  const init = useApp((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Titlebar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <NavRail />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {screen === 'home' && <Home />}
          {screen === 'versions' && <Versions />}
          {screen === 'profiles' && <Profiles />}
          {screen === 'mods' && <Mods />}
          {screen === 'settings' && <Settings />}
          {screen === 'console' && <Console />}
        </main>
      </div>

      {error && (
        <div
          onClick={() => setError(null)}
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--ink-900)',
            border: `1px solid ${error.startsWith('экспортировано') ? 'var(--signal)' : 'var(--hazard)'}`,
            padding: '10px 20px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: error.startsWith('экспортировано') ? 'var(--signal)' : 'var(--hazard)',
            cursor: 'pointer',
            zIndex: 100,
            maxWidth: '80vw'
          }}
        >
          {error} · закрыть
        </div>
      )}
    </div>
  );
}
