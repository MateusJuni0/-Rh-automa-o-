import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname } from "node:path";

/** Servidor estático mínimo do renderer já buildado — só para PRÉ-VISUALIZAR o overlay num browser
 * (a mesma UI do app Electron; o mock feed corre sem o preload). Não é parte do produto. */
const ROOT = new URL("./dist-build/renderer/", import.meta.url);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

createServer(async (req, res) => {
  let p = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (p === "/") {
    p = "/index.html";
  }
  try {
    const data = await readFile(new URL(`.${p}`, ROOT));
    res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(4599, () => console.log("overlay preview em http://localhost:4599"));
