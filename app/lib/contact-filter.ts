// Pattern-matching filter that blocks contact-detail exchange in gig threads.
// Used client-side for instant feedback AND server-side as the authority.

const PATTERNS: { re: RegExp; label: string }[] = [
  // Phone numbers: 10+ digits allowing spaces/dashes/dots between, optional +91
  { re: /(\+?\d[\d\s\-.]{8,}\d)/, label: 'phone number' },
  // Emails
  { re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, label: 'email address' },
  // Social handles: @username, insta/ig/telegram/whatsapp mentions with handle-ish text
  { re: /(?:^|\s)@[a-z0-9._]{3,}/i, label: 'social handle' },
  { re: /\b(?:instagram|insta\b|ig\b|telegram|whatsapp|wa\.me|t\.me|snapchat|facebook|fb\.com)\b[\s:./-]*[a-z0-9._@-]*/i, label: 'social media reference' },
  // Obfuscated digits ("nine eight seven...") — catch 4+ spelled digits in a row
  { re: /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:[\s-]+(?:zero|one|two|three|four|five|six|seven|eight|nine)){3,}\b/i, label: 'spelled-out number' },
];

/** Returns null if clean, or a human-readable label of what was detected. */
export function detectContactInfo(text: string): string | null {
  for (const { re, label } of PATTERNS) {
    if (re.test(text)) return label;
  }
  return null;
}
