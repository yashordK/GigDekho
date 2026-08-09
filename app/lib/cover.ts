/**
 * Gig cover images.
 *
 * The role→stock-photo map used to be copy-pasted into gigs.$id.tsx,
 * GigCard.jsx and worker.dashboard.tsx, with the gig detail page having
 * already drifted (it mapped "art" to a photography shot). One copy now.
 */

const STOCK: { match: string[]; id: string }[] = [
  { match: ["wait", "hostess", "usher", "host"], id: "photo-1414235077428-338989a2e8c0" },
  { match: ["sing", "vocal"], id: "photo-1493225457124-a3eb161ffa5f" },
  { match: ["dj", "disc"], id: "photo-1571266028243-d220c6f3f07b" },
  { match: ["art", "sketch", "design"], id: "photo-1513364776144-60967b0f800f" },
  { match: ["secur", "guard", "bouncer"], id: "photo-1558618666-fcd25c85cd64" },
  { match: ["danc"], id: "photo-1508700929628-666bc8bd84ea" },
  { match: ["photo", "camera", "reel", "video"], id: "photo-1542038784456-1ea8e935640e" },
  { match: ["cook", "kitchen", "cater", "food", "bartend"], id: "photo-1414235077428-338989a2e8c0" },
  { match: ["deliver", "rider", "driv"], id: "photo-1571068316344-75bc76f77890" },
  { match: ["teach", "tutor", "invigil"], id: "photo-1503676260728-1c00da094a0b" },
  { match: ["web", "develop", "it support", "data"], id: "photo-1461749280684-dccba630e2f6" },
];

const FALLBACK = "photo-1511795409834-ef04bbd61622";

/** The role-based stock photo a listing gets when the hirer hasn't set one. */
export function defaultCoverUrl(role?: string | null, width = 800): string {
  const r = (role || "").toLowerCase();
  const hit = STOCK.find((s) => s.match.some((m) => r.includes(m)));
  return `https://images.unsplash.com/${hit?.id ?? FALLBACK}?w=${width}&auto=format&fit=crop`;
}

export interface CoverFields {
  cover_mode?: string | null;
  cover_image_url?: string | null;
  role_type?: string | null;
  custom_role?: string | null;
}

/**
 * Resolves what a listing should actually show.
 * Returns null when the hirer chose to have no cover image at all —
 * callers must handle that rather than falling back to a stock photo.
 */
export function gigCoverUrl(gig: CoverFields, width = 800): string | null {
  if (gig.cover_mode === "none") return null;
  if (gig.cover_mode === "custom" && gig.cover_image_url) return gig.cover_image_url;
  return defaultCoverUrl(gig.role_type ?? gig.custom_role, width);
}
