import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "~/lib/service-client.server";
import { createSupabaseServerClient } from "./supabase.server";

/** @deprecated use `serviceClient()` from ~/lib/service-client.server */
export const adminClient = serviceClient;

export interface AdminContext {
  admin: SupabaseClient;
  adminId: string;
  adminName: string;
}

/**
 * Verifies the caller is an admin, server-side, and hands back a service-role
 * client. Every admin loader/action goes through this — admin data is never
 * fetched with the browser's anon key, so a leaked client bundle exposes
 * nothing and RLS is not the only thing standing between a user and the
 * whole database.
 *
 * Throws a Response (404, not 403) for non-admins so the panel's existence
 * isn't confirmed to people poking at URLs.
 */
/**
 * We deny non-admins with a 404 rather than a 403, so the admin surface
 * doesn't confirm it exists. The body is JSON because these API routes are
 * fetched and parsed by the admin UI — a plain-text "Not Found" would blow
 * up in `res.json()`. Page routes ignore the body and render the branded
 * 404 from the root ErrorBoundary, so this is safe for both.
 */
const notFound = () => Response.json({ error: "not_found" }, { status: 404 });

export async function requireAdmin(request: Request): Promise<AdminContext> {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw notFound();

  const admin = serviceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, is_admin, is_suspended")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin || profile.is_suspended) {
    throw notFound();
  }

  return { admin, adminId: profile.id, adminName: profile.full_name ?? "Admin" };
}

/** Appends to the tamper-evident admin audit trail. */
export async function logAdminAction(
  ctx: AdminContext,
  action: string,
  detail: string,
  opts: { targetUserId?: string | null; targetDocumentId?: string | null } = {}
) {
  await ctx.admin.from("admin_actions").insert({
    admin_id: ctx.adminId,
    action,
    detail: detail.slice(0, 1000),
    target_user_id: opts.targetUserId ?? null,
    target_document_id: opts.targetDocumentId ?? null,
  });
}

/** Reads an app_settings value with a fallback. */
export async function getSetting(admin: SupabaseClient, key: string, fallback: string) {
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? fallback;
}
