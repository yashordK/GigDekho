import { createServerClient } from "@supabase/ssr";

function parseCookies(header: string): { name: string; value: string }[] {
  if (!header) return [];
  return header.split(";").map((c) => {
    const [name, ...rest] = c.trim().split("=");
    return { name: name.trim(), value: rest.join("=").trim() };
  });
}

export function createSupabaseServerClient(request: Request) {
  return createServerClient(
    process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => parseCookies(request.headers.get("Cookie") ?? ""),
        setAll: () => {},
      },
    }
  );
}
