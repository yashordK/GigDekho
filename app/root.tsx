import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

export function Layout({ children }: { children: React.ReactNode }) {
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
        {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
          <script
            src={`https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`}
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
          {children}
        </AuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}
