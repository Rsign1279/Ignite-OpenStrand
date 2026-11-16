/** Local-only HTTPS harness for testing a production build. Never a deployment server. */
import { createServer } from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--port"))
  throw new Error("Usage: node scripts/serve-test-build.mjs [--port 3100]");
const port = Number(args[1] ?? "3100");
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("The test port must be an integer from 1024 to 65535.");

let app;
let server;
let tlsDirectory;
let cleanupPromise;
function cleanup() {
  cleanupPromise ??= (async () => {
    server?.closeAllConnections();
    if (server?.listening)
      await new Promise((resolve) => server.close(resolve));
    await app?.close();
    if (tlsDirectory) await rm(tlsDirectory, { recursive: true, force: true });
  })();
  return cleanupPromise;
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void cleanup().then(() => process.exit(0));
  });

try {
  tlsDirectory = await mkdtemp(join(tmpdir(), "ignite-test-tls-"));
  const keyPath = join(tlsDirectory, "key.pem");
  const certPath = join(tlsDirectory, "certificate.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  process.env.NODE_ENV = "production";
  const { default: next } = await import("next");
  let handle;
  server = createServer(
    { key: await readFile(keyPath), cert: await readFile(certPath) },
    (request, response) => {
      // This process terminates TLS itself. Do not trust forwarded protocol
      // supplied by a test request, or rewrite its Origin to hide CSRF failures.
      request.headers["x-forwarded-proto"] = "https";
      request.headers["x-forwarded-host"] = `localhost:${port}`;
      request.headers["x-forwarded-port"] = String(port);
      Promise.resolve(handle(request, response)).catch(() => {
        if (!response.headersSent)
          response.writeHead(500, {
            "Content-Type": "text/plain",
            "Cache-Control": "no-store",
          });
        response.end("The local test app could not complete this request.");
      });
    },
  );
  // Next constructs Request.url from this public hostname/port. Serving it on
  // TLS directly keeps browser Origin and the route's URL identical.
  app = next({ dev: false, hostname: "localhost", port, httpServer: server });
  await app.prepare();
  handle = app.getRequestHandler();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(
    `HTTPS production test server ready at https://localhost:${port}`,
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Unable to start HTTPS test server.",
  );
  await cleanup();
  process.exit(1);
}
