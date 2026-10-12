import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorldScene from "./WorldScene.jsx";

const DEMO_CHARACTER = {
  name: "Aster",
  level: 18,
  classId: 16,
  classKey: "knight",
  className: "Dark Knight",
};
const DEMO_WORLD = {
  x: 137,
  y: 125,
  map: 0,
  life: 420,
  maxLife: 420,
  mana: 120,
  maxMana: 120,
  shield: 180,
  maxShield: 180,
  money: 12500,
  str: 74,
  agi: 38,
  vit: 52,
  ene: 20,
};
const MAPS = {
  0: "Lorencia",
  1: "Dungeon",
  2: "Devias",
  3: "Noria",
  4: "Lost Tower",
  7: "Atlans",
  8: "Tarkan",
  51: "Elbeland",
};
const number = (value) => new Intl.NumberFormat("vi-VN").format(value ?? 0);

function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrow: (
      <>
        <path d="M4 12h16M14 6l6 6-6 6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 6a8 8 0 0 1 14 6M18 18a8 8 0 0 1-14-6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    sword: (
      <>
        <path d="m4 20 3-3m-2-4 6 6m-3-4L18 3l3 3L9 16" />
      </>
    ),
    exit: (
      <>
        <path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.shield}
    </svg>
  );
}

function ResourceBar({ label, value, max, kind }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`resource resource-${kind}`}>
      <div className="resource-label">
        <span>{label}</span>
        <span>
          {number(value)} <small>/ {number(max)}</small>
        </span>
      </div>
      <div className="resource-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function App() {
  const socket = useRef(null);
  const intentionalClose = useRef(false);
  const [stage, setStage] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [account, setAccount] = useState("");
  const [characters, setCharacters] = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [world, setWorld] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [pending, setPending] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [gatewayReady, setGatewayReady] = useState(false);
  const [gatewayChecked, setGatewayChecked] = useState(false);
  const [capabilities, setCapabilities] = useState({});
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState(16);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const check = async () => {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Gateway unavailable");
        if (!disposed) {
          setGatewayReady(true);
          setGatewayChecked(true);
        }
      } catch {
        if (!disposed) {
          setGatewayReady(false);
          setGatewayChecked(true);
        }
      }
    };
    check();
    fetch("/api/config", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (!disposed && config) setCapabilities(config.capabilities || {});
      })
      .catch(() => {});
    const timer = setInterval(check, 10000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  useEffect(
    () => () => {
      intentionalClose.current = true;
      socket.current?.close();
    },
    [],
  );
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setHelpOpen(false);
        setCreateOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const selectedCharacter = useMemo(
    () =>
      characters.find((character) => character.name === selectedName) || null,
    [characters, selectedName],
  );
  const isDemo = stage === "demo";
  const inWorld = stage === "world" || isDemo;
  const renderedCharacter = isDemo
    ? DEMO_CHARACTER
    : activeCharacter || selectedCharacter || DEMO_CHARACTER;
  const renderedWorld = isDemo ? DEMO_WORLD : world;
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneError = useCallback((message) => {
    setSceneError(
      typeof message === "string"
        ? message
        : "Trình duyệt không khởi tạo được WebGL.",
    );
    setSceneReady(true);
  }, []);
  const onPosition = useCallback((next) => setPosition(next), []);

  function send(message) {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setPending("");
      setError("Kết nối đã đóng. Hãy đăng nhập lại.");
      return false;
    }
    socket.current.send(JSON.stringify(message));
    return true;
  }

  function handleMessage(message) {
    switch (message.type) {
      case "status":
        setStatus(message.message || "");
        if (message.phase === "idle") setPending("");
        break;
      case "authenticated":
        setAccount(message.username);
        setPassword("");
        setStatus("Đang tải nhân vật…");
        setStage("select");
        break;
      case "characters":
        setCharacters(message.characters || []);
        setNotice("");
        setSelectedName((current) =>
          message.characters?.some((character) => character.name === current)
            ? current
            : message.characters?.[0]?.name || "",
        );
        setPending("");
        setStatus("");
        setCreateOpen(false);
        break;
      case "world":
        setActiveCharacter(message.character);
        setWorld(message.stats);
        setPosition({ x: 0, y: 0 });
        setStage("world");
        setPending("");
        setStatus("");
        break;
      case "error":
        setError(message.message || "Không thể hoàn tất yêu cầu.");
        setPending("");
        setStatus("");
        break;
      case "notice":
        setNotice(message.message || "");
        break;
      default:
        break;
    }
  }

  function login(event) {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setError("");
    setNotice("");
    setStatus("Đang kết nối tới server…");
    setPending("login");
    const previousSocket = socket.current;
    socket.current = null;
    previousSocket?.close();
    intentionalClose.current = false;
    const connection = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
    );
    socket.current = connection;
    connection.onopen = () =>
      connection.send(
        JSON.stringify({ type: "login", username: username.trim(), password }),
      );
    connection.onmessage = (event) => {
      if (socket.current !== connection) return;
      try {
        handleMessage(JSON.parse(event.data));
      } catch {
        setError("Phản hồi từ gateway không hợp lệ.");
        setPending("");
      }
    };
    connection.onerror = () => {
      if (socket.current !== connection) return;
      setError("Không kết nối được gateway. Kiểm tra cửa sổ chạy npm run dev.");
      setPending("");
    };
    connection.onclose = () => {
      if (socket.current !== connection || intentionalClose.current) return;
      setPending("");
      setStatus("");
      setError(
        (current) =>
          current || "Kết nối đã đóng. Hãy đăng nhập lại để tiếp tục.",
      );
    };
  }

  function logout() {
    intentionalClose.current = true;
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify({ type: "logout" }));
    socket.current?.close();
    socket.current = null;
    setStage("login");
    setAccount("");
    setCharacters([]);
    setWorld(null);
    setActiveCharacter(null);
    setPending("");
    setStatus("");
    setError("");
    setNotice("");
    setPosition({ x: 0, y: 0 });
    setCreateOpen(false);
  }

  function enterWorld() {
    if (!selectedCharacter) return;
    setError("");
    setPending("enter");
    setStatus("Đang tải dữ liệu nhân vật…");
    send({ type: "enter", name: selectedCharacter.name });
  }

  function createCharacter(event) {
    event.preventDefault();
    if (!/^[A-Za-z0-9_]{3,10}$/.test(newName)) {
      setError("Tên nhân vật cần 3–10 ký tự: chữ không dấu, số hoặc dấu _.");
      return;
    }
    setError("");
    setPending("create");
    send({ type: "create", name: newName, classId: Number(newClass) });
  }

  return (
    <main className={`app stage-${stage}`}>
      <div className="scene-host">
        <WorldScene
          character={renderedCharacter}
          world={renderedWorld}
          onPosition={onPosition}
          onReady={onSceneReady}
          onError={onSceneError}
          interactive={inWorld && !helpOpen && !createOpen}
        />
      </div>
      <div className="scene-shade" />
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            if (stage !== "login") logout();
          }}
          aria-label="MU Web, về màn hình đăng nhập"
        >
          <span className="brand-rune">
            M<span>U</span>
          </span>
          <span className="brand-copy">
            MU WEB<small>CHRONICLES OF LORENCIA</small>
          </span>
        </a>
        <div className="topbar-right">
          <span className={`connection-badge ${gatewayReady ? "ready" : ""}`}>
            <i />
            {isDemo
              ? "Cảnh thử"
              : account
                ? "Đã đăng nhập"
                : gatewayReady
                  ? "Gateway sẵn sàng"
                  : gatewayChecked
                    ? "Gateway offline"
                    : "Đang kết nối"}
          </span>
          <button
            className="icon-button help-button"
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Hướng dẫn chơi"
          >
            <Icon name="info" />
          </button>
          {inWorld && (
            <button
              className="icon-button"
              type="button"
              onClick={logout}
              aria-label="Thoát"
            >
              <Icon name="exit" />
            </button>
          )}
        </div>
      </header>

      {!sceneReady && (
        <div className="scene-loading">
          <span className="spinner" />
          Đang dựng thế giới…
        </div>
      )}
      {sceneError && (
        <div className="scene-failure" role="alert">
          <Icon name="info" />
          <span>
            {sceneError} Bạn vẫn có thể thử đăng nhập và xem nhân vật.
          </span>
        </div>
      )}

      {!inWorld && (
        <div className="lobby-layout">
          <section className="lobby-intro">
            <div className="eyebrow">
              <span />
              MU ONLINE · BROWSER CLIENT
            </div>
            <h1>
              {stage === "select" ? (
                <>
                  Chọn một
                  <br />
                  <em>huyền thoại.</em>
                </>
              ) : (
                <>
                  Cánh cổng
                  <br />
                  <em>mở lại.</em>
                </>
              )}
            </h1>
            <p>
              {stage === "select"
                ? `Chào ${account}. Những nhân vật của bạn đang chờ phía bên kia cánh cổng.`
                : "Trở về miền đất của những chiến binh. Một hành trình quen thuộc, ngay trong trình duyệt của bạn."}
            </p>
            <div className="intro-rule" />
            <div className="intro-features">
              <span>
                <Icon name="shield" size={17} />
                Dữ liệu nhân vật từ server
              </span>
              <span>
                <Icon name="sword" size={17} />
                Cảnh 3D tương tác
              </span>
            </div>
            <div className="prototype-note">
              Bản thử nghiệm · Cảnh 3D dùng model mẫu
            </div>
          </section>

          <section
            className="portal-card"
            aria-label={stage === "select" ? "Chọn nhân vật" : "Đăng nhập"}
          >
            <div className="card-ornament">✦</div>
            {stage === "login" ? (
              <>
                <div className="card-eyebrow">HÀNH TRÌNH BẮT ĐẦU TỪ ĐÂY</div>
                <h2>Chào mừng trở lại</h2>
                <p className="card-description">
                  Đăng nhập bằng tài khoản trên server MU của bạn.
                </p>
                <form onSubmit={login} className="login-form">
                  <label htmlFor="username">TÀI KHOẢN</label>
                  <div className="input-wrap">
                    <Icon name="user" size={18} />
                    <input
                      id="username"
                      name="username"
                      autoComplete="username"
                      placeholder="Tên tài khoản"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      maxLength={10}
                      required
                      disabled={!!pending}
                    />
                  </div>
                  <label htmlFor="password">MẬT KHẨU</label>
                  <div className="input-wrap">
                    <Icon name="lock" size={18} />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      maxLength={20}
                      required
                      disabled={!!pending}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                      }
                    >
                      <Icon name="eye" size={18} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="sample-account"
                    onClick={() => {
                      setUsername("pafa7a");
                      setPassword("123");
                    }}
                    disabled={!!pending}
                  >
                    Dùng tài khoản mẫu của repository
                  </button>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!!pending || !gatewayReady}
                  >
                    {pending ? (
                      <>
                        <span className="spinner" />
                        Đang kết nối…
                      </>
                    ) : (
                      <>
                        Đăng nhập
                        <Icon name="arrow" />
                      </>
                    )}
                  </button>
                </form>
                <div className="card-divider">
                  <span>HOẶC KHÁM PHÁ TRƯỚC</span>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setStage("demo");
                    setPosition({ x: 0, y: 0 });
                    setError("");
                  }}
                  disabled={!!pending}
                >
                  Khám phá cảnh mẫu
                  <Icon name="arrow" size={18} />
                </button>
                <p className="sample-note">
                  Cảnh mẫu chạy độc lập, không đăng nhập vào server.
                </p>
              </>
            ) : (
              <>
                <div className="card-eyebrow">NHÂN VẬT CỦA BẠN</div>
                <div className="card-title-row">
                  <h2>Chọn nhân vật</h2>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Tải lại nhân vật"
                    disabled={!!pending}
                    onClick={() => {
                      setPending("refresh");
                      setError("");
                      send({ type: "refresh" });
                    }}
                  >
                    <Icon name="refresh" size={18} />
                  </button>
                </div>
                <p className="card-description">
                  {characters.length} nhân vật · Tài khoản {account}
                </p>
                <div className="character-list">
                  {characters.length ? (
                    characters.map((character) => (
                      <button
                        key={character.name}
                        type="button"
                        className={`character-card ${character.name === selectedName ? "selected" : ""}`}
                        onClick={() => setSelectedName(character.name)}
                        disabled={!!pending}
                      >
                        <span
                          className={`character-emblem class-${character.classKey || "knight"}`}
                        >
                          <Icon
                            name={
                              character.classKey === "knight"
                                ? "sword"
                                : "shield"
                            }
                            size={25}
                          />
                        </span>
                        <span className="character-details">
                          <strong>{character.name}</strong>
                          <small>{character.className || "Chiến binh"}</small>
                        </span>
                        <span className="character-level">
                          <small>LV.</small>
                          {character.level}
                        </span>
                        <span className="selection-dot" />
                      </button>
                    ))
                  ) : (
                    <div className="empty-characters">
                      <Icon name="user" size={30} />
                      <p>
                        {pending
                          ? "Đang tải nhân vật…"
                          : "Tài khoản chưa có nhân vật."}
                      </p>
                      <small>Tạo một nhân vật để bắt đầu hành trình.</small>
                    </div>
                  )}
                </div>
                {capabilities.create && (
                  <button
                    className="create-trigger"
                    type="button"
                    onClick={() => {
                      setNewName("");
                      setError("");
                      setCreateOpen(true);
                    }}
                    disabled={!!pending || characters.length >= 5}
                  >
                    <Icon name="plus" size={17} />
                    Tạo nhân vật
                  </button>
                )}
                <button
                  className="primary-button"
                  type="button"
                  onClick={enterWorld}
                  disabled={!!pending || !selectedCharacter}
                >
                  {pending ? (
                    <>
                      <span className="spinner" />
                      Đang xử lý…
                    </>
                  ) : (
                    <>
                      Bước vào thế giới
                      <Icon name="arrow" />
                    </>
                  )}
                </button>
                <button className="text-button" type="button" onClick={logout}>
                  Đăng xuất
                </button>
              </>
            )}
            {status && (
              <div className="request-status" role="status">
                {status}
              </div>
            )}
            {error && (
              <div className="error-message" role="alert">
                <Icon name="info" size={17} />
                <span>{error}</span>
              </div>
            )}
          </section>
        </div>
      )}

      {inWorld && (
        <>
          <section className="player-panel">
            <div className="player-portrait">
              <Icon name="shield" size={30} />
              <span>{renderedCharacter.level}</span>
            </div>
            <div>
              <div className="player-name">{renderedCharacter.name}</div>
              <div className="player-class">{renderedCharacter.className}</div>
              <span className={`mode-tag ${isDemo ? "demo-tag" : ""}`}>
                {isDemo ? "NHÂN VẬT MẪU" : "NHÂN VẬT TỪ SERVER"}
              </span>
            </div>
          </section>
          <section className="map-caption">
            <div className="eyebrow">
              {isDemo ? "CẢNH THỬ NGHIỆM" : `MAP ${world?.map ?? 0} · CẢNH MẪU`}
            </div>
            <h2>
              {MAPS[renderedWorld?.map] ||
                `Vùng đất ${renderedWorld?.map ?? 0}`}
            </h2>
            <span>Cổng thành cổ</span>
          </section>
          <aside className="world-info">
            <span className="eyebrow">
              CHỈ SỐ {isDemo ? "MẪU" : "TỪ SERVER"}
            </span>
            <dl>
              <div>
                <dt>Sức mạnh</dt>
                <dd>{number(renderedWorld?.str)}</dd>
              </div>
              <div>
                <dt>Nhanh nhẹn</dt>
                <dd>{number(renderedWorld?.agi)}</dd>
              </div>
              <div>
                <dt>Thể lực</dt>
                <dd>{number(renderedWorld?.vit)}</dd>
              </div>
              <div>
                <dt>Năng lượng</dt>
                <dd>{number(renderedWorld?.ene)}</dd>
              </div>
              <div className="zen-row">
                <dt>Zen</dt>
                <dd>{number(renderedWorld?.money)}</dd>
              </div>
            </dl>
          </aside>
          <div className="movement-note">
            <Icon name="info" size={16} />
            <span>
              Di chuyển trong cảnh mẫu chưa đồng bộ với server. Chiến đấu chưa
              được hỗ trợ.
            </span>
          </div>
          <section className="world-hud">
            <div className="hud-resources">
              <ResourceBar
                label="HP"
                kind="health"
                value={renderedWorld?.life}
                max={renderedWorld?.maxLife}
              />
              <div className="hud-rune">✦</div>
              <ResourceBar
                label="MP"
                kind="mana"
                value={renderedWorld?.mana}
                max={renderedWorld?.maxMana}
              />
            </div>
            <div className="controls-hint">
              <span>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> Di chuyển
              </span>
              <i />
              <span>Click nền đất để đi</span>
              <i />
              <span>Cuộn để zoom</span>
            </div>
          </section>
          <div className="position-chip">
            <span>VỊ TRÍ TRONG CẢNH</span>
            <strong>
              {Math.round((renderedWorld?.x ?? 0) + position.x)},{" "}
              {Math.round((renderedWorld?.y ?? 0) + position.y)}
            </strong>
            <small>
              Điểm vào map: {renderedWorld?.x ?? 0}, {renderedWorld?.y ?? 0}
            </small>
          </div>
          {(error || notice) && (
            <div className="world-message" role={error ? "alert" : "status"}>
              <Icon name="info" size={17} />
              <span>{error || notice}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Đóng thông báo"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {!inWorld && (
        <footer className="lobby-footer">
          <span>
            MU WEB <i /> CLIENT 0.1
          </span>
          <span>THẾ GIỚI CŨ. CÁNH CỔNG MỚI.</span>
        </footer>
      )}

      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              type="button"
              aria-label="Đóng hướng dẫn"
              onClick={() => setHelpOpen(false)}
            >
              <Icon name="close" />
            </button>
            <div className="card-eyebrow">MU WEB · BẢN THỬ NGHIỆM</div>
            <h2 id="help-title">Bắt đầu hành trình</h2>
            <p>
              Đăng nhập bằng tài khoản MU, chọn nhân vật rồi bước vào cảnh 3D.
              Dữ liệu tài khoản và chỉ số được lấy từ server đang chạy.
            </p>
            <div className="help-item">
              <Icon name="shield" />
              <div>
                <strong>Kết nối server thật</strong>
                <p>
                  Cần MySQL, ConnectServer, JoinServer và GameServer hoạt động.
                  Client web không truy cập database trực tiếp.
                </p>
              </div>
            </div>
            <div className="help-item">
              <Icon name="sword" />
              <div>
                <strong>Khám phá cảnh mẫu</strong>
                <p>
                  Dùng WASD, phím mũi tên hoặc click nền đất để di chuyển; cuộn
                  để zoom. Vị trí này chỉ có trong trình duyệt.
                </p>
              </div>
            </div>
            <div className="help-item">
              <Icon name="info" />
              <div>
                <strong>Phạm vi hiện tại</strong>
                <p>
                  Model và bản đồ được dựng riêng cho bản thử. Chưa tích hợp tài
                  nguyên MuMain, đồng bộ nhiều người chơi hoặc chiến đấu.
                </p>
              </div>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => setHelpOpen(false)}
            >
              Đã hiểu
              <Icon name="arrow" />
            </button>
          </section>
        </div>
      )}
      {createOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!pending) setCreateOpen(false);
          }}
        >
          <section
            className="modal create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              type="button"
              disabled={!!pending}
              aria-label="Đóng tạo nhân vật"
              onClick={() => setCreateOpen(false)}
            >
              <Icon name="close" />
            </button>
            <div className="card-eyebrow">MỘT HUYỀN THOẠI MỚI</div>
            <h2 id="create-title">Tạo nhân vật</h2>
            <form onSubmit={createCharacter}>
              <label htmlFor="new-name">TÊN NHÂN VẬT</label>
              <input
                id="new-name"
                className="standalone-input"
                placeholder="3–10 ký tự không dấu"
                autoComplete="off"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                minLength={3}
                maxLength={10}
                pattern="[A-Za-z0-9_]{3,10}"
                required
                disabled={!!pending}
              />
              <label htmlFor="new-class">LỚP NHÂN VẬT</label>
              <select
                id="new-class"
                className="standalone-input"
                value={newClass}
                onChange={(event) => setNewClass(event.target.value)}
                disabled={!!pending}
              >
                <option value={16}>Dark Knight · Chiến binh</option>
                <option value={0}>Dark Wizard · Pháp sư</option>
                <option value={32}>Fairy Elf · Tiên nữ</option>
              </select>
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              <button
                className="primary-button"
                type="submit"
                disabled={!!pending}
              >
                {pending === "create" ? "Đang tạo…" : "Tạo nhân vật"}
                <Icon name="plus" />
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
