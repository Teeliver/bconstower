import WebSocket from "ws";

// Opt-in functional check against your running gateway and MU services.
// No database writes or character creation; the sample account needs a character.
const address = process.env.MU_WEB_URL || "ws://127.0.0.1:3001/ws";
const url = new URL(address);
const origin = `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
const ws = new WebSocket(address, { origin });
const outcome = { authenticated: false, characters: 0, enteredWorld: false };
let finished = false;
const timeout = setTimeout(
  () =>
    finish(
      new Error(
        "Hết thời gian kiểm tra. Xem log ConnectServer, JoinServer và GameServer.",
      ),
    ),
  45000,
);

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  if (ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type: "logout" }));
  ws.close();
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
  } else console.log(JSON.stringify(outcome, null, 2));
}

ws.on("open", () =>
  ws.send(
    JSON.stringify({
      type: "login",
      username: process.env.MU_SMOKE_USERNAME || "pafa7a",
      password: process.env.MU_SMOKE_PASSWORD || "123",
    }),
  ),
);
ws.on("error", () =>
  finish(
    new Error(
      "Không kết nối được gateway. Khởi động npm run dev hoặc npm start trước.",
    ),
  ),
);
ws.on("close", () => {
  if (!finished)
    finish(new Error("Gateway đóng kết nối trước khi kiểm tra hoàn tất."));
});
ws.on("message", (raw) => {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    finish(new Error("Gateway gửi phản hồi không hợp lệ."));
    return;
  }
  if (message.type === "error") finish(new Error(message.message));
  if (message.type === "authenticated") outcome.authenticated = true;
  if (message.type === "characters") {
    outcome.characters = message.characters.length;
    if (!outcome.characters) {
      finish(
        new Error(
          "Đăng nhập thành công nhưng tài khoản chưa có nhân vật. Hãy tạo nhân vật trên web rồi thử lại.",
        ),
      );
      return;
    }
    ws.send(
      JSON.stringify({ type: "enter", name: message.characters[0].name }),
    );
  }
  if (message.type === "world") {
    outcome.enteredWorld = true;
    outcome.map = message.stats.map;
    outcome.position = { x: message.stats.x, y: message.stats.y };
    outcome.life = message.stats.life;
    finish();
  }
});
