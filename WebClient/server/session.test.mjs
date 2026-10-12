import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import PacketManager from "@mu-online-js/mu-packet-manager";
import { MuSession } from "./session.mjs";
import { loadConfig } from "./config.mjs";
import {
  encodeEnter,
  encodeCreate,
  encodeCharacterListRequest,
} from "./protocol.mjs";

const require = createRequire(import.meta.url);
const gameStructures = require("../../GameServer/src/packets/gameserver.js");
const clientStructures = require("../../Client/src/packets/index.js");

class FakeWebSocket extends EventEmitter {
  readyState = 1;
  messages = [];
  send(data) {
    const message = JSON.parse(data);
    this.messages.push(message);
    this.emit("outgoing", message);
  }
  command(message) {
    this.emit("message", Buffer.from(JSON.stringify(message)), false);
  }
}

class FakeTLSSocket extends EventEmitter {
  destroyed = false;
  writableLength = 0;
  writes = [];
  ended = false;
  write(packet) {
    this.writes.push(Buffer.from(packet));
    return true;
  }
  setNoDelay(value) {
    this.noDelay = value;
  }
  setKeepAlive(value, delay) {
    this.keepAlive = { value, delay };
  }
  end() {
    this.ended = true;
    queueMicrotask(() => {
      this.destroyed = true;
      this.emit("close");
    });
  }
  destroy() {
    this.destroyed = true;
    this.emit("close");
  }
  receive(packet, split = 0) {
    if (split) {
      this.emit("data", packet.subarray(0, split));
      this.emit("data", packet.subarray(split));
    } else this.emit("data", packet);
  }
}

function publishedPacket(structure, type, headCode, subCode, payload = {}) {
  return new PacketManager().useStruct(structure).toBuffer({
    header: { type, size: "auto", headCode, subCode },
    ...payload,
  });
}

function serverList(servers = [{ serverId: 0, loadPercentage: 10 }]) {
  return publishedPacket(clientStructures.CSServerListResponse, 0xc2, 0xf4, 6, {
    serverCount: servers.length,
    serverLoadInfo: servers,
  });
}

function helloGS(version) {
  return publishedPacket(gameStructures.NewClientConnected, 0xc1, 0xf1, 0, {
    result: 1,
    playerIndexH: 1,
    playerIndexL: 2,
    version,
  });
}

function charactersPacket() {
  return publishedPacket(gameStructures.CharacterList, 0xc1, 0xf3, 0, {
    maxClass: 0,
    moveCount: 0,
    characterCount: 1,
    isVaultExtended: 0,
    characterList: [
      {
        slot: 0,
        name: "WebKnight",
        level: 50,
        ctlCode: 0,
        charSet: [0x20, ...Array(16).fill(0xff)],
        guildStatus: 0xff,
      },
    ],
  });
}

function worldPacket() {
  return publishedPacket(gameStructures.JoinMapSend, 0xc1, 0xf3, 3, {
    x: 125,
    y: 128,
    map: 0,
    dir: 2,
    experience: Array(8).fill(0),
    nextExperience: Array(8).fill(0),
    levelUpPoints: 12,
    str: 28,
    agi: 35,
    vit: 48,
    ene: 21,
    life: 123,
    maxLife: 234,
    mana: 90,
    maxMana: 145,
    shield: 10,
    maxShield: 20,
    bp: 30,
    maxBp: 40,
    money: 100000,
    pkLeve: 3,
    ctlCode: 0,
    fruitAddPoint: 2,
    fruitMaxAddPoint: 4,
    command: 6,
    fruitSubPoint: 8,
    fruitMaxSubPoint: 10,
    extInventory: 1,
  });
}

function harness(t, overrides = {}) {
  const ws = new FakeWebSocket();
  const config = {
    ...loadConfig({}),
    timeoutMs: 5000,
    serverWaitMs: 5000,
    ...overrides,
  };
  const connections = [];
  const session = new MuSession(ws, config, {
    connect(options) {
      const socket = new FakeTLSSocket();
      connections.push({ options, socket });
      return socket;
    },
  });
  t.after(() => session.close());
  return { ws, config, connections, session };
}

function reachGameServer(h) {
  h.ws.command({ type: "login", username: "pafa7a", password: "123" });
  const cs = h.connections[0].socket;
  cs.receive(Buffer.from([0xc1, 4, 0, 1]), 1);
  cs.receive(serverList(), 2);
  cs.receive(
    publishedPacket(
      clientStructures.CSMainCSServerInfoResponse,
      0xc1,
      0xf4,
      3,
      {
        serverAddress: "203.0.113.10",
        serverPort: 55901,
      },
    ),
    10,
  );
  return h.connections[1].socket;
}

function reachReady(h) {
  const gs = reachGameServer(h);
  gs.receive(helloGS(h.config.version), 6);
  gs.receive(Buffer.from([0xc1, 5, 0xf1, 1, 1]));
  gs.receive(charactersPacket(), 20);
  return gs;
}

function waitForMessage(ws, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("outgoing", listener);
      reject(new Error("Expected gateway message was not sent"));
    }, 1000);
    const listener = (message) => {
      if (!predicate(message)) return;
      clearTimeout(timeout);
      ws.off("outgoing", listener);
      resolve(message);
    };
    ws.on("outgoing", listener);
  });
}

test("invalid and unauthenticated requests never open backend connections", (t) => {
  const h = harness(t);
  h.ws.emit("message", Buffer.from("not json"), false);
  h.ws.emit("message", Buffer.from("{}"), true);
  h.ws.command({
    type: "login",
    username: "too_long_username",
    password: "123",
  });
  h.ws.command({ type: "enter", name: "WebKnight" });
  h.ws.command({ type: "create", name: "NewHero", classId: 16 });
  h.ws.command({ type: "refresh" });
  assert.equal(h.connections.length, 0);
  assert.deepEqual(
    h.ws.messages
      .filter((message) => message.type === "error")
      .map((message) => message.code),
    [
      "INVALID_MESSAGE",
      "INVALID_MESSAGE",
      "INVALID_CREDENTIALS",
      "AUTH_REQUIRED",
      "AUTH_REQUIRED",
      "AUTH_REQUIRED",
    ],
  );
  assert.equal(h.session.stage, "idle");
});

test("login traverses fragmented CS and GS packets, releases credentials, and enters the world", (t) => {
  const h = harness(t);
  h.ws.command({ type: "login", username: "pafa7a", password: "123" });
  const cs = h.connections[0].socket;
  assert.equal(h.session.stage, "cs-hello");
  cs.receive(Buffer.from([0xc1, 4, 0, 1]), 1);
  assert.deepEqual(cs.writes[0], Buffer.from([0xc1, 4, 0xf4, 6]));
  cs.receive(serverList([]), 3);
  assert.equal(h.session.stage, "cs-list");
  assert.ok(h.session.pollTimer, "empty server lists schedule a retry");
  cs.receive(serverList(), 2);
  assert.equal(h.session.stage, "cs-info");
  assert.deepEqual(cs.writes.at(-1), Buffer.from([0xc1, 6, 0xf4, 3, 0, 0]));
  cs.receive(
    publishedPacket(
      clientStructures.CSMainCSServerInfoResponse,
      0xc1,
      0xf4,
      3,
      {
        serverAddress: "203.0.113.10",
        serverPort: 55901,
      },
    ),
    10,
  );
  assert.equal(cs.ended, true, "CS gets a graceful FIN when changing servers");
  assert.equal(
    h.connections[1].options.host,
    h.config.gameHost,
    "advertised addresses cannot override trusted configuration",
  );
  assert.equal(h.connections[1].options.port, 55901);
  const gs = h.connections[1].socket;
  gs.receive(helloGS(h.config.version), 6);
  assert.equal(
    h.session.password,
    null,
    "password is released after sending the login packet",
  );
  const login = new PacketManager()
    .fromBuffer(gs.writes[0])
    .useStruct(gameStructures.RequestLogin)
    .toObject();
  assert.equal(login.username, "pafa7a");
  assert.equal(login.password, "123");
  assert.equal(login.version, h.config.version);
  assert.equal(login.serial, h.config.serial);
  gs.receive(
    Buffer.concat([
      Buffer.from([0xc1, 5, 0xf1, 1, 1]),
      Buffer.from([0xc1, 5, 0xde, 0, 15]),
      charactersPacket(),
    ]),
    8,
  );
  assert.equal(h.session.stage, "ready");
  assert.equal(h.session.authenticated, true);
  assert.deepEqual(gs.writes.at(-1), encodeCharacterListRequest());
  assert.ok(
    h.ws.messages.some(
      (message) =>
        message.type === "authenticated" && message.username === "pafa7a",
    ),
  );
  const characters = h.ws.messages.find(
    (message) => message.type === "characters",
  );
  assert.equal(characters.characters[0].name, "WebKnight");
  h.ws.command({ type: "enter", name: "WebKnight" });
  assert.equal(h.session.stage, "enter");
  assert.deepEqual(gs.writes.at(-1), encodeEnter("WebKnight"));
  gs.receive(worldPacket(), 51);
  const world = h.ws.messages.find((message) => message.type === "world");
  assert.equal(world.character.name, "WebKnight");
  assert.equal(world.stats.x, 125);
  assert.equal(world.stats.life, 123);
  assert.equal(world.stats.money, 100000);
  assert.equal(h.session.stage, "ready");
  assert.equal(h.session.timer, null);
  assert.equal(JSON.stringify(h.ws.messages).includes('"password"'), false);
  h.ws.command({ type: "logout" });
  assert.equal(
    gs.ended,
    true,
    "GS gets a graceful FIN to clean up its logged-in account",
  );
  assert.equal(h.session.authenticated, false);
  assert.equal(h.session.username, null);
  assert.equal(h.session.currentCharacter, null);
});

test("backend TLS connections retain CA and hostname verification", (t) => {
  const h = harness(t, { connectHost: "localhost" });
  h.ws.command({ type: "login", username: "pafa7a", password: "123" });
  const { options, socket } = h.connections[0];
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.minVersion, "TLSv1.2");
  assert.equal(options.servername, "localhost");
  assert.deepEqual(options.ca, readFileSync(h.config.caFile));
  assert.equal(
    options.checkServerIdentity("ignored", { subjectaltname: "DNS:localhost" }),
    undefined,
  );
  assert.equal(
    options.checkServerIdentity("ignored", {
      subjectaltname: "DNS:other.example",
    }).code,
    "ERR_TLS_CERT_ALTNAME_INVALID",
  );
  assert.equal(socket.noDelay, true);
  assert.deepEqual(socket.keepAlive, { value: true, delay: 30000 });
});

test("failed logins reset the session and gracefully close the GS socket", (t) => {
  const h = harness(t);
  const gs = reachGameServer(h);
  gs.receive(helloGS(h.config.version));
  gs.receive(Buffer.from([0xc1, 5, 0xf1, 1, 0]));
  assert.equal(h.session.stage, "idle");
  assert.equal(h.session.password, null);
  assert.equal(h.session.username, null);
  assert.equal(h.session.authenticated, false);
  assert.equal(gs.ended, true);
  assert.ok(
    h.ws.messages.some(
      (message) => message.type === "error" && message.code === "LOGIN_FAILED",
    ),
  );
});

test("mismatched server versions never receive account credentials", (t) => {
  const h = harness(t);
  const gs = reachGameServer(h);
  gs.receive(helloGS("99999"));
  assert.equal(gs.writes.length, 0);
  assert.equal(h.session.password, null);
  assert.equal(gs.ended, true);
  assert.ok(
    h.ws.messages.some((message) => message.code === "VERSION_MISMATCH"),
  );
});

test("only owned characters and valid create requests reach GameServer", (t) => {
  const h = harness(t);
  const gs = reachReady(h);
  const before = gs.writes.length;
  h.ws.command({ type: "enter", name: "SomeoneElse" });
  h.ws.command({ type: "create", name: "x", classId: 16 });
  h.ws.command({ type: "create", name: "NewHero", classId: 255 });
  assert.equal(gs.writes.length, before);
  h.ws.command({ type: "create", name: "NewHero", classId: 16 });
  assert.deepEqual(gs.writes.at(-1), encodeCreate("NewHero", 16));
  assert.equal(h.session.stage, "create");
  h.ws.command({ type: "refresh" });
  assert.ok(h.ws.messages.some((message) => message.code === "SESSION_BUSY"));
  gs.receive(Buffer.from([0xc1, 5, 0xf3, 1, 1]));
  assert.deepEqual(gs.writes.at(-1), encodeCharacterListRequest());
  gs.receive(charactersPacket());
  assert.equal(h.session.stage, "ready");
});

test("socket errors report actionable TLS failures and clear pending login credentials", (t) => {
  const h = harness(t);
  h.ws.command({ type: "login", username: "pafa7a", password: "123" });
  h.connections[0].socket.emit(
    "error",
    Object.assign(new Error("expired"), { code: "CERT_HAS_EXPIRED" }),
  );
  assert.ok(
    h.ws.messages.some((message) => message.code === "TLS_CERT_EXPIRED"),
  );
  assert.equal(h.session.stage, "idle");
  assert.equal(h.session.password, null);
  assert.equal(h.session.timer, null);
});

test("malformed backend frames fail the session rather than crashing the gateway", (t) => {
  const h = harness(t);
  h.ws.command({ type: "login", username: "pafa7a", password: "123" });
  assert.doesNotThrow(() =>
    h.connections[0].socket.receive(Buffer.from([0xff, 5, 0, 1, 0])),
  );
  assert.ok(h.ws.messages.some((message) => message.code === "PROTOCOL_ERROR"));
  assert.equal(h.session.stage, "idle");
});

test("a silent ConnectServer times out and releases its socket", async (t) => {
  const h = harness(t, { timeoutMs: 20 });
  const result = waitForMessage(h.ws, (message) => message.code === "TIMEOUT");
  h.ws.command({ type: "login", username: "pafa7a", password: "123" });
  await result;
  assert.equal(h.connections[0].socket.ended, true);
  assert.equal(h.session.stage, "idle");
  assert.equal(h.session.password, null);
});

test("waiting for an unregistered GameServer has a bounded timeout", async (t) => {
  const h = harness(t, { serverWaitMs: 20 });
  const result = waitForMessage(h.ws, (message) => message.code === "TIMEOUT");
  h.ws.command({ type: "login", username: "pafa7a", password: "123" });
  const cs = h.connections[0].socket;
  cs.receive(Buffer.from([0xc1, 4, 0, 1]));
  cs.receive(serverList([]));
  await result;
  assert.equal(cs.ended, true);
  assert.equal(h.session.pollTimer, null);
  assert.equal(h.session.stage, "idle");
});

test("browser close closes backend connections without sending more browser messages", (t) => {
  const h = harness(t);
  const gs = reachReady(h);
  const sent = h.ws.messages.length;
  h.ws.emit("close");
  assert.equal(h.session.closed, true);
  assert.equal(gs.ended, true);
  gs.emit(
    "error",
    Object.assign(new Error("late error"), { code: "ECONNRESET" }),
  );
  assert.equal(h.ws.messages.length, sent);
});
