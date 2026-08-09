import { useEffect, useState } from "react";
import { useLocation } from "react-router";

/**
 * Which side of the marketplace the person is currently looking at.
 *
 * This used to be read straight out of localStorage during render, in two
 * components separately. That broke in two ways:
 *
 *  1. The server has no localStorage, so it rendered one value and the
 *     browser hydrated with another. React keeps the server's markup, so the
 *     toggle would sit there showing the wrong mode until some other state
 *     change forced a re-render — which is why clicking it once "fixed" it.
 *  2. Reading localStorage during render isn't reactive, so the label could
 *     disagree with the page actually on screen.
 *
 * So: the URL wins whenever it's unambiguous — /worker/* is worker, and
 * /organizer/* is hirer, no argument. Everywhere else (a gig page, About) we
 * fall back to the last stored choice, read in an effect so the first client
 * render still matches the server's.
 */
export type ActiveView = "worker" | "organizer";

const KEY = "activeView";

/**
 * `/worker/profile` is deliberately excluded: despite the URL it's the shared
 * profile page, and the hirer nav points there too. Deriving "worker" from
 * that path would force hirers to look at a worker profile.
 */
const SHARED_PATHS = ["/worker/profile"];

function viewFromPath(pathname: string): ActiveView | null {
  if (SHARED_PATHS.some((p) => pathname.startsWith(p))) return null;
  if (pathname.startsWith("/organizer")) return "organizer";
  if (pathname.startsWith("/worker")) return "worker";
  return null;
}

export function useActiveView(profileRole?: string | null) {
  const { pathname } = useLocation();
  const routeView = viewFromPath(pathname);

  // Starts null on server and client alike, so hydration always agrees.
  const [stored, setStored] = useState<ActiveView | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "worker" || v === "organizer") setStored(v);
    } catch {
      /* private mode */
    }
  }, []);

  // Landing on a side-specific page IS choosing that side — remember it so
  // the neutral pages agree with where they've just been.
  useEffect(() => {
    if (!routeView) return;
    setStored(routeView);
    try {
      localStorage.setItem(KEY, routeView);
    } catch {
      /* private mode */
    }
  }, [routeView]);

  const activeView: ActiveView =
    routeView ?? stored ?? (profileRole === "organizer" ? "organizer" : "worker");

  return { activeView, isOrganizerView: activeView === "organizer" };
}

/** Persist a deliberate switch before navigating. */
export function setActiveView(view: ActiveView) {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    /* private mode */
  }
}
