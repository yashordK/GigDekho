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

      // Already failed
      if ((window as any).__MAPS_AUTH_FAILED__) {
        return Promise.reject(new Error("Maps auth failed"));
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
        const MAX_TICKS = 75; // 15 seconds

        const timer = setInterval(() => {
          if ((window as any).__MAPS_AUTH_FAILED__) {
            clearInterval(timer);
            reject(new Error(
              "Maps auth failed — make sure billing is enabled on your Google Cloud project and the API key is valid."
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
