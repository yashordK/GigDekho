import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let optionsSet = false;

function initMaps() {
  if (!optionsSet) {
    setOptions({
      key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyDlmoFFSk55O9xy0SODFEHLMX8mqKPYTLc",
      v: "weekly",
    });
    optionsSet = true;
  }
}

export function getMapsLoader() {
  return {
    load: async () => {
      initMaps();
      // Load both "maps" and "places" libraries, installing the google.maps namespace
      await Promise.all([
        importLibrary("maps"),
        importLibrary("places"),
      ]);
      return (window as any).google;
    }
  };
}
