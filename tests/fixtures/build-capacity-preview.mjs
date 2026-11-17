import { build } from "esbuild";
await build({
  entryPoints: ["tests/fixtures/capacity-preview.tsx"],
  outdir: ".local-setup/capacity-preview",
  bundle: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
