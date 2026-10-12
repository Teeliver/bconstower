import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { X509Certificate } from "node:crypto";
import { BASE_CLASSES } from "./protocol.mjs";

export const webClientRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const repositoryRoot = resolve(webClientRoot, "..");

function integer(env, key, fallback, min, max) {
  const value =
    env[key] == null || env[key] === "" ? fallback : Number(env[key]);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${key} phải là số nguyên từ ${min} đến ${max}.`);
  return value;
}

export function loadConfig(env = process.env) {
  const common = JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "GameServer/config/common.json"),
      "utf8",
    ),
  );
  const version = env.MU_VERSION || common.version;
  const serial = env.MU_SERIAL || common.serial;
  if (!/^\d{5}$/.test(version))
    throw new Error("MU_VERSION phải gồm đúng 5 chữ số.");
  if (typeof serial !== "string" || !/^[\x20-\x7E]{16}$/.test(serial))
    throw new Error("MU_SERIAL phải gồm đúng 16 ký tự ASCII.");
  return {
    host: env.WEB_HOST || "127.0.0.1",
    port: integer(env, "WEB_PORT", 3001, 0, 65535),
    connectHost: env.MU_CONNECT_HOST || "127.0.0.1",
    connectPort: integer(env, "MU_CONNECT_PORT", 44405, 1, 65535),
    // Override the repository's old advertised LAN IP; never dial a browser-
    // supplied endpoint. To use another server set this trusted local config.
    gameHost: env.MU_GAME_HOST || "127.0.0.1",
    serverId: integer(env, "MU_SERVER_ID", 0, 0, 65535),
    caFile: env.MU_CA_FILE
      ? resolve(env.MU_CA_FILE)
      : resolve(repositoryRoot, "ssl/cert.pem"),
    version,
    serial,
    timeoutMs: integer(env, "MU_TIMEOUT_MS", 15000, 100, 120000),
    serverWaitMs: integer(env, "MU_SERVER_WAIT_MS", 30000, 100, 120000),
    maxSessions: integer(env, "WEB_MAX_SESSIONS", 32, 1, 128),
    staticRoot: resolve(webClientRoot, "dist"),
  };
}

export const capabilities = Object.freeze({
  login: true,
  characters: true,
  create: true,
  enter: true,
  movement: false,
  combat: false,
});

export function publicConfig(config) {
  return {
    serverId: config.serverId,
    capabilities,
    classes: BASE_CLASSES,
    gatewayAvailable: true,
  };
}

export function certificateStatus(config) {
  if (!existsSync(config.caFile)) return { available: false, validNow: false };
  try {
    const certificate = new X509Certificate(readFileSync(config.caFile));
    const now = Date.now();
    return {
      available: true,
      validNow:
        now >= Date.parse(certificate.validFrom) &&
        now < Date.parse(certificate.validTo),
      expiresAt: certificate.validTo,
    };
  } catch {
    return { available: true, validNow: false };
  }
}
