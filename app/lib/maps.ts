let mapsLoadPromise: Promise<any> | null = null;

export function getMapsLoader() {
  return {
    load: (): Promise<any> => {
      if (typeof window === "undefined") return Promise.resolve(null);

      const g = (window as any).google;
      if (g?.maps?.Map) return Promise.resolve(g);

      if (mapsLoadPromise) return mapsLoadPromise;

      mapsLoadPromise = new Promise<any>((resolve, reject) => {
        const callbackName = "__gmInit__";

        (window as any).gm_authFailure = () => {
          mapsLoadPromise = null;
          reject(new Error("Maps auth failed — Maps JavaScript API or Places API not enabled, or domain not authorized in Google Cloud Console."));
        };

        (window as any)[callbackName] = () => {
          delete (window as any)[callbackName];
          resolve((window as any).google);
        };

        const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=${callbackName}&loading=async`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          delete (window as any)[callbackName];
          mapsLoadPromise = null;
          reject(new Error("Maps script failed to load — Maps JavaScript API may not be enabled for this key."));
        };
        document.head.appendChild(script);
      });

      return mapsLoadPromise;
    },
  };
}
