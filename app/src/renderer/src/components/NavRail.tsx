import { useApp, type Screen } from '../state/store';
import { aky } from '../bridge';
import iconPlay from '../../assets/icons/icon-play.png';
import iconVersions from '../../assets/icons/icon-versions.png';
import iconProfiles from '../../assets/icons/icon-profiles.png';
import iconMods from '../../assets/icons/icon-mods.png';
import iconSettings from '../../assets/icons/icon-settings.png';
import iconConsole from '../../assets/icons/icon-console.png';
import iconTelegram from '../../assets/icons/icon-telegram.png';

const ITEMS: { id: Screen; icon: string; label: string }[] = [
  { id: 'home', icon: iconPlay, label: 'играть' },
  { id: 'versions', icon: iconVersions, label: 'версии' },
  { id: 'profiles', icon: iconProfiles, label: 'аккаунты' },
  { id: 'mods', icon: iconMods, label: 'моды' },
  { id: 'settings', icon: iconSettings, label: 'настройки' },
  { id: 'console', icon: iconConsole, label: 'консоль' }
];

export function NavRail() {
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);
  const gameRunning = useApp((s) => s.game.running);

  return (
    <nav
      style={{
        width: 56,
        flexShrink: 0,
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        gap: 8
      }}
    >
      {ITEMS.map((it) => {
        const active = screen === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setScreen(it.id)}
            title={it.label}
            className={active ? 'corner-marks' : undefined}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: active ? 'var(--ink-800)' : 'transparent',
              border: '1px solid',
              borderColor: active ? 'var(--line)' : 'transparent',
              borderRadius: 'var(--r-control)',
              cursor: 'pointer',
              transition: 'all var(--t-fast) var(--ease)',
              position: 'relative'
            }}
          >
            <img
              src={it.icon}
              alt={it.label}
              draggable={false}
              style={{
                width: 22,
                height: 22,
                opacity: active ? 1 : 0.55,
                transition: 'opacity var(--t-fast) var(--ease)',
                mixBlendMode: 'screen'
              }}
            />
            {it.id === 'console' && gameRunning && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 6,
                  height: 6,
                  background: 'var(--signal)'
                }}
              />
            )}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <button
        onClick={() => void aky.invoke('app:openTelegram')}
        title="телеграм-канал · @akylauncher"
        style={{
          width: 40,
          height: 40,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: 'var(--r-control)',
          cursor: 'pointer',
          transition: 'all var(--t-fast) var(--ease)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--line)';
          e.currentTarget.style.background = 'var(--ink-800)';
          const img = e.currentTarget.querySelector('img');
          if (img) img.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.background = 'transparent';
          const img = e.currentTarget.querySelector('img');
          if (img) img.style.opacity = '0.55';
        }}
      >
        <img
          src={iconTelegram}
          alt="telegram"
          draggable={false}
          style={{
            width: 22,
            height: 22,
            opacity: 0.55,
            transition: 'opacity var(--t-fast) var(--ease)',
            mixBlendMode: 'screen'
          }}
        />
      </button>
    </nav>
  );
}
