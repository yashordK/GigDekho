import { data } from "react-router";
import type { MetaFunction } from "react-router";
import ErrorState from "~/components/ErrorState";

/**
 * Catch-all 404.
 *
 * Without this, any unmatched URL throws an ErrorResponseImpl out of the
 * router and lands in the runtime error log. In production that was the
 * single largest error group — ~200 entries, mostly `/config.json`,
 * `/favicon.ico` and automated scanners probing for `.env`, `.git/config`
 * and AWS credentials. They were all correctly refused, but they buried
 * real errors in the noise.
 *
 * `data(..., { status: 404 })` renders this page WITH a 404 status rather
 * than throwing, so crawlers and browsers still get the right signal.
 */
export function loader() {
  return data({}, { status: 404 });
}

export const meta: MetaFunction = () => [
  { title: "Page not found — GigDekho" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function NotFound() {
  return (
    <ErrorState
      title="Page not found — GigDekho"
      heading="This page doesn't exist"
      message="The link may be old, or the gig may have been filled and taken down."
      showPath
    />
  );
}
