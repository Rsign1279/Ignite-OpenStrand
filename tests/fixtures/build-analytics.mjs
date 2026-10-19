import { build } from "esbuild";
import { resolve } from "node:path";
await build({
  entryPoints: ["tests/fixtures/analytics-preview.tsx"],
  outdir: ".local-setup/analytics-preview",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "test-browser-shims",
      setup(b) {
        b.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: "navigation",
          namespace: "fixture-navigation",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture-navigation" }, () => ({
          contents:
            "export function useRouter(){return {push:(href)=>location.assign(href)}}",
          loader: "js",
        }));
        b.onResolve({ filter: /^next\/link$/ }, () => ({
          path: "next-link",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents:
            'import React from "react";export default function Link({children,...props}){return React.createElement("a",props,children)}',
          loader: "js",
          resolveDir: process.cwd(),
        }));
        b.onResolve({ filter: /chart-loader$/ }, () => ({
          path: resolve("src/components/staff/charts.tsx"),
        }));
      },
    },
  ],
});
