import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import PacketManager from "@mu-online-js/mu-packet-manager";
import {
  PacketStream,
  headerOf,
  encodeLogin,
  encodeServerListRequest,
  encodeServerInfoRequest,
  encodeCharacterListRequest,
  encodeEnter,
  encodeCreate,
  decodeServerList,
  decodeServerInfo,
  decodeCharacters,
  decodeWorld,
} from "./protocol.mjs";

const require = createRequire(import.meta.url);
const gameStructures = require("../../GameServer/src/packets/gameserver.js");
const clientStructures = require("../../Client/src/packets/index.js");

function publishedPacket(structure, type, headCode, subCode, payload = {}) {
  return new PacketManager().useStruct(structure).toBuffer({
    header: { type, size: "auto", headCode, subCode },
    ...payload,
  });
}

function charactersPacket(characters) {
  return publishedPacket(gameStructures.CharacterList, 0xc1, 0xf3, 0, {
    maxClass: 0,
    moveCount: 0,
    characterCount: characters.length,
    isVaultExtended: 0,
    characterList: characters.map(({ protocolClass = 0, ...character }) => ({
      ctlCode: 0,
      charSet: [protocolClass, ...Array(16).fill(0xff)],
      guildStatus: 0xff,
      ...character,
    })),
  });
}

const worldValues = {
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
};

test("PacketStream preserves packets split at every byte boundary", () => {
  const frames = [
    Buffer.from([0xc1, 5, 0xf1, 1, 1]),
    Buffer.from([0xc2, 0, 8, 0xf4, 6, 0, 0, 0]),
    Buffer.from([0xc3, 5, 0xf1, 1, 1]),
    Buffer.from([0xc4, 0, 8, 0xf4, 6, 0, 0, 0]),
  ];
  for (const frame of frames) {
    for (let split = 1; split < frame.length; split++) {
      const stream = new PacketStream();
      assert.deepEqual(stream.push(frame.subarray(0, split)), []);
      assert.deepEqual(stream.push(frame.subarray(split)), [frame]);
    }
    const stream = new PacketStream();
    const output = [];
    for (const byte of frame) output.push(...stream.push(Buffer.from([byte])));
    assert.deepEqual(output, [frame]);
  }
});

test("PacketStream extracts coalesced frames and retains a partial next frame", () => {
  const a = Buffer.from([0xc1, 5, 0xf1, 1, 1]);
  const b = Buffer.from([0xc3, 5, 0xf1, 1, 0]);
  const c = Buffer.from([0xc2, 0, 7, 0xf4, 6, 0, 0]);
  const stream = new PacketStream();
  assert.deepEqual(stream.push(Buffer.concat([a, b, c.subarray(0, 4)])), [
    a,
    b,
  ]);
  assert.deepEqual(stream.push(c.subarray(4)), [c]);
  assert.deepEqual(stream.push(Buffer.alloc(0)), []);
});

test("PacketStream uses the big-endian two-byte length for large C2 frames", () => {
  const frame = Buffer.alloc(300, 0xaa);
  frame[0] = 0xc2;
  frame.writeUInt16BE(frame.length, 1);
  frame[3] = 0xf4;
  frame[4] = 6;
  const stream = new PacketStream();
  assert.deepEqual(stream.push(frame.subarray(0, 256)), []);
  assert.deepEqual(stream.push(frame.subarray(256)), [frame]);
});

test("PacketStream reset discards bytes from the previous connection", () => {
  const stream = new PacketStream();
  stream.push(Buffer.from([0xc2, 0]));
  stream.reset();
  const frame = Buffer.from([0xc1, 5, 0xf1, 1, 1]);
  assert.deepEqual(stream.push(frame), [frame]);
});

test("PacketStream rejects unknown headers and impossible declared lengths", () => {
  for (const invalid of [
    [0xff, 5, 0xf1, 1, 1],
    [0xc1, 0, 0xf1, 1],
    [0xc3, 2, 0xf1, 1],
    [0xc2, 0, 0, 0xf4, 6],
    [0xc4, 0, 3, 0xf4, 6],
  ]) {
    assert.throws(() => new PacketStream().push(Buffer.from(invalid)));
  }
});

test("headerOf reads short and long MU packet headers", () => {
  assert.deepEqual(headerOf(Buffer.from([0xc1, 5, 0xf1, 1, 1])), {
    type: 0xc1,
    head: 0xf1,
    sub: 1,
  });
  assert.deepEqual(headerOf(Buffer.from([0xc2, 0, 7, 0xf4, 6, 0, 0])), {
    type: 0xc2,
    head: 0xf4,
    sub: 6,
  });
});

test("outbound requests match the repository packet manager byte for byte", () => {
  const login = {
    username: "pafa7a",
    password: "123",
    tickCount: 0x01020304,
    version: "10405",
    serial: "TbYehR2hFUPBKgZj",
  };
  assert.deepEqual(
    encodeLogin(login),
    publishedPacket(gameStructures.RequestLogin, 0xc3, 0xf1, 1, login),
  );
  assert.deepEqual(
    encodeServerListRequest(),
    publishedPacket(
      clientStructures.MainCSSendServerListRequest,
      0xc1,
      0xf4,
      6,
    ),
  );
  assert.deepEqual(
    encodeServerInfoRequest(257),
    publishedPacket(clientStructures.MainCSServerInfoRequest, 0xc1, 0xf4, 3, {
      serverId: 257,
    }),
  );
  assert.deepEqual(
    encodeCharacterListRequest(),
    publishedPacket(clientStructures.RequestCharactersList, 0xc1, 0xf3, 0, {
      language: 0,
    }),
  );
  assert.deepEqual(
    encodeEnter("Teeliver"),
    publishedPacket(gameStructures.RequestJoinMapServer, 0xc1, 0xf3, 3, {
      name: "Teeliver",
    }),
  );
  assert.deepEqual(
    encodeCreate("WebKnight", 16),
    publishedPacket(gameStructures.RequestCreateCharacter, 0xc1, 0xf3, 1, {
      name: "WebKnight",
      class: 16,
    }),
  );
});

test("decodeServerList handles published manager padding and little-endian IDs", () => {
  const packet = publishedPacket(
    clientStructures.CSServerListResponse,
    0xc2,
    0xf4,
    6,
    {
      serverCount: 2,
      serverLoadInfo: [
        { serverId: 0, loadPercentage: 12 },
        { serverId: 257, loadPercentage: 70 },
      ],
    },
  );
  assert.deepEqual(decodeServerList(packet), [
    { serverId: 0, loadPercentage: 12 },
    { serverId: 257, loadPercentage: 70 },
  ]);
  assert.deepEqual(
    decodeServerList(Buffer.from([0xc2, 0, 7, 0xf4, 6, 0, 0])),
    [],
  );
  const tooMany = Buffer.from(packet);
  tooMany.writeUInt16BE(3, 5);
  assert.throws(() => decodeServerList(tooMany));
});

test("decodeServerInfo reads null-terminated host and little-endian port", () => {
  const packet = publishedPacket(
    clientStructures.CSMainCSServerInfoResponse,
    0xc1,
    0xf4,
    3,
    {
      serverAddress: "127.0.0.1",
      serverPort: 55901,
    },
  );
  assert.deepEqual(decodeServerInfo(packet), {
    serverAddress: "127.0.0.1",
    serverPort: 55901,
  });
  assert.throws(() => decodeServerInfo(packet.subarray(0, 20)));
});

test("decodeCharacters reads real 34-byte entries, preserving slots and high levels", () => {
  const packet = charactersPacket([
    { slot: 0, name: "Teeliver", level: 400, ctlCode: 1, protocolClass: 0x38 },
    { slot: 4, name: "Elf", level: 2, protocolClass: 0x40 },
  ]);
  assert.equal(packet.length, 8 + 2 * 34);
  const characters = decodeCharacters(packet);
  assert.equal(characters.length, 2);
  assert.deepEqual(
    characters.map(({ slot, name, level, classId, classKey, ctlCode }) => ({
      slot,
      name,
      level,
      classId,
      classKey,
      ctlCode,
    })),
    [
      {
        slot: 0,
        name: "Teeliver",
        level: 400,
        classId: 18,
        classKey: "knight",
        ctlCode: 1,
      },
      {
        slot: 4,
        name: "Elf",
        level: 2,
        classId: 32,
        classKey: "elf",
        ctlCode: 0,
      },
    ],
  );
  for (const character of characters)
    assert.equal(typeof character.className, "string");
});

test("decodeCharacters handles all supported base classes and all five slots", () => {
  const classCases = [
    [0x00, 0, "wizard"],
    [0x20, 16, "knight"],
    [0x40, 32, "elf"],
    [0x60, 48, "gladiator"],
    [0x80, 64, "lord"],
    [0xa0, 80, "summoner"],
    [0xc0, 96, "fighter"],
  ];
  for (const [protocolClass, classId, classKey] of classCases) {
    const [character] = decodeCharacters(
      charactersPacket([{ slot: 0, name: "Test", level: 1, protocolClass }]),
    );
    assert.equal(character.classId, classId);
    assert.equal(character.classKey, classKey);
  }
  const packet = charactersPacket(
    Array.from({ length: 5 }, (_, slot) => ({
      slot,
      name: `Hero${slot}`,
      level: 10 + slot,
    })),
  );
  assert.deepEqual(
    decodeCharacters(packet).map(({ slot }) => slot),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(decodeCharacters(charactersPacket([])), []);
});

test("decodeCharacters refuses incomplete entries and count overruns", () => {
  const packet = charactersPacket([{ slot: 0, name: "Hero", level: 1 }]);
  assert.throws(() => decodeCharacters(packet.subarray(0, packet.length - 1)));
  const tooMany = Buffer.from(packet);
  tooMany[6] = 2;
  assert.throws(() => decodeCharacters(tooMany));
});

test("decodeWorld interoperates with the published manager dword alignment quirk", () => {
  const packet = publishedPacket(
    gameStructures.JoinMapSend,
    0xc1,
    0xf3,
    3,
    worldValues,
  );
  // The package allocates 67 bytes but inserts two additional bytes before money.
  // Its optional tail is truncated; the playable core must still decode accurately.
  assert.equal(packet.length, 67);
  assert.equal(packet.readUInt32LE(52), worldValues.money);
  const decoded = decodeWorld(packet);
  for (const key of [
    "x",
    "y",
    "map",
    "dir",
    "levelUpPoints",
    "str",
    "agi",
    "vit",
    "ene",
    "life",
    "maxLife",
    "mana",
    "maxMana",
    "shield",
    "maxShield",
    "bp",
    "maxBp",
    "money",
  ])
    assert.equal(decoded[key], worldValues[key], key);
  assert.throws(() => decodeWorld(packet.subarray(0, 52)));
});
