import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

const SESSION_KEY = "gd-session";

function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2)) as string;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

function deviceClass() {
  const w = window.innerWidth;
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

/** Fire-and-forget event, safe to call from anywhere in the app. */
export function track(event: string, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    event,
    path: window.location.pathname,
    referrer: document.referrer || null,
    session: sessionId(),
    device: deviceClass(),
    metadata,
  });
  try {
    // Beacon survives navigation away; fetch is the fallback
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
    }
  } catch { /* analytics must never break the app */ }
}

/** Records a pageview on every client-side route change. */
export default function AnalyticsTracker() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Admin traffic would pollute the very numbers it's used to read
    if (location.pathname.startsWith("/admin")) return;
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    track("pageview");
  }, [location.pathname]);

  return null;
}
