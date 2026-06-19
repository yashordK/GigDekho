import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Public routes — no auth required, SSR enabled
  index("routes/home.tsx"),
  route("auth", "routes/auth.tsx"),
  route("setup-profile", "routes/setup-profile.tsx"),

  // Public gig pages — SSR for SEO
  route("gigs/:id", "routes/gigs.$id.tsx"),

  // Public app pages — nav chrome, no auth wall
  layout("routes/public-layout.tsx", [
    route("worker/home", "routes/worker.home.tsx"),
  ]),

  // Protected routes — nav chrome + auth check
  layout("routes/app-layout.tsx", [
    route("worker/dashboard", "routes/worker.dashboard.tsx"),
    route("worker/earnings", "routes/worker.earnings.tsx"),
    route("worker/profile", "routes/worker.profile.tsx"),
    route("organizer/home", "routes/organizer.home.tsx"),
  ]),

] satisfies RouteConfig;
