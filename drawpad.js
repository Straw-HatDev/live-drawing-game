(function (global) {
  "use strict";

  const BOARD_WIDTH = 800;
  const BOARD_HEIGHT = 500;

  class WhiteboardController {
    constructor(miniCanvas, options = {}) {
      this.miniCanvas = miniCanvas;
      this.miniCtx = miniCanvas ? miniCanvas.getContext("2d") : null;

      // Offscreen backing canvas mirrored onto the massive 3D standing whiteboard
      this.boardCanvas = document.createElement("canvas");
      this.boardCanvas.width = BOARD_WIDTH;
      this.boardCanvas.height = BOARD_HEIGHT;
      this.boardCtx = this.boardCanvas.getContext("2d");

      if (this.miniCanvas) {
        this.miniCanvas.width = BOARD_WIDTH;
        this.miniCanvas.height = BOARD_HEIGHT;
      }

      this.onStroke = options.onStroke || (() => {});
      this.onClear = options.onClear || (() => {});
      this.onBoardUpdated = options.onBoardUpdated || (() => {});

      this.enabled = false;
      this.isDrawing = false;
      this.activePointerId = null;
      this.lastPoint = null;

      this.brushColor = "#111827";
      this.isEraser = false;
      this.isPaintGun = false;
      this.lastSplatterTime = 0;
      this.brushSize = 8;

      this.strokeCount = 0;
      this.inkDistance = 0;

      this.clearLocal(false);
      this._bindPointerEvents();
    }

    getCanvas() {
      return this.boardCanvas;
    }

    setEnabled(flag) {
      this.enabled = Boolean(flag);
      if (!this.enabled) {
        this.isDrawing = false;
        this.activePointerId = null;
        this.lastPoint = null;
      }
    }

    setColor(hex) {
      this.brushColor = hex;
      this.isEraser = false;
    }

    setEraser(active) {
      this.isEraser = Boolean(active);
      if (this.isEraser) {
        this.isPaintGun = false;
      }
    }

    setPaintGun(active) {
      this.isPaintGun = Boolean(active);
      if (this.isPaintGun) {
        this.isEraser = false;
      }
    }

    setBrushSize(size) {
      this.brushSize = Math.max(2, Math.min(36, Number(size) || 8));
    }

    getActiveColor() {
      return this.isEraser ? "#ffffff" : this.brushColor;
    }

    getCompleteness() {
      // Normalized measure (0..1) of how much meaningful drawing exists on the board
      const distFactor = Math.min(1, this.inkDistance / 1.8);
      const countFactor = Math.min(1, this.strokeCount / 4);
      return Math.min(1, distFactor * 0.75 + countFactor * 0.25);
    }

    clearLocal(emitEvent = false) {
      this.boardCtx.fillStyle = "#ffffff";
      this.boardCtx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      if (this.miniCtx) {
        this.miniCtx.fillStyle = "#ffffff";
        this.miniCtx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      }
      this.strokeCount = 0;
      this.inkDistance = 0;
      this.onBoardUpdated();
      if (emitEvent) {
        this.onClear();
      }
    }

    applyStroke(stroke, alsoMini = false) {
      if (!stroke) return;
      const color = stroke.color || "#111827";
      const size = Math.max(1, Math.min(48, Number(stroke.size) || 6));
      const x0 = stroke.x0 * BOARD_WIDTH;
      const y0 = stroke.y0 * BOARD_HEIGHT;
      const x1 = stroke.x1 * BOARD_WIDTH;
      const y1 = stroke.y1 * BOARD_HEIGHT;

      this._drawOnCtx(this.boardCtx, x0, y0, x1, y1, color, size, stroke.isDot);
      if (alsoMini && this.miniCtx) {
        this._drawOnCtx(this.miniCtx, x0, y0, x1, y1, color, size, stroke.isDot);
      }

      if (color.toLowerCase() !== "#ffffff") {
        const segDist = Math.hypot(stroke.x1 - stroke.x0, stroke.y1 - stroke.y0);
        this.inkDistance += segDist;
      }

      this.onBoardUpdated();
    }

    applyMegaBlackSplat(seed = Date.now(), alsoMini = false) {
      // Deterministic PRNG from seed so all players see the exact same black splatter
      let state = (Number(seed) || 1) >>> 0;
      const rand = () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };

      const drawSplat = (ctx) => {
        ctx.save();
        ctx.fillStyle = "#0b0f19";
        ctx.strokeStyle = "#0b0f19";
        ctx.lineCap = "round";

        // 1. Massive overlapping central black paint pools covering most of the board
        const cx = BOARD_WIDTH * (0.44 + rand() * 0.12);
        const cy = BOARD_HEIGHT * (0.44 + rand() * 0.12);
        for (let i = 0; i < 6; i += 1) {
          const ox = cx + (rand() - 0.5) * 230;
          const oy = cy + (rand() - 0.5) * 140;
          const r = 105 + rand() * 85;
          ctx.beginPath();
          ctx.arc(ox, oy, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2. Thick radiating splash tendrils across the canvas
        for (let i = 0; i < 18; i += 1) {
          const angle = (i / 18) * Math.PI * 2 + (rand() - 0.5) * 0.25;
          const len = 160 + rand() * 210;
          const ex = cx + Math.cos(angle) * len;
          const ey = cy + Math.sin(angle) * (len * 0.68);
          ctx.lineWidth = 18 + rand() * 28;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(ex, ey, 14 + rand() * 24, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Outer scattered black droplets & downward paint drips
        for (let i = 0; i < 32; i += 1) {
          const dx = 40 + rand() * (BOARD_WIDTH - 80);
          const dy = 25 + rand() * (BOARD_HEIGHT - 50);
          const dr = 8 + rand() * 26;
          ctx.beginPath();
          ctx.arc(dx, dy, dr, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      };

      // Reset random sequence by re-seeding before drawing each canvas so both match identically
      const initial = state;
      drawSplat(this.boardCtx);
      if (alsoMini && this.miniCtx) {
        state = initial;
        drawSplat(this.miniCtx);
      }

      // Reduce drawing progress so bots don't auto-guess after a board sabotage
      this.inkDistance *= 0.2;
      this.onBoardUpdated();
    }

    _drawOnCtx(ctx, x0, y0, x1, y1, color, size, isDot) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = size;

      if (isDot || (x0 === x1 && y0 === y1)) {
        ctx.beginPath();
        ctx.arc(x1, y1, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    }

    _getNormalizedPoint(event) {
      const rect = this.miniCanvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0.5, y: 0.5 };
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      return { x, y };
    }

    _emitSplatterBurst(pt) {
      const color = this.brushColor;
      const spreadY = 0.014 + (this.brushSize / 26) * 0.042;
      const spreadX = spreadY / 1.6;
      const dropCount = 9;

      // Central paint splat
      const centerSize = Math.max(4, this.brushSize * (0.75 + Math.random() * 0.35));
      const centerDot = {
        x0: pt.x,
        y0: pt.y,
        x1: pt.x,
        y1: pt.y,
        color,
        size: centerSize,
        isDot: true
      };
      this.applyStroke(centerDot, true);
      this.onStroke(centerDot);

      // Scattered splatter droplets around center
      for (let i = 0; i < dropCount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.65);
        const sx = Math.max(0, Math.min(1, pt.x + Math.cos(angle) * spreadX * r));
        const sy = Math.max(0, Math.min(1, pt.y + Math.sin(angle) * spreadY * r));
        const dSize = Math.max(2, this.brushSize * (0.22 + (1 - r * 0.6) * 0.45));
        const drop = {
          x0: sx,
          y0: sy,
          x1: sx,
          y1: sy,
          color,
          size: dSize,
          isDot: true
        };
        this.applyStroke(drop, true);
        this.onStroke(drop);
      }
      this.inkDistance += 0.035;
      this.lastSplatterTime = performance.now();
    }

    _bindPointerEvents() {
      if (!this.miniCanvas) return;

      // Explicitly block WebView/in-app browser scroll & zoom gestures while drawing
      const blockTouchScroll = (e) => {
        if (this.enabled) {
          e.preventDefault();
        }
      };
      this.miniCanvas.addEventListener("touchstart", blockTouchScroll, { passive: false });
      this.miniCanvas.addEventListener("touchmove", blockTouchScroll, { passive: false });

      this.miniCanvas.addEventListener("pointerdown", (e) => {
        if (!this.enabled) return;
        if (e.pointerType === "mouse" && e.button > 0) return;
        e.preventDefault();
        try {
          this.miniCanvas.setPointerCapture(e.pointerId);
        } catch (_) {
          // Some in-app WebViews throw on setPointerCapture
        }
        this.isDrawing = true;
        this.activePointerId = e.pointerId;

        const pt = this._getNormalizedPoint(e);
        this.lastPoint = pt;
        if (!this.isEraser) {
          this.strokeCount += 1;
        }

        if (this.isPaintGun) {
          this._emitSplatterBurst(pt);
          return;
        }

        const stroke = {
          x0: pt.x,
          y0: pt.y,
          x1: pt.x,
          y1: pt.y,
          color: this.getActiveColor(),
          size: this.isEraser ? Math.max(14, this.brushSize * 1.8) : this.brushSize,
          isDot: true
        };
        this.applyStroke(stroke, true);
        this.onStroke(stroke);
      });

      this.miniCanvas.addEventListener("pointermove", (e) => {
        if (!this.enabled || !this.isDrawing || e.pointerId !== this.activePointerId) {
          return;
        }
        e.preventDefault();
        const pt = this._getNormalizedPoint(e);
        const prev = this.lastPoint || pt;
        const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);

        if (this.isPaintGun) {
          const now = performance.now();
          if (now - this.lastSplatterTime >= 35 || dist >= 0.02) {
            this.lastPoint = pt;
            this._emitSplatterBurst(pt);
          }
          return;
        }

        if (dist < 0.0025) return;

        const stroke = {
          x0: prev.x,
          y0: prev.y,
          x1: pt.x,
          y1: pt.y,
          color: this.getActiveColor(),
          size: this.isEraser ? Math.max(14, this.brushSize * 1.8) : this.brushSize,
          isDot: false
        };
        this.lastPoint = pt;
        this.applyStroke(stroke, true);
        this.onStroke(stroke);
      });

      const endPointer = (e) => {
        if (e.pointerId !== this.activePointerId) return;
        this.isDrawing = false;
        this.activePointerId = null;
        this.lastPoint = null;
      };

      this.miniCanvas.addEventListener("pointerup", endPointer);
      this.miniCanvas.addEventListener("pointercancel", endPointer);
      this.miniCanvas.addEventListener("lostpointercapture", endPointer);
    }
  }

  global.WhiteboardController = WhiteboardController;
})(window);
