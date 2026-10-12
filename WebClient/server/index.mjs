import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
import { loadConfig, publicConfig, certificateStatus } from "./config.mjs";
import { MuSession } from "./session.mjs";

export { loadConfig } from "./config.mjs";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

export function allowedOrigin(request) {
  if (
    typeof request.headers.origin !== "string" ||
    typeof request.headers.host !== "string"
  )
    return false;
  try {
    const origin = new URL(request.headers.origin);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password
    )
      return false;
    if (origin.host === request.headers.host) return true;
    // Vite development uses a different local port from the gateway.
    return (
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) &&
      origin.port === "5173"
    );
  } catch {
    return false;
  }
}

export function createGateway(config = loadConfig(), options = {}) {
  const sessions = new Set();
  const server = createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("X-Frame-Options", "DENY");
    if (!["GET", "HEAD"].includes(request.method)) {
      response.setHeader("Allow", "GET, HEAD");
      json(response, 405, { error: "Method not allowed" });
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
    } catch {
      json(response, 400, { error: "Invalid path" });
      return;
    }
    if (pathname === "/api/health") {
      json(response, 200, {
        ok: true,
        gatewayAvailable: true,
        activeSessions: sessions.size,
        tls: certificateStatus(config),
      });
      return;
    }
    if (pathname === "/api/config") {
      json(response, 200, publicConfig(config));
      return;
    }
    if (pathname.startsWith("/api/")) {
      json(response, 404, { error: "Not found" });
      return;
    }
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const filename = resolve(config.staticRoot, relative);
    if (
      pathname.includes("\0") ||
      relative.split("/").some((part) => part.startsWith(".")) ||
      (filename !== config.staticRoot &&
        !filename.startsWith(config.staticRoot + sep))
    ) {
      json(response, 403, { error: "Forbidden" });
      return;
    }
    try {
      const metadata = await stat(filename);
      if (!metadata.isFile()) {
        json(response, 404, { error: "Not found" });
        return;
      }
      response.writeHead(200, {
        "Content-Type":
          mimeTypes[extname(filename)] || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control":
          extname(filename) === ".html" ? "no-cache" : "public, max-age=3600",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      const stream = createReadStream(filename);
      stream.on("error", () => response.destroy());
      stream.pipe(response);
    } catch {
      json(response, 404, {
        error:
          "Chưa có bản build web. Chạy npm run build trong WebClient hoặc dùng npm run dev.",
      });
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });
  server.on("upgrade", (request, socket, head) => {
    let pathname;
    try {
      pathname = new URL(request.url, "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== "/ws" || !allowedOrigin(request)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    if (sessions.size >= config.maxSessions) {
      socket.end(
        "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n",
      );
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit("connection", ws),
    );
  });
  wss.on("connection", (ws) => {
    const session = new MuSession(ws, config, options);
    sessions.add(session);
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.once("close", () => sessions.delete(session));
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  heartbeat.unref();
  let closing;
  function close() {
    if (closing) return closing;
    clearInterval(heartbeat);
    for (const session of sessions) session.close();
    for (const ws of wss.clients) ws.terminate();
    closing = new Promise((resolveClose) => {
      wss.close(() => {
        if (!server.listening) resolveClose();
        else server.close(resolveClose);
      });
      server.closeIdleConnections?.();
    });
    return closing;
  }
  return {
    server,
    wss,
    config,
    sessions,
    close,
    listen: () =>
      new Promise((resolveListen, reject) => {
        server.once("error", reject);
        server.listen(config.port, config.host, () => {
          server.off("error", reject);
          resolveListen(server.address());
        });
      }),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const gateway = createGateway();
    const address = await gateway.listen();
    console.log(
      `MU Web gateway: http://${gateway.config.host}:${address.port}`,
    );
    const certificate = certificateStatus(gateway.config);
    if (!certificate.validNow)
      console.log(
        "Chứng chỉ MU chưa hợp lệ. Tạo chứng chỉ localhost mới và khởi động lại server trước khi đăng nhập.",
      );
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, async () => {
        await gateway.close();
        process.exit(0);
      });
  } catch (error) {
    console.error(
      error.code === "EADDRINUSE"
        ? "Cổng gateway đang được sử dụng. Đổi WEB_PORT hoặc dừng tiến trình cũ."
        : error.message,
    );
    process.exitCode = 1;
  }
}
