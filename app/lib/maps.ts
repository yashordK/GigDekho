let mapsLoadPromise: Promise<void> | null = null;

export function getMapsLoader() {
  return {
    load: (): Promise<void> => {
      if (typeof window === "undefined") return Promise.resolve();

      // Already loaded
      if ((window as any).google?.maps?.Map) {
        return Promise.resolve();
      }

      if (mapsLoadPromise) return mapsLoadPromise;

      mapsLoadPromise = new Promise<void>((resolve, reject) => {
        const callbackName = "__gmInit__";

        // Called by Maps JS API when auth fails (invalid key, API not enabled, etc.)
        (window as any).gm_authFailure = () => {
          mapsLoadPromise = null;
          reject(
            new Error(
              "Google Maps auth failed — check that Maps JavaScript API and Places API are enabled in Google Cloud Console, and that the API key restrictions allow this domain."
            )
          );
        };

        (window as any)[callbackName] = () => {
          delete (window as any)[callbackName];
          resolve();
        };

        const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=${callbackName}&loading=async`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          delete (window as any)[callbackName];
          mapsLoadPromise = null;
          reject(
            new Error(
              `Maps script failed to load — check that Maps JavaScript API is enabled in Google Cloud Console for this key.`
            )
          );
        };
        document.head.appendChild(script);
      });

      return mapsLoadPromise;
    },
  };
}
