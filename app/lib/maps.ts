import { Loader } from "@googlemaps/js-api-loader";

let loaderInstance: Loader | null = null;

export function getMapsLoader(): Loader {
  if (!loaderInstance) {
    loaderInstance = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyDlmoFFSk55O9xy0SODFEHLMX8mqKPYTLc",
      version: "weekly",
      libraries: ["places"],
    });
  }
  return loaderInstance;
}
