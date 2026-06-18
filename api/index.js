import { createRequestHandler } from "@react-router/node";

// Cache the handler across warm invocations
let handler;

export default async function (req, res) {
  if (!handler) {
    // Loaded at runtime so Vercel doesn't try to statically bundle the
    // React Router server build (included separately via vercel.json includeFiles)
    const build = await import("../build/server/index.js");
    handler = createRequestHandler({ build });
  }
  return handler(req, res);
}
