import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let optionsSet = false;

function initMaps() {
  if (!optionsSet) {
    setOptions({
      key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyDlmoFFSk55O9xy0SODFEHLMX8mqKPYTLc",
      // No `v` — defaults to the stable quarterly release, which keeps
      // legacy google.maps.places.Autocomplete working correctly.
    });
    optionsSet = true;
  }
}

export function getMapsLoader() {
  return {
    load: async () => {
      initMaps();
      await Promise.all([
        importLibrary("maps"),
        importLibrary("places"),
      ]);
      return (window as any).google;
    }
  };
}
