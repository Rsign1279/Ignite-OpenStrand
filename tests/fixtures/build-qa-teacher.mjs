import { build } from "esbuild";
await build({
  entryPoints: ["tests/fixtures/qa-teacher-preview.tsx"],
  outdir: ".local-setup/qa-teacher-preview",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "qa-teacher-browser-shims",
      setup(builder) {
        builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: "navigation",
          namespace: "fixture-navigation",
        }));
        builder.onLoad(
          { filter: /.*/, namespace: "fixture-navigation" },
          () => ({
            contents:
              "export function useRouter(){return {replace:(href)=>location.assign(href),refresh:()=>location.reload(),push:(href)=>location.assign(href)}}",
            loader: "js",
          }),
        );
        builder.onResolve({ filter: /^next\/image$/ }, () => ({
          path: "next-image",
          namespace: "fixture-image",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture-image" }, () => ({
          contents:
            'import React from "react";export default function Image({src,alt,width,height,className}){return React.createElement("img",{src:typeof src === "string"?src:src.src,alt,width,height,className})}',
          loader: "js",
          resolveDir: process.cwd(),
        }));
        builder.onResolve({ filter: /^next\/link$/ }, () => ({
          path: "next-link",
          namespace: "fixture-link",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture-link" }, () => ({
          contents:
            'import React from "react";export default function Link({children,...props}){return React.createElement("a",props,children)}',
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
