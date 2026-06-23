import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

/**
 * Build do overlay Electron (3 alvos): main (ESM — usa import.meta.dirname), preload (CJS — o
 * sandbox exige CommonJS) e renderer (bundle browser + CSS). Sem chaves: corre o guião golden.
 * Layout de saída batido com os caminhos do main.ts: dist-build/{main,preload,renderer}/.
 */
const OUT = "dist-build";

// 1) Processo principal — ESM (node), electron fica externo.
await build({
  entryPoints: ["src/main/main.ts"],
  outfile: `${OUT}/main/main.js`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["electron"],
  logLevel: "info",
});

// 2) Preload principal — CJS (o preload em sandbox tem de ser CommonJS). package.json local fixa o tipo.
await build({
  entryPoints: ["src/preload/preload.ts"],
  outfile: `${OUT}/preload/preload.js`,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
  logLevel: "info",
});

// 2b) Preload da janela de login — mesmo formato CJS (sandbox partilhado).
await build({
  entryPoints: ["src/preload/loginPreload.ts"],
  outfile: `${OUT}/preload/loginPreload.js`,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
  logLevel: "info",
});

await writeFile(`${OUT}/preload/package.json`, `${JSON.stringify({ type: "commonjs" })}\n`);

// 3) Renderer — bundle IIFE (script clássico, robusto sob CSP file:) + CSS.
await build({
  entryPoints: ["src/renderer/main.tsx"],
  outfile: `${OUT}/renderer/main.js`,
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  loader: { ".css": "css" },
  logLevel: "info",
});

// 4) index.html — script clássico (sem type=module) + liga o main.css emitido pelo bundle.
const html = (await readFile("src/renderer/index.html", "utf8"))
  .replace('<script type="module" src="./main.js"></script>', '<script src="./main.js"></script>')
  .replace("</head>", `    <link rel="stylesheet" href="./main.css" />\n  </head>`);
await writeFile(`${OUT}/renderer/index.html`, html);

// 4b) login.html — standalone, sem bundler; copiar directamente para o renderer output.
await copyFile("src/renderer/login.html", `${OUT}/renderer/login.html`);

// 5) Assets (ícone do tray/janela).
await mkdir(`${OUT}/assets`, { recursive: true });
await copyFile("assets/tray.png", `${OUT}/assets/tray.png`);

console.log(
  "✓ build do desktop pronto em dist-build/ (main ESM · preload CJS · loginPreload CJS · renderer IIFE+CSS · login.html)",
);
