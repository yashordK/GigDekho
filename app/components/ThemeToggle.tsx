import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * Light/dark theme switch. Persisted in localStorage ('gd-theme') so it
 * survives reloads and worker/hirer view switches; applied pre-paint by an
 * inline script in root.tsx.
 */
export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains('light'));
  }, []);

  const toggle = () => {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle('light', next);
    try { localStorage.setItem('gd-theme', next ? 'light' : 'dark'); } catch { /* private mode */ }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-white text-sm">Appearance</h3>
        <p className="text-white/50 text-xs font-semibold mt-0.5">
          {isLight ? 'Light theme' : 'Dark theme'} — applies everywhere, in both modes.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isLight}
        aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
        onClick={toggle}
        className={`relative w-16 h-9 rounded-full border transition-colors btn-tap flex items-center px-1 ${
          isLight ? 'bg-amber-400/20 border-amber-400/40' : 'bg-[#111111] border-white/10'
        }`}
      >
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-transform duration-200 ${
            isLight ? 'translate-x-7 bg-amber-400 text-white' : 'translate-x-0 bg-[#1C1C1C] text-white/60 border border-white/10'
          }`}
        >
          {isLight ? <Sun size={14} /> : <Moon size={14} />}
        </span>
      </button>
    </div>
  );
}
