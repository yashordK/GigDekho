import { useEffect, useState } from "react";

/**
 * The height a full-screen sheet should actually be on a phone.
 *
 * `100dvh` accounts for the browser's own chrome appearing and disappearing,
 * but not for the on-screen keyboard. iOS Safari in particular does not shrink
 * the layout viewport when the keyboard opens — it shrinks only the *visual*
 * viewport — so a sheet sized at 100dvh keeps its full height and its footer
 * sits behind the keyboard. On a form you have to type into, that means the
 * buttons you need next are the ones you cannot see.
 *
 * visualViewport is the only thing that reports the space actually left over,
 * so that is what the sheet is sized to. Everything else falls back to
 * innerHeight, and rendering starts with `null` so the server and the first
 * client paint agree — reading window during render would mismatch on SSR.
 */
export function useViewportHeight(active: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const vv = window.visualViewport;
    const read = () => {
      // offsetTop matters when the page is scrolled under a shrunken visual
      // viewport: without it the sheet is the right size in the wrong place.
      const h = vv ? vv.height : window.innerHeight;
      setHeight(Math.round(h));
    };

    read();
    if (vv) {
      vv.addEventListener("resize", read);
      vv.addEventListener("scroll", read);
    }
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", read);
        vv.removeEventListener("scroll", read);
      }
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, [active]);

  return height;
}
