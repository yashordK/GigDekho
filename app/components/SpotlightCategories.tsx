import { useEffect, useRef, useState } from 'react';
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

/** Clear space kept between a card and the hero's real content. */
const SAFE_PADDING = 24;

/**
 * The taxonomy alone only fills a narrow band of a tall hero, so the torch
 * finds nothing above or below it. Repeating it fills the space; the rotation
 * offsets keep any two copies of a label about a screen apart, so a single
 * 88px beam never shows the same word twice.
 */
const rotate = <T,>(arr: T[], by: number) => [...arr.slice(by), ...arr.slice(0, by)];
const FIELD = [...CARDS, ...rotate(CARDS, 17), ...rotate(CARDS, 34)];

/**
 * Drop inside a `relative overflow-hidden` hero. Renders a grid of small
 * glowing category cards, masked by a torch-shaped spotlight following the
 * cursor.
 *
 * Two rules it enforces:
 *
 *  - Pointer devices only. On touch it used to drift around on its own via
 *    requestAnimationFrame, which read as restless rather than playful and
 *    burned battery for decoration. It simply doesn't render there now.
 *  - Cards never sit under the headline or buttons. Anything marked
 *    `data-torch-safe` is measured after layout and any card overlapping it
 *    (plus padding) is hidden, so the reveal happens around the content
 *    instead of through it.
 */
export default function SpotlightCategories() {
  const layerRef = useRef<HTMLDivElement>(null);
  const torchRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  // Decide on the client only — matchMedia doesn't exist during SSR, and
  // starting false means server and first client render always agree.
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const apply = () => setEnabled(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const layer = layerRef.current;
    const torch = torchRef.current;
    const host = layer?.parentElement;
    if (!layer || !host) return;

    const setSpot = (x: number, y: number) => {
      layer.style.setProperty('--sx', `${x}px`);
      layer.style.setProperty('--sy', `${y}px`);
      if (torch) torch.style.transform = `translate(${x}px, ${y}px)`;
    };

    /**
     * The rectangles cards must stay out of.
     *
     * Measuring the marked elements' own boxes reserved far too much: a
     * centred headline is a full-width block whose text only occupies the
     * middle, so it blanked the whole hero and left cards stranded in two
     * thin gutters. Ranges give the actual line boxes of the text, and
     * interactive elements contribute their real box, so the exclusion hugs
     * the ink instead of the layout.
     */
    const safeRects = () => {
      const out: DOMRect[] = [];
      for (const el of Array.from(host.querySelectorAll('[data-torch-safe]'))) {
        for (const b of Array.from(el.querySelectorAll('button, a, input, select, textarea'))) {
          out.push(b.getBoundingClientRect());
        }
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          if (!n.nodeValue || !n.nodeValue.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const r of Array.from(range.getClientRects())) {
            if (r.width > 2 && r.height > 2) out.push(r);
          }
        }
      }
      return out;
    };

    // Hide any card that would sit on top of the hero's content.
    const clearSafeZones = () => {
      const hostRect = host.getBoundingClientRect();
      const zones = safeRects().map((r) => ({
        left: r.left - hostRect.left - SAFE_PADDING,
        right: r.right - hostRect.left + SAFE_PADDING,
        top: r.top - hostRect.top - SAFE_PADDING,
        bottom: r.bottom - hostRect.top + SAFE_PADDING,
      }));
      for (const el of Array.from(layer.querySelectorAll<HTMLElement>('[data-card]'))) {
        el.style.visibility = 'visible';
        const r = el.getBoundingClientRect();
        const c = {
          left: r.left - hostRect.left, right: r.right - hostRect.left,
          top: r.top - hostRect.top, bottom: r.bottom - hostRect.top,
        };
        const hits = zones.some(
          (z) => c.left < z.right && c.right > z.left && c.top < z.bottom && c.bottom > z.top
        );
        if (hits) el.style.visibility = 'hidden';
      }
    };

    host.classList.add('torch-host');
    clearSafeZones();

    const ro = new ResizeObserver(clearSafeZones);
    ro.observe(host);

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
      ro.disconnect();
    };
  }, [enabled]);

  if (!enabled) return null;

  const mask = 'radial-gradient(circle 88px at var(--sx, -500px) var(--sy, -500px), black 0%, black 55%, transparent 100%)';

  return (
    <>
      {/* Masked card grid. Wider horizontal gaps push more cards onto the next
          line and tighter vertical gaps keep those lines close, so it reads as
          a field of cards rather than a few far-apart rows. */}
      <div
        ref={layerRef}
        aria-hidden="true"
        className="absolute inset-0 z-[5] pointer-events-none select-none p-4 lg:p-6 overflow-hidden"
        style={{ WebkitMaskImage: mask, maskImage: mask }}
      >
        <div
          className="w-full h-full flex flex-wrap items-center justify-center content-center"
          style={{ columnGap: '22px', rowGap: '10px' }}
        >
          {FIELD.map((label, i) => (
            <span
              key={`${label}-${i}`}
              data-card
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
        <span
          className="absolute rounded-full"
          style={{
            width: '18px', height: '18px', left: '-9px', top: '-9px',
            background: 'radial-gradient(circle, rgba(255,214,170,0.9) 0%, rgba(244,81,30,0.35) 45%, transparent 70%)',
          }}
        />
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
