"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { MapPin, Navigation, Loader2, AlertCircle, Info, X, ArrowRight } from "lucide-react";
import { useTranslation } from "../../context/LanguageContext";

// Dynamically import LocationMap with SSR disabled to prevent window/document errors
const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 sm:h-72 md:h-80 rounded-xl border border-[#E9E9E9] bg-[#F5F7FA] flex flex-col items-center justify-center gap-2 text-[#667085] animate-pulse">
      <Loader2 className="h-6 w-6 animate-spin text-[#1F5E91]" />
      <span className="text-xs font-semibold">Loading interactive map...</span>
    </div>
  ),
});

export interface LocationPickerProps {
  value: string;
  latitude?: number;
  longitude?: number;
  onChange: (address: string, lat?: number, lng?: number) => void;
  className?: string;
  required?: boolean;
  id?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  hasError?: boolean;
}

// Known postal code localities in Pune region to ensure specific localities (e.g. Alandi, Charoli)
// are accurately identified even when the OSM way lacks a direct village/suburb tag
const PUNE_PINCODE_LOCALITIES: Record<string, string> = {
  "412105": "Alandi",
  "412101": "Dehu",
  "412207": "Wagholi",
  "412308": "Phursungi",
  "412307": "Uruli Kanchan",
  "412115": "Chakan",
  "412201": "Shirur",
  "412409": "Talegaon Dabhade",
  "411057": "Hinjawadi",
  "411045": "Baner",
  "411038": "Kothrud",
  "411028": "Hadapsar",
  "411005": "Shivaji Nagar",
  "411039": "Bhosari",
  "411015": "Dighi",
  "411033": "Thergaon",
  "411027": "Pimple Saudagar",
  "411017": "Pimpri",
  "411019": "Chinchwad",
  "411014": "Viman Nagar",
  "411006": "Yerwada",
  "411041": "Vadgaon Budruk",
  "411046": "Katraj",
  "411048": "Kondhwa",
  "411052": "Karve Nagar",
  "411058": "Warje",
  "411021": "Bavdhan",
  "411007": "Aundh",
  "411004": "Deccan Gymkhana",
  "411016": "Model Colony",
  "411001": "Pune Camp",
  "411002": "Budhwar Peth",
  "411030": "Sadashiv Peth",
  "411042": "Swargate",
  "411037": "Bibwewadi",
  "411051": "Dhayari",
  "411012": "Dapodi",
  "411026": "Bhosari I.E.",
  "411044": "Nigdi",
  "411035": "Akurdi",
};

// Comprehensive, prioritized address formatter for OpenStreetMap Nominatim response
// Preference order: street/road -> landmark/place -> locality/suburb/village -> city -> district -> state
export function formatReverseGeocodeAddress(data: any): string {
  if (!data) return "";
  const addr = data.address || {};
  const parts: string[] = [];

  const isIncluded = (val: string) => {
    const lower = val.toLowerCase().trim();
    return parts.some((p) => {
      const pLower = p.toLowerCase().trim();
      return pLower === lower || pLower.includes(lower) || lower.includes(pLower);
    });
  };

  // ----------------------------------------------------
  // Priority 1: street / road / pedestrian / way / highway
  // house_number, road, pedestrian, footway, residential, street
  // ----------------------------------------------------
  const houseNumber = addr.house_number ? addr.house_number.trim() : "";
  const road =
    addr.road ||
    addr.pedestrian ||
    addr.street ||
    addr.footway ||
    addr.path ||
    addr.cycleway ||
    addr.highway ||
    (addr.residential && addr.residential !== addr.suburb && addr.residential !== addr.neighbourhood
      ? addr.residential
      : undefined);

  if (road && typeof road === "string") {
    const cleanRoad = road.trim();
    if (houseNumber) {
      parts.push(`${houseNumber}, ${cleanRoad}`);
    } else {
      parts.push(cleanRoad);
    }
  } else if (houseNumber) {
    parts.push(houseNumber);
  }

  // ----------------------------------------------------
  // Priority 2: landmark / place / amenity / POI
  // amenity, building, shop, tourism, office, historic, leisure, place
  // ----------------------------------------------------
  const rawPoi =
    addr.amenity ||
    addr.building ||
    addr.shop ||
    addr.tourism ||
    addr.office ||
    addr.historic ||
    addr.leisure ||
    addr.place ||
    (data.name &&
    data.addresstype !== "road" &&
    data.addresstype !== "city" &&
    data.addresstype !== "postcode" &&
    data.addresstype !== "county" &&
    data.addresstype !== "state" &&
    data.addresstype !== "country"
      ? data.name
      : undefined);

  if (rawPoi && typeof rawPoi === "string") {
    const cleanPoi = rawPoi.trim();
    if (!isIncluded(cleanPoi)) {
      const isLandmarkType =
        data.category === "amenity" ||
        data.category === "tourism" ||
        addr.amenity ||
        addr.historic ||
        addr.tourism;
      if (
        isLandmarkType &&
        !cleanPoi.toLowerCase().startsWith("near ") &&
        !cleanPoi.toLowerCase().startsWith("opp ") &&
        !cleanPoi.toLowerCase().startsWith("opposite ")
      ) {
        parts.push(`Near ${cleanPoi}`);
      } else {
        parts.push(cleanPoi);
      }
    }
  }

  // ----------------------------------------------------
  // Priority 3: locality / suburb / village / town (Preserve Actual Locality!)
  // suburb, neighbourhood, village, town, hamlet, city_district, quarter
  // ----------------------------------------------------
  const suburb = addr.suburb || addr.neighbourhood;
  const village = addr.village || addr.town || addr.hamlet;

  if (suburb && typeof suburb === "string") {
    const cleanSuburb = suburb.trim();
    if (!isIncluded(cleanSuburb)) {
      parts.push(cleanSuburb);
    }
  }

  if (village && typeof village === "string") {
    const cleanVillage = village.trim();
    if (!isIncluded(cleanVillage)) {
      parts.push(cleanVillage);
    }
  }

  // If neither suburb nor village was present in raw address tags,
  // check known postcode locality (e.g. 412105 -> Alandi)
  const postcode = addr.postcode ? addr.postcode.toString().trim() : "";
  if (!suburb && !village && postcode && PUNE_PINCODE_LOCALITIES[postcode]) {
    const pinLocality = PUNE_PINCODE_LOCALITIES[postcode];
    if (!isIncluded(pinLocality)) {
      parts.push(pinLocality);
    }
  }

  // Also check city_district, quarter, or subdistrict if still no locality found
  if (parts.length === 0 || (!suburb && !village && !postcode)) {
    const dist = addr.city_district || addr.quarter || addr.subdistrict;
    if (dist && typeof dist === "string") {
      const cleanDist = dist.trim();
      if (!isIncluded(cleanDist)) {
        parts.push(cleanDist);
      }
    }
  }

  // ----------------------------------------------------
  // Priority 4: city (Ensure Pune is clearly anchored)
  // ----------------------------------------------------
  const rawCity = addr.city || addr.municipality;
  if (rawCity && typeof rawCity === "string") {
    const cleanCity = rawCity.replace(/ Subdistrict/gi, "").trim();
    if (!isIncluded(cleanCity)) {
      parts.push(cleanCity);
    }
  }

  // Always anchor to Pune if not already mentioned
  if (!parts.some((p) => p.toLowerCase().includes("pune"))) {
    parts.push("Pune");
  }

  // ----------------------------------------------------
  // Clean deduplication while strictly preserving order
  // ----------------------------------------------------
  const uniqueParts: string[] = [];
  for (const part of parts) {
    const clean = part.trim();
    if (!clean) continue;
    if (!uniqueParts.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
      uniqueParts.push(clean);
    }
  }

  if (uniqueParts.length > 0) {
    return uniqueParts.join(", ");
  }

  return data.display_name || "";
}

export default function LocationPicker({
  value,
  latitude,
  longitude,
  onChange,
  className = "",
  required = true,
  id,
  inputRef,
  hasError = false,
}: LocationPickerProps) {
  const { t } = useTranslation();
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState<number>(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showSearchTooltip, setShowSearchTooltip] = useState(false);
  const [targetZoom, setTargetZoom] = useState(17);

  // Reverse geocode latitude and longitude to human-readable address
  const reverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<string> => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1`,
          {
            headers: {
              Accept: "application/json",
              "Accept-Language": "en",
            },
          }
        );
        if (!response.ok) {
          throw new Error("Geocoding service unavailable");
        }
        const data = await response.json();
        const formatted = formatReverseGeocodeAddress(data);
        return formatted || `Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      } catch (err) {
        console.warn("Reverse geocode fallback:", err);
        return `Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      }
    },
    []
  );

  // Handler for browser Geolocation API
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError(
        t("reportPage.locationUnavailable") ||
          "Geolocation is not supported by your browser. Please type your location or pick it on the map."
      );
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // 1. Immediately update zoom level to 17 and trigger smooth flyTo
        setTargetZoom(17);
        setFlyToTrigger(Date.now());

        // 2. Instantly notify parent with exact GPS coordinates so marker moves and map centers right away
        const tempDisplay = `Detecting location... (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        onChange(tempDisplay, lat, lng);

        try {
          // 3. Reverse geocode in parallel to build the specific human-readable address
          const address = await reverseGeocode(lat, lng);
          // Pass the rich, specific address while strictly preserving exact GPS coordinates
          onChange(address, lat, lng);
        } catch (err) {
          console.warn("Reverse geocoding error:", err);
          // If reverse geocode fails, still keep exact GPS coordinates and show clean fallback
          onChange(`Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError(
              t("reportPage.locationPermissionDenied") ||
                "Location access was denied. Please select your location directly on the map or type it manually."
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError(
              t("reportPage.locationUnavailable") ||
                "Location information is unavailable. Please select your location on the map or type it manually."
            );
            break;
          case error.TIMEOUT:
            setGeoError(
              t("reportPage.locationTimeout") ||
                "Location request timed out. Please select on the map or try again."
            );
            break;
          default:
            setGeoError(
              t("reportPage.locationUnavailable") ||
                "Could not retrieve location. Please select on the map or type manually."
            );
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [reverseGeocode, onChange, value, t]);

  // Handler for manual location forward geocoding (using the arrow button or Enter key)
  const handleSearchLocation = useCallback(async () => {
    const query = value.trim();
    if (!query) return;

    setIsSearching(true);
    setGeoError(null);

    try {
      // Prioritize Pune, Maharashtra, India
      const searchQuery = query.toLowerCase().includes("pune") ? query : `${query}, Pune, Maharashtra, India`;
      const viewbox = "73.65,18.70,74.10,18.35"; // Pune region bounding box
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        searchQuery
      )}&viewbox=${viewbox}&bounded=0&limit=5&addressdetails=1`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error("Search service unavailable");
      }

      let results = await res.json();

      // Fallback: try raw query without forced suffix if nothing returned
      if (!results || results.length === 0) {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
          query
        )}&limit=5&addressdetails=1`;
        const fallbackRes = await fetch(fallbackUrl, {
          headers: { Accept: "application/json" },
        });
        if (fallbackRes.ok) {
          results = await fallbackRes.json();
        }
      }

      if (!results || results.length === 0) {
        setGeoError(
          t("reportPage.locationNotFound") ||
            "Location not found. Please try a more specific area or landmark in Pune, or click directly on the map."
        );
        return;
      }

      const topMatch = results[0];
      const lat = parseFloat(topMatch.lat);
      const lng = parseFloat(topMatch.lon);

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error("Invalid coordinates received");
      }

      const formatted = formatReverseGeocodeAddress(topMatch) || topMatch.display_name || query;

      setTargetZoom(16);
      setFlyToTrigger(Date.now());
      onChange(formatted, lat, lng);
    } catch (err) {
      console.warn("Location search error:", err);
      setGeoError(
        t("reportPage.locationNotFound") ||
          "Could not search location. Please check the spelling or select directly on the map."
      );
    } finally {
      setIsSearching(false);
    }
  }, [value, onChange, t]);

  // Handler for map clicks
  const handleMapLocationSelect = useCallback(
    async (lat: number, lng: number) => {
      setGeoError(null);
      setTargetZoom(16);
      setFlyToTrigger(Date.now());
      // Immediately pass exact coordinates so marker moves to clicked location at once
      const tempCoordLabel = `Detecting address... (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      onChange(tempCoordLabel, lat, lng);
      try {
        const address = await reverseGeocode(lat, lng);
        onChange(address, lat, lng);
      } catch (err) {
        console.warn("Reverse geocode failed:", err);
        onChange(`Selected Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng);
      }
    },
    [reverseGeocode, onChange]
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-[#1F2933] flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-[#1F5E91]" />
          <span>{t("reportPage.locationLabel") || "AREA / LANDMARK / LOCATION IN PUNE"}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
        {latitude && longitude && (
          <span className="text-[10px] font-mono text-[#667085] bg-[#F5F4F0] px-2 py-0.5 rounded border border-[#E9E9E9]">
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </span>
        )}
      </div>

      {/* Input container with map pin icon and search arrow button */}
      <div className="relative">
        <input
          id={id || "location-input"}
          ref={inputRef}
          type="text"
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value, latitude, longitude)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearchLocation();
            }
          }}
          placeholder={
            t("reportPage.locationPlaceholder") ||
            "e.g. Baner Road near Balewadi Phata, or Kothrud near Karve Statue"
          }
          className={`w-full rounded-xl border pl-4 pr-24 py-3 text-xs sm:text-sm text-[#1F2933] placeholder-[#667085] bg-white transition ${
            hasError
              ? "border-rose-400 ring-2 ring-rose-200 focus:border-rose-500 focus:ring-rose-300"
              : "border-[#E9E9E9] focus:border-[#1F5E91] focus:outline-none focus:ring-1 focus:ring-[#1F5E91]"
          }`}
        />

        {/* Action button group: [📍] [→] */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {/* [📍] Current Location Button */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating || isSearching}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              aria-label={t("reportPage.useCurrentLocation") || "Use my current location"}
              className="p-1.5 sm:p-2 rounded-lg text-[#1F5E91] hover:text-[#123B5D] hover:bg-[#F5F4F0] transition-colors focus:outline-none disabled:opacity-40"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-[#F39A32]" />
              ) : (
                <Navigation className="h-4 w-4 sm:h-5 sm:w-5 fill-[#1F5E91]/10 text-[#1F5E91] hover:text-[#123B5D] transition-transform active:scale-90" />
              )}
            </button>

            {/* Tooltip on hover */}
            {showTooltip && (
              <div
                role="tooltip"
                className="absolute right-0 bottom-full mb-2.5 z-30 whitespace-nowrap rounded-lg bg-[#123B5D] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg border border-[#1F5E91]/40 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
              >
                <span>{t("reportPage.useCurrentLocation") || "Use my current location"}</span>
                {/* Arrow */}
                <span className="absolute right-3 top-full border-4 border-transparent border-t-[#123B5D]"></span>
              </div>
            )}
          </div>

          {/* Subtle vertical divider */}
          <span className="h-4 w-[1px] bg-[#E9E9E9]"></span>

          {/* [→] Arrow Button for Manual Search */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={handleSearchLocation}
              disabled={isLocating || isSearching || !value.trim()}
              onMouseEnter={() => setShowSearchTooltip(true)}
              onMouseLeave={() => setShowSearchTooltip(false)}
              onFocus={() => setShowSearchTooltip(true)}
              onBlur={() => setShowSearchTooltip(false)}
              aria-label={t("reportPage.searchLocation") || "Search location on map"}
              className="p-1.5 sm:p-2 rounded-lg text-[#1F5E91] hover:text-white hover:bg-[#1F5E91] transition-all focus:outline-none disabled:opacity-40 active:scale-95"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-[#F39A32]" />
              ) : (
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>

            {/* Search Tooltip on hover */}
            {showSearchTooltip && (
              <div
                role="tooltip"
                className="absolute right-0 bottom-full mb-2.5 z-30 whitespace-nowrap rounded-lg bg-[#123B5D] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg border border-[#1F5E91]/40 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
              >
                <span>{t("reportPage.searchLocation") || "Search location on map"}</span>
                {/* Arrow */}
                <span className="absolute right-3 top-full border-4 border-transparent border-t-[#123B5D]"></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Geolocation Error Alert (Clean & non-breaking) */}
      {geoError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start justify-between gap-2 animate-in fade-in duration-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{geoError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGeoError(null)}
            className="text-amber-700 hover:text-amber-900 p-0.5 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Subtle user instruction above the map */}
      <div className="flex items-center justify-between text-xs text-[#667085] px-0.5">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F39A32] inline-block animate-pulse"></span>
          <span>{t("reportPage.clickMapHint") || "Click anywhere on the map to select a location"}</span>
        </span>
        {latitude && longitude ? (
          <span className="text-[11px] text-[#1F5E91] font-medium hidden sm:inline">
            Location pin active
          </span>
        ) : null}
      </div>

      {/* Interactive Leaflet Map */}
      <LocationMap
        latitude={latitude}
        longitude={longitude}
        address={value}
        onLocationSelect={handleMapLocationSelect}
        flyToTrigger={flyToTrigger}
        targetZoom={targetZoom}
      />

      {/* Tip box below the map */}
      <div className="flex items-start gap-2 rounded-xl border border-[#1F5E91]/20 bg-[#1F5E91]/5 p-3 text-xs text-[#123B5D]">
        <Info className="h-4 w-4 text-[#F39A32] shrink-0 mt-0.5" />
        <span className="leading-relaxed">
          {t("reportPage.mapTip") ||
            "Tip: You can also click on the map to select a location. The address will be filled automatically."}
        </span>
      </div>
    </div>
  );
}
