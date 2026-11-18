// ============================================================================
// CONFIGURATION: Render backend URL (use "http://localhost:3000" for local testing).
// ============================================================================
const BACKEND_URL = "https://drawing-game-backend-ul2q.onrender.com";

(function () {
  "use strict";

  const { WORD_POOL, getBotDrawingSegments } = window.GAME_WORDS;

  const MAX_ROUNDS = 10;
  const DRAW_SECONDS = 60;
  const WORD_CHOICE_SECONDS = 10;
  const INTRO_SPIN_DURATION_MS = 5000;
  const INTRO_HOLD_MS = 1800;
  const ROUND_END_PAUSE_MS = 3600;

  // DOM References
  const uiRoot = document.getElementById("ui-root");
  const threeCanvas = document.getElementById("three-canvas");
  const miniCanvas = document.getElementById("mini-whiteboard");

  const hudControls = document.getElementById("hud-controls");
  const btnSoundToggle = document.getElementById("btn-sound-toggle");
  const btnLeaveMatch = document.getElementById("btn-leave-match");

  const hudTopCenter = document.getElementById("hud-top-center");
  const hudRoundBadge = document.getElementById("hud-round-badge");
  const hudTimer = document.getElementById("hud-timer");
  const hudWordBox = document.getElementById("hud-word-box");
  const hudPhaseLabel = document.getElementById("hud-phase-label");

  const hudLeaderboard = document.getElementById("hud-leaderboard");
  const leaderboardList = document.getElementById("leaderboard-list");

  const btnChatToggle = document.getElementById("btn-chat-toggle");
  const chatUnreadDot = document.getElementById("chat-unread-dot");
  const chatPanel = document.getElementById("chat-panel");
  const chatMessages = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");

  const centerBanner = document.getElementById("center-banner");
  const centerBannerTitle = document.getElementById("center-banner-title");
  const centerBannerSub = document.getElementById("center-banner-sub");

  const wordChoiceModal = document.getElementById("word-choice-modal");
  const wordChoiceTimer = document.getElementById("word-choice-timer");
  const wordChoiceBar = document.getElementById("word-choice-bar");
  const wordOptionsGrid = document.getElementById("word-options-grid");

  const drawerPadModal = document.getElementById("drawer-pad-modal");
  const drawerSecretWord = document.getElementById("drawer-secret-word");
  const btnTogglePad = document.getElementById("btn-toggle-pad");
  const padBody = document.getElementById("pad-body");
  const btnClearBoard = document.getElementById("btn-clear-board");
  const colorSwatches = document.getElementById("color-swatches");
  const btnPaintGun = document.getElementById("btn-paint-gun");
  const btnEraser = document.getElementById("btn-eraser");
  const brushSizeSlider = document.getElementById("brush-size-slider");
  const brushSizeValue = document.getElementById("brush-size-value");

  const paintBlasterWrap = document.getElementById("paint-blaster-wrap");
  const btnPaintBlaster = document.getElementById("btn-paint-blaster");
  const paintBlasterTimer = document.getElementById("paint-blaster-timer");

  const menuOverlay = document.getElementById("menu-overlay");
  const serverStatusPill = document.getElementById("server-status-pill");
  const nicknameInput = document.getElementById("nickname-input");
  const btnCustomizeAvatar = document.getElementById("btn-customize-avatar");
  const menuError = document.getElementById("menu-error");
  const btnSinglePlayer = document.getElementById("btn-single-player");
  const createBotSelector = document.getElementById("create-bot-selector");
  const btnCreateRoom = document.getElementById("btn-create-room");
  const roomCodeInput = document.getElementById("room-code-input");
  const btnJoinRoom = document.getElementById("btn-join-room");

  const customizeOverlay = document.getElementById("customize-overlay");
  const btnCustomizeDone = document.getElementById("btn-customize-done");
  const prevShirt = document.getElementById("prev-shirt");
  const prevArmL = document.getElementById("prev-arm-l");
  const prevArmR = document.getElementById("prev-arm-r");
  const prevHairLayer = document.getElementById("prev-hair-layer");
  const shirtColorSwatches = document.getElementById("shirt-color-swatches");
  const customShirtPicker = document.getElementById("custom-shirt-picker");
  const hairColorSwatches = document.getElementById("hair-color-swatches");
  const customHairPicker = document.getElementById("custom-hair-picker");
  const hairstyleGrid = document.getElementById("hairstyle-grid");

  const lobbyOverlay = document.getElementById("lobby-overlay");
  const lobbyRoomCode = document.getElementById("lobby-room-code");
  const btnCopyCode = document.getElementById("btn-copy-code");
  const btnLobbyLeave = document.getElementById("btn-lobby-leave");
  const lobbyError = document.getElementById("lobby-error");
  const lobbyCountBadge = document.getElementById("lobby-count-badge");
  const lobbyBotControls = document.getElementById("lobby-bot-controls");
  const lobbyBotSelector = document.getElementById("lobby-bot-selector");
  const lobbyPlayerList = document.getElementById("lobby-player-list");
  const lobbyStatusMsg = document.getElementById("lobby-status-msg");
  const btnStartGame = document.getElementById("btn-start-game");

  const gameoverOverlay = document.getElementById("gameover-overlay");
  const podiumStage = document.getElementById("podium-stage");
  const gameoverRestList = document.getElementById("gameover-rest-list");
  const gameoverActions = document.getElementById("gameover-actions");
  const btnPlayAgain = document.getElementById("btn-play-again");
  const btnGameoverMenu = document.getElementById("btn-gameover-menu");
  const gameoverWaitNote = document.getElementById("gameover-wait-note");

  // Lightweight Web Audio Sound Effects
  const soundFX = {
    enabled: true,
    ctx: null,
    _ensureCtx() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    },
    tone(freq, dur, type = "sine", vol = 0.08, delay = 0) {
      const ctx = this._ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    },
    wheelTick() {
      this.tone(720, 0.035, "triangle", 0.05);
    },
    correct() {
      this.tone(523.25, 0.12, "sine", 0.1, 0);
      this.tone(659.25, 0.12, "sine", 0.1, 0.08);
      this.tone(783.99, 0.22, "sine", 0.11, 0.16);
    },
    roundTimeout() {
      this.tone(320, 0.16, "sawtooth", 0.06, 0);
      this.tone(240, 0.26, "sawtooth", 0.06, 0.14);
    },
    fanfare() {
      this.tone(523.25, 0.14, "triangle", 0.09, 0);
      this.tone(659.25, 0.14, "triangle", 0.09, 0.1);
      this.tone(783.99, 0.14, "triangle", 0.09, 0.2);
      this.tone(1046.5, 0.35, "triangle", 0.1, 0.3);
    }
  };

  // App State
  const appState = {
    mode: "menu", // "menu" | "multiplayer" | "singleplayer"
    selfId: null,
    hostId: null,
    roomCode: null,
    phase: "menu",
    round: 0,
    drawerId: null,
    players: [],
    bannerTimeout: null,
    chatOpen: false,
    createBotCount: 0,
    blasterReadyAt: 0,
    blasterTickerId: null
  };

  // Initialize Whiteboard & 3D Environment
  let scene3d = null;
  const whiteboard = new window.WhiteboardController(miniCanvas, {
    onStroke: (stroke) => {
      if (appState.mode === "multiplayer" && socket) {
        socket.emit("draw_stroke", stroke);
      }
    },
    onClear: () => {
      if (appState.mode === "multiplayer" && socket) {
        socket.emit("clear_board");
      }
    },
    onBoardUpdated: () => {
      if (scene3d) {
        scene3d.markBoardDirty();
      }
    }
  });

  scene3d = new window.Scene3DManager(threeCanvas, whiteboard.getCanvas(), {
    onWheelTick: () => soundFX.wheelTick()
  });

  // Avatar Customization State
  const avatarConfig = {
    shirtColor: "#3b82f6",
    hairColor: "#4a2c18",
    hairStyle: "classic"
  };

  // Restore saved nickname & avatar if present
  try {
    const saved = localStorage.getItem("sketchglade_nickname");
    if (saved) nicknameInput.value = saved;
    const savedAvatar = localStorage.getItem("doodledash_avatar");
    if (savedAvatar) {
      const parsed = JSON.parse(savedAvatar);
      if (parsed.shirtColor) avatarConfig.shirtColor = parsed.shirtColor;
      if (parsed.hairColor) avatarConfig.hairColor = parsed.hairColor;
      if (parsed.hairStyle) avatarConfig.hairStyle = parsed.hairStyle;
    }
  } catch (err) {
    // ignore storage restrictions
  }

  function saveAvatarConfig() {
    try {
      localStorage.setItem("doodledash_avatar", JSON.stringify(avatarConfig));
    } catch (err) {
      // ignore storage restrictions
    }
  }

  function renderAvatarPreview() {
    prevShirt.setAttribute("fill", avatarConfig.shirtColor);
    prevArmL.setAttribute("fill", avatarConfig.shirtColor);
    prevArmR.setAttribute("fill", avatarConfig.shirtColor);
    customShirtPicker.value = avatarConfig.shirtColor;
    customHairPicker.value = avatarConfig.hairColor;

    shirtColorSwatches.querySelectorAll(".c-swatch").forEach((el) => {
      el.classList.toggle(
        "active",
        el.dataset.color.toLowerCase() === avatarConfig.shirtColor.toLowerCase()
      );
    });
    hairColorSwatches.querySelectorAll(".c-swatch").forEach((el) => {
      el.classList.toggle(
        "active",
        el.dataset.color.toLowerCase() === avatarConfig.hairColor.toLowerCase()
      );
    });
    hairstyleGrid.querySelectorAll(".hairstyle-btn").forEach((el) => {
      el.classList.toggle("active", el.dataset.style === avatarConfig.hairStyle);
    });

    const hc = avatarConfig.hairColor;
    const hi = shadeHex(hc, 0.32);
    const lo = shadeHex(hc, -0.28);
    const style = avatarConfig.hairStyle;
    const G = "url(#hairGrad)";
    const strand = (d, w = 2.5, extra = "") =>
      `<path d="${d}" fill="none" stroke="${hi}" stroke-width="${w}" stroke-linecap="round" class="hair-anim shine" ${extra}/>`;
    const animG = (cls, ox, oy, inner, delay = 0) =>
      `<g class="hair-anim ${cls}" style="transform-origin:${ox}px ${oy}px;animation-delay:${delay}s">${inner}</g>`;

    let markup =
      `<defs><linearGradient id="hairGrad" x1="0" y1="0" x2="0.3" y2="1">` +
      `<stop offset="0" stop-color="${hi}"/><stop offset="0.55" stop-color="${hc}"/><stop offset="1" stop-color="${lo}"/>` +
      `</linearGradient></defs>`;

    if (style === "spiky") {
      markup += `<rect x="46" y="24" width="68" height="16" rx="7" fill="${G}"/>`;
      const spikes = [
        [54, 40, 2, 0.0],
        [66, 58, -6, 0.2],
        [80, 80, -12, 0.4],
        [94, 102, -6, 0.1],
        [106, 120, 2, 0.3],
        [73, 70, -2, 0.5],
        [87, 92, -2, 0.15]
      ];
      spikes.forEach(([bx, tx, ty, d]) => {
        markup += animG(
          "wobble",
          bx,
          30,
          `<polygon points="${bx - 9},32 ${tx},${ty} ${bx + 9},32" fill="${G}" stroke="${lo}" stroke-width="1"/>` +
            `<line x1="${bx}" y1="29" x2="${(bx + tx) / 2}" y2="${(30 + ty) / 2}" stroke="${hi}" stroke-width="2" stroke-linecap="round"/>`,
          d
        );
      });
    } else if (style === "bob") {
      markup += animG(
        "sway-soft",
        80,
        24,
        `<path d="M41 84 L41 42 Q41 16 80 16 Q119 16 119 42 L119 84 Q113 89 106 84 L106 46 L54 46 L54 84 Q47 89 41 84 Z" fill="${G}" stroke="${lo}" stroke-width="1.2"/>` +
          strand("M46 50 Q45 66 47 80") +
          strand("M114 50 Q115 66 113 80")
      );
      markup += animG(
        "wave",
        80,
        30,
        `<path d="M48 48 Q54 26 80 25 Q106 26 112 48 L103 42 L96 50 L88 42 L80 50 L72 42 L64 50 L57 42 Z" fill="${hc}"/>`
      );
      markup += strand("M58 26 Q80 16 102 26", 3);
    } else if (style === "bun") {
      markup += animG(
        "bob",
        80,
        24,
        `<line x1="58" y1="0" x2="100" y2="24" stroke="#b45309" stroke-width="3.2" stroke-linecap="round"/>` +
          `<circle cx="58" cy="0" r="3" fill="#ef4444"/>` +
          `<circle cx="80" cy="12" r="16" fill="${G}" stroke="${lo}" stroke-width="1.2"/>` +
          `<path d="M70 9 Q80 0 91 9 Q84 6 78 12" fill="none" stroke="${hi}" stroke-width="2.5" stroke-linecap="round"/>` +
          `<line x1="102" y1="-2" x2="62" y2="24" stroke="#92400e" stroke-width="3.2" stroke-linecap="round"/>` +
          `<circle cx="102" cy="-2" r="3" fill="#ef4444"/>` +
          `<rect x="68" y="24" width="24" height="6" rx="3" fill="${lo}"/>`
      );
      markup += `<rect x="46" y="25" width="68" height="18" rx="9" fill="${G}"/>`;
      markup += strand("M56 30 Q80 22 104 30", 2.5);
      markup += animG("sway", 54, 36, `<path d="M54 36 Q46 52 52 64" stroke="${hc}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
      markup += animG("sway", 106, 36, `<path d="M106 36 Q114 52 108 64" stroke="${hc}" stroke-width="4" fill="none" stroke-linecap="round"/>`, 0.6);
    } else if (style === "mohawk") {
      markup += `<rect x="49" y="28" width="62" height="9" rx="4" fill="${lo}" opacity="0.9"/>`;
      markup += `<line x1="52" y1="40" x2="52" y2="50" stroke="${hi}" stroke-width="1.6"/><line x1="108" y1="40" x2="108" y2="50" stroke="${hi}" stroke-width="1.6"/>`;
      markup += animG(
        "wave",
        80,
        34,
        `<path d="M68 35 L62 12 L72 20 L74 -6 L82 14 L88 -12 L92 16 L100 4 L94 35 Z" fill="${G}" stroke="${lo}" stroke-width="1.2"/>` +
          strand("M76 30 L78 6", 2.2) +
          strand("M86 30 L88 0", 2.2)
      );
    } else if (style === "curly") {
      const curls = [
        [52, 34, 11, lo], [108, 34, 11, lo], [46, 46, 8, lo], [114, 46, 8, lo],
        [58, 24, 12, hc], [102, 24, 12, hc], [70, 18, 13, hc], [90, 18, 13, hc],
        [80, 24, 14, hc], [80, 8, 11, hc], [66, 6, 9, hc], [94, 6, 9, hc]
      ];
      curls.forEach(([cx, cy, r, fill], i) => {
        markup += animG(
          "pulse",
          cx,
          cy,
          `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${lo}" stroke-width="0.8"/>` +
            `<path d="M${cx - r * 0.5} ${cy - r * 0.1} a${r * 0.45} ${r * 0.45} 0 1 1 ${r * 0.6} ${r * 0.35}" fill="none" stroke="${hi}" stroke-width="1.8" stroke-linecap="round"/>`,
          (i % 5) * 0.25
        );
      });
    } else if (style === "ponytail") {
      markup += animG(
        "swing",
        112,
        34,
        `<path d="M108 30 Q136 38 128 72 Q124 88 114 98 Q122 72 106 44 Z" fill="${G}" stroke="${lo}" stroke-width="1.2"/>` +
          strand("M116 42 Q128 58 121 82")
      );
      markup += `<rect x="104" y="27" width="10" height="11" rx="3.5" fill="#ec4899"/>`;
      markup += `<path d="M45 42 Q45 18 80 18 Q115 18 115 42 Z" fill="${G}"/>`;
      markup += strand("M58 24 Q80 15 102 24", 3);
      markup += animG("sway-soft", 98, 26, `<path d="M102 26 Q76 28 54 48 Q64 26 98 20 Z" fill="${hc}" stroke="${lo}" stroke-width="1"/>`);
    } else if (style === "anime") {
      markup += animG("sway", 46, 42, `<polygon points="47,38 34,72 54,46" fill="${G}"/>`, 0.3);
      markup += animG("sway", 114, 42, `<polygon points="113,38 126,72 106,46" fill="${G}"/>`, 0.9);
      markup += `<path d="M43 46 Q43 14 80 14 Q117 14 117 46 Z" fill="${G}" stroke="${lo}" stroke-width="1.2"/>`;
      markup += animG(
        "sway-soft",
        80,
        30,
        `<path d="M45 40 L51 64 L58 42 L66 51 L72 40 L80 55 L88 40 L94 51 L102 42 L109 64 L115 40 Z" fill="${hc}" stroke="${lo}" stroke-width="1"/>`
      );
      markup += strand("M56 24 Q80 14 104 24", 3);
      markup += animG(
        "boing",
        82,
        16,
        `<path d="M82 17 Q72 -8 94 -10 Q84 0 87 16 Z" fill="${hi}" stroke="${lo}" stroke-width="1"/>`
      );
    } else {
      // Classic swept quiff
      markup += `<rect x="46" y="24" width="68" height="18" rx="9" fill="${G}"/>`;
      markup += `<rect x="45" y="32" width="8" height="22" rx="4" fill="${lo}"/><rect x="107" y="32" width="8" height="22" rx="4" fill="${lo}"/>`;
      markup += animG(
        "sway-soft",
        60,
        30,
        `<path d="M50 34 Q56 4 98 10 Q114 14 112 26 Q96 14 76 22 Q64 26 50 34 Z" fill="${G}" stroke="${lo}" stroke-width="1.2"/>` +
          strand("M60 24 Q72 10 96 13", 3) +
          strand("M66 28 Q78 18 100 20", 2)
      );
    }

    const styleChanged = lastPreviewStyle !== style;
    lastPreviewStyle = style;
    prevHairLayer.innerHTML = `<g class="${styleChanged ? "hair-pop" : ""}">${markup}</g>`;
  }

  let lastPreviewStyle = null;

  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    if (amt >= 0) {
      r += (255 - r) * amt;
      g += (255 - g) * amt;
      b += (255 - b) * amt;
    } else {
      r *= 1 + amt;
      g *= 1 + amt;
      b *= 1 + amt;
    }
    const h = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  renderAvatarPreview();

  btnCustomizeAvatar.addEventListener("click", () => {
    renderAvatarPreview();
    menuOverlay.classList.add("hidden");
    customizeOverlay.classList.remove("hidden");
  });

  btnCustomizeDone.addEventListener("click", () => {
    saveAvatarConfig();
    customizeOverlay.classList.add("hidden");
    menuOverlay.classList.remove("hidden");
  });

  shirtColorSwatches.addEventListener("click", (e) => {
    const btn = e.target.closest(".c-swatch");
    if (!btn) return;
    avatarConfig.shirtColor = btn.dataset.color;
    saveAvatarConfig();
    renderAvatarPreview();
  });

  customShirtPicker.addEventListener("input", () => {
    avatarConfig.shirtColor = customShirtPicker.value;
    saveAvatarConfig();
    renderAvatarPreview();
  });

  hairColorSwatches.addEventListener("click", (e) => {
    const btn = e.target.closest(".c-swatch");
    if (!btn) return;
    avatarConfig.hairColor = btn.dataset.color;
    saveAvatarConfig();
    renderAvatarPreview();
  });

  customHairPicker.addEventListener("input", () => {
    avatarConfig.hairColor = customHairPicker.value;
    saveAvatarConfig();
    renderAvatarPreview();
  });

  hairstyleGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".hairstyle-btn");
    if (!btn) return;
    avatarConfig.hairStyle = btn.dataset.style;
    saveAvatarConfig();
    renderAvatarPreview();
  });

  // ============================================================================
  // UI Helpers
  // ============================================================================

  function showError(el, msg) {
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function showBanner(title, sub = "", durationMs = 3000) {
    if (appState.bannerTimeout) {
      clearTimeout(appState.bannerTimeout);
      appState.bannerTimeout = null;
    }
    centerBannerTitle.textContent = title;
    centerBannerSub.textContent = sub;
    centerBanner.classList.remove("hidden");
    if (durationMs > 0) {
      appState.bannerTimeout = setTimeout(() => {
        centerBanner.classList.add("hidden");
      }, durationMs);
    }
  }

  function hideBanner() {
    if (appState.bannerTimeout) {
      clearTimeout(appState.bannerTimeout);
      appState.bannerTimeout = null;
    }
    centerBanner.classList.add("hidden");
  }

  function clearChat() {
    chatMessages.innerHTML = "";
  }

  function appendChatMessage({ senderName, text, type = "guess" }) {
    const row = document.createElement("div");
    row.className = `chat-msg chat-msg--${type}`;

    if (type === "guess") {
      const senderEl = document.createElement("span");
      senderEl.className = "chat-sender";
      senderEl.textContent = `${senderName}:`;
      const bodyEl = document.createElement("span");
      bodyEl.textContent = ` ${text}`;
      row.appendChild(senderEl);
      row.appendChild(bodyEl);
    } else {
      row.textContent = text;
    }

    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (!appState.chatOpen && !btnChatToggle.classList.contains("hidden")) {
      chatUnreadDot.classList.remove("hidden");
    }

    while (chatMessages.children.length > 80) {
      chatMessages.removeChild(chatMessages.firstChild);
    }
  }

  function setChatOpen(open) {
    appState.chatOpen = Boolean(open);
    chatPanel.classList.toggle("hidden", !appState.chatOpen);
    btnChatToggle.classList.toggle("active", appState.chatOpen);
    if (appState.chatOpen) {
      chatUnreadDot.classList.add("hidden");
      chatMessages.scrollTop = chatMessages.scrollHeight;
      if (!chatInput.disabled) {
        chatInput.focus();
      }
    }
  }

  function updateTimerDisplay(seconds) {
    const sec = Math.max(0, Math.ceil(Number(seconds) || 0));
    hudTimer.textContent = `${sec}s`;
    hudTimer.classList.remove("warning", "urgent");
    if (sec <= 10) {
      hudTimer.classList.add("urgent");
    } else if (sec <= 25) {
      hudTimer.classList.add("warning");
    }
  }

  function updateLeaderboard(players = []) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    leaderboardList.innerHTML = "";

    sorted.forEach((player, index) => {
      const rank = index + 1;
      const li = document.createElement("li");
      li.className = "lb-item";
      if (player.id === appState.drawerId) li.classList.add("is-drawer");
      if (player.id === appState.selfId) li.classList.add("is-self");

      const badge = document.createElement("span");
      badge.className = `rank-badge rank-${rank <= 3 ? rank : "other"}`;
      badge.textContent =
        rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `#${rank}`;

      const dot = document.createElement("span");
      dot.className = "lb-dot";
      dot.style.background = player.seatColor || "#3b82f6";

      const name = document.createElement("span");
      name.className = "lb-name";
      const isDrawer = player.id === appState.drawerId;
      name.textContent = isDrawer ? `✏️ ${player.name}` : player.name;

      const score = document.createElement("span");
      score.className = "lb-score";
      score.textContent = `${player.score} pts`;

      li.appendChild(badge);
      li.appendChild(dot);
      li.appendChild(name);
      li.appendChild(score);
      leaderboardList.appendChild(li);
    });
  }

  function updateLobbyUI(roomState) {
    lobbyRoomCode.textContent = roomState.code || "----";
    lobbyCountBadge.textContent = `${roomState.players.length} / 5`;

    lobbyPlayerList.innerHTML = "";
    for (let i = 0; i < 5; i += 1) {
      const p = roomState.players[i];
      const li = document.createElement("li");
      if (p) {
        li.className = "lobby-player-item";
        const dot = document.createElement("span");
        dot.className = "lb-dot";
        dot.style.background = p.seatColor || "#3b82f6";

        const name = document.createElement("span");
        name.textContent = p.id === appState.selfId ? `${p.name} (You)` : p.name;

        li.appendChild(dot);
        li.appendChild(name);

        if (p.isHost || p.id === roomState.hostId) {
          const tag = document.createElement("span");
          tag.className = "host-tag";
          tag.textContent = "👑 Host";
          li.appendChild(tag);
        } else if (p.isBot) {
          const tag = document.createElement("span");
          tag.className = "host-tag";
          tag.textContent = "🤖 Bot";
          li.appendChild(tag);
        }
      } else {
        li.className = "lobby-player-item empty";
        li.textContent = "Waiting for player...";
      }
      lobbyPlayerList.appendChild(li);
    }

    const isHost = appState.selfId === roomState.hostId;
    const botCount = roomState.players.filter((p) => p.isBot).length;
    const humanCount = roomState.players.length - botCount;
    lobbyBotControls.classList.toggle("hidden", !isHost);
    if (isHost) {
      lobbyBotSelector.querySelectorAll(".bot-pill").forEach((pill) => {
        const n = Number(pill.dataset.bots);
        pill.classList.toggle("active", n === botCount);
        pill.disabled = humanCount + n > 5;
      });
    }

    const count = roomState.players.length;
    if (count < 3) {
      lobbyStatusMsg.textContent = `Need ${3 - count} more player(s) to start (min 3, max 5).`;
      btnStartGame.disabled = true;
    } else if (!isHost) {
      lobbyStatusMsg.textContent = "Ready! Waiting for the room host to start...";
      btnStartGame.disabled = true;
    } else {
      lobbyStatusMsg.textContent = "Minimum players reached — ready to start!";
      btnStartGame.disabled = false;
    }
  }

  function setChatInputState(canType, placeholder) {
    chatInput.disabled = !canType;
    chatSendBtn.disabled = !canType;
    chatInput.placeholder = placeholder;
    if (!canType) {
      chatInput.value = "";
    }
  }

  function showMatchHUD() {
    menuOverlay.classList.add("hidden");
    customizeOverlay.classList.add("hidden");
    lobbyOverlay.classList.add("hidden");
    gameoverOverlay.classList.add("hidden");
    hudControls.classList.remove("hidden");
    hudTopCenter.classList.remove("hidden");
    hudLeaderboard.classList.remove("hidden");
    btnChatToggle.classList.remove("hidden");
    startBlasterTicker();
  }

  function formatBlasterWait(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
  }

  function updateBlasterUI() {
    const inMatch =
      appState.mode !== "menu" &&
      appState.phase !== "menu" &&
      appState.phase !== "lobby" &&
      appState.phase !== "game_over";
    const isDrawingSelf =
      appState.phase === "drawing" && appState.selfId === appState.drawerId;

    if (!inMatch || isDrawingSelf) {
      paintBlasterWrap.classList.add("hidden");
      return;
    }

    paintBlasterWrap.classList.remove("hidden");
    const remSec = Math.max(0, Math.ceil((appState.blasterReadyAt - Date.now()) / 1000));
    if (remSec > 0) {
      btnPaintBlaster.disabled = true;
      btnPaintBlaster.classList.add("is-cooldown");
      btnPaintBlaster.classList.remove("is-ready");
      paintBlasterTimer.classList.remove("ready");
      paintBlasterTimer.textContent = `Wait ${formatBlasterWait(remSec)}`;
    } else if (appState.phase === "drawing" && appState.selfId !== appState.drawerId) {
      btnPaintBlaster.disabled = false;
      btnPaintBlaster.classList.remove("is-cooldown");
      btnPaintBlaster.classList.add("is-ready");
      paintBlasterTimer.classList.add("ready");
      paintBlasterTimer.textContent = "READY!";
    } else {
      btnPaintBlaster.disabled = true;
      btnPaintBlaster.classList.add("is-cooldown");
      btnPaintBlaster.classList.remove("is-ready");
      paintBlasterTimer.classList.add("ready");
      paintBlasterTimer.textContent = "Ready";
    }
  }

  function startBlasterTicker() {
    stopBlasterTicker();
    updateBlasterUI();
    appState.blasterTickerId = setInterval(updateBlasterUI, 250);
  }

  function stopBlasterTicker() {
    if (appState.blasterTickerId) {
      clearInterval(appState.blasterTickerId);
      appState.blasterTickerId = null;
    }
  }

  function showWordChoiceModal(words, totalSeconds, onSelect) {
    wordOptionsGrid.innerHTML = "";
    words.forEach((w) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "word-option-btn";
      btn.textContent = w;
      btn.addEventListener("click", () => {
        wordChoiceModal.classList.add("hidden");
        onSelect(w);
      });
      wordOptionsGrid.appendChild(btn);
    });
    updateWordChoiceTimerUI(totalSeconds, totalSeconds);
    wordChoiceModal.classList.remove("hidden");
  }

  function updateWordChoiceTimerUI(timeLeft, total = WORD_CHOICE_SECONDS) {
    const sec = Math.max(0, Math.ceil(timeLeft));
    wordChoiceTimer.textContent = `${sec}s`;
    const pct = Math.max(0, Math.min(100, (sec / total) * 100));
    wordChoiceBar.style.width = `${pct}%`;
  }

  function openDrawerPad(secretWord) {
    drawerSecretWord.textContent = secretWord.toUpperCase();
    padBody.classList.remove("hidden");
    btnTogglePad.textContent = "▾";
    btnEraser.classList.remove("active");
    btnPaintGun.classList.remove("active");
    whiteboard.setEraser(false);
    whiteboard.setPaintGun(false);
    drawerPadModal.classList.remove("hidden");
    uiRoot.classList.add("is-drawer-drawing");
    whiteboard.setEnabled(true);
  }

  function closeDrawerPad() {
    drawerPadModal.classList.add("hidden");
    uiRoot.classList.remove("is-drawer-drawing");
    whiteboard.setEnabled(false);
  }

  function renderGameOverPodium(rankings, canRestart) {
    stopBlasterTicker();
    paintBlasterWrap.classList.add("hidden");
    closeDrawerPad();
    wordChoiceModal.classList.add("hidden");
    hideBanner();

    podiumStage.innerHTML = "";
    gameoverRestList.innerHTML = "";

    // Display podium order: 2nd (left), 1st (center), 3rd (right)
    const order = [1, 0, 2];
    order.forEach((rankIdx) => {
      const entry = rankings[rankIdx];
      if (!entry) return;
      const place = rankIdx + 1;
      const col = document.createElement("div");
      col.className = "podium-col";

      const nameEl = document.createElement("div");
      nameEl.className = "podium-name";
      nameEl.textContent = entry.name;

      const ptsEl = document.createElement("div");
      ptsEl.className = "podium-pts";
      ptsEl.textContent = `${entry.score} pts`;

      const block = document.createElement("div");
      block.className = `podium-block podium-${place}`;
      block.textContent = place === 1 ? "🥇 1st" : place === 2 ? "🥈 2nd" : "🥉 3rd";

      col.appendChild(nameEl);
      col.appendChild(ptsEl);
      col.appendChild(block);
      podiumStage.appendChild(col);
    });

    rankings.slice(3).forEach((entry, idx) => {
      const li = document.createElement("li");
      li.className = "gameover-rest-item";
      const left = document.createElement("span");
      left.textContent = `#${idx + 4} ${entry.name}`;
      const right = document.createElement("span");
      right.textContent = `${entry.score} pts`;
      li.appendChild(left);
      li.appendChild(right);
      gameoverRestList.appendChild(li);
    });

    btnPlayAgain.classList.toggle("hidden", !canRestart);
    gameoverWaitNote.classList.toggle("hidden", canRestart);
    gameoverOverlay.classList.remove("hidden");
  }

  function returnToMainMenu() {
    spEngine.stop();
    if (appState.mode === "multiplayer" && socket && socket.connected && appState.roomCode) {
      socket.emit("leave_room");
    }

    appState.mode = "menu";
    appState.phase = "menu";
    appState.roomCode = null;
    appState.drawerId = null;
    appState.players = [];

    stopBlasterTicker();
    paintBlasterWrap.classList.add("hidden");
    closeDrawerPad();
    wordChoiceModal.classList.add("hidden");
    hideBanner();
    hudControls.classList.add("hidden");
    hudTopCenter.classList.add("hidden");
    hudLeaderboard.classList.add("hidden");
    btnChatToggle.classList.add("hidden");
    chatUnreadDot.classList.add("hidden");
    setChatOpen(false);
    customizeOverlay.classList.add("hidden");
    lobbyOverlay.classList.add("hidden");
    gameoverOverlay.classList.add("hidden");
    menuOverlay.classList.remove("hidden");

    whiteboard.clearLocal(false);
    scene3d.setDrawerSketching(false);
    scene3d.syncPlayers([], null);
    scene3d.setCameraMode("menu");
  }

  // ============================================================================
  // Mini-Whiteboard Toolbar Wiring
  // ============================================================================

  colorSwatches.addEventListener("click", (e) => {
    const btn = e.target.closest(".swatch");
    if (!btn) return;
    colorSwatches.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    btnEraser.classList.remove("active");
    whiteboard.setColor(btn.dataset.color);
  });

  btnPaintGun.addEventListener("click", () => {
    const nextState = !btnPaintGun.classList.contains("active");
    btnPaintGun.classList.toggle("active", nextState);
    if (nextState) {
      btnEraser.classList.remove("active");
      const activeSwatch = colorSwatches.querySelector(".swatch.active");
      if (activeSwatch) whiteboard.setColor(activeSwatch.dataset.color);
    }
    whiteboard.setPaintGun(nextState);
  });

  btnEraser.addEventListener("click", () => {
    const nextState = !btnEraser.classList.contains("active");
    btnEraser.classList.toggle("active", nextState);
    if (nextState) {
      btnPaintGun.classList.remove("active");
    }
    whiteboard.setEraser(nextState);
    if (!nextState) {
      const activeSwatch = colorSwatches.querySelector(".swatch.active");
      if (activeSwatch) whiteboard.setColor(activeSwatch.dataset.color);
    }
  });

  brushSizeSlider.addEventListener("input", () => {
    const val = Number(brushSizeSlider.value) || 8;
    brushSizeValue.textContent = String(val);
    whiteboard.setBrushSize(val);
  });

  btnClearBoard.addEventListener("click", () => {
    whiteboard.clearLocal(true);
  });

  btnTogglePad.addEventListener("click", () => {
    const collapsed = padBody.classList.toggle("hidden");
    btnTogglePad.textContent = collapsed ? "▴" : "▾";
  });

  btnSoundToggle.addEventListener("click", () => {
    soundFX.enabled = !soundFX.enabled;
    btnSoundToggle.textContent = soundFX.enabled ? "🔊 Sound On" : "🔇 Muted";
  });

  btnChatToggle.addEventListener("click", () => {
    setChatOpen(!appState.chatOpen);
  });

  btnPaintBlaster.addEventListener("click", () => {
    if (appState.phase !== "drawing" || appState.selfId === appState.drawerId) return;
    if (Date.now() < appState.blasterReadyAt) return;

    if (appState.mode === "singleplayer") {
      appState.blasterReadyAt = Date.now() + 400 * 1000;
      const seed = Math.floor(Math.random() * 1000000000);
      whiteboard.applyMegaBlackSplat(seed, false);
      soundFX.roundTimeout();
      const human = appState.players.find((p) => p.id === "human");
      const name = human ? human.name : "You";
      appendChatMessage({
        type: "system",
        text: `💥 ${name} fired the Paint Blaster! Huge black splat!`
      });
      showBanner("💥 PAINT BLASTER!", "Black paint splattered across the board!", 2000);
      updateBlasterUI();
    } else if (appState.mode === "multiplayer" && socket) {
      socket.emit("use_paint_blaster");
    }
  });

  btnLeaveMatch.addEventListener("click", () => {
    returnToMainMenu();
  });

  btnLobbyLeave.addEventListener("click", () => {
    returnToMainMenu();
  });

  btnGameoverMenu.addEventListener("click", () => {
    returnToMainMenu();
  });

  btnCopyCode.addEventListener("click", async () => {
    const code = lobbyRoomCode.textContent;
    if (!code || code === "----") return;
    try {
      await navigator.clipboard.writeText(code);
      btnCopyCode.textContent = "✓ Copied!";
      setTimeout(() => {
        btnCopyCode.textContent = "📋 Copy";
      }, 1500);
    } catch (err) {
      btnCopyCode.textContent = code;
    }
  });

  function damerauLevenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i += 1) dp[i][0] = i;
    for (let j = 0; j <= n; j += 1) dp[0][j] = j;

    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let val = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          val = Math.min(val, dp[i - 2][j - 2] + 1);
        }
        dp[i][j] = val;
      }
    }
    return dp[m][n];
  }

  function isCloseGuessMatch(rawGuess, secretWord) {
    const clean = (s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const g = clean(rawGuess);
    const t = clean(secretWord);
    if (!g || !t) return false;
    if (g === t) return true;

    const len = t.length;
    if (len <= 2 || Math.abs(g.length - len) > 2) return false;

    const dist = damerauLevenshtein(g, t);
    if (len <= 3) {
      return dist === 1 && g.length >= 3 && (g[0] === t[0] || g.length > len);
    }
    if (len <= 5) {
      return dist <= 1;
    }
    if (len <= 7) {
      return dist <= 1 || (dist === 2 && g.length >= 5 && g[0] === t[0]);
    }
    return dist <= 2;
  }

  // ============================================================================
  // Shared Nickname Helper
  // ============================================================================

  function getValidatedNickname() {
    const raw = nicknameInput.value.trim().replace(/\s+/g, " ").slice(0, 16);
    if (!raw) {
      showError(menuError, "Please enter a nickname first!");
      nicknameInput.focus();
      return null;
    }
    showError(menuError, "");
    try {
      localStorage.setItem("sketchglade_nickname", raw);
    } catch (err) {
      // ignore
    }
    return raw;
  }

  // ============================================================================
  // Single Player Mode Engine (Human vs. Bot Leo & Bot Maya)
  // ============================================================================

  const spEngine = {
    active: false,
    round: 0,
    phase: "idle",
    players: [],
    drawerId: null,
    lastDrawerId: null,
    currentWord: null,
    usedWords: new Set(),
    roundStartMs: 0,
    phaseEndsMs: 0,
    timers: [],
    intervals: [],

    addTimeout(fn, ms) {
      const id = setTimeout(fn, ms);
      this.timers.push(id);
      return id;
    },

    addInterval(fn, ms) {
      const id = setInterval(fn, ms);
      this.intervals.push(id);
      return id;
    },

    clearAllTimers() {
      this.timers.forEach((id) => clearTimeout(id));
      this.intervals.forEach((id) => clearInterval(id));
      this.timers = [];
      this.intervals = [];
    },

    stop() {
      this.active = false;
      this.clearAllTimers();
    },

    startMatch(humanName) {
      this.stop();
      this.active = true;
      appState.mode = "singleplayer";
      appState.selfId = "human";
      appState.hostId = "human";

      const botStyles = [
        "classic",
        "spiky",
        "bob",
        "bun",
        "mohawk",
        "curly",
        "ponytail",
        "anime"
      ];
      const botHairColors = [
        "#4a2c18",
        "#111827",
        "#eab308",
        "#d97706",
        "#2563eb",
        "#ec4899",
        "#9333ea",
        "#cbd5e1"
      ];
      const leoStyleIdx = Math.floor(Math.random() * botStyles.length);
      const mayaStyleIdx =
        (leoStyleIdx + 1 + Math.floor(Math.random() * (botStyles.length - 1))) %
        botStyles.length;
      const leoHairColor =
        botHairColors[Math.floor(Math.random() * botHairColors.length)];
      const mayaHairColor =
        botHairColors[Math.floor(Math.random() * botHairColors.length)];

      this.players = [
        {
          id: "human",
          name: humanName,
          score: 0,
          seatColor: avatarConfig.shirtColor,
          shirtColor: avatarConfig.shirtColor,
          hairColor: avatarConfig.hairColor,
          hairStyle: avatarConfig.hairStyle,
          isBot: false
        },
        {
          id: "bot_leo",
          name: "Bot Leo",
          score: 0,
          seatColor: "#ef4444",
          shirtColor: "#ef4444",
          hairColor: leoHairColor,
          hairStyle: botStyles[leoStyleIdx],
          isBot: true
        },
        {
          id: "bot_maya",
          name: "Bot Maya",
          score: 0,
          seatColor: "#22c55e",
          shirtColor: "#22c55e",
          hairColor: mayaHairColor,
          hairStyle: botStyles[mayaStyleIdx],
          isBot: true
        }
      ];

      this.round = 1;
      this.drawerId = null;
      this.lastDrawerId = null;
      this.currentWord = null;
      this.usedWords.clear();

      // Random initial Paint Blaster cooldown (60s-240s) for each player
      const randWaitMs = () => (60 + Math.floor(Math.random() * 181)) * 1000;
      appState.blasterReadyAt = Date.now() + randWaitMs();
      this.botBlasterReadyAt = {
        bot_leo: Date.now() + randWaitMs(),
        bot_maya: Date.now() + randWaitMs()
      };

      appState.players = this.players;
      appState.drawerId = null;

      clearChat();
      whiteboard.clearLocal(false);
      this.phase = "intro_spin";
      appState.phase = "intro_spin";
      showMatchHUD();
      setChatOpen(false);
      updateLeaderboard(this.players);
      scene3d.syncPlayers(this.players, null);
      setChatInputState(false, "Spinning for the first Drawer...");

      // Round 1 Intro Spin
      this.phase = "intro_spin";
      hudRoundBadge.textContent = `Round 1 / ${MAX_ROUNDS}`;
      updateTimerDisplay(0);
      hudWordBox.textContent = "🎡 SPINNING";
      hudPhaseLabel.textContent = "Selecting Round 1 Drawer...";
      appendChatMessage({
        type: "system",
        text: "Welcome to Single Player! Spinning the wheel for Round 1 Drawer..."
      });

      const firstDrawer =
        this.players[Math.floor(Math.random() * this.players.length)];

      scene3d.startIntroSpin(
        this.players,
        firstDrawer.id,
        INTRO_SPIN_DURATION_MS,
        () => {
          if (!this.active) return;
          soundFX.fanfare();
          showBanner(
            `🎯 ${firstDrawer.name} is the First Drawer!`,
            "Get ready for Round 1",
            INTRO_HOLD_MS - 150
          );
        }
      );

      this.addTimeout(() => {
        if (!this.active) return;
        scene3d.setCameraMode("gameplay");
        this.beginWordChoice(firstDrawer);
      }, INTRO_SPIN_DURATION_MS + INTRO_HOLD_MS);
    },

    pickUnusedWords(count = 3) {
      let avail = WORD_POOL.filter((w) => !this.usedWords.has(w));
      if (avail.length < count) {
        this.usedWords.clear();
        avail = [...WORD_POOL];
      }
      const copy = [...avail];
      const out = [];
      for (let i = 0; i < count && copy.length > 0; i += 1) {
        const idx = Math.floor(Math.random() * copy.length);
        out.push(copy.splice(idx, 1)[0]);
      }
      return out;
    },

    beginWordChoice(drawer) {
      this.clearAllTimers();
      this.phase = "word_choice";
      this.drawerId = drawer.id;
      this.lastDrawerId = drawer.id;
      this.currentWord = null;
      appState.drawerId = drawer.id;
      appState.phase = "word_choice";

      whiteboard.clearLocal(false);
      closeDrawerPad();
      updateBlasterUI();
      scene3d.setDrawerSketching(false);
      scene3d.syncPlayers(this.players, drawer.id);
      updateLeaderboard(this.players);

      hudRoundBadge.textContent = `Round ${this.round} / ${MAX_ROUNDS}`;
      hudWordBox.textContent = "...";
      hudPhaseLabel.textContent = `${drawer.name} is choosing a word...`;
      setChatInputState(false, `${drawer.name} is choosing a word...`);
      appendChatMessage({
        type: "system",
        text: `Round ${this.round}: ${drawer.name} is choosing a word...`
      });

      const options = this.pickUnusedWords(3);

      if (drawer.id === "human") {
        let timeLeft = WORD_CHOICE_SECONDS;
        updateTimerDisplay(timeLeft);
        showWordChoiceModal(options, WORD_CHOICE_SECONDS, (picked) => {
          if (!this.active || this.phase !== "word_choice") return;
          this.beginDrawing(picked);
        });

        this.phaseEndsMs = Date.now() + WORD_CHOICE_SECONDS * 1000;
        this.addInterval(() => {
          const rem = Math.max(0, Math.ceil((this.phaseEndsMs - Date.now()) / 1000));
          updateTimerDisplay(rem);
          updateWordChoiceTimerUI(rem, WORD_CHOICE_SECONDS);
          if (Date.now() >= this.phaseEndsMs) {
            wordChoiceModal.classList.add("hidden");
            this.beginDrawing(options[Math.floor(Math.random() * options.length)]);
          }
        }, 200);
      } else {
        updateTimerDisplay(WORD_CHOICE_SECONDS);
        this.addTimeout(() => {
          if (!this.active || this.phase !== "word_choice") return;
          const botWord = options[Math.floor(Math.random() * options.length)];
          this.beginDrawing(botWord);
        }, 1600);
      }
    },

    beginDrawing(word) {
      this.clearAllTimers();
      this.phase = "drawing";
      this.currentWord = word;
      this.usedWords.add(word);
      this.roundStartMs = Date.now();
      this.phaseEndsMs = this.roundStartMs + DRAW_SECONDS * 1000;
      appState.phase = "drawing";

      const drawer = this.players.find((p) => p.id === this.drawerId);
      scene3d.setDrawerSketching(true);
      updateTimerDisplay(DRAW_SECONDS);
      updateBlasterUI();

      if (drawer.id === "human") {
        hudWordBox.textContent = word.toUpperCase();
        hudPhaseLabel.textContent = "Your turn to draw! Bots are watching...";
        openDrawerPad(word);
        setChatInputState(false, "You are drawing! Bots are guessing...");
        this.scheduleBotsGuessingHuman(word);
      } else {
        const blanks = word
          .split("")
          .map(() => "_")
          .join(" ");
        hudWordBox.textContent = `${blanks} (${word.length})`;
        hudPhaseLabel.textContent = `${drawer.name} is drawing! Type your guess below`;
        setChatInputState(true, "Type your guess here...");
        this.scheduleBotDrawing(word);
        this.scheduleOtherBotGuessing(drawer.id, word);
      }

      appendChatMessage({
        type: "system",
        text: `${drawer.name} started drawing!`
      });

      this.addInterval(() => {
        const rem = Math.max(0, Math.ceil((this.phaseEndsMs - Date.now()) / 1000));
        updateTimerDisplay(rem);
        if (Date.now() >= this.phaseEndsMs) {
          this.finishRound("timeout", null);
        }
      }, 200);
    },

    scheduleBotDrawing(word) {
      const segments = getBotDrawingSegments(word);
      if (!segments.length) return;

      // Scale segment delays so total sketch finishes naturally in ~13-22s
      const rawTotal = segments.reduce((sum, s) => sum + (s.delayMs || 50), 0);
      const targetTotal = Math.min(22000, Math.max(12000, rawTotal));
      const timeScale = rawTotal > 0 ? targetTotal / rawTotal : 1;
      let idx = 0;

      const drawTick = () => {
        if (!this.active || this.phase !== "drawing") return;
        if (idx >= segments.length) {
          scene3d.setDrawerSketching(false);
          return;
        }
        const seg = segments[idx];
        whiteboard.applyStroke(seg, false);
        idx += 1;
        if (idx >= segments.length) {
          scene3d.setDrawerSketching(false);
          return;
        }
        const nextDelay = Math.max(18, (segments[idx].delayMs || 45) * timeScale);
        this.addTimeout(drawTick, nextDelay);
      };

      const initialDelay = Math.max(350, (segments[0].delayMs || 450) * timeScale);
      this.addTimeout(drawTick, initialDelay);
    },

    scheduleOtherBotGuessing(botDrawerId, secretWord) {
      const otherBot = this.players.find(
        (p) => p.isBot && p.id !== botDrawerId
      );
      if (!otherBot) return;

      const decoys = WORD_POOL.filter((w) => w !== secretWord);
      const pickDecoy = () => decoys[Math.floor(Math.random() * decoys.length)];

      // Realistic staggered guesses from the competing bot, giving human plenty of time first
      const schedule = [14000, 28000, 41000];
      schedule.forEach((delay) => {
        this.addTimeout(() => {
          if (!this.active || this.phase !== "drawing") return;
          appendChatMessage({
            senderName: otherBot.name,
            text: pickDecoy(),
            type: "guess"
          });
        }, delay);
      });

      // Late solve at ~51-56.5s if human still hasn't solved it
      const solveAt = 51000 + Math.random() * 5500;
      this.addTimeout(() => {
        if (!this.active || this.phase !== "drawing") return;
        this.finishRound("guessed", otherBot);
      }, solveAt);
    },

    scheduleBotsGuessingHuman(secretWord) {
      const bots = this.players.filter((p) => p.isBot);
      const decoys = WORD_POOL.filter((w) => w !== secretWord);
      const usedDecoys = new Set();

      const pickDecoy = () => {
        for (let i = 0; i < 15; i += 1) {
          const w = decoys[Math.floor(Math.random() * decoys.length)];
          if (!usedDecoys.has(w)) {
            usedDecoys.add(w);
            return w;
          }
        }
        return decoys[Math.floor(Math.random() * decoys.length)];
      };

      // Choose a realistic bot solve threshold based on drawing completeness
      let turnIdx = 0;
      const attemptBotGuess = () => {
        if (!this.active || this.phase !== "drawing") return;

        const bot = bots[turnIdx % bots.length];
        turnIdx += 1;

        const elapsedSec = (Date.now() - this.roundStartMs) / 1000;
        const completeness = whiteboard.getCompleteness();

        // Check if this bot's Paint Blaster is ready to sabotage the human drawer
        if (
          this.botBlasterReadyAt &&
          Date.now() >= (this.botBlasterReadyAt[bot.id] || Infinity) &&
          completeness >= 0.25
        ) {
          this.botBlasterReadyAt[bot.id] = Date.now() + 400 * 1000;
          const seed = Math.floor(Math.random() * 1000000000);
          whiteboard.applyMegaBlackSplat(seed, true);
          soundFX.roundTimeout();
          appendChatMessage({
            type: "system",
            text: `💥 ${bot.name} fired the Paint Blaster! Wipe or erase the board!`
          });
          showBanner(
            `💥 ${bot.name} SPLATTERED YOUR BOARD!`,
            "Use Eraser or Clear Board to keep drawing!",
            2400
          );
        }

        // Bots cannot solve an empty/barely started canvas; more complete drawings solve faster!
        const requiredSeconds = Math.max(20, 44 - completeness * 20);
        if (completeness >= 0.48 && elapsedSec >= requiredSeconds) {
          this.finishRound("guessed", bot);
          return;
        }

        if (completeness < 0.08 && elapsedSec < 12) {
          appendChatMessage({
            senderName: bot.name,
            text: turnIdx === 1 ? "Waiting to see the first lines..." : pickDecoy(),
            type: "guess"
          });
        } else {
          appendChatMessage({
            senderName: bot.name,
            text: pickDecoy(),
            type: "guess"
          });
        }

        const nextDelay = 5000 + Math.random() * 3000;
        this.addTimeout(attemptBotGuess, nextDelay);
      };

      this.addTimeout(attemptBotGuess, 6500);
    },

    handleHumanGuess(rawText) {
      if (!this.active || this.phase !== "drawing") return;
      if (this.drawerId === "human") return;
      const trimmed = rawText.trim();
      if (!trimmed) return;

      if (isCloseGuessMatch(trimmed, this.currentWord)) {
        const human = this.players.find((p) => p.id === "human");
        this.finishRound("guessed", human);
      } else {
        const human = this.players.find((p) => p.id === "human");
        appendChatMessage({
          senderName: human.name,
          text: trimmed,
          type: "guess"
        });
      }
    },

    finishRound(reason, winner) {
      this.clearAllTimers();
      this.phase = "round_end";
      appState.phase = "round_end";
      closeDrawerPad();
      updateBlasterUI();
      wordChoiceModal.classList.add("hidden");
      scene3d.setDrawerSketching(false);
      setChatInputState(false, "Next round starting soon...");

      const drawer = this.players.find((p) => p.id === this.drawerId);
      const wordUpper = (this.currentWord || "").toUpperCase();

      if (reason === "guessed" && winner) {
        const elapsedMs = Date.now() - this.roundStartMs;
        const pts = elapsedMs < 30000 ? 8 : 5;
        winner.score += pts;
        if (drawer) drawer.score += pts;

        soundFX.correct();
        scene3d.celebratePlayer(winner.id);
        appendChatMessage({
          type: "correct",
          text: `🎉 ${winner.name}: ${this.currentWord} (+${pts} pts)`
        });
        showBanner(
          `🎉 ${winner.name} guessed "${wordUpper}"!`,
          `${winner.name} +${pts} pts • ${drawer.name} +${pts} pts`,
          ROUND_END_PAUSE_MS - 300
        );
      } else {
        let delta = 0;
        if (drawer) {
          const prev = drawer.score;
          drawer.score = Math.max(0, drawer.score - 3);
          delta = drawer.score - prev;
        }
        soundFX.roundTimeout();
        appendChatMessage({
          type: "system",
          text: `⏰ Time's up! The word was ${wordUpper}.`
        });
        showBanner(
          `⏰ Time's Up! Word: ${wordUpper}`,
          drawer ? `${drawer.name} ${delta} pts` : "",
          ROUND_END_PAUSE_MS - 300
        );
      }

      hudWordBox.textContent = wordUpper;
      updateLeaderboard(this.players);
      scene3d.syncPlayers(this.players, this.drawerId);

      this.addTimeout(() => {
        if (!this.active) return;
        if (this.round >= MAX_ROUNDS) {
          this.finishMatch();
          return;
        }
        this.round += 1;
        const candidates = this.players.filter((p) => p.id !== this.lastDrawerId);
        const nextDrawer =
          candidates[Math.floor(Math.random() * candidates.length)] ||
          this.players[0];
        this.beginWordChoice(nextDrawer);
      }, ROUND_END_PAUSE_MS);
    },

    finishMatch() {
      this.clearAllTimers();
      this.phase = "game_over";
      appState.phase = "game_over";
      stopBlasterTicker();
      paintBlasterWrap.classList.add("hidden");
      scene3d.setCameraMode("gameover");
      scene3d.spawnConfetti(new THREE.Vector3(0.8, 5.5, -4.5), 90);
      soundFX.fanfare();

      const sorted = [...this.players].sort((a, b) => b.score - a.score);
      renderGameOverPodium(sorted, true);
    }
  };

  // ============================================================================
  // Multiplayer Socket.IO Client Wiring
  // ============================================================================

  let socket = null;

  function initSocketConnection() {
    if (typeof window.io !== "function") {
      serverStatusPill.className = "server-pill offline";
      serverStatusPill.textContent = "● Socket.IO unavailable — Single Player Ready";
      return;
    }

    socket = window.io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      timeout: 6000
    });

    socket.on("connect", () => {
      serverStatusPill.className = "server-pill online";
      serverStatusPill.textContent = "● Online Server Connected";
    });

    socket.on("disconnect", () => {
      serverStatusPill.className = "server-pill offline";
      serverStatusPill.textContent = "● Server Offline — Single Player Ready";
      if (appState.mode === "multiplayer") {
        showError(
          menuError,
          "Disconnected from the game server. Check connection or play Single Player."
        );
        returnToMainMenu();
      }
    });

    socket.on("connect_error", () => {
      serverStatusPill.className = "server-pill offline";
      serverStatusPill.textContent = "● Server Offline — Single Player Ready";
    });

    socket.on("room_state", (state) => {
      if (appState.mode !== "multiplayer") return;
      appState.hostId = state.hostId;
      appState.phase = state.phase;
      appState.round = state.round;
      appState.drawerId = state.drawerId;
      appState.players = state.players || [];

      if (state.phase === "lobby") {
        menuOverlay.classList.add("hidden");
        gameoverOverlay.classList.add("hidden");
        lobbyOverlay.classList.remove("hidden");
        hudControls.classList.add("hidden");
        hudTopCenter.classList.add("hidden");
        hudLeaderboard.classList.add("hidden");
        btnChatToggle.classList.remove("hidden");
        scene3d.setCameraMode("menu");
        setChatInputState(true, "Chat with your lobby...");
        updateLobbyUI(state);
      } else {
        updateLeaderboard(state.players);
      }

      scene3d.syncPlayers(state.players, state.drawerId);
    });

    socket.on("intro_spin", (payload) => {
      if (appState.mode !== "multiplayer") return;
      appState.phase = "intro_spin";
      showMatchHUD();
      whiteboard.clearLocal(false);
      closeDrawerPad();
      wordChoiceModal.classList.add("hidden");
      hideBanner();

      hudRoundBadge.textContent = `Round ${payload.round} / ${MAX_ROUNDS}`;
      updateTimerDisplay(0);
      hudWordBox.textContent = "🎡 SPINNING";
      hudPhaseLabel.textContent = "Spinning wheel for Round 1 Drawer...";
      setChatInputState(false, "Spinning for first Drawer...");

      scene3d.startIntroSpin(
        payload.players,
        payload.winnerId,
        payload.durationMs || INTRO_SPIN_DURATION_MS,
        () => {
          soundFX.fanfare();
          showBanner(
            `🎯 ${payload.winnerName} is the First Drawer!`,
            "Camera moving to stage...",
            INTRO_HOLD_MS
          );
        }
      );
    });

    socket.on("phase_word_choice", (payload) => {
      if (appState.mode !== "multiplayer") return;
      appState.phase = "word_choice";
      appState.drawerId = payload.drawerId;
      showMatchHUD();
      scene3d.setCameraMode("gameplay");
      scene3d.setDrawerSketching(false);
      closeDrawerPad();
      updateBlasterUI();
      whiteboard.clearLocal(false);

      appState.drawerId = payload.drawerId;
      hudRoundBadge.textContent = `Round ${payload.round} / ${payload.maxRounds}`;
      updateTimerDisplay(payload.timeLeft);
      hudWordBox.textContent = "...";
      hudPhaseLabel.textContent = `${payload.drawerName} is choosing a word...`;
      setChatInputState(false, `${payload.drawerName} is choosing a word...`);
      updateLeaderboard(appState.players);
      scene3d.syncPlayers(appState.players, payload.drawerId);
    });

    socket.on("drawer_word_options", (payload) => {
      if (appState.mode !== "multiplayer") return;
      showWordChoiceModal(payload.words, payload.timeLeft, (word) => {
        socket.emit("select_word", { word });
      });
    });

    socket.on("phase_drawing", (payload) => {
      if (appState.mode !== "multiplayer") return;
      wordChoiceModal.classList.add("hidden");
      appState.phase = "drawing";
      appState.drawerId = payload.drawerId;
      updateBlasterUI();

      hudRoundBadge.textContent = `Round ${payload.round} / ${payload.maxRounds}`;
      updateTimerDisplay(payload.timeLeft);
      scene3d.setDrawerSketching(true);

      if (appState.selfId !== payload.drawerId) {
        closeDrawerPad();
        updateBlasterUI();
        hudWordBox.textContent = `${payload.wordHint} (${payload.wordLength})`;
        hudPhaseLabel.textContent = `${payload.drawerName} is drawing! Guess below`;
        setChatInputState(true, "Type your guess here...");
      }
    });

    socket.on("drawer_secret_word", (payload) => {
      if (appState.mode !== "multiplayer") return;
      wordChoiceModal.classList.add("hidden");
      appState.phase = "drawing";
      hudWordBox.textContent = payload.word.toUpperCase();
      hudPhaseLabel.textContent = "Your turn to draw! Streamed live to the 3D board";
      openDrawerPad(payload.word);
      updateBlasterUI();
      setChatInputState(false, "You are drawing! Others are guessing...");
    });

    socket.on("timer_tick", (payload) => {
      if (appState.mode !== "multiplayer") return;
      updateTimerDisplay(payload.timeLeft);
      if (payload.phase === "word_choice" && !wordChoiceModal.classList.contains("hidden")) {
        updateWordChoiceTimerUI(payload.timeLeft, WORD_CHOICE_SECONDS);
      }
    });

    socket.on("draw_stroke", (stroke) => {
      if (appState.mode !== "multiplayer") return;
      whiteboard.applyStroke(stroke, false);
    });

    socket.on("clear_board", () => {
      if (appState.mode !== "multiplayer") return;
      whiteboard.clearLocal(false);
    });

    socket.on("chat_message", (msg) => {
      if (appState.mode !== "multiplayer") return;
      appendChatMessage(msg);
    });

    socket.on("blaster_state", (payload) => {
      if (appState.mode !== "multiplayer") return;
      appState.blasterReadyAt = Number(payload && payload.readyAt) || 0;
      updateBlasterUI();
    });

    socket.on("paint_blaster_splat", (payload) => {
      if (appState.mode !== "multiplayer") return;
      const isDrawer = appState.selfId === appState.drawerId;
      whiteboard.applyMegaBlackSplat(payload && payload.seed, isDrawer);
      soundFX.roundTimeout();
      if (isDrawer) {
        showBanner(
          `💥 ${payload.byName} SPLATTERED YOUR BOARD!`,
          "Use Eraser or Clear Board to recover!",
          2400
        );
      } else {
        showBanner(
          `💥 ${payload.byName} fired the Paint Blaster!`,
          "Black paint covered the board!",
          2000
        );
      }
    });

    socket.on("round_end", (payload) => {
      if (appState.mode !== "multiplayer") return;
      appState.phase = "round_end";
      closeDrawerPad();
      updateBlasterUI();
      wordChoiceModal.classList.add("hidden");
      scene3d.setDrawerSketching(false);
      setChatInputState(false, "Next round starting soon...");

      appState.players = payload.players || appState.players;
      updateLeaderboard(appState.players);
      scene3d.syncPlayers(appState.players, payload.drawerId);

      const wordUpper = (payload.word || "").toUpperCase();
      if (wordUpper) hudWordBox.textContent = wordUpper;

      if (payload.reason === "guessed" && payload.guesserName) {
        soundFX.correct();
        scene3d.celebratePlayer(payload.guesserId);
        showBanner(
          `🎉 ${payload.guesserName} guessed "${wordUpper}"!`,
          `${payload.guesserName} +${payload.pointsAwarded} pts • ${payload.drawerName} +${payload.pointsAwarded} pts`,
          ROUND_END_PAUSE_MS - 200
        );
      } else if (payload.reason === "timeout") {
        soundFX.roundTimeout();
        showBanner(
          `⏰ Time's Up! Word: ${wordUpper}`,
          `${payload.drawerName} ${payload.drawerDelta} pts`,
          ROUND_END_PAUSE_MS - 200
        );
      } else {
        showBanner(
          "Drawer Disconnected",
          wordUpper ? `The word was ${wordUpper}` : "Advancing to next round...",
          ROUND_END_PAUSE_MS - 200
        );
      }
    });

    socket.on("game_over", (payload) => {
      if (appState.mode !== "multiplayer") return;
      appState.phase = "game_over";
      stopBlasterTicker();
      paintBlasterWrap.classList.add("hidden");
      appState.hostId = payload.hostId;
      scene3d.setCameraMode("gameover");
      scene3d.spawnConfetti(new THREE.Vector3(0.8, 5.5, -4.5), 90);
      soundFX.fanfare();
      renderGameOverPodium(payload.rankings || [], appState.selfId === payload.hostId);
    });
  }

  initSocketConnection();

  // ============================================================================
  // Menu, Lobby, Chat & Game Over Actions
  // ============================================================================

  btnSinglePlayer.addEventListener("click", () => {
    const nickname = getValidatedNickname();
    if (!nickname) return;
    spEngine.startMatch(nickname);
  });

  createBotSelector.addEventListener("click", (e) => {
    const pill = e.target.closest(".bot-pill");
    if (!pill) return;
    appState.createBotCount = Math.max(0, Math.min(2, Number(pill.dataset.bots) || 0));
    createBotSelector.querySelectorAll(".bot-pill").forEach((el) => {
      el.classList.toggle("active", el === pill);
    });
  });

  lobbyBotSelector.addEventListener("click", (e) => {
    const pill = e.target.closest(".bot-pill");
    if (!pill || pill.disabled || appState.mode !== "multiplayer" || !socket) return;
    const botCount = Math.max(0, Math.min(2, Number(pill.dataset.bots) || 0));
    socket.emit("set_room_bots", { botCount }, (res) => {
      if (res && !res.ok) {
        showError(lobbyError, res.error || "Could not update bots.");
      } else {
        showError(lobbyError, "");
      }
    });
  });

  btnCreateRoom.addEventListener("click", () => {
    const nickname = getValidatedNickname();
    if (!nickname) return;
    if (!socket || !socket.connected) {
      showError(
        menuError,
        `Cannot reach server at ${BACKEND_URL}. Start the backend or try Single Player vs. Bots!`
      );
      return;
    }

    btnCreateRoom.disabled = true;
    socket.emit(
      "create_room",
      { nickname, avatar: avatarConfig, botCount: appState.createBotCount },
      (res) => {
      btnCreateRoom.disabled = false;
      if (!res || !res.ok) {
        showError(menuError, (res && res.error) || "Failed to create room.");
        return;
      }
      clearChat();
      appState.mode = "multiplayer";
      appState.selfId = res.playerId;
      appState.roomCode = res.roomCode;
      appState.hostId = res.room.hostId;
      appState.players = res.room.players;

      showError(lobbyError, "");
      menuOverlay.classList.add("hidden");
      lobbyOverlay.classList.remove("hidden");
      btnChatToggle.classList.remove("hidden");
      setChatOpen(false);
      setChatInputState(true, "Chat with your lobby...");
      appendChatMessage({
        type: "system",
        text: `Room ${res.roomCode} created! Share the code with 2–4 friends.`
      });
      updateLobbyUI(res.room);
      scene3d.syncPlayers(res.room.players, null);
    });
  });

  btnJoinRoom.addEventListener("click", () => {
    const nickname = getValidatedNickname();
    if (!nickname) return;

    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
      showError(menuError, "Please enter a 4-letter room code.");
      roomCodeInput.focus();
      return;
    }
    if (!socket || !socket.connected) {
      showError(
        menuError,
        `Cannot reach server at ${BACKEND_URL}. Start the backend or try Single Player vs. Bots!`
      );
      return;
    }

    btnJoinRoom.disabled = true;
    socket.emit("join_room", { roomCode: code, nickname, avatar: avatarConfig }, (res) => {
      btnJoinRoom.disabled = false;
      if (!res || !res.ok) {
        showError(menuError, (res && res.error) || "Could not join room.");
        return;
      }
      clearChat();
      appState.mode = "multiplayer";
      appState.selfId = res.playerId;
      appState.roomCode = res.roomCode;
      appState.hostId = res.room.hostId;
      appState.players = res.room.players;

      showError(lobbyError, "");
      menuOverlay.classList.add("hidden");
      lobbyOverlay.classList.remove("hidden");
      btnChatToggle.classList.remove("hidden");
      setChatOpen(false);
      setChatInputState(true, "Chat with your lobby...");
      updateLobbyUI(res.room);
      scene3d.syncPlayers(res.room.players, null);
    });
  });

  roomCodeInput.addEventListener("input", () => {
    roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z]/g, "");
  });

  btnStartGame.addEventListener("click", () => {
    if (appState.mode !== "multiplayer" || !socket) return;
    socket.emit("start_game", {}, (res) => {
      if (res && !res.ok) {
        showError(lobbyError, res.error || "Unable to start game.");
      } else {
        showError(lobbyError, "");
      }
    });
  });

  btnPlayAgain.addEventListener("click", () => {
    if (appState.mode === "singleplayer") {
      gameoverOverlay.classList.add("hidden");
      const human = appState.players.find((p) => p.id === "human");
      spEngine.startMatch(human ? human.name : "Player");
    } else if (appState.mode === "multiplayer" && socket) {
      socket.emit("play_again", {}, (res) => {
        if (res && !res.ok) {
          showBanner("Cannot Restart", res.error || "Error", 2500);
        } else {
          gameoverOverlay.classList.add("hidden");
        }
      });
    }
  });

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";

    if (appState.mode === "singleplayer") {
      spEngine.handleHumanGuess(text);
    } else if (appState.mode === "multiplayer" && socket) {
      socket.emit("submit_guess", { text });
    }
  });
})();
