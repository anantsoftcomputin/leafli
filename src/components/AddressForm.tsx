"use client";

import { useState } from "react";
import type { Address } from "@/lib/types";
import { Button, Input } from "./ui";

export const emptyAddress: Address = { line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" };

/**
 * Delivery address fields. Porter needs coordinates, so staff can paste
 * "lat, lng" from Google Maps and customers can share their location.
 */
export function AddressForm({ value, onChange, allowGeo }: { value: Address; onChange: (a: Address) => void; allowGeo?: boolean }) {
  const [text, setText] = useState(value.lat != null ? `${value.lat}, ${value.lng}` : "");
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });

  function locate() {
    setGeoMsg("Locating…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = Number(p.coords.latitude.toFixed(6));
        const lng = Number(p.coords.longitude.toFixed(6));
        setText(`${lat}, ${lng}`);
        onChange({ ...value, lat, lng });
        setGeoMsg("Location added ✓");
      },
      () => setGeoMsg("Couldn't get your location — check browser permissions"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <Input placeholder="House / building, street" value={value.line1} onChange={set("line1")} />
      </div>
      <Input placeholder="Flat / floor" value={value.line2 ?? ""} onChange={set("line2")} />
      <Input placeholder="Landmark" value={value.landmark ?? ""} onChange={set("landmark")} />
      <Input placeholder="City" value={value.city} onChange={set("city")} />
      <Input placeholder="State" value={value.state} onChange={set("state")} />
      <Input placeholder="Pincode" inputMode="numeric" maxLength={6} value={value.pincode} onChange={set("pincode")} />
      {allowGeo ? (
        <Button type="button" variant="secondary" onClick={locate}>
          {value.lat != null ? "Update location" : "Use my location"}
        </Button>
      ) : (
        <Input
          placeholder="Lat, Lng (Google Maps)"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const m = e.target.value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
            onChange({ ...value, lat: m ? Number(m[1]) : undefined, lng: m ? Number(m[2]) : undefined });
          }}
        />
      )}
      {geoMsg && <p className="col-span-2 text-xs text-stone-500">{geoMsg}</p>}
    </div>
  );
}
