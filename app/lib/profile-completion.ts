/**
 * What "a complete profile" means, in one place, so the nudge and the
 * profile page can never disagree about it.
 */

export interface CompletionStep {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  /** Why it's worth doing — this is what actually persuades people */
  benefit: string;
  /** Where tapping it should take them */
  href: string;
}

export function workerSteps(profile: any, extras: { skillCount?: number } = {}): CompletionStep[] {
  return [
    {
      id: "id_verified",
      label: "Verify your ID",
      hint: "Upload your Aadhaar — reviewed within a few days",
      // Not a gate on applying — hirers see the badge and pick accordingly.
      benefit: "Hirers pick verified workers first, especially for paid shifts",
      href: "/worker/profile",
      done: Boolean(profile?.id_verified),
    },
    {
      id: "photo",
      label: "Add a profile photo",
      hint: "Hirers pick faces they recognise",
      benefit: "Profiles with a photo get picked noticeably more often",
      href: "/worker/profile",
      done: Boolean(profile?.avatar_url),
    },
    {
      id: "phone",
      label: "Add your phone number",
      hint: "Only shared with hirers who confirm you",
      benefit: "Hirers can reach you about timings on the day",
      href: "/worker/profile",
      done: Boolean(profile?.phone),
    },
    {
      id: "skills",
      label: "Pick your skills",
      hint: "Choose everything you're up for",
      benefit: "You show up in searches for every skill you add",
      href: "/worker/profile",
      done: (extras.skillCount ?? 0) > 0,
    },
  ];
}

export function hirerSteps(profile: any): CompletionStep[] {
  return [
    {
      id: "id_verified",
      label: "Verify your ID",
      hint: "Upload your Aadhaar — reviewed within a few days",
      benefit: "Workers apply far more readily to verified hirers",
      href: "/worker/profile",
      done: Boolean(profile?.id_verified),
    },
    {
      id: "business",
      label: "Add your business name",
      hint: "Or leave blank if you're hiring as an individual",
      benefit: "Your listings show a real name instead of a blank",
      href: "/worker/profile",
      done: Boolean(profile?.company_name),
    },
    {
      id: "photo",
      label: "Add a logo or photo",
      hint: "Appears on every listing you post",
      benefit: "Listings with a logo read as legitimate at a glance",
      href: "/worker/profile",
      done: Boolean(profile?.avatar_url),
    },
    {
      id: "phone",
      label: "Add your phone number",
      hint: "Only shared with workers you confirm",
      benefit: "Lets you coordinate with your crew on the day",
      href: "/worker/profile",
      done: Boolean(profile?.phone),
    },
  ];
}

export function completionFor(
  profile: any,
  isOrganizerView: boolean,
  extras: { skillCount?: number } = {}
) {
  const steps = isOrganizerView ? hirerSteps(profile) : workerSteps(profile, extras);
  const done = steps.filter((s) => s.done).length;
  return {
    steps,
    done,
    total: steps.length,
    percent: Math.round((done / steps.length) * 100),
    complete: done === steps.length,
    nextStep: steps.find((s) => !s.done) ?? null,
  };
}

// ── When we're allowed to interrupt someone ────────────────────────
// The brief: prompt once at the start, then stop nagging. So the modal
// fires a single time per account; after that the only reminder is a
// quiet inline card, and dismissing that hides it for a week.
const seenKey = (userId: string) => `gd-profile-prompt-seen-${userId}`;
const snoozeKey = (userId: string) => `gd-profile-card-snooze-${userId}`;

export function hasSeenPrompt(userId: string) {
  try { return localStorage.getItem(seenKey(userId)) === "1"; } catch { return true; }
}
export function markPromptSeen(userId: string) {
  try { localStorage.setItem(seenKey(userId), "1"); } catch { /* private mode */ }
}
export function isCardSnoozed(userId: string) {
  try {
    const until = Number(localStorage.getItem(snoozeKey(userId)) ?? 0);
    return Date.now() < until;
  } catch { return false; }
}
export function snoozeCard(userId: string, days = 7) {
  try { localStorage.setItem(snoozeKey(userId), String(Date.now() + days * 86400000)); } catch { /* ignore */ }
}
