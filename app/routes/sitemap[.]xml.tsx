import { createSupabaseServerClient } from "~/lib/supabase.server";

export async function loader({ request }) {
  const supabase = createSupabaseServerClient(request);

  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1000);

  const base = "https://gigdekho.com";
  const now = new Date().toISOString();

  const staticUrls = [
    `<url><loc>${base}/</loc><lastmod>${now}</lastmod><priority>1.0</priority></url>`,
  ];

  const gigUrls = (gigs ?? []).map(
    (g) =>
      `<url><loc>${base}/gigs/${g.id}</loc><lastmod>${g.created_at ?? now}</lastmod><priority>0.8</priority></url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...gigUrls].join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
