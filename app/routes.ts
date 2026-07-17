import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Public routes — no auth required, SSR enabled
  index("routes/home.tsx"),
  route("auth", "routes/auth.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/reset", "routes/auth.reset.tsx"),
  route("setup-profile", "routes/setup-profile.tsx"),
  route("organizer/preview", "routes/organizer.preview.tsx"),

  // Public gig pages — SSR for SEO
  route("gigs/:id", "routes/gigs.$id.tsx"),
  route("hirer/:id", "routes/hirer.$id.tsx"),

  // Internal admin panel — gated by is_admin (client check + RLS on every query)
  route("admin", "routes/admin.tsx"),

  // Server-only API routes (no component)
  route("api/apply", "routes/api.apply.ts"),
  route("api/cancel", "routes/api.cancel.ts"),
  route("api/mark-attendance", "routes/api.mark-attendance.ts"),
  route("api/pay", "routes/api.pay.ts"),
  route("api/announce", "routes/api.announce.ts"),
  route("api/qa", "routes/api.qa.ts"),
  route("api/bank", "routes/api.bank.ts"),
  route("api/withdraw", "routes/api.withdraw.ts"),
  route("api/cron/reminders", "routes/api.cron.reminders.ts"),

  // Public app pages — nav chrome, no auth wall
  layout("routes/public-layout.tsx", [
    route("worker/home", "routes/worker.home.tsx"),
    route("about", "routes/about.tsx"),
  ]),

  // Protected routes — nav chrome + auth check
  layout("routes/app-layout.tsx", [
    route("worker/dashboard", "routes/worker.dashboard.tsx"),
    route("worker/earnings", "routes/worker.earnings.tsx"),
    route("worker/profile", "routes/worker.profile.tsx"),
    route("organizer/home", "routes/organizer.home.tsx"),
  ]),

] satisfies RouteConfig;
