import { useEffect, useRef } from 'react';
import { Flashlight } from 'lucide-react';

// Category cards hidden in the hero — the cursor's torch reveals them,
// teaching users everything they can do on GigDekho. Mirrors the live
// skill taxonomy (skill_categories).
const CARDS = [
  'Waitstaff', 'Event Helper', 'Usher/Host', 'Security', 'Bartender', 'Setup Crew',
  'Cleanup Crew', 'Photographer', 'Reel Shooter', 'Surprise Setup', 'Gifting',
  'Brand Promoter', 'Sales Person', 'Product Sampling', 'Leaflet Distributor',
  'Field Verification', 'Data Collection', 'Telecaller', 'Kitchen Help',
  'Catering Staff', 'Housekeeping', 'Customer Service', 'Retail/Cashier',
  'Beauty Assistant', 'Laundry/Ironing', 'Food Service', 'Data Entry',
  'Accounting Help', 'IT Support', 'Front Desk', 'Home Tutoring',
  'Exam Invigilation', 'Bike Rider', 'Local Delivery', 'Auto Driver',
  'Part-Time Driver', 'Packing/Loading', 'Babysitting', 'Personal Helper',
  'Volunteer', 'Web Development', 'Graphic Design', 'Video Editing',
  'Content Writing', 'Social Media', 'Singer', 'DJ', 'Live Band',
  'Anchor/MC', 'Dancer', 'Magician', 'Comedian',
];

/**
 * Drop inside a `relative overflow-hidden` hero. Renders an evenly-spaced grid
 * of small glowing category cards, masked by a torch-shaped spotlight that
 * follows the cursor (the cursor itself becomes a torch over empty hero space).
 * On touch devices the spotlight slowly drifts on its own.
 */
export default function SpotlightCategories() {
  const layerRef = useRef<HTMLDivElement>(null);
  const torchRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const layer = layerRef.current;
    const torch = torchRef.current;
    const host = layer?.parentElement;
    if (!layer || !host) return;

    const setSpot = (x: number, y: number) => {
      layer.style.setProperty('--sx', `${x}px`);
      layer.style.setProperty('--sy', `${y}px`);
      if (torch) {
        torch.style.transform = `translate(${x}px, ${y}px)`;
      }
    };

    const hasHover = window.matchMedia('(hover: hover)').matches;

    if (hasHover) {
      host.classList.add('torch-host');
      const onMove = (e: MouseEvent) => {
        const rect = host.getBoundingClientRect();
        setSpot(e.clientX - rect.left, e.clientY - rect.top);
        // Over buttons/links the normal pointer returns — hide the torch there
        const interactive = (e.target as Element | null)?.closest?.('button, a, input, [role="button"]');
        if (torch) torch.style.opacity = interactive ? '0' : '1';
      };
      const onLeave = () => {
        setSpot(-500, -500);
        if (torch) torch.style.opacity = '0';
      };
      host.addEventListener('mousemove', onMove);
      host.addEventListener('mouseleave', onLeave);
      setSpot(-500, -500);
      if (torch) torch.style.opacity = '0';
      return () => {
        host.classList.remove('torch-host');
        host.removeEventListener('mousemove', onMove);
        host.removeEventListener('mouseleave', onLeave);
      };
    }

    // Touch / no-hover: auto-drifting spotlight on a slow lissajous path (no torch icon)
    if (torch) torch.style.display = 'none';
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

  // Slightly tighter beam than v1 (was 110px)
  const mask = 'radial-gradient(circle 88px at var(--sx, -500px) var(--sy, -500px), black 0%, black 55%, transparent 100%)';

  return (
    <>
      {/* Masked card grid */}
      <div
        ref={layerRef}
        aria-hidden="true"
        className="absolute inset-0 z-[5] pointer-events-none select-none p-4 lg:p-6 overflow-hidden"
        style={{ WebkitMaskImage: mask, maskImage: mask }}
      >
        <div className="w-full h-full flex flex-wrap items-center justify-center content-between gap-2 lg:gap-2.5">
          {CARDS.map((label) => (
            <span
              key={label}
              className="px-2.5 py-1.5 rounded-lg whitespace-nowrap font-bold uppercase tracking-wider"
              style={{
                fontSize: '9px',
                color: 'rgba(255,255,255,0.8)',
                background: 'rgba(255,255,255,0.045)',
                border: '1px solid rgba(244,81,30,0.4)',
                boxShadow: '0 0 8px rgba(244,81,30,0.2), inset 0 0 5px rgba(244,81,30,0.07)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Torch cursor — rendered at the cursor tip, outside the mask */}
      <div
        ref={torchRef}
        aria-hidden="true"
        className="absolute top-0 left-0 z-[6] pointer-events-none transition-opacity duration-150"
        style={{ opacity: 0, willChange: 'transform' }}
      >
        {/* soft light bloom at the tip */}
        <span
          className="absolute rounded-full"
          style={{
            width: '18px', height: '18px', left: '-9px', top: '-9px',
            background: 'radial-gradient(circle, rgba(255,214,170,0.9) 0%, rgba(244,81,30,0.35) 45%, transparent 70%)',
          }}
        />
        {/* torch body, handle trailing down-right from the tip */}
        <Flashlight
          size={26}
          strokeWidth={2.2}
          style={{
            color: '#F4511E',
            transform: 'translate(2px, 2px) rotate(-45deg)',
            transformOrigin: 'top left',
            filter: 'drop-shadow(0 0 5px rgba(244,81,30,0.6))',
          }}
        />
      </div>
    </>
  );
}
