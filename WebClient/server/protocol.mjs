import PacketManager from "@mu-online-js/mu-packet-manager";

// Wire structures follow pafa7a/mu-online-js (MIT), Client/src/packets and
// GameServer/src/packets/gameserver.js. C3 packets are plain MU frames inside
// verified TLS in this server; applying the retail client's XOR here is wrong.
const subHeader = {
  header: { type: "byte", size: "byte", headCode: "byte", subCode: "byte" },
};
const structures = {
  request: subHeader,
  serverInfo: { ...subHeader, serverId: "shortLE" },
  login: {
    ...subHeader,
    username: "char(10)",
    password: "char(20)",
    tickCount: "dwordBE",
    version: "char(5)",
    serial: "char(16)",
  },
  list: { ...subHeader, language: "byte" },
  enter: { ...subHeader, name: "char(10)" },
  create: { ...subHeader, name: "char(10)", class: "byte" },
};

export const BASE_CLASSES = Object.freeze([
  { classId: 0, className: "Dark Wizard", classKey: "wizard" },
  { classId: 16, className: "Dark Knight", classKey: "knight" },
  { classId: 32, className: "Fairy Elf", classKey: "elf" },
  { classId: 48, className: "Magic Gladiator", classKey: "gladiator" },
  { classId: 64, className: "Dark Lord", classKey: "lord" },
  { classId: 80, className: "Summoner", classKey: "summoner" },
  { classId: 96, className: "Rage Fighter", classKey: "fighter" },
]);

const classByProtocol = new Map([
  [0x00, [0, "Dark Wizard", "wizard"]],
  [0x10, [1, "Soul Master", "wizard"]],
  [0x18, [2, "Grand Master", "wizard"]],
  [0x20, [16, "Dark Knight", "knight"]],
  [0x30, [17, "Blade Knight", "knight"]],
  [0x38, [18, "Blade Master", "knight"]],
  [0x40, [32, "Fairy Elf", "elf"]],
  [0x50, [33, "Muse Elf", "elf"]],
  [0x58, [34, "High Elf", "elf"]],
  [0x60, [48, "Magic Gladiator", "gladiator"]],
  [0x78, [49, "Duel Master", "gladiator"]],
  [0x80, [64, "Dark Lord", "lord"]],
  [0x98, [65, "Lord Emperor", "lord"]],
  [0xa0, [80, "Summoner", "summoner"]],
  [0xb0, [81, "Bloody Summoner", "summoner"]],
  [0xb8, [82, "Dimension Master", "summoner"]],
  [0xc0, [96, "Rage Fighter", "fighter"]],
  [0xd8, [97, "Fist Master", "fighter"]],
]);

function encode(struct, type, headCode, subCode, fields = {}) {
  return new PacketManager().useStruct(struct).toBuffer({
    header: { type, size: "auto", headCode, subCode },
    ...fields,
  });
}

export const encodeServerListRequest = () =>
  encode(structures.request, 0xc1, 0xf4, 0x06);
export const encodeServerInfoRequest = (serverId) =>
  encode(structures.serverInfo, 0xc1, 0xf4, 0x03, { serverId });
export const encodeLogin = ({
  username,
  password,
  version,
  serial,
  tickCount = Date.now() >>> 0,
}) =>
  encode(structures.login, 0xc3, 0xf1, 0x01, {
    username,
    password,
    version,
    serial,
    tickCount,
  });
export const encodeCharacterListRequest = () =>
  encode(structures.list, 0xc1, 0xf3, 0x00, { language: 0 });
export const encodeEnter = (name) =>
  encode(structures.enter, 0xc1, 0xf3, 0x03, { name });
export const encodeCreate = (name, classId) =>
  encode(structures.create, 0xc1, 0xf3, 0x01, { name, class: classId });

export class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProtocolError";
  }
}

function lengths(type) {
  if (type === 0xc1 || type === 0xc3)
    return { sizeBytes: 1, headOffset: 2, min: 3 };
  if (type === 0xc2 || type === 0xc4)
    return { sizeBytes: 2, headOffset: 3, min: 4 };
  throw new ProtocolError("Loại gói tin MU không hợp lệ.");
}

/** TLS/TCP can split a frame or combine many frames in one data event. */
export class PacketStream {
  constructor({ maxBuffer = 262144, maxPacket = 65535 } = {}) {
    this.maxBuffer = maxBuffer;
    this.maxPacket = maxPacket;
    this.buffer = Buffer.alloc(0);
  }
  reset() {
    this.buffer = Buffer.alloc(0);
  }
  push(chunk) {
    if (!Buffer.isBuffer(chunk)) chunk = Buffer.from(chunk);
    if (this.buffer.length + chunk.length > this.maxBuffer)
      throw new ProtocolError("Bộ đệm MU vượt giới hạn.");
    this.buffer = this.buffer.length
      ? Buffer.concat([this.buffer, chunk])
      : chunk;
    const frames = [];
    let offset = 0;
    while (offset < this.buffer.length) {
      const shape = lengths(this.buffer[offset]);
      if (this.buffer.length - offset < 1 + shape.sizeBytes) break;
      const size =
        shape.sizeBytes === 1
          ? this.buffer[offset + 1]
          : this.buffer.readUInt16BE(offset + 1);
      if (size < shape.min || size > this.maxPacket)
        throw new ProtocolError("Độ dài gói tin MU không hợp lệ.");
      if (this.buffer.length - offset < size) break;
      frames.push(Buffer.from(this.buffer.subarray(offset, offset + size)));
      offset += size;
    }
    if (offset) this.buffer = Buffer.from(this.buffer.subarray(offset));
    return frames;
  }
}

export function headerOf(packet) {
  if (!Buffer.isBuffer(packet) || !packet.length)
    throw new ProtocolError("Gói tin MU trống.");
  const shape = lengths(packet[0]);
  if (packet.length < shape.min)
    throw new ProtocolError("Gói tin MU thiếu header.");
  const size = shape.sizeBytes === 1 ? packet[1] : packet.readUInt16BE(1);
  if (size !== packet.length)
    throw new ProtocolError("Gói tin MU bị thiếu hoặc dư dữ liệu.");
  return {
    type: packet[0],
    head: packet[shape.headOffset],
    sub: packet[shape.headOffset + 1],
  };
}

function expect(packet, head, sub, minimum) {
  const header = headerOf(packet);
  if (header.head !== head || header.sub !== sub || packet.length < minimum) {
    throw new ProtocolError("Gói tin MU không đúng định dạng mong đợi.");
  }
}

function text(packet, offset, length) {
  return packet.toString("utf8", offset, offset + length).split("\0", 1)[0];
}

export function decodeServerList(packet) {
  expect(packet, 0xf4, 0x06, 7);
  if (![0xc2, 0xc4].includes(packet[0]))
    throw new ProtocolError("Danh sách server thiếu header dài.");
  const count = packet.readUInt16BE(5);
  if (count > 128 || packet.length !== 7 + count * 4)
    throw new ProtocolError("Danh sách server MU bị lỗi.");
  return Array.from({ length: count }, (_, i) => ({
    serverId: packet.readUInt16LE(7 + i * 4),
    loadPercentage: packet[9 + i * 4],
  }));
}

export function decodeServerInfo(packet) {
  expect(packet, 0xf4, 0x03, 22);
  const serverPort = packet.readUInt16LE(20);
  if (!serverPort) throw new ProtocolError("Cổng GameServer không hợp lệ.");
  return { serverAddress: text(packet, 4, 16), serverPort };
}

export function decodeCharacters(packet) {
  expect(packet, 0xf3, 0x00, 8);
  const count = packet[6];
  // Published mu-packet-manager 0.0.15 writes `word` with one 0xCC
  // alignment byte, then an explicit arrayPadding. Entry width is 34, not 32.
  if (count > 5 || packet.length !== 8 + count * 34)
    throw new ProtocolError("Danh sách nhân vật MU bị lỗi.");
  return Array.from({ length: count }, (_, i) => {
    const offset = 8 + i * 34;
    const protocolClass = packet[offset + 15] & 0xf8;
    const [classId, className, classKey] = classByProtocol.get(
      protocolClass,
    ) ?? [-1, "Unknown", "wizard"];
    return {
      slot: packet[offset],
      name: text(packet, offset + 1, 10),
      level: packet.readUInt16LE(offset + 12),
      ctlCode: packet[offset + 14],
      classId,
      className,
      classKey,
    };
  });
}

export function decodeWorld(packet) {
  expect(packet, 0xf3, 0x03, 58);
  const stats = { x: packet[4], y: packet[5], map: packet[6], dir: packet[7] };
  // Experience is emitted as bytes (the upstream server's order is unusual).
  // Keep the original bytes so the browser does not invent a progression value.
  stats.experienceBytes = [...packet.subarray(8, 16)];
  stats.nextExperienceBytes = [...packet.subarray(16, 24)];
  const words = [
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
  ];
  words.forEach((key, i) => {
    stats[key] = packet.readUInt16LE(24 + i * 2);
  });
  // The server's serializer inserts two bytes before dword money, but does not
  // include them in its allocation. Core stats are intact; the final fields
  // can be truncated. Do not use its decoder (which also misreads money).
  stats.money = packet.readUInt32LE(52);
  stats.pkLevel = packet[56];
  stats.ctlCode = packet[57];
  const tail = [
    "fruitAddPoint",
    "fruitMaxAddPoint",
    "command",
    "fruitSubPoint",
    "fruitMaxSubPoint",
  ];
  tail.forEach((key, i) => {
    const offset = 58 + i * 2;
    if (offset + 2 <= packet.length) stats[key] = packet.readUInt16LE(offset);
  });
  if (packet.length >= 69) stats.extInventory = packet[68];
  stats.tailTruncated = packet.length < 69;
  return stats;
}
