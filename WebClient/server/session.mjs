import { connect as tlsConnect, checkServerIdentity } from "node:tls";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import {
  PacketStream,
  headerOf,
  ProtocolError,
  BASE_CLASSES,
  encodeServerListRequest,
  encodeServerInfoRequest,
  encodeLogin,
  encodeCharacterListRequest,
  encodeEnter,
  encodeCreate,
  decodeServerList,
  decodeServerInfo,
  decodeCharacters,
  decodeWorld,
} from "./protocol.mjs";

const loginErrors = new Map([
  [0, "Sai mật khẩu hoặc phiên bản/serial không khớp GameServer."],
  [2, "Tài khoản không tồn tại."],
  [3, "Tài khoản đang được đăng nhập ở nơi khác."],
  [4, "Server đã đầy."],
  [5, "Tài khoản bị khóa."],
  [6, "Phiên bản client không khớp server."],
  [8, "Đã vượt số lần thử đăng nhập."],
  [18, "Địa chỉ kết nối không được server chấp nhận."],
]);

function safeNetworkError(error, label) {
  if (error?.code === "CERT_HAS_EXPIRED")
    return [
      "TLS_CERT_EXPIRED",
      `Chứng chỉ của ${label} đã hết hạn. Tạo lại chứng chỉ localhost và khởi động lại ConnectServer, GameServer.`,
    ];
  if (error?.code === "ERR_TLS_CERT_ALTNAME_INVALID")
    return [
      "TLS_HOSTNAME",
      `Chứng chỉ của ${label} không hợp lệ cho địa chỉ đã cấu hình. Chứng chỉ local cần SAN localhost và 127.0.0.1.`,
    ];
  if (
    [
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    ].includes(error?.code)
  ) {
    return [
      "TLS_CA",
      `Không xác minh được chứng chỉ của ${label}. MU_CA_FILE phải trỏ đến chứng chỉ đang dùng ở server.`,
    ];
  }
  if (error?.code === "ENOENT")
    return [
      "TLS_CA_MISSING",
      "Không tìm thấy chứng chỉ CA. Kiểm tra ssl/cert.pem hoặc cấu hình MU_CA_FILE.",
    ];
  if (error?.code === "ECONNREFUSED")
    return [
      "CONNECT_REFUSED",
      `Không kết nối được ${label}. Kiểm tra server đã chạy và cổng cấu hình đúng.`,
    ];
  if (["ENOTFOUND", "EAI_AGAIN"].includes(error?.code))
    return [
      "HOST_NOT_FOUND",
      `Không phân giải được địa chỉ ${label}. Kiểm tra cấu hình máy chủ.`,
    ];
  return [
    "NETWORK_ERROR",
    `Kết nối ${label} gặp lỗi. Kiểm tra log server và cấu hình TLS.`,
  ];
}

export class MuSession {
  constructor(ws, config, { connect = tlsConnect } = {}) {
    this.ws = ws;
    this.config = config;
    this.connect = connect;
    this.stage = "idle";
    this.username = null;
    this.password = null;
    this.authenticated = false;
    this.characters = [];
    this.currentCharacter = null;
    this.closed = false;
    this.cs = null;
    this.gs = null;
    this.timer = null;
    this.pollTimer = null;
    this.messageTimes = [];
    this.loginTimes = [];
    this.send({
      type: "status",
      phase: "idle",
      message: "Sẵn sàng kết nối server MU của bạn.",
    });
    ws.on("message", (data, isBinary) => this.handleMessage(data, isBinary));
    ws.on("close", () => this.close());
    ws.on("error", () => this.close());
  }

  send(message) {
    if (!this.closed && this.ws.readyState === 1)
      this.ws.send(JSON.stringify(message));
  }
  status(phase, message) {
    this.send({ type: "status", phase, message });
  }
  error(code, message) {
    this.send({ type: "error", code, message });
  }
  armTimeout(milliseconds, message) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail("TIMEOUT", message), milliseconds);
    this.timer.unref?.();
  }
  clearTimeout() {
    clearTimeout(this.timer);
    this.timer = null;
  }

  disposeSocket(name) {
    const socket = this[name];
    this[name] = null;
    if (!socket || socket.destroyed) return;
    // Graceful FIN lets GameServer remove its logged-in account on `end`.
    socket.end();
    const timer = setTimeout(() => socket.destroy(), 1000);
    timer.unref?.();
    socket.once("close", () => clearTimeout(timer));
  }

  reset() {
    this.clearTimeout();
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.disposeSocket("cs");
    this.disposeSocket("gs");
    this.password = null;
    this.username = null;
    this.authenticated = false;
    this.characters = [];
    this.currentCharacter = null;
    this.stage = "idle";
  }
  fail(code, message) {
    if (this.closed) return;
    this.reset();
    this.error(code, message);
    this.status("idle", "Kết nối đã kết thúc. Bạn có thể thử đăng nhập lại.");
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.reset();
  }

  handleMessage(data, isBinary = false) {
    if (this.closed) return;
    const now = Date.now();
    this.messageTimes = this.messageTimes.filter((time) => now - time < 10000);
    if (this.messageTimes.length >= 30) {
      this.error(
        "RATE_LIMIT",
        "Bạn thao tác quá nhanh. Vui lòng đợi vài giây.",
      );
      return;
    }
    this.messageTimes.push(now);
    let message;
    try {
      if (isBinary || data.length > 4096) throw new Error();
      message = JSON.parse(data.toString());
      if (
        !message ||
        Array.isArray(message) ||
        typeof message !== "object" ||
        typeof message.type !== "string"
      )
        throw new Error();
    } catch {
      this.error("INVALID_MESSAGE", "Yêu cầu gửi tới gateway không hợp lệ.");
      return;
    }
    if (message.type === "logout") {
      this.reset();
      this.status("idle", "Đã đăng xuất.");
      return;
    }
    if (message.type === "login") {
      if (this.stage !== "idle") {
        this.error(
          "SESSION_BUSY",
          "Phiên kết nối đang hoạt động. Đăng xuất trước khi đăng nhập lại.",
        );
        return;
      }
      if (
        typeof message.username !== "string" ||
        !/^[A-Za-z0-9_.-]{1,10}$/.test(message.username) ||
        typeof message.password !== "string" ||
        !/^[\x20-\x7E]{1,20}$/.test(message.password)
      ) {
        this.error(
          "INVALID_CREDENTIALS",
          "Tài khoản cần 1–10 ký tự chữ/số; mật khẩu cần 1–20 ký tự ASCII.",
        );
        return;
      }
      this.loginTimes = this.loginTimes.filter((time) => now - time < 60000);
      if (this.loginTimes.length >= 5) {
        this.error(
          "RATE_LIMIT",
          "Đã thử đăng nhập nhiều lần. Vui lòng đợi một phút.",
        );
        return;
      }
      this.loginTimes.push(now);
      this.login(message.username, message.password);
      return;
    }
    if (!["refresh", "enter", "create"].includes(message.type)) {
      this.error("UNKNOWN_COMMAND", "Gateway chưa hỗ trợ thao tác này.");
      return;
    }
    if (!this.authenticated || !this.gs) {
      this.error("AUTH_REQUIRED", "Bạn cần đăng nhập trước.");
      return;
    }
    if (this.stage !== "ready") {
      this.error("SESSION_BUSY", "Đang chờ server trả lời thao tác trước.");
      return;
    }
    if (message.type === "refresh") {
      this.requestCharacters();
    } else if (message.type === "enter") {
      const character = this.characters.find(
        (character) => character.name === message.name,
      );
      if (!character) {
        this.error(
          "INVALID_CHARACTER",
          "Nhân vật không có trong danh sách của tài khoản này.",
        );
        return;
      }
      if (this.currentCharacter) {
        this.error(
          "ALREADY_IN_WORLD",
          "Hãy đăng xuất trước khi chọn lại nhân vật.",
        );
        return;
      }
      this.currentCharacter = character;
      this.stage = "enter";
      this.status("entering", `Đang vào bản đồ với ${character.name}…`);
      this.armTimeout(
        this.config.timeoutMs,
        "GameServer chưa trả thông tin bản đồ. Kiểm tra log GameServer và database.",
      );
      this.write("gs", encodeEnter(character.name));
    } else if (message.type === "create") {
      if (this.currentCharacter) {
        this.error(
          "ALREADY_IN_WORLD",
          "Hãy đăng xuất trước khi tạo thêm nhân vật.",
        );
        return;
      }
      if (
        typeof message.name !== "string" ||
        !/^[A-Za-z0-9_]{3,10}$/.test(message.name) ||
        !BASE_CLASSES.some((item) => item.classId === message.classId)
      ) {
        this.error(
          "INVALID_CHARACTER",
          "Tên nhân vật cần 3–10 ký tự chữ/số hoặc dấu gạch dưới, và hệ nhân vật hợp lệ.",
        );
        return;
      }
      this.stage = "create";
      this.status("characters", "Đang tạo nhân vật…");
      this.armTimeout(
        this.config.timeoutMs,
        "GameServer chưa trả kết quả tạo nhân vật. Kiểm tra log GameServer.",
      );
      this.write("gs", encodeCreate(message.name, message.classId));
    }
  }

  login(username, password) {
    this.username = username;
    this.password = password;
    this.stage = "cs-hello";
    this.status("connecting", "Đang kết nối ConnectServer…");
    this.armTimeout(
      this.config.timeoutMs,
      "ConnectServer chưa trả lời. Kiểm tra ConnectServer đang chạy.",
    );
    this.openSocket("cs", this.config.connectHost, this.config.connectPort);
  }

  openSocket(name, host, port) {
    const label = name === "cs" ? "ConnectServer" : "GameServer";
    const parser = new PacketStream();
    try {
      const socket = this.connect({
        host,
        port,
        ca: readFileSync(this.config.caFile),
        rejectUnauthorized: true,
        ...(isIP(host) ? {} : { servername: host }),
        checkServerIdentity: (_servername, certificate) =>
          checkServerIdentity(host, certificate),
        minVersion: "TLSv1.2",
      });
      this[name] = socket;
      socket.setNoDelay?.(true);
      socket.setKeepAlive?.(true, 30000);
      socket.on("data", (chunk) => {
        if (this.closed || this[name] !== socket) return;
        try {
          for (const packet of parser.push(chunk)) {
            if (this[name] !== socket) break;
            if (name === "cs") this.receiveCS(packet);
            else this.receiveGS(packet);
          }
        } catch (error) {
          this.fail(
            "PROTOCOL_ERROR",
            error instanceof ProtocolError
              ? error.message
              : "Không giải mã được phản hồi MU. Kiểm tra phiên bản server.",
          );
        }
      });
      socket.on("error", (error) => {
        if (!this.closed && this[name] === socket)
          this.fail(...safeNetworkError(error, label));
      });
      socket.on("close", () => {
        if (!this.closed && this[name] === socket)
          this.fail(
            "SERVER_DISCONNECTED",
            `${label} đã đóng kết nối. Kiểm tra log server rồi thử lại.`,
          );
      });
    } catch (error) {
      this.fail(...safeNetworkError(error, label));
    }
  }

  write(name, packet) {
    const socket = this[name];
    if (!socket || socket.destroyed) return;
    if (socket.writableLength > 65536) {
      this.fail("NETWORK_BUSY", "Kết nối MU đang bị nghẽn. Vui lòng thử lại.");
      return;
    }
    socket.write(packet);
  }

  receiveCS(packet) {
    const { head, sub } = headerOf(packet);
    if (head === 0x00 && sub === 0x01 && this.stage === "cs-hello") {
      this.stage = "cs-list";
      this.status(
        "connecting",
        "Đang chờ GameServer đăng ký với ConnectServer…",
      );
      this.armTimeout(
        this.config.serverWaitMs,
        `Chưa thấy server ${this.config.serverId} trong ConnectServer. Khởi động JoinServer và GameServer rồi thử lại.`,
      );
      this.write("cs", encodeServerListRequest());
    } else if (head === 0xf4 && sub === 0x06 && this.stage === "cs-list") {
      const servers = decodeServerList(packet);
      if (!servers.some((server) => server.serverId === this.config.serverId)) {
        clearTimeout(this.pollTimer);
        this.pollTimer = setTimeout(
          () => this.write("cs", encodeServerListRequest()),
          1000,
        );
        this.pollTimer.unref?.();
        return;
      }
      clearTimeout(this.pollTimer);
      this.stage = "cs-info";
      this.armTimeout(
        this.config.timeoutMs,
        "ConnectServer chưa trả địa chỉ GameServer.",
      );
      this.write("cs", encodeServerInfoRequest(this.config.serverId));
    } else if (head === 0xf4 && sub === 0x03 && this.stage === "cs-info") {
      const { serverPort } = decodeServerInfo(packet);
      this.disposeSocket("cs");
      this.stage = "gs-hello";
      this.status("connecting", "Đang kết nối GameServer…");
      this.armTimeout(
        this.config.timeoutMs,
        "GameServer chưa trả lời. Kiểm tra GameServer đã chạy.",
      );
      this.openSocket("gs", this.config.gameHost, serverPort);
    }
  }

  receiveGS(packet) {
    const { head, sub } = headerOf(packet);
    if (head === 0xf1 && sub === 0x00 && this.stage === "gs-hello") {
      if (packet.length < 12 || packet[4] !== 1)
        throw new ProtocolError("GameServer không chấp nhận kết nối.");
      const serverVersion = packet.toString("ascii", 7, 12);
      if (serverVersion !== this.config.version) {
        this.fail(
          "VERSION_MISMATCH",
          "MU_VERSION không khớp phiên bản GameServer. Kiểm tra GameServer/config/common.json.",
        );
        return;
      }
      this.stage = "gs-login";
      this.status("authenticating", "Đang xác minh tài khoản với JoinServer…");
      this.armTimeout(
        this.config.timeoutMs,
        "Chưa nhận kết quả đăng nhập. Kiểm tra JoinServer và kết nối MySQL.",
      );
      const request = encodeLogin({
        username: this.username,
        password: this.password,
        version: this.config.version,
        serial: this.config.serial,
      });
      this.password = null;
      this.write("gs", request);
    } else if (head === 0xf1 && sub === 0x01 && this.stage === "gs-login") {
      if (packet.length < 5)
        throw new ProtocolError("Kết quả đăng nhập MU bị thiếu.");
      if (packet[4] !== 1) {
        this.fail(
          "LOGIN_FAILED",
          loginErrors.get(packet[4]) ??
            `Server từ chối đăng nhập (mã ${packet[4]}).`,
        );
        return;
      }
      this.authenticated = true;
      this.send({
        type: "authenticated",
        username: this.username,
        serverId: this.config.serverId,
      });
      this.requestCharacters();
    } else if (head === 0xf3 && sub === 0x00 && this.stage === "list") {
      this.characters = decodeCharacters(packet);
      this.clearTimeout();
      this.stage = "ready";
      this.send({ type: "characters", characters: this.characters });
      this.status(
        "characters",
        this.characters.length
          ? "Chọn nhân vật để vào bản đồ."
          : "Tài khoản chưa có nhân vật. Bạn có thể tạo nhân vật mới.",
      );
    } else if (head === 0xf3 && sub === 0x01 && this.stage === "create") {
      if (packet.length < 5)
        throw new ProtocolError("Kết quả tạo nhân vật MU bị thiếu.");
      this.clearTimeout();
      this.stage = "ready";
      if (packet[4] !== 1) {
        this.error(
          "CREATE_FAILED",
          packet[4] === 2
            ? "Tài khoản đã đủ 5 nhân vật."
            : "Không tạo được nhân vật. Tên có thể đã tồn tại hoặc hệ nhân vật chưa được mở.",
        );
        this.status(
          "characters",
          "Chọn tên hoặc hệ nhân vật khác rồi thử lại.",
        );
      } else {
        this.send({
          type: "notice",
          message: "Đã tạo nhân vật. Đang tải lại danh sách.",
        });
        this.requestCharacters();
      }
    } else if (head === 0xf3 && sub === 0x03 && this.stage === "enter") {
      const stats = decodeWorld(packet);
      this.clearTimeout();
      this.stage = "ready";
      this.send({ type: "world", character: this.currentCharacter, stats });
      this.status(
        "world",
        "Đã nhận bản đồ và chỉ số từ server. Di chuyển trong cảnh hiện tại chỉ là xem thử cục bộ.",
      );
    }
  }

  requestCharacters() {
    this.stage = "list";
    this.status("characters", "Đang tải danh sách nhân vật từ GameServer…");
    this.armTimeout(
      this.config.timeoutMs,
      "GameServer chưa trả danh sách nhân vật. Kiểm tra log GameServer và database.",
    );
    this.write("gs", encodeCharacterListRequest());
  }
}
