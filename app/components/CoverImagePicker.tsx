import { useState, useRef } from "react";
import { supabase } from "~/lib/supabase.client";
import { defaultCoverUrl } from "~/lib/cover";
import { Image as ImageIcon, Upload, Ban, Check, Loader2, AlertCircle } from "lucide-react";

export type CoverMode = "default" | "custom" | "none";

export interface CoverValue {
  cover_mode: CoverMode;
  cover_image_url: string | null;
}

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Lets a hirer keep the stock photo, upload their own, or turn the cover
 * off entirely. Used both when posting and when editing a live listing.
 */
export default function CoverImagePicker({
  value,
  onChange,
  userId,
  roleHint,
  compact = false,
}: {
  value: CoverValue;
  onChange: (v: CoverValue) => void;
  userId: string;
  /** Role name, so the "default" preview matches what applicants will see */
  roleHint?: string | null;
  compact?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("That's not an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be under 5 MB.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("gig-covers").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("gig-covers").getPublicUrl(path);
      onChange({ cover_mode: "custom", cover_image_url: pub.publicUrl });
    } catch (err: any) {
      setError(err.message || "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const preview =
    value.cover_mode === "custom" && value.cover_image_url
      ? value.cover_image_url
      : value.cover_mode === "none"
        ? null
        : defaultCoverUrl(roleHint, 800);

  const OPTIONS: { mode: CoverMode; label: string; icon: React.ReactNode }[] = [
    { mode: "default", label: "Default", icon: <ImageIcon size={13} /> },
    { mode: "custom", label: value.cover_image_url ? "Custom" : "Upload", icon: <Upload size={13} /> },
    { mode: "none", label: "No image", icon: <Ban size={13} /> },
  ];

  return (
    <div className="space-y-2.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        onChange={handleFile}
      />

      {/* Preview */}
      <div
        className={`relative w-full ${compact ? "h-28" : "h-40"} rounded-2xl overflow-hidden border border-white/10 bg-[#111111] flex items-center justify-center`}
      >
        {uploading ? (
          <Loader2 size={22} className="animate-spin text-[#F4511E]" />
        ) : preview ? (
          <>
            <img src={preview} alt="" className="w-full h-full object-cover" />
            <span className="absolute bottom-2 left-2 text-[9px] font-black uppercase tracking-widest bg-black/70 text-white/80 px-2 py-1 rounded-full">
              {value.cover_mode === "custom" ? "Your image" : "Default image"}
            </span>
          </>
        ) : (
          <div className="text-center px-4">
            <Ban size={20} className="text-white/25 mx-auto mb-1.5" />
            <p className="text-[11px] font-bold text-white/40">No cover image</p>
            <p className="text-[10px] font-medium text-white/25">Applicants see a clean text-only listing</p>
          </div>
        )}
      </div>

      {/* Mode switch */}
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const active = value.cover_mode === o.mode;
          return (
            <button
              key={o.mode}
              type="button"
              disabled={uploading}
              onClick={() => {
                setError("");
                if (o.mode === "custom") {
                  // Re-open the file picker so they can swap the image out
                  if (!value.cover_image_url || active) fileRef.current?.click();
                  else onChange({ ...value, cover_mode: "custom" });
                } else {
                  onChange({ cover_mode: o.mode, cover_image_url: value.cover_image_url ?? null });
                }
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold border btn-tap transition-colors disabled:opacity-50 ${
                active
                  ? "bg-[#F4511E] border-[#F4511E] text-white"
                  : "bg-transparent border-white/10 text-white/55 hover:border-[#F4511E]/50"
              }`}
            >
              {active && o.mode !== "custom" ? <Check size={13} /> : o.icon}
              {o.label}
            </button>
          );
        })}
      </div>

      {value.cover_mode === "custom" && value.cover_image_url && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full text-[11px] font-bold text-[#F4511E] hover:underline btn-tap disabled:opacity-50"
          style={{ minHeight: "32px" }}
        >
          Replace image
        </button>
      )}

      {error && (
        <p className="text-red-400 text-[11px] font-semibold flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
