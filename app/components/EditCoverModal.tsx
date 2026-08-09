import { useState, useEffect } from "react";
import { supabase } from "~/lib/supabase.client";
import CoverImagePicker, { type CoverValue } from "./CoverImagePicker";
import { X, ImageIcon } from "lucide-react";

/**
 * Change (or remove, or restore) a live listing's cover image without
 * reposting it. Writes through RLS — organizers may update their own gigs.
 */
export default function EditCoverModal({
  isOpen,
  onClose,
  gig,
  userId,
  onSaved,
  showToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  gig: any;
  userId: string;
  onSaved: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const [cover, setCover] = useState<CoverValue>({ cover_mode: "default", cover_image_url: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCover({
        cover_mode: (gig.cover_mode as CoverValue["cover_mode"]) ?? "default",
        cover_image_url: gig.cover_image_url ?? null,
      });
    }
  }, [isOpen, gig]);

  if (!isOpen) return null;

  const save = async () => {
    setSaving(true);
    try {
      // A refused update comes back with no error and no rows, so the row
      // count is the only honest signal that anything actually changed.
      const { data, error } = await supabase
        .from("gigs")
        .update({
          cover_mode: cover.cover_mode,
          cover_image_url: cover.cover_mode === "custom" ? cover.cover_image_url : null,
        })
        .eq("id", gig.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to change this cover, or your session expired.");
      }
      showToast("Cover image updated", "success");
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(
        err?.code === "42501"
          ? "Your session has expired. Sign in again and retry."
          : err.message || "Could not update the cover.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#1C1C1C] border-t sm:border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto hide-scrollbar">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <ImageIcon size={18} className="text-[#F4511E]" /> Cover image
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] font-semibold text-white/40 mb-5 truncate">{gig.title}</p>

        <CoverImagePicker
          value={cover}
          onChange={setCover}
          userId={userId}
          roleHint={gig.custom_role ?? gig.role_type}
        />

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save cover"}
        </button>
      </div>
    </div>
  );
}
