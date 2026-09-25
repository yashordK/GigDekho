// Google Maps is loaded eagerly via <script> in root.tsx.
// This module just waits for window.google to become available
// and surfaces a clean error if auth fails.

export function getMapsLoader() {
  return {
    load: (): Promise<any> => {
      if (typeof window === "undefined") return Promise.resolve(null);

      // Already ready
      if ((window as any).google?.maps?.Map) {
        return Promise.resolve((window as any).google);
      }

      // Already failed. The two cases are worth telling apart: a rejected key
      // is something only the owner can fix, while a blocked request is
      // usually the viewer's own extension or network and is worth retrying.
      if ((window as any).__MAPS_AUTH_FAILED__) {
        return Promise.reject(new Error(
          "Maps rejected the API key — check the key's restrictions and that billing is on."
        ));
      }
      if ((window as any).__MAPS_LOAD_FAILED__) {
        return Promise.reject(new Error(
          "Maps couldn't be reached. An ad blocker or your network may be blocking maps.googleapis.com."
        ));
      }

      // The <script> tag is rendered by root.tsx from a runtime key. If it
      // isn't in the document at all, no key is configured — fail fast so the
      // caller's fallback UI shows immediately instead of polling for 15s.
      const scriptPresent = document.querySelector(
        'script[src*="maps.googleapis.com/maps/api/js"]'
      );
      if (!scriptPresent) {
        return Promise.reject(
          new Error("Google Maps key not configured (set GOOGLE_MAPS_API_KEY)")
        );
      }

      // Poll until window.google is ready (max 15 s)
      return new Promise<any>((resolve, reject) => {
        let ticks = 0;
        const INTERVAL = 200;
        const MAX_TICKS = 40; // 8 seconds — long enough for a slow phone,
                              // short enough that a failure does not feel hung

        const timer = setInterval(() => {
          if ((window as any).__MAPS_AUTH_FAILED__) {
            clearInterval(timer);
            reject(new Error(
              "Maps rejected the API key — check the key's restrictions and that billing is on."
            ));
            return;
          }

          // Set by the script tag's own onerror, so a blocked request stops
          // the wait at once instead of burning the full timeout.
          if ((window as any).__MAPS_LOAD_FAILED__) {
            clearInterval(timer);
            reject(new Error(
              "Maps couldn't be reached. An ad blocker or your network may be blocking maps.googleapis.com."
            ));
            return;
          }

          if ((window as any).google?.maps?.Map) {
            clearInterval(timer);
            resolve((window as any).google);
            return;
          }

          ticks++;
          if (ticks >= MAX_TICKS) {
            clearInterval(timer);
            reject(new Error("Maps timed out — script may have been blocked or the key is invalid."));
          }
        }, INTERVAL);
      });
    },
  };
}
