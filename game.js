/**
 * 《晨光飞跃》Morning Leap
 * Flappy Bird–like · Canvas primitives · art-spec v1.1
 */
(function () {
  "use strict";

  // ——— Palette (art-spec v1.1) ———
  const COLORS = {
    skyTop: "#FFE8C8",
    skyBot: "#F4A261",
    bean: "#6F4E37",
    cream: "#F5E6D3",
    glass: "#7A9EAF",
    ink: "#2A1F1A",
    accent: "#F4A261",
  };

  const W = 400;
  const H = 600;
  const BEST_KEY = "morning-leap-best";

  // Bean
  const BEAN_W = 28;
  const BEAN_H = 34;
  const BEAN_R = 14;

  // Pipes
  const PIPE_W = 56;
  const CAP_EXTRA = 14;
  const CAP_H = 14;
  const GAP_EASY = 170;
  const GAP_HARD = 140;
  const GAP_MARGIN = 70;

  // Physics (dt-normalized @ 60fps reference)
  const GRAVITY = 0.42;
  const FLAP_VY = -7.2;
  const MAX_FALL = 11;
  const GROUND_H = 48;
  const CEIL_Y = 0;

  // Difficulty: first ~10s easier
  const EASY_MS = 10000;
  const SPEED_EASY = 2.4;
  const SPEED_HARD = 3.4;
  const SPAWN_EASY = 200;
  const SPAWN_HARD = 165;

  const STATE = { TITLE: 0, PLAY: 1, DEAD: 2, OVER: 3 };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  let state = STATE.TITLE;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let bean = null;
  let pipes = [];
  let spawnTimer = 0;
  let elapsed = 0;
  let deadTimer = 0;
  let scorePop = 0;
  let wingPhase = 0;
  let squash = 1;
  let squashT = 0;
  let btnHover = false;
  let btnPressed = false;
  let silX = 0;
  let lastTs = 0;
  let animId = 0;

  function difficulty(t) {
    const k = Math.min(1, Math.max(0, (t - EASY_MS) / 4000));
    return {
      speed: SPEED_EASY + (SPEED_HARD - SPEED_EASY) * k,
      gap: GAP_EASY + (GAP_HARD - GAP_EASY) * k,
      spawn: SPAWN_EASY + (SPAWN_HARD - SPAWN_EASY) * k,
    };
  }

  function resetBean() {
    bean = {
      x: W * 0.32,
      y: H * 0.42,
      vy: 0,
      rot: 0,
      alive: true,
    };
  }

  function startGame() {
    state = STATE.PLAY;
    score = 0;
    pipes = [];
    spawnTimer = 80;
    elapsed = 0;
    deadTimer = 0;
    scorePop = 0;
    wingPhase = 0;
    squash = 1;
    squashT = 0;
    resetBean();
    flap();
  }

  function flap() {
    if (!bean || !bean.alive) return;
    bean.vy = FLAP_VY;
    squash = 0.88;
    squashT = 100;
    wingPhase = 1;
  }

  function onInput(e) {
    if (e) {
      if (e.type === "keydown" && e.code !== "Space" && e.key !== " ") return;
      if (e.type === "keydown" || e.type === "touchstart") {
        e.preventDefault();
      }
    }

    const point = getEventPoint(e);
    if (state === STATE.TITLE) {
      if (pointInButton(point)) {
        startGame();
      } else if (!point || hitCanvas(point)) {
        // click anywhere / space also starts from title after hint
        startGame();
      }
      return;
    }
    if (state === STATE.OVER) {
      if (pointInButton(point) || (e && e.type === "keydown")) {
        startGame();
      }
      return;
    }
    if (state === STATE.PLAY) {
      flap();
    }
  }

  function getEventPoint(e) {
    if (!e) return null;
    let clientX, clientY;
    if (e.touches && e.touches.length) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else if (typeof e.clientX === "number") {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return null;
    }
    const r = canvas.getBoundingClientRect();
    const sx = W / r.width;
    const sy = H / r.height;
    return { x: (clientX - r.left) * sx, y: (clientY - r.top) * sy };
  }

  function hitCanvas(p) {
    return p && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
  }

  function buttonRect() {
    return { x: (W - 180) / 2, y: H * 0.62, w: 180, h: 48 };
  }

  function pointInButton(p) {
    if (!p) return false;
    const b = buttonRect();
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  function spawnPipe(gapH) {
    const minY = GAP_MARGIN;
    const maxY = H - GROUND_H - gapH - GAP_MARGIN;
    const gapY = minY + Math.random() * Math.max(1, maxY - minY);
    pipes.push({
      x: W + 10,
      gapY,
      gapH,
      scored: false,
    });
  }

  function kill() {
    if (state !== STATE.PLAY) return;
    state = STATE.DEAD;
    bean.alive = false;
    deadTimer = 0;
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (_) {}
    }
  }

  function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function update(dt) {
    const frames = dt / (1000 / 60);
    silX = (silX - 0.9 * frames) % 80;

    if (squashT > 0) {
      squashT -= dt;
      const t = Math.max(0, squashT) / 100;
      squash = 0.88 + (1 - 0.88) * (1 - t);
      if (squashT <= 0) squash = 1;
    }

    if (wingPhase > 0) {
      wingPhase = Math.max(0, wingPhase - dt / 120);
    }

    if (scorePop > 0) scorePop = Math.max(0, scorePop - dt);

    if (state === STATE.TITLE) {
      // idle bob
      if (!bean) resetBean();
      bean.y = H * 0.42 + Math.sin(performance.now() / 400) * 6;
      bean.rot = Math.sin(performance.now() / 500) * 0.08;
      return;
    }

    if (state === STATE.PLAY || state === STATE.DEAD) {
      elapsed += dt;
      const diff = difficulty(elapsed);

      bean.vy = Math.min(MAX_FALL, bean.vy + GRAVITY * frames);
      bean.y += bean.vy * frames;

      // rotation from vy
      if (bean.vy < 0) {
        bean.rot = Math.max((-22 * Math.PI) / 180, (bean.vy * 2.5 * Math.PI) / 180);
      } else {
        bean.rot = Math.min((50 * Math.PI) / 180, (bean.vy * 3 * Math.PI) / 180);
      }

      if (state === STATE.DEAD) {
        bean.rot = Math.min(bean.rot + 0.08 * frames, (90 * Math.PI) / 180);
        deadTimer += dt;
        if (deadTimer >= 300) state = STATE.OVER;
        // still collide with ground visually
        if (bean.y + BEAN_R > H - GROUND_H) {
          bean.y = H - GROUND_H - BEAN_R;
          bean.vy = 0;
        }
        return;
      }

      // pipes
      spawnTimer -= frames * (60 / 60) * (diff.speed / SPEED_EASY) * 1.15;
      // distance-based: move pipes, spawn by gap in x
      let rightmost = -Infinity;
      for (const p of pipes) {
        p.x -= diff.speed * frames;
        if (p.x > rightmost) rightmost = p.x;
      }
      if (pipes.length === 0 || rightmost < W - diff.spawn) {
        spawnPipe(diff.gap);
      }
      pipes = pipes.filter((p) => p.x > -PIPE_W - CAP_EXTRA);

      // score + collision
      const cx = bean.x;
      const cy = bean.y;
      const r = BEAN_R - 1;

      if (cy - r <= CEIL_Y || cy + r >= H - GROUND_H) {
        kill();
        return;
      }

      for (const p of pipes) {
        const topH = p.gapY;
        const botY = p.gapY + p.gapH;
        const botH = H - GROUND_H - botY;
        if (
          circleRectHit(cx, cy, r, p.x, 0, PIPE_W, topH) ||
          circleRectHit(cx, cy, r, p.x, botY, PIPE_W, botH)
        ) {
          kill();
          return;
        }
        if (!p.scored && p.x + PIPE_W < cx) {
          p.scored = true;
          score += 1;
          scorePop = 160;
        }
      }
    }
  }

  // ——— Drawing ———

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COLORS.skyTop);
    g.addColorStop(1, COLORS.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // soft sun
    ctx.beginPath();
    ctx.arc(W * 0.78, H * 0.18, 36, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 232, 200, 0.55)";
    ctx.fill();
  }

  function drawSilhouette() {
    const baseY = H - GROUND_H;
    const hMax = 110;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = COLORS.ink;
    const heights = [70, 100, 55, 90, 65, 105, 48, 80];
    const widths = [36, 28, 42, 30, 38, 26, 34, 40];
    let x = silX - 80;
    let i = 0;
    while (x < W + 80) {
      const bw = widths[i % widths.length];
      const bh = heights[i % heights.length];
      ctx.fillRect(x, baseY - bh, bw, bh);
      // tiny roof bump
      ctx.fillRect(x + 4, baseY - bh - 8, bw * 0.35, 8);
      x += bw + 6;
      i++;
    }
    ctx.restore();
  }

  function drawGround() {
    ctx.fillStyle = COLORS.bean;
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    ctx.fillStyle = "rgba(42, 31, 26, 0.25)";
    ctx.fillRect(0, H - GROUND_H, W, 4);
    // speckles
    ctx.fillStyle = "rgba(245, 230, 211, 0.15)";
    for (let i = 0; i < 12; i++) {
      const gx = ((i * 53 + Math.floor(-silX * 2)) % W + W) % W;
      ctx.fillRect(gx, H - GROUND_H + 12 + (i % 3) * 8, 6, 3);
    }
  }

  function drawPipePair(x, gapY, gapH) {
    const topH = gapY;
    const botY = gapY + gapH;
    const botH = H - GROUND_H - botY;

    drawPipeBody(x, 0, topH, true);
    drawPipeBody(x, botY, botH, false);
  }

  function drawPipeBody(x, y, h, isTop) {
    if (h <= 0) return;
    const glassDeep = "#6A8A9A";

    ctx.fillStyle = COLORS.glass;
    ctx.fillRect(x, y, PIPE_W, h);

    // left highlight strip
    ctx.fillStyle = "rgba(245, 230, 211, 0.2)";
    ctx.fillRect(x + 2, y, 5, h);

    // window lines
    ctx.strokeStyle = "rgba(42, 31, 26, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + PIPE_W * 0.38, y + 4);
    ctx.lineTo(x + PIPE_W * 0.38, y + h - 4);
    ctx.moveTo(x + PIPE_W * 0.68, y + 4);
    ctx.lineTo(x + PIPE_W * 0.68, y + h - 4);
    ctx.stroke();

    // cap
    const capW = PIPE_W + CAP_EXTRA;
    const capX = x - CAP_EXTRA / 2;
    let capY;
    if (isTop) {
      capY = y + h - CAP_H;
    } else {
      capY = y;
    }
    ctx.fillStyle = glassDeep;
    roundRect(capX, capY, capW, CAP_H, 3);
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // outline body
    ctx.strokeStyle = "rgba(42, 31, 26, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, PIPE_W - 1, h - 1);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBean(x, y, rot, squashY, wing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const sx = 1 + (1 - squashY) * 0.9;
    const sy = squashY;
    ctx.scale(sx, sy);

    // wings
    if (wing > 0.05) {
      const ang = (16 * Math.PI) / 180 * Math.sin(wing * Math.PI);
      ctx.fillStyle = COLORS.accent;
      ctx.save();
      ctx.rotate(-ang);
      ctx.beginPath();
      ctx.ellipse(-12, -2, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(12, -2, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // body
    ctx.beginPath();
    ctx.ellipse(0, 0, BEAN_W / 2, BEAN_H / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.bean;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();

    // crease
    ctx.beginPath();
    ctx.ellipse(-2, 0, 2.2, BEAN_H * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(42, 31, 26, 0.35)";
    ctx.fill();

    // highlight
    ctx.beginPath();
    ctx.ellipse(-5, -7, 4, 5, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(245, 230, 211, 0.85)";
    ctx.fill();

    ctx.restore();
  }

  function drawScoreHUD() {
    if (state !== STATE.PLAY && state !== STATE.DEAD) return;
    const pop = scorePop > 0 ? 1 + 0.15 * (scorePop / 160) : 1;
    ctx.save();
    ctx.translate(W / 2, 32);
    ctx.scale(pop, pop);
    ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.ink;
    ctx.fillStyle = COLORS.accent;
    ctx.strokeText(String(score), 0, 0);
    ctx.fillText(String(score), 0, 0);
    ctx.restore();
  }

  function drawButton(label, pressed) {
    const b = buttonRect();
    const fill = pressed ? "#D4894A" : COLORS.accent;
    ctx.save();
    roundRect(b.x, b.y, b.w, b.h, 12);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.cream;
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.restore();
  }

  function drawTitle() {
    ctx.font = "bold 30px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("晨光飞跃", W / 2, H * 0.22);

    ctx.font = "13px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = COLORS.bean;
    ctx.fillText("点击或按空格起飞", W / 2, H * 0.22 + 36);

    ctx.font = "12px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = "rgba(42, 31, 26, 0.55)";
    ctx.fillText("点一下 · 冲楼缝", W / 2, H * 0.22 + 56);

    drawButton("冲！", btnPressed && btnHover);

    if (best > 0) {
      ctx.font = "13px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
      ctx.fillStyle = COLORS.ink;
      ctx.fillText("最高 " + best, W / 2, buttonRect().y + 68);
    }
  }

  function drawGameOver() {
    // panel
    const pw = 280;
    const ph = 200;
    const px = (W - pw) / 2;
    const py = H * 0.28;
    roundRect(px, py, pw, ph, 16);
    ctx.fillStyle = COLORS.cream;
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("游戏结束", W / 2, py + 36);

    ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(String(score), W / 2, py + 88);

    ctx.font = "13px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = COLORS.ink;
    ctx.fillText("最高 " + best, W / 2, py + 122);

    // move button into panel area visually — use fixed buttonRect but draw label
    // Override button Y for over screen
    const b = { x: (W - 180) / 2, y: py + ph - 58, w: 180, h: 48 };
    // temporarily draw custom button here
    const fill = btnPressed && pointInCustomBtn(b) ? "#D4894A" : COLORS.accent;
    roundRect(b.x, b.y, b.w, b.h, 12);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = COLORS.cream;
    ctx.fillText("再来一局", b.x + b.w / 2, b.y + b.h / 2 + 1);

    // store for hit test
    drawGameOver._btn = b;
  }

  function pointInCustomBtn(b) {
    // used only during press feedback; hit test uses buttonRect override below
    return btnHover;
  }

  // Patch button hit for game over panel position
  const _origButtonRect = buttonRect;
  function buttonRectLive() {
    if (state === STATE.OVER && drawGameOver._btn) return drawGameOver._btn;
    return _origButtonRect();
  }

  // rebind pointInButton to live rect
  function pointInButtonLive(p) {
    if (!p) return false;
    const b = buttonRectLive();
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  // Replace references used by input — monkey-patch via wrappers already calling pointInButton
  // We'll redefine onInput hit to use live; simpler: overwrite pointInButton
  // Actually pointInButton is const-bound via function declaration hoisting...
  // Re-assign by updating the outer function through a mutable ref:

  // Fix: redefine hit helpers used in handlers
  window.__mlb_pointInButton = function (p) {
    return pointInButtonLive(p);
  };

  function render() {
    drawSky();
    drawSilhouette();

    for (const p of pipes) {
      drawPipePair(p.x, p.gapY, p.gapH);
    }

    drawGround();

    if (bean) {
      drawBean(bean.x, bean.y, bean.rot, squash, wingPhase);
    }

    drawScoreHUD();

    if (state === STATE.TITLE) {
      drawTitle();
    } else if (state === STATE.OVER) {
      drawGameOver();
    }
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 50) dt = 50;
    update(dt);
    render();
    animId = requestAnimationFrame(loop);
  }

  // ——— Events ———
  function handlePointer(e) {
    // use live button hit
    if (e) {
      if (e.type === "keydown") {
        if (e.code !== "Space" && e.key !== " ") return;
        e.preventDefault();
      }
      if (e.type === "touchstart") e.preventDefault();
    }

    const point = getEventPoint(e);

    if (state === STATE.TITLE) {
      startGame();
      return;
    }
    if (state === STATE.OVER) {
      if (!point || pointInButtonLive(point) || (e && e.type === "keydown")) {
        startGame();
      }
      return;
    }
    if (state === STATE.PLAY) {
      flap();
    }
  }

  canvas.addEventListener("mousedown", (e) => {
    btnPressed = true;
    btnHover = pointInButtonLive(getEventPoint(e));
    handlePointer(e);
  });
  canvas.addEventListener("mouseup", () => {
    btnPressed = false;
  });
  canvas.addEventListener(
    "touchstart",
    (e) => {
      btnPressed = true;
      btnHover = pointInButtonLive(getEventPoint(e));
      handlePointer(e);
    },
    { passive: false }
  );
  canvas.addEventListener("touchend", () => {
    btnPressed = false;
  });
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handlePointer(e);
      }
    },
    { passive: false }
  );
  // prevent scroll / bounce on touch move over page
  window.addEventListener(
    "touchmove",
    (e) => {
      if (e.target === canvas || canvas.contains(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener("mousemove", (e) => {
    btnHover = pointInButtonLive(getEventPoint(e));
  });

  // boot
  resetBean();
  requestAnimationFrame(loop);
})();
