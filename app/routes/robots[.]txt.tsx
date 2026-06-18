export async function loader() {
  return new Response(
    `User-agent: *
Allow: /
Allow: /gigs/
Disallow: /auth
Disallow: /setup-profile
Disallow: /worker/
Disallow: /organizer/
Sitemap: https://gigdekho.com/sitemap.xml`,
    { headers: { "Content-Type": "text/plain" } }
  );
}
