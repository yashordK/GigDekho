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
  const [loadingError, setLoadingError] = useState(false);
  const [inputValue, setInputValue] = useState(value.is_remote ? "" : value.location_text);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);

  // Load Google Maps API on mount
  useEffect(() => {
    getMapsLoader()
      .load()
      .then(() => {
        setMapsLoaded(true);
      })
      .catch((err) => {
        console.error("[LocationPicker] Maps load error:", err?.message ?? err);
        setLoadingError(true);
      });
  }, []);

  // Update input text when external location_text changes (e.g. from parent/reset)
  useEffect(() => {
    if (value.is_remote) {
      setInputValue("");
    } else {
      setInputValue(value.location_text);
    }
  }, [value.location_text, value.is_remote]);

  // Initializing map and autocomplete when mapsLoaded and is_remote is false
  useEffect(() => {
    if (!mapsLoaded || value.is_remote || !mapContainerRef.current || !inputRef.current) return;

    const google = (window as any).google;
    const defaultCenter = { lat: value.lat || 22.7196, lng: value.lng || 75.8577 }; // Indore as default

    // Create Map Instance
    const map = new google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: value.lat && value.lng ? 15 : 13,
      styles: darkMapStyles,
      disableDefaultUI: true,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    // Create Marker
    const marker = new google.maps.Marker({
      position: defaultCenter,
      map: map,
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

    // If coordinates don't exist yet, hide marker initially
    if (!value.lat || !value.lng) {
      marker.setVisible(false);
    }

    // Initialize Autocomplete
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry"],
      componentRestrictions: { country: "in" }, // Restrict search to India since hyperlocal Indore
    });
    autocompleteRef.current = autocomplete;

    // Listen to autocomplete selections
    const autocompleteListener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || inputRef.current?.value || "";

        setInputValue(address);
        onChange({
          is_remote: false,
          location_text: address,
          lat,
          lng,
        });

        // Update map position and show marker
        map.setCenter({ lat, lng });
        map.setZoom(16);
        marker.setPosition({ lat, lng });
        marker.setVisible(true);
      }
    });

    // Listen to marker dragging
    const markerDragListener = marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) {
        const lat = pos.lat();
        const lng = pos.lng();

        // Geocode to get address for dragged location
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
          const address =
            status === "OK" && results && results[0]
              ? results[0].formatted_address
              : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          setInputValue(address);
          onChange({
            is_remote: false,
            location_text: address,
            lat,
            lng,
          });
        });
      }
    });

    return () => {
      // Clean up autocomplete and marker listeners
      if (google) {
        google.maps.event.clearInstanceListeners(autocomplete);
        google.maps.event.clearInstanceListeners(marker);
      }
    };
  }, [mapsLoaded, value.is_remote]);

  const handleRemoteToggle = (isRemote: boolean) => {
    if (isRemote) {
      onChange({
        is_remote: true,
        location_text: "Remote",
        lat: null,
        lng: null,
      });
    } else {
      onChange({
        is_remote: false,
        location_text: "",
        lat: null,
        lng: null,
      });
    }
  };

  if (loadingError) {
    return (
      <div className="bg-[#1C1C1C] border border-red-500/20 text-red-400 p-4 rounded-2xl text-sm font-semibold space-y-1">
        <p>Failed to load map services.</p>
        <p className="text-red-400/60 text-xs font-medium">
          Check browser console for details. Ensure Maps JavaScript API and Places API are enabled in Google Cloud Console and the API key allows this domain.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Remote / Physical Toggle */}
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
        <div className="flex flex-col space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Autocomplete Input */}
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

          {/* Map Container / Skeleton */}
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
    </div>
  );
}
