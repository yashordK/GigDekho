import { useEffect, useRef } from 'react';

// Category words hidden in the hero — the cursor's "torch" reveals them,
// teaching users everything they can do on GigDekho.
const WORDS = [
  { text: 'Waitstaff', x: 6, y: 12, size: 22, rotate: -8 },
  { text: 'DJ', x: 22, y: 6, size: 30, rotate: 5 },
  { text: 'Photographer', x: 38, y: 14, size: 18, rotate: -4 },
  { text: 'Bartender', x: 62, y: 8, size: 24, rotate: 7 },
  { text: 'Singer', x: 82, y: 13, size: 26, rotate: -6 },
  { text: 'Security', x: 8, y: 32, size: 20, rotate: 4 },
  { text: 'Brand Promoter', x: 88, y: 30, size: 16, rotate: 8 },
  { text: 'Reel Shooter', x: 4, y: 52, size: 18, rotate: -7 },
  { text: 'Tutoring', x: 90, y: 50, size: 22, rotate: -5 },
  { text: 'Delivery', x: 7, y: 72, size: 24, rotate: 6 },
  { text: 'Web Development', x: 86, y: 68, size: 15, rotate: 4 },
  { text: 'Setup Crew', x: 16, y: 88, size: 18, rotate: -5 },
  { text: 'Catering', x: 34, y: 92, size: 20, rotate: 3 },
  { text: 'Anchor/MC', x: 56, y: 90, size: 22, rotate: -4 },
  { text: 'Babysitting', x: 76, y: 88, size: 17, rotate: 6 },
  { text: 'Data Entry', x: 44, y: 4, size: 16, rotate: -3 },
  { text: 'Magician', x: 68, y: 92, size: 18, rotate: -8 },
  { text: 'Telecaller', x: 24, y: 70, size: 15, rotate: 5 },
  { text: 'Video Editing', x: 74, y: 45, size: 16, rotate: -6 },
  { text: 'Volunteer', x: 20, y: 45, size: 17, rotate: 7 },
];

/**
 * Drop inside a `relative overflow-hidden` hero. Renders a full-bleed layer of
 * category words masked by a circular spotlight that follows the cursor.
 * On touch devices (no hover) the spotlight slowly drifts on its own.
 */
export default function SpotlightCategories() {
  const layerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const layer = layerRef.current;
    const host = layer?.parentElement;
    if (!layer || !host) return;

    const setSpot = (x: number, y: number) => {
      layer.style.setProperty('--sx', `${x}px`);
      layer.style.setProperty('--sy', `${y}px`);
    };

    const hasHover = window.matchMedia('(hover: hover)').matches;

    if (hasHover) {
      const onMove = (e: MouseEvent) => {
        const rect = host.getBoundingClientRect();
        setSpot(e.clientX - rect.left, e.clientY - rect.top);
      };
      const onLeave = () => setSpot(-500, -500);
      host.addEventListener('mousemove', onMove);
      host.addEventListener('mouseleave', onLeave);
      setSpot(-500, -500);
      return () => {
        host.removeEventListener('mousemove', onMove);
        host.removeEventListener('mouseleave', onLeave);
      };
    }

    // Touch / no-hover: auto-drifting spotlight on a slow lissajous path
    const start = performance.now();
    const drift = (now: number) => {
      const t = (now - start) / 1000;
      const { width, height } = host.getBoundingClientRect();
      const x = width * (0.5 + 0.42 * Math.sin(t * 0.35));
      const y = height * (0.5 + 0.38 * Math.sin(t * 0.23 + 1.3));
      setSpot(x, y);
      rafRef.current = requestAnimationFrame(drift);
    };
    rafRef.current = requestAnimationFrame(drift);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const mask = 'radial-gradient(circle 110px at var(--sx, -500px) var(--sy, -500px), black 0%, black 55%, transparent 100%)';

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="absolute inset-0 z-[5] pointer-events-none select-none"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
    >
      {WORDS.map((w) => (
        <span
          key={w.text}
          className="absolute font-black uppercase tracking-widest whitespace-nowrap"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            fontSize: `${w.size}px`,
            transform: `rotate(${w.rotate}deg)`,
            color: 'rgba(244, 81, 30, 0.55)',
            textShadow: '0 0 24px rgba(244,81,30,0.35)',
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}
