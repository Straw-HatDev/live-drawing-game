(function (global) {
  "use strict";

  const SLICE_PALETTE = [
    "#ef4444",
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#a855f7",
    "#06b6d4"
  ];

  function createRoundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  class Scene3DManager {
    constructor(canvas, boardCanvas, options = {}) {
      this.canvas = canvas;
      this.boardCanvas = boardCanvas;
      this.onWheelTick = options.onWheelTick || (() => {});

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xf5efe6);
      this.scene.fog = new THREE.Fog(0xf5efe6, 36, 86);

      const width = window.innerWidth || 1280;
      const height = window.innerHeight || 720;

      this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 150);
      this.camera.position.set(0.2, 8.0, 15.2);
      this.currentLookAt = new THREE.Vector3(0.4, 2.6, -4.5);
      this.desiredCamPos = new THREE.Vector3(0.2, 8.0, 15.2);
      this.desiredLookAt = new THREE.Vector3(0.4, 2.6, -4.5);
      this.cameraMode = "menu";

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: "high-performance"
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.setSize(width, height, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputEncoding = THREE.sRGBEncoding;

      this.clock = new THREE.Clock();
      this.elapsed = 0;

      this.clockSecondHand = null;
      this.confetti = [];
      this.guesserDesks = [];
      this.avatarMap = new Map();

      this.wheelPlayers = [];
      this.spinState = {
        active: false,
        startTime: 0,
        durationMs: 5000,
        startRot: 0,
        endRot: 0,
        lastPegIndex: -1,
        tickerAngle: 0,
        tickerVel: 0,
        winnerIndex: -1,
        highlightPulse: 0,
        onComplete: null
      };

      this.drawerIsSketching = false;
      this.currentDrawerId = null;

      this._setupLights();
      this._buildClassroomRoom();
      this._buildClassroomDecor();
      this._buildWhiteboard();
      this._buildDrawerDesk();
      this._buildGuesserDesks();
      this._buildSpinwheel();

      this._handleResize();
      window.addEventListener("resize", () => this._handleResize());
      this._animate();
    }

    _setupLights() {
      const hemi = new THREE.HemisphereLight(0xfffdf7, 0xd4c3a3, 0.92);
      hemi.position.set(0, 22, 0);
      this.scene.add(hemi);

      const sun = new THREE.DirectionalLight(0xfff7e6, 0.95);
      sun.position.set(-12, 22, 16);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 2;
      sun.shadow.camera.far = 65;
      sun.shadow.camera.left = -18;
      sun.shadow.camera.right = 18;
      sun.shadow.camera.top = 18;
      sun.shadow.camera.bottom = -18;
      sun.shadow.bias = -0.0005;
      this.scene.add(sun);

      const fill = new THREE.DirectionalLight(0xe0f2fe, 0.38);
      fill.position.set(14, 12, 8);
      this.scene.add(fill);
    }

    _buildClassroomRoom() {
      // Clean honey-oak hardwood plank floor
      const floorCanvas = document.createElement("canvas");
      floorCanvas.width = 512;
      floorCanvas.height = 512;
      const fctx = floorCanvas.getContext("2d");
      fctx.fillStyle = "#e6cfa8";
      fctx.fillRect(0, 0, 512, 512);
      const plankColors = ["#e2c799", "#ebd6b0", "#dcc08e", "#e7cfa3"];
      for (let row = 0; row < 8; row += 1) {
        const y = row * 64;
        const offset = (row % 2) * 128;
        for (let col = -1; col < 3; col += 1) {
          fctx.fillStyle = plankColors[(row + col + 4) % plankColors.length];
          fctx.fillRect(col * 256 + offset + 2, y + 2, 252, 60);
        }
        fctx.fillStyle = "rgba(120, 80, 40, 0.14)";
        fctx.fillRect(0, y, 512, 2);
      }
      const floorTex = new THREE.CanvasTexture(floorCanvas);
      floorTex.encoding = THREE.sRGBEncoding;
      floorTex.wrapS = THREE.RepeatWrapping;
      floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(9, 9);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(76, 76),
        new THREE.MeshLambertMaterial({ map: floorTex })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.scene.add(floor);

      // Soft light-red classroom rug with woven carpet print under student desks
      const rugCanvas = document.createElement("canvas");
      rugCanvas.width = 256;
      rugCanvas.height = 256;
      const rctx = rugCanvas.getContext("2d");
      rctx.fillStyle = "#f28b8b";
      rctx.fillRect(0, 0, 256, 256);
      // Tufted / woven carpet fiber print
      for (let y = 0; y < 256; y += 4) {
        rctx.fillStyle = y % 8 === 0 ? "rgba(185, 58, 58, 0.14)" : "rgba(255, 215, 215, 0.16)";
        rctx.fillRect(0, y, 256, 2);
      }
      for (let x = 0; x < 256; x += 4) {
        rctx.fillStyle = x % 8 === 0 ? "rgba(175, 52, 52, 0.1)" : "rgba(255, 225, 225, 0.12)";
        rctx.fillRect(x, 0, 2, 256);
      }
      // Subtle repeating diamond-tuft carpet pattern
      rctx.strokeStyle = "rgba(255, 238, 238, 0.28)";
      rctx.lineWidth = 2;
      for (let gy = 16; gy < 256; gy += 32) {
        for (let gx = 16; gx < 256; gx += 32) {
          rctx.beginPath();
          rctx.moveTo(gx, gy - 8);
          rctx.lineTo(gx + 8, gy);
          rctx.lineTo(gx, gy + 8);
          rctx.lineTo(gx - 8, gy);
          rctx.closePath();
          rctx.stroke();
          rctx.fillStyle = "rgba(205, 72, 72, 0.18)";
          rctx.fillRect(gx - 2, gy - 2, 4, 4);
        }
      }
      const rugTex = new THREE.CanvasTexture(rugCanvas);
      rugTex.encoding = THREE.sRGBEncoding;
      rugTex.wrapS = THREE.RepeatWrapping;
      rugTex.wrapT = THREE.RepeatWrapping;
      rugTex.repeat.set(8, 5);

      const rugOuter = new THREE.Mesh(
        new THREE.BoxGeometry(15.4, 0.02, 8.6),
        new THREE.MeshLambertMaterial({ color: 0xd96666 })
      );
      rugOuter.position.set(0.2, 0.01, 2.5);
      rugOuter.receiveShadow = true;
      this.scene.add(rugOuter);

      const rugInner = new THREE.Mesh(
        new THREE.BoxGeometry(14.6, 0.025, 7.8),
        new THREE.MeshLambertMaterial({ map: rugTex })
      );
      rugInner.position.set(0.2, 0.014, 2.5);
      rugInner.receiveShadow = true;
      this.scene.add(rugInner);

      const upperWallMat = new THREE.MeshLambertMaterial({ color: 0xa8dcfa });
      const frontWallMat = new THREE.MeshLambertMaterial({
        color: 0x1e3a8a,
        emissive: 0x0b1a33,
        emissiveIntensity: 0.25
      });
      const wainscotMat = new THREE.MeshLambertMaterial({ color: 0xd6b88d });
      const trimMat = new THREE.MeshLambertMaterial({ color: 0x9c7344 });

      // Front classroom wall behind whiteboard & spinwheel (z = -9.6)
      const frontUpper = new THREE.Mesh(new THREE.BoxGeometry(34, 13, 0.4), frontWallMat);
      frontUpper.position.set(0.5, 6.5, -9.6);
      frontUpper.receiveShadow = true;
      this.scene.add(frontUpper);

      const frontWainscot = new THREE.Mesh(new THREE.BoxGeometry(34, 2.3, 0.46), wainscotMat);
      frontWainscot.position.set(0.5, 1.15, -9.56);
      frontWainscot.receiveShadow = true;
      this.scene.add(frontWainscot);

      const frontRail = new THREE.Mesh(new THREE.BoxGeometry(34, 0.16, 0.52), trimMat);
      frontRail.position.set(0.5, 2.32, -9.54);
      this.scene.add(frontRail);

      // Left wall with 3 bright sunlit windows (x = -14.2)
      const leftUpper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 13, 36), upperWallMat);
      leftUpper.position.set(-14.2, 6.5, 4);
      leftUpper.receiveShadow = true;
      this.scene.add(leftUpper);

      const leftWainscot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.3, 36), wainscotMat);
      leftWainscot.position.set(-14.16, 1.15, 4);
      this.scene.add(leftWainscot);

      const skyPaneMat = new THREE.MeshBasicMaterial({ color: 0xe6f6ff });
      const windowFrameMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      [-5.2, -0.4, 4.4].forEach((wz) => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.8, 3.2), windowFrameMat);
        frame.position.set(-13.92, 5.4, wz);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 2.8), skyPaneMat);
        glass.position.set(-13.9, 5.4, wz);
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.12), windowFrameMat);
        mullion.position.set(-13.88, 5.4, wz);
        this.scene.add(frame, glass, mullion);
      });

      // Right wall with cork bulletin board (x = 15.2)
      const rightUpper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 13, 36), upperWallMat);
      rightUpper.position.set(15.2, 6.5, 4);
      rightUpper.receiveShadow = true;
      this.scene.add(rightUpper);

      const rightWainscot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.3, 36), wainscotMat);
      rightWainscot.position.set(15.16, 1.15, 4);
      this.scene.add(rightWainscot);

      const corkFrame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.1, 4.6), trimMat);
      corkFrame.position.set(14.92, 5.2, -2.5);
      const corkBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 2.75, 4.25),
        new THREE.MeshLambertMaterial({ color: 0xd99b66 })
      );
      corkBoard.position.set(14.9, 5.2, -2.5);
      this.scene.add(corkFrame, corkBoard);
      const noteColors = [0xfef08a, 0x93c5fd, 0xfda4af, 0x86efac];
      [-3.7, -2.8, -1.9, -1.2].forEach((nz, i) => {
        const note = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.72, 0.62),
          new THREE.MeshLambertMaterial({ color: noteColors[i % noteColors.length] })
        );
        note.position.set(14.8, 5.3 + (i % 2 ? 0.3 : -0.25), nz);
        this.scene.add(note);
      });
    }

    _buildClassroomDecor() {
      // Wall clock centered above the whiteboard
      const clockGroup = new THREE.Group();
      clockGroup.position.set(1.0, 8.65, -9.32);
      const clockRim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.68, 0.14, 24),
        new THREE.MeshLambertMaterial({ color: 0x334155 })
      );
      clockRim.rotation.x = Math.PI / 2;
      const clockFace = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.58, 0.16, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      clockFace.rotation.x = Math.PI / 2;
      const hourHand = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.28, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x0f172a })
      );
      hourHand.position.set(0.08, 0.08, 0.09);
      hourHand.rotation.z = -0.7;
      const secPivot = new THREE.Group();
      secPivot.position.set(0, 0, 0.1);
      const secHand = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.42, 0.03),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      secHand.position.y = 0.16;
      secPivot.add(secHand);
      clockGroup.add(clockRim, clockFace, hourHand, secPivot);
      this.scene.add(clockGroup);
      this.clockSecondHand = secPivot;

      // Colorful framed classroom posters flanking the whiteboard
      const posterSpecs = [
        { x: -10.2, y: 5.2, bg: "#dbeafe", title: "ABC", accent: "#2563eb", sub: "DRAW & GUESS" },
        { x: 10.6, y: 5.2, bg: "#fef3c7", title: "ART", accent: "#d97706", sub: "BE CREATIVE!" }
      ];
      posterSpecs.forEach((p) => {
        const pc = document.createElement("canvas");
        pc.width = 256;
        pc.height = 320;
        const ctx = pc.getContext("2d");
        ctx.fillStyle = p.bg;
        ctx.fillRect(0, 0, 256, 320);
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 14;
        ctx.strokeRect(14, 14, 228, 292);
        ctx.fillStyle = p.accent;
        ctx.textAlign = "center";
        ctx.font = '800 68px "Fredoka", "Nunito", sans-serif';
        ctx.fillText(p.title, 128, 150);
        ctx.fillStyle = "#334155";
        ctx.font = '800 24px "Nunito", sans-serif';
        ctx.fillText(p.sub, 128, 220);
        const tex = new THREE.CanvasTexture(pc);
        tex.encoding = THREE.sRGBEncoding;

        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(2.15, 2.65, 0.12),
          new THREE.MeshLambertMaterial({ color: 0x7c4a28 })
        );
        frame.position.set(p.x, p.y, -9.32);
        const art = new THREE.Mesh(
          new THREE.PlaneGeometry(1.9, 2.4),
          new THREE.MeshBasicMaterial({ map: tex })
        );
        art.position.set(p.x, p.y, -9.25);
        this.scene.add(frame, art);
      });

      // Back-right classroom bookshelf with colorful books
      const shelfGroup = new THREE.Group();
      shelfGroup.position.set(11.4, 0, -8.3);
      const woodMat = new THREE.MeshLambertMaterial({ color: 0x9c6635 });
      const shelfBody = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.0, 0.8), woodMat);
      shelfBody.position.y = 1.5;
      shelfBody.castShadow = true;
      shelfBody.receiveShadow = true;
      shelfGroup.add(shelfBody);

      const bookColors = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7];
      [1.1, 2.1].forEach((sy, rowIdx) => {
        for (let b = 0; b < 6; b += 1) {
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.56 + (b % 2) * 0.1, 0.52),
            new THREE.MeshLambertMaterial({ color: bookColors[(b + rowIdx * 2) % bookColors.length] })
          );
          book.position.set(-0.9 + b * 0.34, sy + 0.32, 0.25);
          book.castShadow = true;
          shelfGroup.add(book);
        }
      });

      // Potted classroom plant next to the bookshelf
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.26, 0.55, 10),
        new THREE.MeshLambertMaterial({ color: 0xc2410c })
      );
      pot.position.set(-2.0, 0.28, 0.2);
      pot.castShadow = true;
      const leaves = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.5, 0),
        new THREE.MeshLambertMaterial({ color: 0x22c55e })
      );
      leaves.position.set(-2.0, 0.85, 0.2);
      leaves.castShadow = true;
      shelfGroup.add(pot, leaves);

      this.scene.add(shelfGroup);
    }

    _buildWhiteboard() {
      const group = new THREE.Group();
      group.position.set(1.0, 0, -7.2);

      const boardW = 8.4;
      const boardH = 5.25; // Exact 1.6:1 aspect ratio matching 800x500 canvas
      const boardCenterY = 4.45;

      const woodFrameMat = new THREE.MeshLambertMaterial({ color: 0x7c4a28 });
      const metalLegMat = new THREE.MeshLambertMaterial({ color: 0x334155 });

      // Standing support pillars and feet
      [-3.5, 3.5].forEach((lx) => {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 6.9, 0.24),
          metalLegMat
        );
        post.position.set(lx, 3.45, -0.16);
        post.castShadow = true;
        post.receiveShadow = true;
        group.add(post);

        const foot = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.16, 1.55),
          metalLegMat
        );
        foot.position.set(lx, 0.08, -0.1);
        foot.castShadow = true;
        foot.receiveShadow = true;
        group.add(foot);
      });

      // Outer wooden frame box
      const backing = new THREE.Mesh(
        new THREE.BoxGeometry(boardW + 0.44, boardH + 0.44, 0.22),
        woodFrameMat
      );
      backing.position.set(0, boardCenterY, 0);
      backing.castShadow = true;
      backing.receiveShadow = true;
      group.add(backing);

      // Live CanvasTexture drawing surface
      this.boardTexture = new THREE.CanvasTexture(this.boardCanvas);
      this.boardTexture.encoding = THREE.sRGBEncoding;
      this.boardTexture.minFilter = THREE.LinearFilter;
      this.boardTexture.magFilter = THREE.LinearFilter;

      const surfaceMat = new THREE.MeshBasicMaterial({ map: this.boardTexture });
      const surface = new THREE.Mesh(
        new THREE.PlaneGeometry(boardW, boardH),
        surfaceMat
      );
      surface.position.set(0, boardCenterY, 0.12);
      group.add(surface);

      // Marker tray + colorful markers
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(boardW + 0.3, 0.12, 0.36),
        metalLegMat
      );
      tray.position.set(0, boardCenterY - boardH / 2 - 0.16, 0.22);
      tray.castShadow = true;
      group.add(tray);

      const markerColors = [0x111827, 0xef4444, 0x3b82f6, 0x22c55e];
      markerColors.forEach((col, i) => {
        const marker = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.42, 8),
          new THREE.MeshLambertMaterial({ color: col })
        );
        marker.rotation.z = Math.PI / 2;
        marker.position.set(-1.4 + i * 0.7, boardCenterY - boardH / 2 - 0.06, 0.28);
        group.add(marker);
      });

      this.scene.add(group);
    }

    _createDeskAndChair(isDrawerDesk = false) {
      const group = new THREE.Group();
      const woodMat = new THREE.MeshLambertMaterial({
        color: isDrawerDesk ? 0xa1622e : 0xc0844b
      });
      const darkWoodMat = new THREE.MeshLambertMaterial({ color: 0x5c361a });
      const frameMat = new THREE.MeshLambertMaterial({ color: 0x334155 });

      const deskW = isDrawerDesk ? 2.2 : 1.75;
      const deskD = isDrawerDesk ? 1.15 : 0.95;
      const deskH = 1.05;

      // Desk tabletop
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(deskW, 0.1, deskD),
        woodMat
      );
      top.position.set(0, deskH, 0);
      top.castShadow = true;
      top.receiveShadow = true;
      group.add(top);

      // Front modesty panel on drawer's wooden desk
      if (isDrawerDesk) {
        const apron = new THREE.Mesh(
          new THREE.BoxGeometry(deskW - 0.2, 0.55, 0.08),
          darkWoodMat
        );
        apron.position.set(0, deskH - 0.34, deskD / 2 - 0.1);
        apron.castShadow = true;
        group.add(apron);
      }

      // Desk legs
      const lx = deskW / 2 - 0.12;
      const lz = deskD / 2 - 0.12;
      [
        [-lx, -lz],
        [lx, -lz],
        [-lx, lz],
        [lx, lz]
      ].forEach(([px, pz]) => {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, deskH, 0.1),
          isDrawerDesk ? darkWoodMat : frameMat
        );
        leg.position.set(px, deskH / 2, pz);
        leg.castShadow = true;
        leg.receiveShadow = true;
        group.add(leg);
      });

      // Sketchpad / notebook prop on desk
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.04, 0.45),
        new THREE.MeshLambertMaterial({ color: 0xf8fafc })
      );
      pad.position.set(0, deskH + 0.07, 0.05);
      pad.castShadow = true;
      group.add(pad);

      // Chair positioned slightly behind desk (-Z in local space; avatar faces +Z)
      const chairGroup = new THREE.Group();
      chairGroup.position.set(0, 0, -0.78);

      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.09, 0.8),
        woodMat
      );
      seat.position.set(0, 0.62, 0);
      seat.castShadow = true;
      seat.receiveShadow = true;
      chairGroup.add(seat);

      const backrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.65, 0.09),
        woodMat
      );
      backrest.position.set(0, 0.98, -0.35);
      backrest.castShadow = true;
      chairGroup.add(backrest);

      [
        [-0.35, -0.32],
        [0.35, -0.32],
        [-0.35, 0.32],
        [0.35, 0.32]
      ].forEach(([cx, cz]) => {
        const cLeg = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.62, 0.08),
          isDrawerDesk ? darkWoodMat : frameMat
        );
        cLeg.position.set(cx, 0.31, cz);
        cLeg.castShadow = true;
        chairGroup.add(cLeg);
      });

      group.add(chairGroup);

      // Seat anchor where avatar sits facing +Z
      group.userData.seatAnchor = new THREE.Vector3(0, 0.66, -0.76);
      return group;
    }

    _buildDrawerDesk() {
      this.drawerDesk = this._createDeskAndChair(true);
      this.drawerDesk.position.set(6.7, 0, -5.0);
      // Local +Z faces toward the guessers (front-left toward center)
      this.drawerDesk.rotation.y = -0.34;
      this.scene.add(this.drawerDesk);
    }

    _buildGuesserDesks() {
      for (let i = 0; i < 4; i += 1) {
        const desk = this._createDeskAndChair(false);
        desk.visible = false;
        this.scene.add(desk);
        this.guesserDesks.push(desk);
      }
      this._layoutGuesserDesks(4);
    }

    _layoutGuesserDesks(count) {
      const clamped = Math.max(1, Math.min(4, count));
      const presets = {
        1: [[0.2, 3.1]],
        2: [
          [-1.8, 3.0],
          [2.2, 3.0]
        ],
        3: [
          [-3.2, 2.75],
          [0.2, 3.25],
          [3.6, 2.75]
        ],
        4: [
          [-4.6, 2.55],
          [-1.5, 3.25],
          [1.6, 3.25],
          [4.7, 2.55]
        ]
      };
      const coords = presets[clamped];
      const lookTarget = new THREE.Vector3(1.0, 0, -7.2);
      const guesserScale = clamped <= 2 ? 1.3 : 1.08;

      this.guesserDesks.forEach((desk, i) => {
        if (i < clamped) {
          const [gx, gz] = coords[i];
          desk.position.set(gx, 0, gz);
          const dx = lookTarget.x - gx;
          const dz = lookTarget.z - gz;
          // Local +Z is forward facing direction of seated character
          desk.rotation.y = Math.atan2(dx, dz);
          desk.scale.setScalar(guesserScale);
          desk.visible = true;
        } else {
          desk.visible = false;
        }
      });
    }

    _buildSpinwheel() {
      const root = new THREE.Group();
      root.position.set(-6.0, 0, -6.8);
      root.rotation.y = 0.22;

      const woodMat = new THREE.MeshLambertMaterial({ color: 0x7c4a28 });
      const goldMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
      const darkMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

      const hubY = 4.35;
      const wheelRadius = 2.22;

      // Base platform
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(3.1, 0.22, 1.8),
        woodMat
      );
      base.position.set(0, 0.11, -0.2);
      base.castShadow = true;
      base.receiveShadow = true;
      root.add(base);

      // Stand vertical support post
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, hubY + 0.2, 0.32),
        woodMat
      );
      post.position.set(0, (hubY + 0.2) / 2, -0.32);
      post.castShadow = true;
      post.receiveShadow = true;
      root.add(post);

      // Diagonal back brace
      const brace = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 2.8, 0.22),
        woodMat
      );
      brace.position.set(0, 1.35, -0.75);
      brace.rotation.x = 0.38;
      brace.castShadow = true;
      root.add(brace);

      // Spinning wheel container
      this.wheelSpinner = new THREE.Group();
      this.wheelSpinner.position.set(0, hubY, 0);

      // Backing disc cylinder
      const backDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.18, 40),
        darkMat
      );
      backDisc.rotation.x = Math.PI / 2;
      backDisc.castShadow = true;
      backDisc.receiveShadow = true;
      this.wheelSpinner.add(backDisc);

      // Golden rim ring
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(wheelRadius, 0.11, 12, 48),
        goldMat
      );
      rim.position.z = 0.04;
      rim.castShadow = true;
      this.wheelSpinner.add(rim);

      // Dynamic slice canvas texture
      this.wheelCanvas = document.createElement("canvas");
      this.wheelCanvas.width = 1024;
      this.wheelCanvas.height = 1024;
      this.wheelTexture = new THREE.CanvasTexture(this.wheelCanvas);
      this.wheelTexture.encoding = THREE.sRGBEncoding;

      const faceMesh = new THREE.Mesh(
        new THREE.CircleGeometry(wheelRadius - 0.06, 64),
        new THREE.MeshBasicMaterial({ map: this.wheelTexture })
      );
      faceMesh.position.z = 0.105;
      this.wheelSpinner.add(faceMesh);

      // Center hub cap
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.36, 0.16, 16),
        goldMat
      );
      hub.rotation.x = Math.PI / 2;
      hub.position.z = 0.13;
      this.wheelSpinner.add(hub);

      // Rim pegs container
      this.wheelPegsGroup = new THREE.Group();
      this.wheelSpinner.add(this.wheelPegsGroup);

      root.add(this.wheelSpinner);

      // Top ticker pointer mounted above 12 o'clock
      const tickerMount = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.36, 0.38),
        darkMat
      );
      tickerMount.position.set(0, hubY + wheelRadius + 0.36, -0.04);
      root.add(tickerMount);

      this.tickerPivot = new THREE.Group();
      this.tickerPivot.position.set(0, hubY + wheelRadius + 0.25, 0.16);

      const pointerShape = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 0.62, 4),
        new THREE.MeshLambertMaterial({ color: 0xfacc15 })
      );
      pointerShape.rotation.z = Math.PI;
      pointerShape.position.y = -0.28;
      pointerShape.castShadow = true;
      this.tickerPivot.add(pointerShape);

      root.add(this.tickerPivot);

      // Subtle highlight ring around wheel (glows on spin win)
      this.wheelGlowRing = new THREE.Mesh(
        new THREE.RingGeometry(wheelRadius + 0.14, wheelRadius + 0.3, 48),
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0
        })
      );
      this.wheelGlowRing.position.set(0, hubY, 0.08);
      root.add(this.wheelGlowRing);

      this.spinwheelRoot = root;
      this.scene.add(root);

      this.updateWheelPlayers([
        { id: "p1", name: "Alex" },
        { id: "p2", name: "Bot Leo" },
        { id: "p3", name: "Bot Maya" }
      ]);
    }

    updateWheelPlayers(players, highlightIndex = -1) {
      this.wheelPlayers = players && players.length ? players : [{ id: "0", name: "Ready" }];
      const count = this.wheelPlayers.length;
      const ctx = this.wheelCanvas.getContext("2d");
      const size = 1024;
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.48;
      const sliceAngle = (Math.PI * 2) / count;

      ctx.clearRect(0, 0, size, size);

      for (let i = 0; i < count; i += 1) {
        const start = -Math.PI / 2 + i * sliceAngle;
        const end = start + sliceAngle;
        const mid = (start + end) / 2;
        const isWinner = i === highlightIndex;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end);
        ctx.closePath();

        ctx.fillStyle = SLICE_PALETTE[i % SLICE_PALETTE.length];
        ctx.fill();

        if (isWinner) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
          ctx.fill();
        }

        ctx.lineWidth = isWinner ? 12 : 6;
        ctx.strokeStyle = isWinner ? "#fef08a" : "#ffffff";
        ctx.stroke();

        // Draw player nickname along slice radius
        ctx.translate(cx, cy);
        ctx.rotate(mid);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const label = String(this.wheelPlayers[i].name || "Player").slice(0, 14);
        const fontSize = count <= 3 ? 50 : count <= 4 ? 44 : 38;
        ctx.font = `800 ${fontSize}px "Nunito", "Segoe UI", sans-serif`;
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(15, 23, 42, 0.6)";
        ctx.strokeText(label, radius - 42, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, radius - 42, 0);
        ctx.restore();
      }

      this.wheelTexture.needsUpdate = true;

      // Rebuild rim pegs aligned with slice boundaries
      while (this.wheelPegsGroup.children.length > 0) {
        this.wheelPegsGroup.remove(this.wheelPegsGroup.children[0]);
      }
      const pegMat = new THREE.MeshLambertMaterial({ color: 0xfef3c7 });
      const pegGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 8);
      for (let i = 0; i < count; i += 1) {
        // Canvas angle -PI/2 + i*sliceAngle maps to 3D polar angle PI/2 - i*sliceAngle
        const phi = Math.PI / 2 - i * sliceAngle;
        const peg = new THREE.Mesh(pegGeo, pegMat);
        peg.rotation.x = Math.PI / 2;
        peg.position.set(Math.cos(phi) * 2.08, Math.sin(phi) * 2.08, 0.13);
        this.wheelPegsGroup.add(peg);
      }
    }

    startIntroSpin(players, winnerId, durationMs = 5000, onComplete) {
      this.updateWheelPlayers(players, -1);
      const count = this.wheelPlayers.length;
      const sliceAngle = (Math.PI * 2) / count;
      let winnerIndex = this.wheelPlayers.findIndex((p) => p.id === winnerId);
      if (winnerIndex < 0) winnerIndex = 0;

      // Normalize current rotation into [0, 2*PI)
      const baseRot = ((this.wheelSpinner.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      this.wheelSpinner.rotation.z = baseRot;

      // Target Z rotation so center of winnerIndex lands under 12-o'clock top ticker
      const jitter = (Math.random() - 0.5) * sliceAngle * 0.42;
      const targetMod = ((winnerIndex + 0.5) * sliceAngle + jitter) % (Math.PI * 2);
      const fullSpins = 7 * Math.PI * 2;
      const endRot = fullSpins + targetMod;

      this.spinState = {
        active: true,
        startTime: performance.now(),
        durationMs,
        startRot: baseRot,
        endRot,
        lastPegIndex: Math.floor((baseRot / sliceAngle)),
        tickerAngle: 0,
        tickerVel: 0,
        winnerIndex,
        highlightPulse: 0,
        onComplete
      };

      this.setCameraMode("spin");
    }

    _getSpecialDecalSkin(decalId) {
      const skins = {
        chief: {
          id: "chief",
          label: "Chief",
          shirt: "#081226",
          shirt2: "#0f294a",
          sleeve: "#0369a1",
          accent: "#38bdf8",
          accent2: "#a78bfa",
          text: "#ffffff"
        },
        cbert: {
          id: "cbert",
          label: "Cbert",
          shirt: "#450a0a",
          shirt2: "#991b1b",
          sleeve: "#b91c1c",
          accent: "#fb7185",
          accent2: "#fde047",
          text: "#ffffff"
        },
        hunter: {
          id: "hunter",
          label: "Hunter",
          shirt: "#022c22",
          shirt2: "#065f46",
          sleeve: "#047857",
          accent: "#34d399",
          accent2: "#bef264",
          text: "#ecfdf5"
        },
        fours: {
          id: "fours",
          label: "Fours",
          shirt: "#2e1065",
          shirt2: "#581c87",
          sleeve: "#7e22ce",
          accent: "#fde047",
          accent2: "#f472b6",
          text: "#fef9c3"
        },
        tubz: {
          id: "tubz",
          label: "Tubz",
          shirt: "#1c1917",
          shirt2: "#431407",
          sleeve: "#ea580c",
          accent: "#fb923c",
          accent2: "#facc15",
          text: "#fff7ed"
        },
        lenny: {
          id: "lenny",
          label: "Lenny",
          shirt: "#2a0a0a",
          shirt2: "#7c2d12",
          sleeve: "#b91c1c",
          accent: "#facc15",
          accent2: "#fb923c",
          text: "#fef9c3"
        },
        remig: {
          id: "remig",
          label: "Remig",
          shirt: "#f8fafc",
          shirt2: "#e7d8b9",
          sleeve: "#d6be8a",
          accent: "#ca8a04",
          accent2: "#0284c7",
          text: "#fef3c7"
        }
      };
      return skins[decalId] || null;
    }

    _drawSpecialDecalTexture(entry, elapsedSec) {
      const { id, skin, ctx, tex } = entry;
      const w = 256;
      const h = 256;

      // Diagonal rich jersey gradient
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, skin.shirt);
      bg.addColorStop(1, skin.shirt2);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Unique animated motif per Special Decal skin
      ctx.save();
      if (id === "chief") {
        ctx.translate(128, 128);
        ctx.rotate(elapsedSec * 0.9);
        ctx.strokeStyle = skin.accent;
        ctx.lineWidth = 4;
        ctx.setLineDash([16, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, 88, 0, Math.PI * 2);
        ctx.stroke();
        ctx.rotate(-elapsedSec * 1.6);
        ctx.strokeStyle = skin.accent2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 72, 0, Math.PI * 1.4);
        ctx.stroke();
      } else if (id === "cbert") {
        const shift = (elapsedSec * 36) % 44;
        ctx.strokeStyle = skin.accent2;
        ctx.lineWidth = 5;
        for (let y = 40; y <= 230; y += 44) {
          ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(elapsedSec * 4 + y));
          ctx.beginPath();
          ctx.moveTo(24, y + 34 - shift * 0.4);
          ctx.lineTo(128, y - shift * 0.4);
          ctx.lineTo(232, y + 34 - shift * 0.4);
          ctx.stroke();
        }
      } else if (id === "hunter") {
        const pulse = 0.65 + 0.35 * Math.sin(elapsedSec * 3.5);
        ctx.strokeStyle = skin.accent;
        ctx.lineWidth = 4;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.moveTo(128, 36);
        ctx.lineTo(212, 128);
        ctx.lineTo(128, 220);
        ctx.lineTo(44, 128);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = skin.accent2;
        ctx.beginPath();
        ctx.moveTo(0, 128);
        ctx.lineTo(44, 128);
        ctx.moveTo(212, 128);
        ctx.lineTo(256, 128);
        ctx.stroke();
      } else if (id === "fours") {
        for (let i = 0; i < 6; i += 1) {
          const ang = elapsedSec * 0.9 + (i * Math.PI) / 3;
          const sx = 128 + Math.cos(ang) * 86;
          const sy = 128 + Math.sin(ang) * 76;
          const r = 4 + 3 * Math.sin(elapsedSec * 5 + i);
          ctx.fillStyle = i % 2 === 0 ? skin.accent : skin.accent2;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(2, r), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (id === "remig") {
        // Egyptian gold pyramid & sun-disc motif on white/beige robes
        const glow = 0.55 + 0.45 * Math.sin(elapsedSec * 2.8);
        ctx.strokeStyle = skin.accent;
        ctx.lineWidth = 5;
        ctx.globalAlpha = glow;
        ctx.beginPath();
        ctx.moveTo(46, 214);
        ctx.lineTo(128, 48);
        ctx.lineTo(210, 214);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = skin.accent2;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(16, 224);
        ctx.lineTo(240, 224);
        ctx.stroke();
      } else {
        ctx.lineWidth = 6;
        for (let row = 0; row < 2; row += 1) {
          ctx.strokeStyle = row === 0 ? skin.accent : skin.accent2;
          ctx.globalAlpha = 0.78;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 12) {
            const y = 176 + row * 22 + Math.sin(x * 0.055 - elapsedSec * 5 + row) * 10;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.restore();

      // Athletic V-collar trim
      ctx.strokeStyle = skin.accent;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(74, 0);
      ctx.lineTo(128, 42);
      ctx.lineTo(182, 0);
      ctx.stroke();

      // Sleek chest badge pill
      ctx.fillStyle = "rgba(2, 6, 23, 0.74)";
      ctx.strokeStyle = skin.accent;
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(24, 92, 208, 72, 24);
      } else {
        ctx.rect(24, 92, 208, 72);
      }
      ctx.fill();
      ctx.stroke();

      // Bold glowing skin text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '800 50px "Fredoka", "Nunito", "Segoe UI", sans-serif';
      ctx.shadowColor = skin.accent;
      ctx.shadowBlur = 12;
      ctx.fillStyle = skin.text;
      ctx.fillText(skin.label, 128, 129);
      ctx.shadowBlur = 0;

      // Sweeping diagonal holographic shine bar
      const sweep = ((elapsedSec * 145) % 420) - 90;
      const shine = ctx.createLinearGradient(sweep - 34, 0, sweep + 34, 0);
      shine.addColorStop(0, "rgba(255, 255, 255, 0)");
      shine.addColorStop(0.5, "rgba(255, 255, 255, 0.28)");
      shine.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.save();
      ctx.transform(1, 0, -0.35, 1, 0, 0);
      ctx.fillStyle = shine;
      ctx.fillRect(sweep - 34, 0, 68, h);
      ctx.restore();

      tex.needsUpdate = true;
    }

    _getSpecialDecalMaterials(decalId, skin) {
      if (!this.decalMatCache) this.decalMatCache = new Map();
      if (this.decalMatCache.has(decalId)) return this.decalMatCache.get(decalId);

      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      const tex = new THREE.CanvasTexture(canvas);
      tex.encoding = THREE.sRGBEncoding;

      const sideMat = new THREE.MeshLambertMaterial({ color: skin.shirt });
      const frontMat = new THREE.MeshLambertMaterial({
        map: tex,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.18
      });
      const sleeveMat = new THREE.MeshLambertMaterial({ color: skin.sleeve });

      // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back)
      const bundle = {
        id: decalId,
        skin,
        canvas,
        ctx,
        tex,
        torsoMats: [sideMat, sideMat, sideMat, sideMat, frontMat, frontMat],
        sleeveMat
      };
      this._drawSpecialDecalTexture(bundle, 0);
      this.decalMatCache.set(decalId, bundle);
      return bundle;
    }

    _createAvatarMesh(player) {
      const root = new THREE.Group();
      const shirtDecal = player.shirtDecal || "none";
      const decalSkin = this._getSpecialDecalSkin(shirtDecal);
      const shirtHex = player.shirtColor || player.seatColor || "#3b82f6";
      const hairHex = player.hairColor || "#4a2c18";
      const hairStyle = player.hairStyle || "classic";
      const isBot = Boolean(player.isBot || String(player.name || "").startsWith("Bot "));

      const decalBundle = decalSkin ? this._getSpecialDecalMaterials(shirtDecal, decalSkin) : null;
      const shirtMat = new THREE.MeshLambertMaterial({ color: shirtHex });
      const armMat = decalBundle ? decalBundle.sleeveMat : shirtMat;
      const torsoMat = decalBundle ? decalBundle.torsoMats : shirtMat;
      const pantsMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
      const skinMat = new THREE.MeshLambertMaterial({
        color: isBot ? 0xdbeafe : 0xfcd5b5
      });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      let hairParts = [];

      // Seated torso
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.62, 0.34),
        torsoMat
      );
      torso.position.set(0, 0.34, 0);
      torso.castShadow = true;
      root.add(torso);

      // Seated thighs
      [-0.14, 0.14].forEach((lx) => {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.18, 0.46),
          pantsMat
        );
        leg.position.set(lx, 0.08, 0.22);
        leg.castShadow = true;
        root.add(leg);
      });

      // Head group
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.9, 0.02);

      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.46, 0.46),
        skinMat
      );
      head.castShadow = true;
      headGroup.add(head);

      // Build selected detailed, animated hairstyle for both humans and bots
      hairParts = this._buildHairstyle(headGroup, hairStyle, hairHex);

      // Face details: robot visor + ear nodes for bots, eyes for humans
      if (isBot) {
        const visor = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.12, 0.06),
          new THREE.MeshBasicMaterial({ color: 0x0ea5e9 })
        );
        visor.position.set(0, 0.04, 0.23);
        headGroup.add(visor);

        const earMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
        [-0.25, 0.25].forEach((ex) => {
          const ear = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8),
            earMat
          );
          ear.rotation.z = Math.PI / 2;
          ear.position.set(ex, 0.04, 0);
          headGroup.add(ear);
        });
      } else {
        const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.04), eyeMat);
        leftEye.position.set(-0.1, 0.04, 0.23);
        const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.04), eyeMat);
        rightEye.position.set(0.1, 0.04, 0.23);
        headGroup.add(leftEye, rightEye);
      }

      // Floating golden crown visible just above the hair while selected as Drawer
      const crownBaseY = this._getCrownBaseY(hairStyle);
      const crownGroup = this._createCrownGroup();
      crownGroup.position.set(0, crownBaseY, 0.02);
      crownGroup.visible = false;
      root.add(crownGroup);

      root.add(headGroup);

      // Left and right arms reaching toward desk
      const leftArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.48),
        armMat
      );
      leftArm.position.set(-0.34, 0.44, 0.22);
      leftArm.rotation.x = 0.25;
      leftArm.castShadow = true;

      const rightArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.48),
        armMat
      );
      rightArm.position.set(0.34, 0.44, 0.22);
      rightArm.rotation.x = 0.25;
      rightArm.castShadow = true;

      root.add(leftArm, rightArm);

      const skinParts = decalSkin
        ? this._buildSpecialSkin3DExtras(root, headGroup, shirtDecal, decalSkin)
        : [];

      // Floating 3D nameplate Sprite
      const plateCanvas = document.createElement("canvas");
      plateCanvas.width = 360;
      plateCanvas.height = 104;
      const plateTex = new THREE.CanvasTexture(plateCanvas);
      plateTex.encoding = THREE.sRGBEncoding;

      const plateMat = new THREE.SpriteMaterial({
        map: plateTex,
        transparent: true,
        depthTest: false
      });
      const plateSprite = new THREE.Sprite(plateMat);
      plateSprite.position.set(0, crownBaseY + 0.42, 0);
      plateSprite.scale.set(2.3, 0.66, 1);
      plateSprite.renderOrder = 10;
      root.add(plateSprite);

      return {
        root,
        headGroup,
        rightArm,
        shirtDecal,
        crownGroup,
        crownBaseY,
        plateCanvas,
        plateTex,
        lastPlateKey: "",
        avatarKey: `${shirtHex}|${shirtDecal}|${hairHex}|${hairStyle}|${isBot ? 1 : 0}`,
        hairParts,
        skinParts,
        jumpTimer: 0
      };
    }

    _buildSpecialSkin3DExtras(root, headGroup, decalId, skin) {
      const animParts = [];
      const accentMat = new THREE.MeshLambertMaterial({ color: skin.accent });
      const accent2Mat = new THREE.MeshBasicMaterial({ color: skin.accent2 });
      const sleeveMat = new THREE.MeshLambertMaterial({ color: skin.sleeve });

      if (decalId === "chief") {
        // Flowing royal cape + angled armored shoulder pauldrons
        const capePivot = new THREE.Group();
        capePivot.position.set(0, 0.62, -0.18);
        const cape = new THREE.Mesh(
          new THREE.BoxGeometry(0.64, 0.68, 0.05),
          sleeveMat
        );
        cape.position.set(0, -0.32, -0.05);
        cape.rotation.x = 0.24;
        cape.castShadow = true;
        capePivot.add(cape);
        root.add(capePivot);
        animParts.push({ type: "swayX", obj: capePivot, base: 0, amp: 0.09, speed: 2.6 });

        [-1, 1].forEach((side) => {
          const pauldron = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.14, 0.36),
            accentMat
          );
          pauldron.position.set(side * 0.35, 0.61, 0.02);
          pauldron.rotation.z = side * -0.28;
          pauldron.castShadow = true;
          root.add(pauldron);
        });
      } else if (decalId === "cbert") {
        // Demon hoodie back-shell + twin glowing horns
        const hood = new THREE.Mesh(
          new THREE.BoxGeometry(0.54, 0.42, 0.16),
          sleeveMat
        );
        hood.position.set(0, 0.04, -0.22);
        hood.castShadow = true;
        headGroup.add(hood);

        [-1, 1].forEach((side) => {
          const horn = new THREE.Mesh(
            new THREE.ConeGeometry(0.06, 0.24, 6),
            accent2Mat
          );
          horn.position.set(side * 0.2, 0.32, 0.04);
          horn.rotation.z = side * -0.4;
          horn.rotation.x = 0.18;
          headGroup.add(horn);
        });
      } else if (decalId === "hunter") {
        // Angled quiver + 3 arrow fletchings + diagonal bandolier strap
        const quiver = new THREE.Group();
        quiver.position.set(0.14, 0.56, -0.22);
        quiver.rotation.z = -0.35;
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.055, 0.46, 8),
          new THREE.MeshLambertMaterial({ color: 0x78350f })
        );
        tube.castShadow = true;
        quiver.add(tube);
        [-0.025, 0, 0.025].forEach((ox, idx) => {
          const fletch = new THREE.Mesh(
            new THREE.ConeGeometry(0.026, 0.1, 4),
            idx === 1 ? accent2Mat : accentMat
          );
          fletch.position.set(ox, 0.27, 0);
          quiver.add(fletch);
        });
        root.add(quiver);

        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.075, 0.38),
          new THREE.MeshLambertMaterial({ color: 0x78350f })
        );
        strap.position.set(0, 0.42, 0);
        strap.rotation.z = -0.68;
        root.add(strap);
      } else if (decalId === "fours") {
        // Flared cosmic robe hem + 2 orbiting golden stars
        const robeSkirt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.48, 0.32, 8),
          sleeveMat
        );
        robeSkirt.position.set(0, 0.12, 0.04);
        robeSkirt.castShadow = true;
        root.add(robeSkirt);

        const orbitGroup = new THREE.Group();
        orbitGroup.position.set(0, 1.0, 0.02);
        [0, Math.PI].forEach((ang, idx) => {
          const star = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.065, 0),
            idx === 0 ? accentMat : accent2Mat
          );
          star.position.set(Math.cos(ang) * 0.46, 0.05, Math.sin(ang) * 0.46);
          orbitGroup.add(star);
        });
        root.add(orbitGroup);
        animParts.push({ type: "orbitY", obj: orbitGroup, speed: 2.2 });
      } else if (decalId === "tubz") {
        // Chunky quilted puffer jacket ribs + collar + flickering shoulder flames
        [0.24, 0.42, 0.56].forEach((ry) => {
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(0.64, 0.12, 0.41),
            ry === 0.56 ? sleeveMat : new THREE.MeshLambertMaterial({ color: skin.shirt2 })
          );
          rib.position.set(0, ry, 0);
          rib.castShadow = true;
          root.add(rib);
        });
        [-1, 1].forEach((side, idx) => {
          const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.085, 0.24, 5),
            idx === 0 ? accent2Mat : accentMat
          );
          flame.position.set(side * 0.35, 0.69, 0.02);
          root.add(flame);
          animParts.push({ type: "pulseScale", obj: flame, base: 1, amp: 0.22, speed: 6.5, phase: idx * 1.4 });
        });
      } else if (decalId === "lenny") {
        // Fire suit shoulder flames + diagonal golden sword strapped across back
        [-1, 1].forEach((side, idx) => {
          const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.08, 0.24, 5),
            idx === 0 ? accentMat : accent2Mat
          );
          flame.position.set(side * 0.34, 0.68, 0.02);
          root.add(flame);
          animParts.push({ type: "pulseScale", obj: flame, base: 1, amp: 0.24, speed: 7.0, phase: idx * 1.2 });
        });

        const sword = new THREE.Group();
        sword.position.set(0.04, 0.56, -0.22);
        sword.rotation.z = -0.58;
        const goldBladeMat = new THREE.MeshLambertMaterial({
          color: 0xfde047,
          emissive: 0xca8a04,
          emissiveIntensity: 0.35
        });
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.66, 0.025), goldBladeMat);
        blade.position.y = 0.22;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.14, 4), goldBladeMat);
        tip.position.y = 0.61;
        tip.rotation.y = Math.PI / 4;
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.05), goldBladeMat);
        guard.position.y = -0.1;
        const hilt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 0.16, 6),
          new THREE.MeshLambertMaterial({ color: 0x78350f })
        );
        hilt.position.y = -0.2;
        sword.add(blade, tip, guard, hilt);
        root.add(sword);
      } else if (decalId === "remig") {
        // White & beige Egyptian-style flared robes + golden pharaoh collar
        const robeHem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.31, 0.49, 0.34, 8),
          new THREE.MeshLambertMaterial({ color: 0xe7d8b9 })
        );
        robeHem.position.set(0, 0.13, 0.04);
        robeHem.castShadow = true;
        root.add(robeHem);

        const collar = new THREE.Mesh(
          new THREE.TorusGeometry(0.22, 0.042, 6, 16),
          accentMat
        );
        collar.rotation.x = Math.PI / 2;
        collar.position.set(0, 0.63, 0.02);
        root.add(collar);
      }

      return animParts;
    }

    _getCrownBaseY(hairStyle) {
      if (hairStyle === "spiky" || hairStyle === "mohawk") return 1.66;
      if (hairStyle === "bun") return 1.6;
      if (hairStyle === "curly") return 1.56;
      return 1.44;
    }

    _createCrownGroup() {
      const crown = new THREE.Group();
      const goldMat = new THREE.MeshLambertMaterial({
        color: 0xfacc15,
        emissive: 0x854d0e,
        emissiveIntensity: 0.35
      });
      const trimMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
      const velvetMat = new THREE.MeshLambertMaterial({ color: 0xb91c1c });
      const pearlMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
      const gemColors = [0xef4444, 0x3b82f6, 0x22c55e, 0xa855f7, 0x06b6d4];

      // Velvet inner cushion + main golden crown band
      const velvet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.14, 0.06, 12),
        velvetMat
      );
      velvet.position.y = 0.04;
      crown.add(velvet);

      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.185, 0.16, 0.09, 14),
        goldMat
      );
      band.position.y = 0.045;
      band.castShadow = true;
      crown.add(band);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.165, 0.022, 6, 16),
        trimMat
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.01;
      crown.add(rim);

      // 5 royal points with pearls and front-band gems
      const points = 5;
      for (let i = 0; i < points; i += 1) {
        const angle = (i / points) * Math.PI * 2;
        const radial = new THREE.Group();
        radial.rotation.y = angle;

        const spikePivot = new THREE.Group();
        spikePivot.position.set(0, 0.085, 0.16);
        spikePivot.rotation.x = 0.18;

        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.052, 0.14, 4),
          goldMat
        );
        spike.position.y = 0.065;
        spike.castShadow = true;
        spikePivot.add(spike);

        const pearl = new THREE.Mesh(
          new THREE.SphereGeometry(0.028, 7, 7),
          pearlMat
        );
        pearl.position.y = 0.145;
        spikePivot.add(pearl);
        radial.add(spikePivot);

        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.028, 0),
          new THREE.MeshBasicMaterial({ color: gemColors[i % gemColors.length] })
        );
        gem.position.set(0, 0.045, 0.185);
        radial.add(gem);

        crown.add(radial);
      }

      return crown;
    }

    /**
     * Builds a detailed low-poly hairstyle (with highlight/shadow shades) on the head
     * and returns a list of animated parts (sway, wobble, bounce, swing, breathe).
     */
    _buildHairstyle(headGroup, style, hairHex) {
      const parts = [];
      const baseCol = new THREE.Color(hairHex);
      const hiCol = baseCol.clone().offsetHSL(0, 0.05, 0.16);
      const loCol = baseCol.clone().offsetHSL(0, 0, -0.12);
      const mat = new THREE.MeshLambertMaterial({ color: baseCol });
      const hiMat = new THREE.MeshLambertMaterial({ color: hiCol });
      const loMat = new THREE.MeshLambertMaterial({ color: loCol });

      const hair = new THREE.Group();
      headGroup.add(hair);

      const mesh = (geo, m, x, y, z, parent = hair) => {
        const o = new THREE.Mesh(geo, m);
        o.position.set(x, y, z);
        o.castShadow = true;
        parent.add(o);
        return o;
      };
      const pivot = (x, y, z, parent = hair) => {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        parent.add(g);
        return g;
      };
      const anim = (obj, opts) => {
        parts.push({
          obj,
          speed: 2,
          phase: 0,
          ...opts,
          base: {
            rx: obj.rotation.x,
            ry: obj.rotation.y,
            rz: obj.rotation.z,
            py: obj.position.y,
            s: obj.scale.x
          }
        });
      };

      if (style === "spiky") {
        mesh(new THREE.BoxGeometry(0.5, 0.1, 0.48), mat, 0, 0.21, -0.01);
        mesh(new THREE.BoxGeometry(0.52, 0.12, 0.07), loMat, 0, 0.13, -0.23);
        const spikes = [
          [-0.15, 0.12, 0.22, 0.35, 0.45],
          [0.0, 0.14, 0.28, 0.45, 0.0],
          [0.15, 0.12, 0.22, 0.35, -0.45],
          [-0.17, -0.05, 0.25, -0.1, 0.6],
          [0.0, -0.02, 0.34, -0.05, 0.0],
          [0.17, -0.05, 0.25, -0.1, -0.6],
          [-0.08, -0.17, 0.23, -0.55, 0.3],
          [0.08, -0.17, 0.23, -0.55, -0.3]
        ];
        spikes.forEach(([x, z, h, tx, tz], i) => {
          const p = pivot(x, 0.25, z);
          p.rotation.set(tx, 0, tz);
          mesh(new THREE.ConeGeometry(0.075, h, 5), i % 2 ? mat : loMat, 0, h / 2, 0, p);
          mesh(new THREE.ConeGeometry(0.034, h * 0.38, 5), hiMat, 0, h * 0.8, 0.028, p);
          anim(p, { rx: 0.07, rz: 0.09, speed: 3 + (i % 3) * 0.6, phase: i * 1.1 });
        });
      } else if (style === "bob") {
        mesh(new THREE.BoxGeometry(0.55, 0.14, 0.53), mat, 0, 0.22, -0.02);
        mesh(new THREE.BoxGeometry(0.4, 0.03, 0.3), hiMat, 0, 0.3, 0.02);
        // Choppy bangs
        for (let i = 0; i < 5; i += 1) {
          const p = pivot(-0.2 + i * 0.1, 0.2, 0.245);
          mesh(new THREE.BoxGeometry(0.1, 0.14 - (i % 2) * 0.03, 0.05), i % 2 ? hiMat : mat, 0, -0.05, 0, p);
          anim(p, { rx: 0.08, speed: 2.2, phase: i * 0.5 });
        }
        // Swaying side curtains with flared tips
        [-1, 1].forEach((side) => {
          const p = pivot(side * 0.258, 0.2, -0.02);
          mesh(new THREE.BoxGeometry(0.08, 0.42, 0.36), mat, 0, -0.2, 0, p);
          mesh(new THREE.BoxGeometry(0.11, 0.07, 0.38), loMat, side * 0.012, -0.41, 0, p);
          mesh(new THREE.BoxGeometry(0.02, 0.3, 0.05), hiMat, side * 0.045, -0.15, 0.1, p);
          anim(p, { rz: 0.07, speed: 1.8, phase: side > 0 ? Math.PI : 0 });
        });
        const back = pivot(0, 0.2, -0.245);
        mesh(new THREE.BoxGeometry(0.55, 0.42, 0.1), mat, 0, -0.2, 0, back);
        mesh(new THREE.BoxGeometry(0.57, 0.07, 0.12), loMat, 0, -0.41, 0, back);
        anim(back, { rx: 0.05, speed: 1.8, phase: 0.8 });
      } else if (style === "bun") {
        mesh(new THREE.BoxGeometry(0.5, 0.12, 0.49), mat, 0, 0.21, -0.01);
        mesh(new THREE.BoxGeometry(0.5, 0.2, 0.08), loMat, 0, 0.12, -0.235);
        mesh(new THREE.BoxGeometry(0.3, 0.025, 0.4), hiMat, 0, 0.275, 0.0);
        const bunG = pivot(0, 0.29, -0.06);
        mesh(new THREE.DodecahedronGeometry(0.15, 1), mat, 0, 0.11, 0, bunG);
        const tie = mesh(new THREE.TorusGeometry(0.1, 0.028, 6, 14), loMat, 0, 0.02, 0, bunG);
        tie.rotation.x = Math.PI / 2;
        const swirl = mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 12, Math.PI * 1.3), hiMat, 0, 0.16, 0.05, bunG);
        swirl.rotation.x = -0.7;
        const stickMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
        const tipMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
        [1, -1].forEach((dir) => {
          const stick = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 5), stickMat, 0, 0.13, -0.02, bunG);
          stick.rotation.set(0.3, 0, dir * 1.05);
          const tip = mesh(new THREE.SphereGeometry(0.024, 6, 6), tipMat, dir * -0.2, 0.25, 0.05, bunG);
          tip.castShadow = false;
        });
        anim(bunG, { py: 0.018, rz: 0.07, speed: 2.6 });
        // Loose face-framing strands
        [-1, 1].forEach((side) => {
          const p = pivot(side * 0.19, 0.2, 0.22);
          mesh(new THREE.BoxGeometry(0.035, 0.22, 0.035), hiMat, 0, -0.11, 0, p);
          anim(p, { rz: 0.16, speed: 2.2, phase: side > 0 ? 0 : 1.4 });
        });
      } else if (style === "mohawk") {
        mesh(new THREE.BoxGeometry(0.5, 0.04, 0.48), loMat, 0, 0.215, -0.01);
        mesh(new THREE.BoxGeometry(0.16, 0.05, 0.5), mat, 0, 0.245, -0.01);
        const heights = [0.2, 0.28, 0.36, 0.3, 0.22];
        const zs = [0.18, 0.09, 0, -0.09, -0.18];
        heights.forEach((h, i) => {
          const p = pivot(0, 0.25, zs[i]);
          p.rotation.x = 0.4 - i * 0.2;
          const fin = mesh(new THREE.ConeGeometry(0.08, h, 4), i % 2 ? mat : loMat, 0, h / 2, 0, p);
          fin.scale.x = 0.55;
          const tip = mesh(new THREE.ConeGeometry(0.04, h * 0.4, 4), hiMat, 0, h * 0.78, 0.02, p);
          tip.scale.x = 0.55;
          anim(p, { rx: 0.13, speed: 3.2, phase: -i * 0.8 });
        });
        // Shaved side stripes
        [-1, 1].forEach((side) => {
          mesh(new THREE.BoxGeometry(0.01, 0.02, 0.22), hiMat, side * 0.243, 0.14, -0.02);
          mesh(new THREE.BoxGeometry(0.01, 0.02, 0.22), hiMat, side * 0.243, 0.09, -0.02);
        });
      } else if (style === "curly") {
        const puffs = [
          [0, 0.3, 0, 0.15],
          [-0.15, 0.27, 0.1, 0.12],
          [0.15, 0.27, 0.1, 0.12],
          [-0.15, 0.27, -0.1, 0.12],
          [0.15, 0.27, -0.1, 0.12],
          [0, 0.28, 0.15, 0.11],
          [0, 0.27, -0.17, 0.13],
          [-0.25, 0.15, 0.05, 0.09],
          [0.25, 0.15, 0.05, 0.09],
          [-0.25, 0.12, -0.12, 0.1],
          [0.25, 0.12, -0.12, 0.1],
          [-0.12, 0.12, -0.25, 0.11],
          [0.12, 0.12, -0.25, 0.11],
          [0, 0.38, 0.04, 0.1],
          [-0.08, 0.36, -0.1, 0.09],
          [0.09, 0.36, -0.08, 0.09]
        ];
        puffs.forEach(([x, y, z, r], i) => {
          const puff = mesh(new THREE.DodecahedronGeometry(r, 0), i % 3 === 0 ? hiMat : i % 3 === 1 ? mat : loMat, x, y, z);
          puff.rotation.set(i * 0.7, i * 1.3, i * 0.4);
          anim(puff, { sc: 0.07, ry: 0.15, speed: 2 + (i % 4) * 0.45, phase: i * 0.9 });
        });
      } else if (style === "ponytail") {
        mesh(new THREE.BoxGeometry(0.52, 0.13, 0.5), mat, 0, 0.22, -0.01);
        mesh(new THREE.BoxGeometry(0.52, 0.26, 0.08), loMat, 0, 0.1, -0.235);
        mesh(new THREE.BoxGeometry(0.03, 0.025, 0.42), hiMat, 0.08, 0.29, -0.01);
        // Side-swept bang
        const bang = pivot(-0.12, 0.25, 0.225);
        bang.rotation.z = -0.4;
        mesh(new THREE.BoxGeometry(0.26, 0.07, 0.06), hiMat, 0.11, 0, 0, bang);
        anim(bang, { rz: 0.06, speed: 2 });
        // Hair tie
        const tie = mesh(new THREE.TorusGeometry(0.055, 0.022, 6, 12), new THREE.MeshLambertMaterial({ color: 0xec4899 }), 0, 0.18, -0.28);
        tie.rotation.x = 0.3;
        // Chained, swinging tail segments
        const seg1 = pivot(0, 0.18, -0.29);
        seg1.rotation.x = 0.5;
        mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.17, 6), mat, 0, -0.085, 0, seg1);
        const seg2 = pivot(0, -0.17, 0, seg1);
        seg2.rotation.x = 0.2;
        mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.16, 6), hiMat, 0, -0.08, 0, seg2);
        const seg3 = pivot(0, -0.16, 0, seg2);
        const tip = mesh(new THREE.ConeGeometry(0.055, 0.18, 6), loMat, 0, -0.09, 0, seg3);
        tip.rotation.x = Math.PI;
        anim(seg1, { rz: 0.22, rx: 0.06, speed: 2.2 });
        anim(seg2, { rz: 0.18, speed: 2.2, phase: 0.6 });
        anim(seg3, { rz: 0.16, speed: 2.2, phase: 1.2 });
      } else if (style === "anime") {
        mesh(new THREE.BoxGeometry(0.53, 0.14, 0.51), mat, 0, 0.22, -0.01);
        mesh(new THREE.BoxGeometry(0.36, 0.03, 0.36), hiMat, 0, 0.3, 0.02);
        // Sharp fringe
        const lens = [0.22, 0.16, 0.2, 0.16, 0.22];
        lens.forEach((len, i) => {
          const p = pivot(-0.2 + i * 0.1, 0.25, 0.235);
          p.rotation.z = (i - 2) * 0.16;
          const c = mesh(new THREE.ConeGeometry(0.06, len, 4), i % 2 ? hiMat : mat, 0, -len / 2, 0, p);
          c.rotation.x = Math.PI;
          anim(p, { rz: 0.07, speed: 2.6, phase: i * 0.6 });
        });
        // Side spikes
        [-1, 1].forEach((side) => {
          const p = pivot(side * 0.25, 0.17, 0.04);
          p.rotation.z = side * -2.7;
          mesh(new THREE.ConeGeometry(0.06, 0.22, 4), mat, 0, 0.11, 0, p);
          anim(p, { rz: 0.08, speed: 2.3, phase: side > 0 ? 0 : 1 });
        });
        // Back spikes
        for (let i = 0; i < 3; i += 1) {
          const p = pivot(-0.14 + i * 0.14, 0.18, -0.24);
          p.rotation.x = -2.3;
          mesh(new THREE.ConeGeometry(0.075, 0.24, 4), i === 1 ? loMat : mat, 0, 0.12, 0, p);
          anim(p, { rx: 0.08, speed: 2.4, phase: i });
        }
        // Bouncy ahoge (cowlick)
        const ahoge = pivot(0.02, 0.29, 0.02);
        mesh(new THREE.TorusGeometry(0.075, 0.016, 5, 12, Math.PI), hiMat, 0.075, 0, 0, ahoge);
        anim(ahoge, { rz: 0.28, speed: 4.5 });
      } else {
        // Classic swept quiff with faded sides
        mesh(new THREE.BoxGeometry(0.52, 0.12, 0.5), mat, 0, 0.22, -0.01);
        mesh(new THREE.BoxGeometry(0.52, 0.22, 0.08), loMat, 0, 0.1, -0.235);
        [-1, 1].forEach((side) => {
          mesh(new THREE.BoxGeometry(0.06, 0.16, 0.36), loMat, side * 0.25, 0.13, -0.05);
          mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), mat, side * 0.245, 0.06, 0.12);
        });
        for (let i = 0; i < 4; i += 1) {
          const p = pivot(-0.16 + i * 0.1, 0.26, 0.19);
          p.rotation.set(-0.5, 0, -0.35);
          mesh(new THREE.BoxGeometry(0.12, 0.07, 0.2), i % 2 ? hiMat : mat, 0.03, 0.035, 0.02, p);
          anim(p, { rz: 0.08, rx: 0.06, speed: 2.4, phase: i * 0.7 });
        }
      }

      return parts;
    }

    _updateNameplate(avatar, player, isDrawer) {
      const key = `${player.name}|${player.score}|${isDrawer ? 1 : 0}`;
      if (avatar.lastPlateKey === key) return;
      avatar.lastPlateKey = key;

      const ctx = avatar.plateCanvas.getContext("2d");
      const w = avatar.plateCanvas.width;
      const h = avatar.plateCanvas.height;
      ctx.clearRect(0, 0, w, h);

      createRoundedRectPath(ctx, 14, 14, w - 28, h - 28, 26);
      ctx.fillStyle = isDrawer
        ? "rgba(245, 158, 11, 0.94)"
        : "rgba(15, 23, 42, 0.84)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = isDrawer ? "#fef08a" : "rgba(255, 255, 255, 0.45)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '800 30px "Nunito", "Segoe UI", sans-serif';
      ctx.fillStyle = isDrawer ? "#0f172a" : "#ffffff";
      const prefix = isDrawer ? "✏️ " : "";
      const nameStr = `${prefix}${String(player.name || "Player").slice(0, 13)}`;
      ctx.fillText(nameStr, w / 2, h / 2 - 12);

      ctx.font = '700 22px "Nunito", "Segoe UI", sans-serif';
      ctx.fillStyle = isDrawer ? "#1e293b" : "#93c5fd";
      ctx.fillText(`${player.score || 0} pts`, w / 2, h / 2 + 18);

      avatar.plateTex.needsUpdate = true;
    }

    syncPlayers(players = [], drawerId = null) {
      this.currentDrawerId = drawerId;
      const activeIds = new Set(players.map((p) => p.id));

      // Remove avatars of players who left
      for (const [id, av] of this.avatarMap.entries()) {
        if (!activeIds.has(id)) {
          this.scene.remove(av.root);
          av.plateTex.dispose();
          this.avatarMap.delete(id);
        }
      }

      const guessers = players.filter((p) => p.id !== drawerId);
      const guesserCount = drawerId
        ? Math.min(4, guessers.length)
        : Math.min(4, players.length);
      this._layoutGuesserDesks(Math.max(1, guesserCount));

      let guesserSlot = 0;

      players.forEach((player, idx) => {
        const shirtHex = player.shirtColor || player.seatColor || "#3b82f6";
        const shirtDecal = player.shirtDecal || "none";
        const hairHex = player.hairColor || "#4a2c18";
        const hairStyle = player.hairStyle || "classic";
        const isBot = Boolean(player.isBot || String(player.name || "").startsWith("Bot "));
        const desiredKey = `${shirtHex}|${shirtDecal}|${hairHex}|${hairStyle}|${isBot ? 1 : 0}`;

        let av = this.avatarMap.get(player.id);
        if (av && av.avatarKey !== desiredKey) {
          this.scene.remove(av.root);
          av.plateTex.dispose();
          this.avatarMap.delete(player.id);
          av = null;
        }
        if (!av) {
          av = this._createAvatarMesh(player);
          this.avatarMap.set(player.id, av);
          this.scene.add(av.root);
        }

        const isDrawer = player.id === drawerId;
        av.crownGroup.visible = isDrawer;
        this._updateNameplate(av, player, isDrawer);

        let targetDesk = null;
        if (isDrawer) {
          targetDesk = this.drawerDesk;
        } else if (guesserSlot < 4) {
          targetDesk = this.guesserDesks[guesserSlot];
          guesserSlot += 1;
        } else {
          // Fallback 5th player in lobby before round 1 drawer is picked
          targetDesk = this.drawerDesk;
        }

        if (targetDesk) {
          const deskScale = isDrawer ? 1 : targetDesk.scale.x || 1;
          const anchor = targetDesk.userData.seatAnchor.clone().multiplyScalar(deskScale);
          anchor.applyAxisAngle(new THREE.Vector3(0, 1, 0), targetDesk.rotation.y);
          av.root.position.copy(targetDesk.position).add(anchor);
          av.root.rotation.y = targetDesk.rotation.y;
          av.root.scale.setScalar(deskScale);
          av.root.userData.baseY = av.root.position.y;
          av.root.userData.phase = idx * 1.3;
          av.root.visible = true;
        }
      });
    }

    setDrawerSketching(isSketching) {
      this.drawerIsSketching = Boolean(isSketching);
    }

    celebratePlayer(playerId) {
      const av = this.avatarMap.get(playerId);
      if (av) {
        av.jumpTimer = 1.4;
      }
      this.spawnConfetti(new THREE.Vector3(0.8, 4.6, -5.2), 45);
    }

    spawnConfetti(origin, count = 40) {
      const palette = [0xef4444, 0x3b82f6, 0x22c55e, 0xfacc15, 0xa855f7, 0xf97316];
      const geo = new THREE.PlaneGeometry(0.18, 0.12);
      for (let i = 0; i < count; i += 1) {
        const mat = new THREE.MeshBasicMaterial({
          color: palette[i % palette.length],
          side: THREE.DoubleSide
        });
        const piece = new THREE.Mesh(geo, mat);
        piece.position.copy(origin);
        piece.userData = {
          vx: (Math.random() - 0.5) * 7.5,
          vy: 2.5 + Math.random() * 5.2,
          vz: (Math.random() - 0.5) * 7.5,
          rx: (Math.random() - 0.5) * 8,
          ry: (Math.random() - 0.5) * 8,
          life: 2.8 + Math.random() * 1.2
        };
        this.scene.add(piece);
        this.confetti.push(piece);
      }
    }

    markBoardDirty() {
      if (this.boardTexture) {
        this.boardTexture.needsUpdate = true;
      }
    }

    setCameraMode(mode) {
      this.cameraMode = mode;
      this._updateCameraTargets();
    }

    _updateCameraTargets() {
      const aspect = (window.innerWidth || 1280) / Math.max(1, window.innerHeight || 720);
      const isPortrait = aspect < 0.95;

      if (this.cameraMode === "spin") {
        // Frame the 3D spinwheel on the left of the massive whiteboard
        const spinZ = isPortrait ? 3.2 : aspect < 1.15 ? 2.0 : 0.4;
        this.desiredCamPos.set(-4.35, 4.5, spinZ);
        this.desiredLookAt.set(-6.0, 4.35, -6.8);
      } else if (this.cameraMode === "gameplay") {
        // Frame guessers, full whiteboard, and the drawer desk on the right
        if (isPortrait) {
          this.desiredCamPos.set(1.0, 9.6, 22.6);
          this.desiredLookAt.set(1.75, 2.3, -4.8);
        } else {
          const narrowOffset = aspect < 1.15 ? 2.8 : 0;
          this.desiredCamPos.set(0.7, 7.9 + narrowOffset * 0.35, 15.0 + narrowOffset);
          this.desiredLookAt.set(1.1, 2.3, -4.6);
        }
      } else if (this.cameraMode === "gameover") {
        if (isPortrait) {
          this.desiredCamPos.set(1.0, 8.2, 18.8);
          this.desiredLookAt.set(1.5, 2.4, -4.8);
        } else {
          const narrowOffset = aspect < 1.15 ? 2.6 : 0;
          this.desiredCamPos.set(0.7, 6.9, 12.6 + narrowOffset);
          this.desiredLookAt.set(1.0, 2.5, -4.8);
        }
      } else {
        // Scenic menu/lobby view
        if (isPortrait) {
          this.desiredCamPos.set(1.0, 9.6, 22.8);
          this.desiredLookAt.set(1.6, 2.5, -4.6);
        } else {
          const narrowOffset = aspect < 1.15 ? 2.6 : 0;
          this.desiredCamPos.set(0.6, 8.1, 15.8 + narrowOffset);
          this.desiredLookAt.set(0.9, 2.6, -4.5);
        }
      }
    }

    _handleResize() {
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 720;
      const aspect = w / h;
      this.camera.aspect = aspect;
      // Wider vertical FOV on narrow portrait phone screens so drawer + all players fit
      this.camera.fov = aspect < 0.7 ? 65 : aspect < 1 ? 58 : 48;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      this._updateCameraTargets();
    }

    _updateSpinwheel(dt) {
      const s = this.spinState;
      if (s.active) {
        const elapsedMs = performance.now() - s.startTime;
        const t = Math.min(1, elapsedMs / s.durationMs);
        // Smooth fast launch and quartic deceleration to a crisp stop after 5s
        const eased = 1 - Math.pow(1 - t, 4);
        const rot = s.startRot + (s.endRot - s.startRot) * eased;
        this.wheelSpinner.rotation.z = rot;

        const sliceAngle = (Math.PI * 2) / Math.max(1, this.wheelPlayers.length);
        const pegIndex = Math.floor(rot / sliceAngle);
        if (pegIndex !== s.lastPegIndex) {
          s.lastPegIndex = pegIndex;
          s.tickerAngle = -0.52;
          s.tickerVel = 4.2;
          this.onWheelTick();
        }

        if (t >= 1) {
          s.active = false;
          s.highlightPulse = 1.6;
          this.updateWheelPlayers(this.wheelPlayers, s.winnerIndex);
          this.spawnConfetti(new THREE.Vector3(-6.0, 5.0, -6.4), 50);
          if (typeof s.onComplete === "function") {
            s.onComplete();
          }
        }
      }

      // Spring physics on top ticker pointer
      if (Math.abs(s.tickerAngle) > 0.001 || Math.abs(s.tickerVel) > 0.001) {
        s.tickerVel += -s.tickerAngle * 42 * dt;
        s.tickerVel *= Math.exp(-9 * dt);
        s.tickerAngle += s.tickerVel * dt;
        this.tickerPivot.rotation.z = s.tickerAngle;
      } else {
        this.tickerPivot.rotation.z = 0;
      }

      if (s.highlightPulse > 0) {
        s.highlightPulse = Math.max(0, s.highlightPulse - dt * 0.65);
        this.wheelGlowRing.material.opacity =
          0.35 + Math.sin(this.elapsed * 12) * 0.25 * Math.min(1, s.highlightPulse);
      } else {
        this.wheelGlowRing.material.opacity = 0;
      }
    }

    _animate() {
      requestAnimationFrame(() => this._animate());

      const dt = Math.min(0.05, this.clock.getDelta());
      this.elapsed += dt;

      // Smoothly tick classroom wall clock second hand
      if (this.clockSecondHand) {
        this.clockSecondHand.rotation.z = -this.elapsed * 0.45;
      }

      // Animate any active Special Decal 3D shirt textures (~22fps)
      if (this.decalMatCache && this.elapsed - (this._lastDecalFrame || 0) >= 0.045) {
        this._lastDecalFrame = this.elapsed;
        const activeDecals = new Set();
        for (const av of this.avatarMap.values()) {
          if (av.shirtDecal && av.shirtDecal !== "none") {
            activeDecals.add(av.shirtDecal);
          }
        }
        activeDecals.forEach((decalId) => {
          const entry = this.decalMatCache.get(decalId);
          if (entry) {
            this._drawSpecialDecalTexture(entry, this.elapsed);
          }
        });
      }

      // Seated avatar animations
      for (const [id, av] of this.avatarMap.entries()) {
        const baseY = av.root.userData.baseY || 0.66;
        const phase = av.root.userData.phase || 0;
        let jumpOffset = 0;
        if (av.jumpTimer > 0) {
          av.jumpTimer = Math.max(0, av.jumpTimer - dt);
          jumpOffset = Math.abs(Math.sin(av.jumpTimer * Math.PI * 4)) * 0.42;
        }
        av.root.position.y =
          baseY + jumpOffset + Math.sin(this.elapsed * 2.2 + phase) * 0.025;

        // Animated hair (extra bouncy while celebrating)
        if (av.hairParts && av.hairParts.length) {
          const boost = av.jumpTimer > 0 ? 2.6 : 1;
          for (const p of av.hairParts) {
            const s = Math.sin(this.elapsed * p.speed + p.phase + phase) * boost;
            if (p.rx) p.obj.rotation.x = p.base.rx + s * p.rx;
            if (p.ry) p.obj.rotation.y = p.base.ry + s * p.ry;
            if (p.rz) p.obj.rotation.z = p.base.rz + s * p.rz;
            if (p.py) p.obj.position.y = p.base.py + s * p.py;
            if (p.sc) p.obj.scale.setScalar(p.base.s * (1 + s * p.sc));
          }
        }

        if (av.skinParts && av.skinParts.length) {
          for (const sp of av.skinParts) {
            if (sp.type === "swayX") {
              sp.obj.rotation.x = sp.base + Math.sin(this.elapsed * sp.speed + phase) * sp.amp;
            } else if (sp.type === "orbitY") {
              sp.obj.rotation.y += dt * sp.speed;
            } else if (sp.type === "pulseScale") {
              const s = sp.base + Math.sin(this.elapsed * sp.speed + (sp.phase || 0)) * sp.amp;
              sp.obj.scale.set(1, s, 1);
            }
          }
        }

        if (av.crownGroup && av.crownGroup.visible) {
          av.crownGroup.position.y =
            av.crownBaseY + Math.sin(this.elapsed * 3.2 + phase) * 0.045;
          av.crownGroup.rotation.y += dt * 1.1;
          av.crownGroup.rotation.z = Math.sin(this.elapsed * 2.0 + phase) * 0.05;
        }

        if (id === this.currentDrawerId && this.drawerIsSketching) {
          av.rightArm.rotation.y = Math.sin(this.elapsed * 11) * 0.34;
          av.headGroup.rotation.x = 0.16 + Math.sin(this.elapsed * 4) * 0.05;
        } else {
          av.rightArm.rotation.y = 0;
          av.headGroup.rotation.x = Math.sin(this.elapsed * 1.3 + phase) * 0.04;
        }
      }

      // Update confetti particles
      for (let i = this.confetti.length - 1; i >= 0; i -= 1) {
        const p = this.confetti[i];
        p.userData.life -= dt;
        if (p.userData.life <= 0) {
          this.scene.remove(p);
          p.material.dispose();
          this.confetti.splice(i, 1);
          continue;
        }
        p.userData.vy -= 9.8 * dt;
        p.position.x += p.userData.vx * dt;
        p.position.y += p.userData.vy * dt;
        p.position.z += p.userData.vz * dt;
        p.rotation.x += p.userData.rx * dt;
        p.rotation.y += p.userData.ry * dt;
      }

      this._updateSpinwheel(dt);

      // Smooth camera choreography interpolation
      const targetPos = this.desiredCamPos.clone();
      if (this.cameraMode === "menu") {
        targetPos.x += Math.sin(this.elapsed * 0.25) * 1.8;
        targetPos.y += Math.cos(this.elapsed * 0.32) * 0.35;
      }
      const lerpFactor = 1 - Math.exp(-3.8 * dt);
      this.camera.position.lerp(targetPos, lerpFactor);
      this.currentLookAt.lerp(this.desiredLookAt, lerpFactor);
      this.camera.lookAt(this.currentLookAt);

      this.renderer.render(this.scene, this.camera);
    }
  }

  global.Scene3DManager = Scene3DManager;
})(window);
