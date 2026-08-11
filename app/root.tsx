import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
  isRouteErrorResponse,
} from "react-router";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./context/AuthContext";
import ErrorState from "./components/ErrorState";
import AnalyticsTracker from "./components/AnalyticsTracker";
import "./index.css";

/**
 * Runtime config for the browser.
 *
 * The Maps key is read from a SERVER env var here rather than an
 * `import.meta.env.VITE_*` one. Vite inlines VITE_ vars at BUILD time, so a
 * key that only exists in local `.env.local` gets baked in as `undefined` on
 * the deployed build and the Maps script never renders — which is exactly why
 * maps worked locally but not in production. Reading it at request time means
 * setting the variable takes effect on redeploy without any build-time
 * coupling. (Maps browser keys are public by design; lock them down with HTTP
 * referrer restrictions, not by hiding them.)
 */
export function loader() {
  return {
    googleMapsApiKey:
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      "",
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  // Fall back to the build-time value so local dev keeps working unchanged
  const mapsKey = data?.googleMapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#F4511E" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Apply saved theme before first paint to avoid a flash of dark */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('gd-theme')==='light')document.documentElement.classList.add('light')}catch(e){}" }} />
        {/* Global gm_authFailure handler — must exist before Maps script loads */}
        <script dangerouslySetInnerHTML={{ __html: "window.gm_authFailure=function(){window.__MAPS_AUTH_FAILED__=true;};" }} />
        {mapsKey ? (
          <script
            src={`https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places`}
            async
            defer
          />
        ) : null}
        <Meta />
        <Links />
      </head>
      {/* Colors come from index.css so the .light theme override can win */}
      <body style={{ margin: 0 }}>
        {/* Accessibility skip link */}
        <a
          href="#main-content"
          style={{ position: "absolute", left: "-9999px", top: "auto", width: "1px", height: "1px", overflow: "hidden" }}
          onFocus={(e) => {
            const el = e.currentTarget;
            el.style.cssText = "position:fixed;top:1rem;left:1rem;width:auto;height:auto;padding:0.5rem 1rem;background:#F4511E;color:#fff;border-radius:6px;z-index:9999;font-weight:500;";
          }}
          onBlur={(e) => {
            const el = e.currentTarget;
            el.style.cssText = "position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;";
          }}
        >
          Skip to main content
        </a>
        <AuthProvider>
          <AnalyticsTracker />
          {children}
        </AuthProvider>
        <ScrollRestoration />
        <Scripts />
        <Analytics />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

/**
 * Catches anything thrown below it — a loader throwing a 404 Response (a gig
 * id that no longer exists), or a genuine render/runtime crash. Without this
 * the app fell back to React Router's built-in boundary: an unstyled white
 * page with no title, on a site that is otherwise entirely dark.
 *
 * The message stays deliberately vague for real errors; the details go to the
 * server log, not to the person who just hit the problem.
 */
export function ErrorBoundary({ error }: { error: unknown }) {
  if (isRouteErrorResponse(error)) {
    const notFound = error.status === 404;
    return (
      <ErrorState
        variant={notFound ? "notFound" : "error"}
        title={
          notFound
            ? "Page not found — GigDekho"
            : `${error.status} ${error.statusText} — GigDekho`
        }
        heading={notFound ? "This page doesn't exist" : "Something went wrong"}
        message={
          notFound
            ? "The link may be old, or the gig may have been filled and taken down."
            : "That request couldn't be completed. Try again in a moment."
        }
        showPath={notFound}
      />
    );
  }

  if (import.meta.env.DEV) {
    console.error(error);
  }

  return (
    <ErrorState
      variant="error"
      title="Something went wrong — GigDekho"
      heading="Something went wrong"
      message="We hit an unexpected problem loading this page. Refreshing usually sorts it — if it keeps happening, let us know."
    />
  );
}
