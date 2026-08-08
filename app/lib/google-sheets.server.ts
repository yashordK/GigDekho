import crypto from "node:crypto";

/**
 * Minimal Google Sheets + Drive client using a service account.
 *
 * Setup (Google Cloud Console, once):
 *   1. Enable "Google Sheets API" and "Google Drive API"
 *   2. Create a service account, then a JSON key for it
 *   3. Set ONE of these in your environment:
 *
 *      (a) RECOMMENDED — paste the whole JSON key file as a single value:
 *            GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account", ...}
 *          No newline mangling to worry about.
 *
 *      (b) Or the two fields separately:
 *            GOOGLE_SA_EMAIL       = client_email from the JSON
 *            GOOGLE_SA_PRIVATE_KEY = private_key from the JSON, INCLUDING the
 *                                    "-----BEGIN PRIVATE KEY-----" header and
 *                                    "-----END PRIVATE KEY-----" footer.
 *                                    Literal \n escapes are handled.
 *
 * If neither is set, every function here no-ops so the rest of the app keeps
 * working and the UI just reports "sheet not connected".
 */

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

function credentials(): { email: string; privateKey: string } | null {
  const blob = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (blob) {
    try {
      const parsed = JSON.parse(blob);
      if (parsed.client_email && parsed.private_key) {
        return { email: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, "\n") };
      }
    } catch {
      console.error("[sheets] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
  }
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (email && key) {
    // Env files store the PEM with literal \n — normalise back to real newlines.
    return { email, privateKey: key.replace(/\\n/g, "\n") };
  }
  return null;
}

export function sheetsConfigured() {
  return credentials() !== null;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const creds = credentials();
  if (!creds) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: creds.email,
    scope: SCOPES,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(creds.privateKey));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
  });

  if (!res.ok) {
    console.error("[sheets] token exchange failed:", await res.text());
    return null;
  }
  const json = await res.json();
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

/**
 * Creates a spreadsheet and shares it with the hirer as a VIEWER.
 * Read-only on purpose: the sheet is a mirror of GigDekho data, so letting a
 * hirer edit it would only create a copy that silently disagrees with the app.
 */
export async function createApplicantSheet(title: string, hirerEmail: string | null) {
  const token = await getAccessToken();
  if (!token) return null;

  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: "Applicants", gridProperties: { frozenRowCount: 1 } } }],
    }),
  });
  if (!createRes.ok) throw new Error(`Sheet create failed: ${await createRes.text()}`);
  const sheet = await createRes.json();

  if (hirerEmail) {
    await shareAsViewer(sheet.spreadsheetId, hirerEmail, token);
  }

  return {
    spreadsheetId: sheet.spreadsheetId as string,
    spreadsheetUrl: sheet.spreadsheetUrl as string,
  };
}

async function shareAsViewer(spreadsheetId: string, email: string, token: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?sendNotificationEmail=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "user", emailAddress: email }),
    }
  );
  if (!res.ok) console.error("[sheets] share failed:", await res.text());
}

/**
 * Defensive: downgrade any pre-existing writer/commenter grant to reader, so
 * sheets created before the view-only rule can't be edited.
 */
export async function enforceViewOnly(spreadsheetId: string) {
  const token = await getAccessToken();
  if (!token) return;
  try {
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?fields=permissions(id,role,type)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) return;
    const { permissions = [] } = await listRes.json();
    for (const p of permissions) {
      if (p.type === "user" && (p.role === "writer" || p.role === "commenter")) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions/${p.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ role: "reader" }),
        });
      }
    }
  } catch (e) {
    console.error("[sheets] enforceViewOnly:", e);
  }
}

/**
 * Writes the header + all rows in one shot. A full rewrite (rather than an
 * append) keeps the sheet correct after status changes without tracking
 * per-row indexes.
 */
export async function writeApplicantRows(spreadsheetId: string, headers: string[], rows: string[][]) {
  const token = await getAccessToken();
  if (!token) return false;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Applicants!A1:Z10000:clear`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } }
  );

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Applicants!A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [headers, ...rows] }),
    }
  );
  if (!res.ok) throw new Error(`Sheet write failed: ${await res.text()}`);

  // Bold the header row so the sheet is readable at a glance
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        repeatCell: {
          range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: "userEnteredFormat.textFormat.bold",
        },
      }],
    }),
  }).catch(() => { /* cosmetic only */ });

  return true;
}
