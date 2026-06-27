import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { searchForWorkspaceRoot } from "vite";

import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const webPkg = require("./package.json");

/**
 * Vite plugin that rewrites /dashboard/* HTML requests to /dashboard
 * so the React SPA shell handles all deep links in dev/preview mode.
 * In production, AWS Amplify rewrite rules handle this instead.
 */
function dashboardSpaFallback() {
  const rewriteDashboardRequest = (req, _res, next) => {
    if (!req.url) return next();

    const [pathname, search = ""] = req.url.split("?");
    const accept = req.headers.accept ?? "";
    const isHtmlRequest =
      req.method === "GET" && (accept.includes("text/html") || req.headers["sec-fetch-dest"] === "document");

    const isDashboardDeepLink =
      pathname.startsWith("/dashboard/") && pathname !== "/dashboard/" && path.posix.extname(pathname) === "";

    if (isHtmlRequest && isDashboardDeepLink) {
      req.url = `/dashboard${search ? `?${search}` : ""}`;
    }

    next();
  };

  return {
    name: "dashboard-spa-fallback",
    configureServer(server) {
      server.middlewares.use(rewriteDashboardRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteDashboardRequest);
    },
  };
}

// Auto-generate optimizeDeps.include from package.json dependencies.
// npm workspaces hoists deps to monorepo root — Vite's optimizer must
// pre-bundle them so React.lazy() dynamic imports work in dev mode.
const optimizeInclude = Object.keys(webPkg.dependencies ?? {}).filter(
  (dep) => !["astro", "@astrojs/react"].includes(dep),
);

export default defineConfig({
  output: "static",
  site: "https://wanderaware.com",
  devToolbar: {
    enabled: false,
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes("/dashboard"),
    }),
  ],
  vite: {
    plugins: [tailwindcss(), dashboardSpaFallback()],

    resolve: {
      dedupe: ["react", "react-dom"],
    },

    optimizeDeps: {
      // Astro's default scan misses lazy-loaded SPA components
      entries: ["src/**/*.{js,jsx,ts,tsx,astro,html}", "!src/**/*.test.*", "!src/**/*.spec.*"],
      // Pre-bundle all hoisted deps so lazy() imports resolve in dev
      include: [...optimizeInclude, "@hookform/resolvers/zod", "aws-amplify/auth", "aws-amplify/data"],
    },

    server: {
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd())],
      },
    },
  },
});
