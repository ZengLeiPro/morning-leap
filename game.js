/**
 * 晨光飞跃 (Morning Leap) — playable MVP
 * Canvas 400×600 · art-spec-v1.1 · vanilla JS
 */
(function () {
  "use strict";

  // ─── Constants (product lock) ───────────────────────────────────────────
  const W = 400;
  const H = 600;
  const GROUND_H = 48;
  const BEST_KEY = "morning-leap-best";

  const COLORS = {
    skyLight: "#FFE8C8",
    skyDeep: "#F4A261",
    coffee: "#6F4E37",
    cream: "#F5E6D3",
    glass: "#7A9EAF",
    silhouette: "#2A1F1A",
    accent: "#F4A261",
    buttonPress: "#D4894A",
  };

  const BEAN_W = 28;
  const BEAN_H = 34;
  const BEAN_R = 14; // collision circle

  const PIPE_W = 56;
  const PIPE_CAP_EXTRA = 14;
  const PIPE_CAP_H = 14;
  const GAP_DEFAULT = 150;
  const GAP_FLOOR = 120;
  const GAP_Y_MIN = 70;

  const FLAP_IMPULSE = -6.2; // px/frame @60fps
  const GRAVITY = 0.32; // px/frame² — Flappy-like with impulse -6.2
  const PIPE_SPEED_BASE = -3.0; // px/frame @60fps
  const WING_CYCLE_MS = 120;
  const SQUASH_MS = 100;
  const DEATH_PANEL_DELAY = 0.3; // seconds
  const SCORE_POP_MS = 160;

  const FAIL_LINES = [
    "迟到了…但香气还在。",
    "撞上玻璃幕墙，HR 已读不回。",
    "这栋楼的缝，比电梯还难等。",
    "豆碎了，梦想还在飘。",
    "建议下次走楼梯。",
  ];

  // ─── Canvas setup ───────────────────────────────────────────────────────
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  // ─── State ──────────────────────────────────────────────────────────────
  const STATE = { TITLE: "title", PLAYING: "playing", DYING: "dying", GAMEOVER: "gameover" };

  let state = STATE.TITLE;
  let best = 0;
  try {
    best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
  } catch (_) {
    best = 0;
  }

  let score = 0;
  let newRecord = false;
  let failLine = "";
  let btnPressed = false;

  // Player
  let bean = {
    x: W / 3,
    y: H / 2,
    vy: 0,
    rot: 0,
    wingPhase: 0,
    squashT: 0, // ms remaining
    wingT: 0,
  };

  // Pipes: { x, gapY, gapH, scored }
  let pipes = [];
  let silScroll = 0;
  let playTime = 0; // seconds since start
  let deathTimer = 0;
  let scorePopT = 0;
  let spawnTimer = 0;
  let titleBob = 0;

  let lastTs = 0;
  let rafId = 0;

  // Button rect (shared layout)
  function primaryBtnRect() {
    return { x: (W - 180) / 2, y: H * 0.62, w: 180, h: 48 };
  }
  function gameOverBtnRect() {
    return { x: (W - 180) / 2, y: H / 2 + 220 / 2 - 56, w: 180, h: 48 };
  }

  // ─── Difficulty ─────────────────────────────────────────────────────────
  function difficultyAt(t) {
    // 0–3s warmup: wider, slower
    // 3–10s forgiving
    // after 10s tighten toward standard then ramp
    let gapH = GAP_DEFAULT;
    let speed = PIPE_SPEED_BASE;
    let spawnInterval = 1.55; // seconds between pipes

    if (t < 3) {
      gapH = 178;
      speed = PIPE_SPEED_BASE * 0.68;
      spawnInterval = 1.95;
    } else if (t < 10) {
      const k = (t - 3) / 7;
      gapH = 178 - k * 28; // 178 → 150
      speed = PIPE_SPEED_BASE * (0.68 + k * 0.32);
      spawnInterval = 1.95 - k * 0.4;
    } else {
      const k = Math.min(1, (t - 10) / 40);
      gapH = Math.max(GAP_FLOOR, GAP_DEFAULT - k * 30); // 150 → 120
      speed = PIPE_SPEED_BASE * (1 + k * 0.28); // soft cap ~-3.84
      spawnInterval = Math.max(1.15, 1.55 - k * 0.4);
    }
    return { gapH, speed, spawnInterval };
  }

  function randomGapY(gapH) {
    const lo = GAP_Y_MIN;
    const hi = H - gapH - GAP_Y_MIN - GROUND_H;
    return lo + Math.random() * Math.max(1, hi - lo);
  }

  function spawnPipe(gapH) {
    pipes.push({
      x: W + 20,
      gapY: randomGapY(gapH),
      gapH: gapH,
      scored: false,
    });
  }

  // ─── Drawing helpers ────────────────────────────────────────────────────
  function drawSky(c) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COLORS.skyLight);
    g.addColorStop(1, COLORS.skyDeep);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function drawSilhouette(c, scrollX) {
    const baseY = H - GROUND_H;
    const buildings = [
      { w: 42, h: 70 },
      { w: 55, h: 110 },
      { w: 38, h: 85 },
      { w: 60, h: 95 },
      { w: 45, h: 120 },
      { w: 50, h: 75 },
      { w: 40, h: 100 },
    ];
    const period = buildings.reduce((s, b) => s + b.w + 8, 0);
    let sx = -((scrollX % period) + period) % period;

    c.save();
    c.globalAlpha = 0.35;
    c.fillStyle = COLORS.silhouette;
    while (sx < W + 60) {
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        c.fillRect(sx, baseY - b.h, b.w, b.h);
        // tiny roof bump
        c.fillRect(sx + 4, baseY - b.h - 8, b.w * 0.35, 8);
        sx += b.w + 8;
      }
    }
    c.restore();
  }

  function drawGround(c) {
    c.fillStyle = COLORS.coffee;
    c.fillRect(0, H - GROUND_H, W, GROUND_H);
    c.strokeStyle = COLORS.silhouette;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, H - GROUND_H);
    c.lineTo(W, H - GROUND_H);
    c.stroke();
    // cream speckles
    c.fillStyle = COLORS.cream;
    c.globalAlpha = 0.15;
    for (let i = 0; i < 12; i++) {
      const gx = ((i * 37 + 11) % W);
      c.fillRect(gx, H - GROUND_H + 10 + (i % 3) * 10, 18, 3);
    }
    c.globalAlpha = 1;
  }

  /**
   * drawBean(ctx, x, y, rot, squash, wingPhase)
   * squash: 0..1 progress of squash (1 = full squash at click)
   * wingPhase: 0..1 within wing cycle
   */
  function drawBean(c, x, y, rot, squash, wingPhase) {
    const sx = 1 + 0.08 * squash;
    const sy = 1 - 0.12 * squash;

    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(sx, sy);

    // Wings (optional, visible when flapping)
    if (wingPhase > 0.05 && wingPhase < 0.95) {
      const flap = Math.sin(wingPhase * Math.PI) * (16 * Math.PI / 180);
      c.fillStyle = COLORS.skyDeep;
      // left
      c.save();
      c.rotate(-flap);
      c.beginPath();
      c.ellipse(-16, 2, 8, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      // right
      c.save();
      c.rotate(flap);
      c.beginPath();
      c.ellipse(16, 2, 8, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // Body
    c.fillStyle = COLORS.coffee;
    c.beginPath();
    c.ellipse(0, 0, BEAN_W / 2, BEAN_H / 2, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = COLORS.silhouette;
    c.lineWidth = 2;
    c.stroke();

    // Crease (slightly left for 3/4 feel)
    c.fillStyle = COLORS.silhouette;
    c.globalAlpha = 0.35;
    c.beginPath();
    c.ellipse(-2, 0, 2.5, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    // Highlight
    c.fillStyle = COLORS.cream;
    c.globalAlpha = 0.85;
    c.beginPath();
    c.ellipse(-5, -7, 4, 5, -0.3, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    c.restore();
  }

  function drawOnePipe(c, x, y, h, flip) {
    // flip: true = top pipe (cap at bottom)
    const glass = COLORS.glass;
    c.fillStyle = glass;
    c.fillRect(x, y, PIPE_W, h);

    // left cream strip
    c.fillStyle = COLORS.cream;
    c.globalAlpha = 0.2;
    c.fillRect(x + 3, y, 5, h);
    c.globalAlpha = 1;

    // window hint lines
    c.strokeStyle = COLORS.silhouette;
    c.globalAlpha = 0.2;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + PIPE_W * 0.4, y + 4);
    c.lineTo(x + PIPE_W * 0.4, y + h - 4);
    c.moveTo(x + PIPE_W * 0.7, y + 4);
    c.lineTo(x + PIPE_W * 0.7, y + h - 4);
    c.stroke();
    c.globalAlpha = 1;

    // stroke
    c.strokeStyle = COLORS.silhouette;
    c.lineWidth = 2;
    c.strokeRect(x + 1, y + (flip ? 0 : 0), PIPE_W - 2, h);

    // Cap
    const capW = PIPE_W + PIPE_CAP_EXTRA;
    const capX = x - PIPE_CAP_EXTRA / 2;
    const capY = flip ? y + h - PIPE_CAP_H : y;
    c.fillStyle = glass;
    c.fillRect(capX, capY, capW, PIPE_CAP_H);
    c.fillStyle = COLORS.cream;
    c.globalAlpha = 0.15;
    c.fillRect(capX + 3, capY, 5, PIPE_CAP_H);
    c.globalAlpha = 1;
    c.strokeStyle = COLORS.silhouette;
    c.lineWidth = 2;
    c.strokeRect(capX + 1, capY + 1, capW - 2, PIPE_CAP_H - 2);
  }

  function drawPipePair(c, x, gapY, gapH) {
    // Top
    if (gapY > 0) drawOnePipe(c, x, 0, gapY, true);
    // Bottom
    const by = gapY + gapH;
    const bh = H - GROUND_H - by;
    if (bh > 0) drawOnePipe(c, x, by, bh, false);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawButton(c, rect, label, pressed) {
    c.fillStyle = pressed ? COLORS.buttonPress : COLORS.accent;
    roundRect(c, rect.x, rect.y, rect.w, rect.h, 12);
    c.fill();
    c.fillStyle = COLORS.cream;
    c.font = "bold 18px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  }

  function drawTitleUI(c) {
    const bob = Math.sin(titleBob) * 6;
    // Demo bean
    drawBean(c, W / 2, H * 0.38 + bob, -0.15, 0, (titleBob % (Math.PI * 2)) / (Math.PI * 2));

    c.fillStyle = COLORS.silhouette;
    c.font = "bold 30px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("晨光飞跃", W / 2, H * 0.22);

    c.fillStyle = COLORS.coffee;
    c.font = "13px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
    c.fillText("点一下 · 冲楼缝", W / 2, H * 0.22 + 28);

    if (best > 0) {
      c.fillStyle = COLORS.silhouette;
      c.font = "13px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
      c.fillText("最高 " + best, W / 2, H * 0.22 + 50);
    }

    drawButton(c, primaryBtnRect(), "冲！", btnPressed);
  }

  function drawPlayingHUD(c) {
    const pop = scorePopT > 0 ? 1 + 0.15 * Math.sin((1 - scorePopT / SCORE_POP_MS) * Math.PI) : 1;
    c.save();
    c.translate(W / 2, 32);
    c.scale(pop, pop);
    c.fillStyle = COLORS.accent;
    c.font = "bold 26px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(String(score), 0, 0);
    c.restore();
  }

  function drawGameOverUI(c) {
    // Panel
    const pw = 280;
    const ph = 200;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2 - 10;

    c.fillStyle = "rgba(42,31,26,0.35)";
    c.fillRect(0, 0, W, H);

    c.fillStyle = COLORS.cream;
    roundRect(c, px, py, pw, ph, 16);
    c.fill();
    c.strokeStyle = COLORS.silhouette;
    c.lineWidth = 2;
    roundRect(c, px, py, pw, ph, 16);
    c.stroke();

    c.fillStyle = COLORS.silhouette;
    c.font = "bold 20px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("本局结束", W / 2, py + 32);

    c.fillStyle = COLORS.accent;
    c.font = "bold 34px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
    c.fillText(String(score), W / 2, py + 72);

    c.fillStyle = COLORS.silhouette;
    c.font = "13px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
    c.fillText("最高 " + best, W / 2, py + 102);

    if (newRecord) {
      c.fillStyle = COLORS.coffee;
      c.font = "13px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
      c.fillText("破纪录！多喝一口再战", W / 2, py + 124);
    } else {
      c.fillStyle = COLORS.coffee;
      c.font = "12px -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif";
      c.fillText(failLine, W / 2, py + 124);
    }

    drawButton(c, gameOverBtnRect(), "再来一局", btnPressed);
  }

  // ─── Collision: circle vs AABB ───────────────────────────────────────────
  function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function checkCollisions() {
    const cx = bean.x;
    const cy = bean.y;
    const r = BEAN_R;

    // Ceiling / ground
    if (cy - r <= 0) return true;
    if (cy + r >= H - GROUND_H) return true;

    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      // Top pipe AABB
      if (circleHitsRect(cx, cy, r, p.x, 0, PIPE_W, p.gapY)) return true;
      // Bottom pipe AABB
      const by = p.gapY + p.gapH;
      const bh = H - GROUND_H - by;
      if (bh > 0 && circleHitsRect(cx, cy, r, p.x, by, PIPE_W, bh)) return true;
    }
    return false;
  }

  // ─── Game flow ──────────────────────────────────────────────────────────
  function resetPlay() {
    score = 0;
    newRecord = false;
    failLine = "";
    pipes = [];
    silScroll = 0;
    playTime = 0;
    deathTimer = 0;
    scorePopT = 0;
    spawnTimer = 2.8; // GDD: first pair ~2.5–3.5s
    bean.x = W / 3;
    bean.y = H / 2;
    bean.vy = 0;
    bean.rot = 0;
    bean.wingPhase = 0;
    bean.squashT = 0;
    bean.wingT = 0;
  }

  function startGame() {
    resetPlay();
    state = STATE.PLAYING;
    bean.vy = FLAP_IMPULSE;
    bean.squashT = SQUASH_MS;
    bean.wingT = WING_CYCLE_MS;
  }

  function kill() {
    if (state !== STATE.PLAYING) return;
    state = STATE.DYING;
    deathTimer = 0;
    failLine = FAIL_LINES[(Math.random() * FAIL_LINES.length) | 0];
    if (score > best) {
      best = score;
      newRecord = true;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (_) {}
    }
  }

  function showGameOver() {
    state = STATE.GAMEOVER;
    btnPressed = false;
  }

  function flap() {
    if (state === STATE.TITLE) {
      startGame();
      return;
    }
    if (state === STATE.GAMEOVER) {
      startGame();
      return;
    }
    if (state === STATE.PLAYING) {
      bean.vy = FLAP_IMPULSE;
      bean.squashT = SQUASH_MS;
      bean.wingT = WING_CYCLE_MS;
    }
  }

  // ─── Input ──────────────────────────────────────────────────────────────
  let lastTouchAt = 0; // suppress ghost mouse after touch

  function canvasToLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const rw = Math.max(1, rect.width);
    const rh = Math.max(1, rect.height);
    return {
      x: ((clientX - rect.left) / rw) * W,
      y: ((clientY - rect.top) / rh) * H,
    };
  }

  function hitBtn(p, rect) {
    return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  }

  function handlePress(clientX, clientY) {
    const p = canvasToLogical(clientX, clientY);

    if (state === STATE.TITLE) {
      const r = primaryBtnRect();
      if (hitBtn(p, r)) btnPressed = true;
      flap();
      return;
    }
    if (state === STATE.GAMEOVER) {
      const r = gameOverBtnRect();
      if (hitBtn(p, r)) btnPressed = true;
      // tap anywhere / Space-equivalent: restart
      flap();
      return;
    }
    if (state === STATE.PLAYING) {
      flap();
    }
  }

  function onTouchStart(e) {
    e.preventDefault();
    lastTouchAt = performance.now();
    const t = e.changedTouches[0];
    if (t) handlePress(t.clientX, t.clientY);
  }

  function onMouseDown(e) {
    // Ignore synthetic click ~300ms after touch
    if (performance.now() - lastTouchAt < 350) return;
    e.preventDefault();
    handlePress(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    btnPressed = false;
  }

  function onKeyDown(e) {
    if (e.code === "Space" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (e.repeat) return; // one flap per physical press
      flap();
    }
  }

  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mouseup", onPointerUp);
  canvas.addEventListener("mouseleave", onPointerUp);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchend", onPointerUp, { passive: false });
  canvas.addEventListener("touchcancel", onPointerUp, { passive: false });
  window.addEventListener("keydown", onKeyDown);

  // Prevent page scroll / bounce on mobile
  document.addEventListener(
    "touchmove",
    function (e) {
      e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener(
    "gesturestart",
    function (e) {
      e.preventDefault();
    },
    { passive: false }
  );

  // ─── Update / Render ────────────────────────────────────────────────────
  function update(dt) {
    // dt in seconds; frame factor relative to 60fps
    const f = dt * 60;

    titleBob += dt * 2.2;

    if (state === STATE.TITLE) {
      // idle bob only
      return;
    }

    if (state === STATE.PLAYING) {
      playTime += dt;

      // Physics
      bean.vy += GRAVITY * f;
      bean.y += bean.vy * f;

      // Rotation from vy
      if (bean.vy < 0) {
        bean.rot = Math.max(-22 * Math.PI / 180, bean.vy * 2.5 * Math.PI / 180);
      } else {
        bean.rot = Math.min(50 * Math.PI / 180, bean.vy * 3 * Math.PI / 180);
      }

      // Squash / wing timers
      if (bean.squashT > 0) bean.squashT = Math.max(0, bean.squashT - dt * 1000);
      if (bean.wingT > 0) {
        bean.wingT = Math.max(0, bean.wingT - dt * 1000);
        bean.wingPhase = 1 - bean.wingT / WING_CYCLE_MS;
      } else {
        bean.wingPhase = 0;
      }

      if (scorePopT > 0) scorePopT = Math.max(0, scorePopT - dt * 1000);

      const diff = difficultyAt(playTime);
      const speed = diff.speed; // already negative px/frame

      // Move pipes
      for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x += speed * f;
        if (!pipes[i].scored && pipes[i].x + PIPE_W < bean.x) {
          pipes[i].scored = true;
          score += 1;
          scorePopT = SCORE_POP_MS;
        }
        if (pipes[i].x + PIPE_W < -40) pipes.splice(i, 1);
      }

      silScroll += Math.abs(speed) * 0.3 * f;

      // Spawn
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnPipe(diff.gapH);
        spawnTimer = diff.spawnInterval;
      }

      if (checkCollisions()) kill();
      return;
    }

    if (state === STATE.DYING) {
      deathTimer += dt;
      bean.vy += GRAVITY * f * 1.2;
      bean.y += bean.vy * f;
      // Rotate toward 90°
      const target = Math.PI / 2;
      bean.rot = bean.rot + (target - bean.rot) * Math.min(1, dt * 6);
      if (bean.y > H + 40) bean.y = H + 40;
      if (deathTimer >= DEATH_PANEL_DELAY) showGameOver();
      return;
    }
  }

  function render() {
    drawSky(ctx);
    drawSilhouette(ctx, silScroll);
    for (let i = 0; i < pipes.length; i++) {
      drawPipePair(ctx, pipes[i].x, pipes[i].gapY, pipes[i].gapH);
    }
    drawGround(ctx);

    const squash = bean.squashT > 0 ? bean.squashT / SQUASH_MS : 0;
    if (state !== STATE.TITLE) {
      drawBean(ctx, bean.x, bean.y, bean.rot, squash, bean.wingPhase);
    }

    if (state === STATE.TITLE) {
      drawTitleUI(ctx);
    } else if (state === STATE.PLAYING || state === STATE.DYING) {
      drawPlayingHUD(ctx);
    } else if (state === STATE.GAMEOVER) {
      // still show last bean pose under overlay
      drawBean(ctx, bean.x, Math.min(bean.y, H - GROUND_H - 10), bean.rot, 0, 0);
      drawGameOverUI(ctx);
    }
  }

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    // Clamp dt to avoid huge jumps / rapid-tap physics blowups
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    update(dt);
    render();
    rafId = requestAnimationFrame(frame);
  }

  // Boot
  resetPlay();
  state = STATE.TITLE;
  rafId = requestAnimationFrame(frame);

  // Expose for debug (optional)
  window.__morningLeap = { COLORS, drawBean, drawPipePair, drawSky, BEST_KEY };
})();
