import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * FORM browser demo: the real app — same pages, components and server logic —
 * running entirely in the browser. Only the server plumbing is swapped:
 *   Postgres → PGlite (Postgres compiled to WebAssembly, stored in IndexedDB)
 *   cookie session → localStorage session
 *   Next.js routing → a small hash router
 */
const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const here = (p: string) => path.join(__dirname, "src", p);

const swaps: Record<string, string> = {
  [path.join(src, "server/db/index.ts")]: here("db.ts"),
  [path.join(src, "server/auth/session.ts")]: here("session.ts"),
  [path.join(src, "server/auth/password.ts")]: here("password.ts"),
  [path.join(src, "server/actions/auth.ts")]: here("actions-auth.ts"),
};

function swapServerModules(): Plugin {
  return {
    name: "form-demo-swaps",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && swaps[resolved.id] && !importer.startsWith(path.join(__dirname, "src"))) {
        return swaps[resolved.id];
      }
      return null;
    },
    transform(code, id) {
      // React's `cache` is a request-scoped server memo; in the browser a pass-through is equivalent.
      if (id.startsWith(src) && code.includes('import { cache } from "react";')) {
        return code.replace('import { cache } from "react";', "const cache = <T,>(fn: T): T => fn;");
      }
      return null;
    },
  };
}

export default defineConfig({
  root: __dirname,
  // Relative base + hash routing: works at any URL (GitHub Pages, a sub-folder, a file share).
  base: "./",
  publicDir: path.join(root, "public"),
  plugins: [swapServerModules(), react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: src + "/" },
      { find: /^next\/link$/, replacement: here("shims/next-link.tsx") },
      { find: /^next\/navigation$/, replacement: here("shims/next-navigation.ts") },
      { find: /^next\/cache$/, replacement: here("shims/next-cache.ts") },
      { find: /^next\/headers$/, replacement: here("shims/next-headers.ts") },
      { find: /^server-only$/, replacement: here("shims/empty.ts") },
      { find: /^node:crypto$/, replacement: here("shims/node-crypto.ts") },
    ],
  },
  define: {
    "process.env": JSON.stringify({ FORM_DEMO_ENABLED: "true", NODE_ENV: "production", FORM_STATIC_DEMO: "true" }),
  },
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  worker: { format: "es" },
  build: {
    outDir: path.join(root, "dist-demo"),
    emptyOutDir: true,
    target: "es2022",
    chunkSizeWarningLimit: 4000,
  },
});
