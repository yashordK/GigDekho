import { type ActionFunctionArgs, redirect } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { serviceClient } from "~/lib/service-client.server";

/**
 * Server-side document upload — the no-JavaScript fallback behind the
 * verification and portfolio upload forms.
 *
 * The primary path uploads from the browser (so photos can be shrunk before
 * they travel), but the form element is real: if client JS never runs — or a
 * phone killed the page state — the native multipart POST lands here and the
 * server does the same job. A full-page form POST is the one upload mechanism
 * that cannot be broken by the page being discarded around the file picker.
 *
 * Feedback travels back as query params on a 303 redirect, because this path
 * by definition has no client code running to show a toast.
 *
 * Vercel caps request bodies at ~4.5 MB, so this path enforces 4 MB. The
 * browser path has no such problem — it talks to Supabase storage directly.
 */

const VERIFICATION_TYPES = ["aadhaar", "student_id", "gst", "shop_license"];
const MAX_BYTES = 4 * 1024 * 1024;

const backTo = (raw: FormDataEntryValue | null) => {
  const v = String(raw ?? "");
  // Same-site paths only — never an open redirect.
  return v.startsWith("/") && !v.startsWith("//") ? v : "/worker/profile";
};

const fail = (to: string, message: string) => {
  const sep = to.includes("?") ? "&" : "?";
  return redirect(`${to}${sep}upload_error=${encodeURIComponent(message)}`, 303);
};
const ok = (to: string) => {
  const sep = to.includes("?") ? "&" : "?";
  return redirect(`${to}${sep}uploaded=1`, 303);
};

export async function action({ request }: ActionFunctionArgs) {
  let to = "/worker/profile";
  try {
    const supabase = createSupabaseServerClient(request);
    const { data: { user } } = await supabase.auth.getUser();

    let fd: FormData;
    try {
      fd = await request.formData();
    } catch {
      return fail(to, "That upload didn't come through. Please try again.");
    }
    to = backTo(fd.get("redirect_to"));

    if (!user) return fail("/auth", "Sign in to upload documents.");

    const docType = String(fd.get("doc_type") ?? "");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(to, "Choose a file first, then tap Submit.");
    }
    if (file.size > MAX_BYTES) {
      return fail(to, "That file is over 4 MB. Try a smaller photo or a compressed PDF.");
    }

    const isPortfolio = docType === "portfolio";
    if (!isPortfolio && !VERIFICATION_TYPES.includes(docType)) {
      return fail(to, "Unknown document type.");
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const extFromName = file.name.includes(".") ? file.name.split(".").pop() : "";
    const ext = (extFromName || (contentType === "application/pdf" ? "pdf" : contentType.startsWith("image/") ? "jpg" : "bin")).toLowerCase();

    const admin = serviceClient();

    if (isPortfolio) {
      const safeName = (file.name || `file.${ext}`).replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await admin.storage.from("portfolios").upload(path, buf, { contentType });
      if (upErr) return fail(to, upErr.message);
      const { data: pub } = admin.storage.from("portfolios").getPublicUrl(path);
      const { error: insErr } = await admin.from("portfolio_items").insert({
        worker_id: user.id,
        kind: "file",
        url: pub.publicUrl,
        label: (file.name || "Uploaded file").slice(0, 60),
      });
      if (insErr) return fail(to, insErr.message);
      return ok(to);
    }

    const path = `${user.id}/${docType}-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage.from("verification-docs").upload(path, buf, { contentType });
    if (upErr) return fail(to, upErr.message);

    const { error: insErr } = await admin.from("verification_documents").insert({
      user_id: user.id,
      doc_type: docType,
      file_path: path,
      status: "pending",
    });
    if (insErr) return fail(to, insErr.message);

    return ok(to);
  } catch (e: any) {
    console.error("[api.upload-doc]", e);
    return fail(to, "Upload failed on our side. Please try again.");
  }
}
