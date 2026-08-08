import { useState } from "react";
import { useLoaderData, useRevalidator, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState } from "~/components/AdminUI";
import { FileCheck, CheckCircle2, XCircle, Eye, ShieldCheck } from "lucide-react";

const DOC_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar (ID)", student_id: "College ID",
  gst: "GST Certificate", shop_license: "Shop License",
};

// Which profile flag an approved document unlocks
const APPROVAL_EFFECT: Record<string, Record<string, any>> = {
  aadhaar: { id_verified: true },
  student_id: { student_status: "student_verified" },
  gst: { business_verified: true },
  shop_license: { business_verified: true },
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);
  const status = new URL(request.url).searchParams.get("status") ?? "pending";

  let q = admin
    .from("verification_documents")
    .select("*, owner:profiles!verification_documents_user_id_fkey(full_name, email, phone, role, city)")
    .order("created_at", { ascending: true })
    .limit(60);
  if (status !== "all") q = q.eq("status", status);
  const { data: docs } = await q;

  // Short-lived signed URLs — documents are in a private bucket and the link
  // dies in 5 minutes so it can't be forwarded around.
  const withUrls = await Promise.all(
    (docs ?? []).map(async (d) => {
      const { data } = await admin.storage.from("verification-docs").createSignedUrl(d.file_path, 300);
      return { ...d, signedUrl: data?.signedUrl ?? null };
    })
  );

  return { docs: withUrls, status };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireAdmin(request);
  const fd = await request.formData();
  const id = String(fd.get("id") ?? "");
  const decision = String(fd.get("decision") ?? "");
  const reason = String(fd.get("reason") ?? "").trim();
  if (!id || !["approve", "reject"].includes(decision)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: doc } = await ctx.admin
    .from("verification_documents").select("id, user_id, doc_type, status").eq("id", id).single();
  if (!doc) return Response.json({ error: "not_found" }, { status: 404 });

  if (decision === "approve") {
    await ctx.admin.from("verification_documents").update({
      status: "approved", rejection_reason: null,
      reviewed_by: ctx.adminId, reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    const effect = APPROVAL_EFFECT[doc.doc_type];
    if (effect) await ctx.admin.from("profiles").update(effect).eq("id", doc.user_id);

    await logAdminAction(ctx, "approve_document", `Approved ${doc.doc_type}`, {
      targetUserId: doc.user_id, targetDocumentId: id,
    });
    await ctx.admin.from("notifications").insert({
      user_id: doc.user_id,
      type: "system",
      title: `${DOC_LABELS[doc.doc_type]} verified ✓`,
      body: doc.doc_type === "aadhaar"
        ? "You're ID verified — you can now apply to gigs."
        : "Your verification badge is now live on your profile.",
      link: "/worker/profile",
    });
  } else {
    await ctx.admin.from("verification_documents").update({
      status: "rejected",
      rejection_reason: reason || "Document unclear — please re-upload.",
      reviewed_by: ctx.adminId, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    await logAdminAction(ctx, "reject_document", `Rejected ${doc.doc_type}: ${reason}`, {
      targetUserId: doc.user_id, targetDocumentId: id,
    });
    await ctx.admin.from("notifications").insert({
      user_id: doc.user_id,
      type: "system",
      title: `${DOC_LABELS[doc.doc_type]} needs another look`,
      body: reason || "Please re-upload a clearer copy.",
      link: "/worker/profile",
    });
  }

  return Response.json({ ok: true });
}

export default function AdminVerifications() {
  const { docs, status } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [preview, setPreview] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const decide = async (id: string, decision: string, why = "") => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("decision", decision);
      fd.append("reason", why);
      await fetch("/admin/verifications", { method: "POST", body: fd });
      revalidator.revalidate();
      setRejecting(null); setReason("");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageTitle title="Verifications" subtitle="Approve ID, student and business documents. Links expire after 5 minutes." />

      <div className="flex flex-wrap gap-2 mb-6">
        {["pending", "approved", "rejected", "all"].map((s) => (
          <button key={s} type="button" onClick={() => { params.set("status", s); setParams(params); }}
            className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider border transition-colors btn-tap min-h-0 ${
              status === s ? "bg-[#F4511E] border-[#F4511E] text-white" : "border-white/10 text-white/50 hover:text-white"
            }`} style={{ minHeight: "34px" }}>{s}</button>
        ))}
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={22} />} title={status === "pending" ? "Queue is clear" : `No ${status} documents`}
          hint="Documents users upload from their profile land here for review." />
      ) : (
        <div className="space-y-3">
          {docs.map((d: any) => {
            const o = Array.isArray(d.owner) ? d.owner[0] : d.owner;
            return (
              <Card key={d.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#F4511E]/10 text-[#F4511E] flex items-center justify-center shrink-0">
                    <FileCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-black text-white text-sm">{o?.full_name ?? "Unknown"}</p>
                      <Pill tone={d.status === "approved" ? "green" : d.status === "rejected" ? "red" : "orange"}>{d.status}</Pill>
                    </div>
                    <p className="text-[11px] font-semibold text-white/40 truncate">
                      {DOC_LABELS[d.doc_type] ?? d.doc_type} · {o?.role} · {o?.email || o?.phone || "—"} ·{" "}
                      {new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    {d.rejection_reason && <p className="text-[11px] font-semibold text-red-400/70 mt-0.5">{d.rejection_reason}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button type="button" onClick={() => setPreview(d.signedUrl)} disabled={!d.signedUrl}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/10 text-white/60 hover:text-white text-[11px] font-black uppercase tracking-wider transition-colors btn-tap disabled:opacity-40">
                    <Eye size={12} /> Preview
                  </button>
                  {d.status === "pending" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => decide(d.id, "approve")}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-black uppercase tracking-wider hover:bg-green-500/25 transition-colors btn-tap disabled:opacity-50">
                        <CheckCircle2 size={12} /> Approve
                      </button>
                      <button type="button" disabled={busy} onClick={() => { setRejecting(d); setReason(""); }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-wider hover:bg-red-500/25 transition-colors btn-tap disabled:opacity-50">
                        <XCircle size={12} /> Reject
                      </button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="max-w-2xl w-full max-h-[85dvh] overflow-auto bg-[#1C1C1C] border border-white/10 rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-black">Document preview <span className="text-white/40 font-bold">(link expires in 5 min)</span></p>
              <button type="button" aria-label="Close preview" onClick={() => setPreview(null)} className="p-2 bg-white/10 rounded-full text-white/60 hover:text-white btn-tap"><XCircle size={16} /></button>
            </div>
            {preview.includes(".pdf") ? (
              <iframe src={preview} title="Document preview" className="w-full h-[70dvh] rounded-xl bg-white" />
            ) : (
              <img src={preview} alt="Verification document" className="w-full rounded-xl" />
            )}
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-white mb-3">Reject {DOC_LABELS[rejecting.doc_type]}?</h3>
            <label htmlFor="vr-reason" className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1.5">Reason (shown to the user)</label>
            <textarea id="vr-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Photo is blurry — please re-upload a clear image."
              className="w-full p-3 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] resize-none mb-4" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="flex-1 py-3 rounded-xl border border-white/15 text-white/70 text-sm font-bold btn-tap">Cancel</button>
              <button type="button" disabled={busy} onClick={() => decide(rejecting.id, "reject", reason)}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-black btn-tap disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
