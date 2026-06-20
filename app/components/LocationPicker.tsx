import { useEffect, useRef, useState } from "react";
import { getMapsLoader } from "~/lib/maps";
import { MapPin, Loader2 } from "lucide-react";

interface LocationPickerProps {
  value: {
    location_text: string;
    lat: number | null;
    lng: number | null;
    is_remote: boolean;
  };
  onChange: (val: LocationPickerProps["value"]) => void;
}

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1C1C1C" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2C2C2C" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1C1C1C" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#111111" }] },
];

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState(false);
  const [inputValue, setInputValue] = useState(value.is_remote ? "" : value.location_text);

  // Fallback address fields (used when maps fail)
  const [fallbackLine1, setFallbackLine1] = useState("");
  const [fallbackLine2, setFallbackLine2] = useState("");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);

  // Load Google Maps
  useEffect(() => {
    getMapsLoader()
      .load()
      .then(() => setMapsLoaded(true))
      .catch((err) => {
        console.error("[LocationPicker] Maps load error:", err?.message ?? err);
        setMapsError(true);
      });
  }, []);

  // Sync input when parent resets location_text
  useEffect(() => {
    if (value.is_remote) {
      setInputValue("");
    } else {
      setInputValue(value.location_text);
    }
  }, [value.location_text, value.is_remote]);

  // Initialize map and autocomplete once maps are loaded
  useEffect(() => {
    if (!mapsLoaded || value.is_remote || !mapContainerRef.current || !inputRef.current) return;

    const google = (window as any).google;
    const defaultCenter = { lat: value.lat || 22.7196, lng: value.lng || 75.8577 };

    const map = new google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: value.lat && value.lng ? 15 : 13,
      styles: darkMapStyles,
      disableDefaultUI: true,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    const marker = new google.maps.Marker({
      position: defaultCenter,
      map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#F4511E",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
        scale: 10,
      },
    });
    markerRef.current = marker;

    if (!value.lat || !value.lng) marker.setVisible(false);

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry"],
      componentRestrictions: { country: "in" },
    });
    autocompleteRef.current = autocomplete;

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || inputRef.current?.value || "";
        setInputValue(address);
        onChange({ is_remote: false, location_text: address, lat, lng });
        map.setCenter({ lat, lng });
        map.setZoom(16);
        marker.setPosition({ lat, lng });
        marker.setVisible(true);
      }
    });

    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) {
        const lat = pos.lat();
        const lng = pos.lng();
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
          const address =
            status === "OK" && results?.[0]
              ? results[0].formatted_address
              : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setInputValue(address);
          onChange({ is_remote: false, location_text: address, lat, lng });
        });
      }
    });

    return () => {
      if (google) {
        google.maps.event.clearInstanceListeners(autocomplete);
        google.maps.event.clearInstanceListeners(marker);
      }
    };
  }, [mapsLoaded, value.is_remote]);

  const handleRemoteToggle = (isRemote: boolean) => {
    onChange({
      is_remote: isRemote,
      location_text: isRemote ? "Remote" : "",
      lat: null,
      lng: null,
    });
  };

  // Fallback: update location_text from the two address lines
  const handleFallbackChange = (line1: string, line2: string) => {
    const combined = line2.trim() ? `${line1.trim()}, ${line2.trim()}` : line1.trim();
    onChange({ is_remote: false, location_text: combined, lat: null, lng: null });
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Remote toggle — always visible */}
      <div className="flex items-center justify-between bg-[#1C1C1C] p-3 rounded-2xl border border-white/5">
        <div className="flex flex-col">
          <span className="text-sm font-black text-white">Remote / Work from Home</span>
          <span className="text-[11px] text-white/50 font-medium">No physical location required</span>
        </div>
        <button
          type="button"
          onClick={() => handleRemoteToggle(!value.is_remote)}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 btn-tap ${
            value.is_remote ? "bg-[#F4511E]" : "bg-white/10"
          }`}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${
              value.is_remote ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {!value.is_remote && (
        <>
          {/* ── MAPS PATH ─────────────────────────────────────────── */}
          {!mapsError && (
            <div className="flex flex-col space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search event location or venue..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full h-11 px-4 pl-10 rounded-xl bg-[#1C1C1C] border border-white/5 text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2"
                />
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
                {!mapsLoaded && (
                  <div className="w-full h-[200px] lg:h-[250px] flex flex-col items-center justify-center space-y-2 text-white/40">
                    <Loader2 size={24} className="animate-spin text-[#F4511E]" />
                    <span className="text-xs font-bold tracking-wider uppercase">Loading Map Services...</span>
                  </div>
                )}
                <div
                  ref={mapContainerRef}
                  className="w-full h-[200px] lg:h-[250px]"
                  style={{ display: mapsLoaded ? "block" : "none" }}
                />
              </div>

              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-1">
                📍 You can drag the marker to pinpoint the exact entrance or stall
              </p>
            </div>
          )}

          {/* ── FALLBACK ADDRESS PATH (when maps fail) ────────────── */}
          {mapsError && (
            <div className="flex flex-col space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-2 rounded-xl text-xs font-semibold">
                <MapPin size={14} className="shrink-0" />
                Map unavailable — enter the address manually below.
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Venue name / Street address *"
                  value={fallbackLine1}
                  onChange={(e) => {
                    setFallbackLine1(e.target.value);
                    handleFallbackChange(e.target.value, fallbackLine2);
                  }}
                  className="w-full h-11 px-4 pl-10 rounded-xl bg-[#1C1C1C] border border-white/5 text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2"
                />
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              </div>

              <input
                type="text"
                placeholder="Area / Landmark (optional) — e.g. Near LIG Square, Indore"
                value={fallbackLine2}
                onChange={(e) => {
                  setFallbackLine2(e.target.value);
                  handleFallbackChange(fallbackLine1, e.target.value);
                }}
                className="w-full h-11 px-4 rounded-xl bg-[#1C1C1C] border border-white/5 text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2"
              />

              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-1">
                📍 Be specific — workers need to know exactly where to show up
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
