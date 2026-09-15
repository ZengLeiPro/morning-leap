/**
 * 《晨光神殿》美术绘制 API — art-spec-zeldalike-v1
 */
(function (global) {
  "use strict";

  const COLORS = {
    sky: "#FFE8C8",
    orange: "#F4A261",
    grass: "#3D8B6E",
    stone: "#6B7B84",
    temple: "#3D5A5B",
    wood: "#6F4E37",
    danger: "#E76F51",
    ink: "#2A1F1A",
    cream: "#F5E6D3",
    water: "#5B8FA8",
  };

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawTile(ctx, id, x, y, seed) {
    const T = 16;
    const s = (seed || 0) | 0;
    ctx.save();
    ctx.translate(x, y);
    switch (id) {
      case 0: // G0 empty/hole
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(0, 0, T, T);
        break;
      case 1: // G1 grass
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = COLORS.orange;
        if ((s * 7 + 3) % 5 === 0) ctx.fillRect(3, 4, 1, 1);
        if ((s * 11 + 1) % 7 === 0) ctx.fillRect(11, 9, 1, 1);
        if ((s * 3) % 6 === 0) ctx.fillRect(7, 12, 1, 1);
        break;
      case 2: // G2 path
        ctx.fillStyle = COLORS.stone;
        ctx.fillRect(0, 0, T, T);
        ctx.strokeStyle = "rgba(42,31,26,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(8, 0); ctx.lineTo(8, 16);
        ctx.moveTo(0, 8); ctx.lineTo(16, 8);
        ctx.stroke();
        break;
      case 3: // G3 temple floor
        ctx.fillStyle = COLORS.temple;
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = "rgba(255,232,200,0.12)";
        ctx.fillRect(3, 3, 10, 10);
        break;
      case 4: // W1 wall village
        ctx.fillStyle = COLORS.stone;
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = "rgba(255,232,200,0.35)";
        ctx.fillRect(0, 0, T, 3);
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, T - 1, T - 1);
        break;
      case 5: // W2 temple wall
        ctx.fillStyle = COLORS.temple;
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = COLORS.sky;
        ctx.fillRect(0, 0, T, 2);
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, T - 1, T - 1);
        break;
      case 6: // D1 door open
        ctx.fillStyle = COLORS.temple;
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(3, 2, 10, 14);
        break;
      case 7: // D2 door locked
        ctx.fillStyle = COLORS.temple;
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(3, 2, 10, 14);
        ctx.fillStyle = COLORS.wood;
        ctx.fillRect(6, 7, 4, 5);
        ctx.fillStyle = COLORS.orange;
        ctx.fillRect(7, 8, 2, 2);
        break;
      case 8: // WTR water
        ctx.fillStyle = COLORS.water;
        ctx.fillRect(0, 0, T, T);
        ctx.strokeStyle = "rgba(255,232,200,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(2, 6); ctx.quadraticCurveTo(8, 4, 14, 7);
        ctx.stroke();
        break;
      case 9: // DEC flower
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = COLORS.orange;
        ctx.beginPath();
        ctx.arc(8, 8, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.danger;
        ctx.fillRect(7, 7, 2, 2);
        break;
      case 10: // spike
        ctx.fillStyle = COLORS.temple;
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = COLORS.ink;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(2 + i * 4, 14);
          ctx.lineTo(4 + i * 4, 4);
          ctx.lineTo(6 + i * 4, 14);
          ctx.fill();
        }
        break;
      case 11: // boss circle floor accent
        ctx.fillStyle = COLORS.temple;
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = "rgba(107,123,132,0.5)";
        ctx.fillRect(1, 1, 14, 14);
        break;
      default:
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(0, 0, T, T);
    }
    ctx.restore();
  }

  function drawSwitch(ctx, x, y, pressed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = COLORS.temple;
    ctx.fillRect(0, 0, 16, 16);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, Math.PI * 2);
    ctx.stroke();
    const scale = pressed ? 0.85 : 1;
    ctx.translate(8, 8);
    ctx.scale(scale, scale);
    ctx.translate(-8, -8);
    ctx.fillStyle = pressed ? COLORS.wood : COLORS.cream;
    ctx.beginPath();
    ctx.arc(8, 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (!pressed) {
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.arc(8, 8, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = COLORS.grass;
      ctx.beginPath();
      ctx.arc(8, 8, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHero(ctx, x, y, dir, frame, swingT, hurtFlash, winPose) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (hurtFlash) {
      ctx.globalAlpha = (Math.floor(Date.now() / 80) % 2) ? 0.35 : 1;
    }
    const bob = frame % 2 === 0 ? 0 : 1;
    // cloak
    ctx.fillStyle = COLORS.wood;
    if (dir === 0) { // down
      ctx.fillRect(-5, -2 + bob, 10, 8);
    } else if (dir === 1) { // up
      ctx.beginPath();
      ctx.moveTo(-6, -4); ctx.lineTo(6, -4); ctx.lineTo(5, 8); ctx.lineTo(-5, 8);
      ctx.fill();
    } else {
      ctx.fillRect(dir === 2 ? -2 : -6, -2 + bob, 8, 9);
    }
    // body bean
    ctx.fillStyle = COLORS.wood;
    ctx.beginPath();
    ctx.ellipse(0, 0 + bob, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.ellipse(-1.5, -1 + bob, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes (facing camera / sides)
    if (dir === 0) {
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(-3, -2 + bob, 2, 2);
      ctx.fillRect(1, -2 + bob, 2, 2);
    } else if (dir === 2 || dir === 3) {
      ctx.fillStyle = COLORS.ink;
      const ex = dir === 3 ? 2 : -4;
      ctx.fillRect(ex, -2 + bob, 2, 2);
    }
    // sword
    const swinging = swingT > 0 && swingT < 180;
    let sx = 6, sy = 0, sw = 2, sh = 10, rot = 0;
    if (dir === 0) { sx = 7; sy = -2; sw = 2; sh = swinging ? 14 : 10; rot = swinging ? Math.PI / 2 * (swingT / 180) : 0.2; }
    if (dir === 1) { sx = -1; sy = -14; sw = 2; sh = swinging ? 14 : 10; rot = swinging ? -0.4 : 0; }
    if (dir === 2) { sx = -12; sy = -2; sw = swinging ? 14 : 10; sh = 2; rot = swinging ? -0.6 : 0; }
    if (dir === 3) { sx = 4; sy = -2; sw = swinging ? 14 : 10; sh = 2; rot = swinging ? 0.6 : 0; }
    if (winPose) {
      sx = -1; sy = -16; sw = 2; sh = 12; rot = 0;
    }
    ctx.save();
    ctx.translate(sx + sw / 2, sy + sh / 2);
    ctx.rotate(rot);
    ctx.fillStyle = COLORS.stone;
    ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(-sw / 2, sh / 2 - 2, sw, 2);
    ctx.restore();
    // feet bob
    ctx.fillStyle = COLORS.ink;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(-4, 7 + bob, 3, 1);
    ctx.fillRect(1, 7 + (bob ? 0 : 1), 3, 1);
    ctx.restore();
  }

  function drawNpc(ctx, x, y, kind, flash) {
    // kind: elder | merchant | villager
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    const cloak = kind === "elder" ? COLORS.orange : kind === "merchant" ? COLORS.grass : COLORS.stone;
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.moveTo(-6, -4); ctx.lineTo(6, -4); ctx.lineTo(5, 9); ctx.lineTo(-5, 9);
    ctx.fill();
    ctx.fillStyle = COLORS.wood;
    ctx.beginPath();
    ctx.ellipse(0, kind === "elder" ? -2 : 0, 6, kind === "elder" ? 8 : 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.ellipse(-1, kind === "elder" ? -4 : -2, 2.2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(-3, kind === "elder" ? -5 : -3, 2, 2);
    ctx.fillRect(1, kind === "elder" ? -5 : -3, 2, 2);
    if (kind === "elder") {
      ctx.strokeStyle = COLORS.wood;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(7, -10); ctx.lineTo(7, 8);
      ctx.stroke();
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.arc(7, -11, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (flash) {
      ctx.fillStyle = COLORS.orange;
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("!", -2, -14);
    }
    ctx.restore();
  }

  function drawSlime(ctx, x, y, indoor, squash, flash) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    const sy = squash ? 0.4 : 1;
    ctx.scale(1, sy);
    ctx.fillStyle = indoor ? COLORS.temple : COLORS.grass;
    if (flash) ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.danger;
    ctx.fillRect(-4, -2, 2, 2);
    ctx.fillRect(2, -2, 2, 2);
    ctx.restore();
  }

  function drawStone(ctx, x, y, flash) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.fillStyle = flash ? COLORS.cream : COLORS.stone;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, -2); ctx.lineTo(2, 3); ctx.lineTo(6, -1);
    ctx.stroke();
    ctx.fillStyle = COLORS.danger;
    ctx.fillRect(-4, -4, 2, 2);
    ctx.fillRect(2, -4, 2, 2);
    ctx.restore();
  }

  function drawBoss(ctx, x, y, phase, flash, dead, telegraph, timeMs) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (dead) ctx.globalAlpha = 0.4;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.fillStyle = flash ? COLORS.cream : COLORS.stone;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-14, -14, 28, 28, 3) : (() => { ctx.rect(-14, -14, 28, 28); })();
    ctx.fill();
    ctx.stroke();
    // horns
    ctx.fillStyle = flash ? COLORS.cream : COLORS.ink;
    ctx.beginPath();
    ctx.moveTo(-10, -14); ctx.lineTo(-6, -22); ctx.lineTo(-2, -14);
    ctx.moveTo(2, -14); ctx.lineTo(6, -22); ctx.lineTo(10, -14);
    ctx.fill();
    // idle eyes (P1 danger red / P2 orange) — under telegraph overlay
    if (!telegraph) {
      ctx.fillStyle = phase >= 2 ? COLORS.orange : COLORS.danger;
      ctx.fillRect(-7, -4, 4, 4);
      ctx.fillRect(3, -4, 4, 4);
    }
    // P0 telegraph: draw ABOVE body — enlarged flashing orange eyes (distinct from idle red)
    if (telegraph) {
      const t = timeMs || 0;
      const pulse = 0.55 + 0.45 * Math.sin(t * 0.05);
      ctx.save();
      ctx.globalAlpha = pulse;
      // outer glow discs
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.arc(-5, -2, 7, 0, Math.PI * 2);
      ctx.arc(5, -2, 7, 0, Math.PI * 2);
      ctx.fill();
      // bright cream cores for contrast
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.cream;
      ctx.beginPath();
      ctx.arc(-5, -2, 3, 0, Math.PI * 2);
      ctx.arc(5, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      // ink rings
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-5, -2, 7, 0, Math.PI * 2);
      ctx.arc(5, -2, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawChest(ctx, x, y, open) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(-8, -4, 16, 12);
    if (open) {
      ctx.save();
      ctx.translate(-8, -4);
      ctx.rotate(-Math.PI / 12);
      ctx.fillRect(0, -6, 16, 6);
      ctx.restore();
      ctx.fillStyle = COLORS.cream;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(-4, -2, 8, 6);
    } else {
      ctx.fillStyle = COLORS.orange;
      ctx.fillRect(-8, 0, 16, 3);
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(-1, 0, 2, 3);
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(-8, -4, 16, 12);
    ctx.restore();
  }

  function drawKey(ctx, x, y, bob) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y + bob));
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(-2, -6, 4, 8);
    ctx.beginPath();
    ctx.arc(0, -7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(2, 0, 3, 2);
    ctx.fillRect(2, 3, 4, 2);
    ctx.restore();
  }

  function drawCoin(ctx, x, y, bob) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y + bob));
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.sky;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-1, -1, 2, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSign(ctx, x, y) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.fillStyle = COLORS.stone;
    ctx.fillRect(-6, -8, 12, 14);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(-3, -2, 6, 2);
    ctx.strokeStyle = COLORS.ink;
    ctx.strokeRect(-6, -8, 12, 14);
    ctx.restore();
  }

  function drawCore(ctx, x, y, t) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    const pulse = 1 + Math.sin(t * 0.006) * 0.1;
    ctx.scale(pulse, pulse);
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.sky;
    ctx.beginPath();
    ctx.arc(-2, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHeart(ctx, x, y, full) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(5, 3);
    ctx.bezierCurveTo(5, 0, 0, 0, 0, 3.5);
    ctx.bezierCurveTo(0, 6, 5, 9, 5, 9);
    ctx.bezierCurveTo(5, 9, 10, 6, 10, 3.5);
    ctx.bezierCurveTo(10, 0, 5, 0, 5, 3);
    if (full) {
      ctx.fillStyle = COLORS.danger;
      ctx.fill();
    } else {
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHUD(ctx, hearts, maxHearts, keys, coins, quest) {
    // hearts
    for (let i = 0; i < maxHearts; i++) {
      const full = hearts >= i + 1 || (hearts > i && hearts < i + 1); // half?
      if (hearts >= i + 1) {
        drawHeart(ctx, 8 + i * 12, 6, true);
      } else if (hearts > i) {
        // half heart: clip
        ctx.save();
        ctx.beginPath();
        ctx.rect(8 + i * 12, 6, 5, 9);
        ctx.clip();
        drawHeart(ctx, 8 + i * 12, 6, true);
        ctx.restore();
        drawHeart(ctx, 8 + i * 12, 6, false);
      } else {
        drawHeart(ctx, 8 + i * 12, 6, false);
      }
    }
    // keys
    ctx.fillStyle = COLORS.orange;
    ctx.fillRect(8, 20, 3, 6);
    ctx.beginPath();
    ctx.arc(9.5, 18, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.cream;
    ctx.font = "12px sans-serif";
    ctx.fillText("×" + keys, 16, 26);
    // coins
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(620, 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.cream;
    ctx.textAlign = "right";
    ctx.fillText(String(coins), 612, 18);
    ctx.textAlign = "left";
    if (quest) {
      ctx.fillStyle = "rgba(42,31,26,0.55)";
      ctx.fillRect(180, 4, 280, 18);
      ctx.fillStyle = COLORS.cream;
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(quest, 320, 17);
      ctx.textAlign = "left";
    }
  }

  function drawDialog(ctx, name, text) {
    const w = 560, h = 72, x = (640 - w) / 2, y = 360 - h - 12;
    ctx.save();
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = COLORS.cream;
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.wood;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(name || "", x + 16, y + 20);
    ctx.fillStyle = COLORS.ink;
    ctx.font = "13px sans-serif";
    wrapText(ctx, text || "", x + 16, y + 40, w - 32, 16);
    ctx.fillStyle = "rgba(42,31,26,0.45)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("E / 空格 继续", x + w - 16, y + h - 8);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    let line = "";
    let yy = y;
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = ch;
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function drawPanel(ctx, title, body, buttons) {
    const w = 280, h = 160, x = (640 - w) / 2, y = (360 - h) / 2;
    ctx.save();
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = COLORS.cream;
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, 320, y + 36);
    ctx.font = "13px sans-serif";
    wrapTextCentered(ctx, body, 320, y + 62, w - 40, 16);
    (buttons || []).forEach((b, i) => {
      const bw = 140, bh = 36;
      const bx = 320 - bw / 2;
      const by = y + h - 52 - (buttons.length - 1 - i) * 42;
      roundRect(ctx, bx, by, bw, bh, 6);
      ctx.fillStyle = COLORS.orange;
      ctx.fill();
      ctx.strokeStyle = COLORS.ink;
      ctx.stroke();
      ctx.fillStyle = COLORS.cream;
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(b, 320, by + 24);
    });
    ctx.textAlign = "left";
    ctx.restore();
  }

  function wrapTextCentered(ctx, text, cx, y, maxW, lineH) {
    const words = text.split("");
    let line = "";
    let yy = y;
    const lines = [];
    for (const ch of words) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = ch;
      } else line = test;
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, cx, yy + i * lineH));
  }

  function drawHouse(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = COLORS.wood;
    ctx.fillRect(0, 8, w, h - 8);
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.moveTo(-4, 8); ctx.lineTo(w / 2, -6); ctx.lineTo(w + 4, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(w / 2 - 4, h - 14, 8, 14);
    ctx.restore();
  }


  function drawHeartPickup(ctx, x, y, t) {
    const bob = Math.sin((t || 0) * 0.0105) * 2; // ~600ms period
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y + bob));
    // 8x8 heart: two circles + triangle
    ctx.beginPath();
    ctx.arc(-2, -1.5, 2.2, 0, Math.PI * 2);
    ctx.arc(2, -1.5, 2.2, 0, Math.PI * 2);
    ctx.moveTo(-4, -0.5);
    ctx.lineTo(0, 5);
    ctx.lineTo(4, -0.5);
    ctx.closePath();
    ctx.fillStyle = COLORS.danger;
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.arc(-1, -2, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  global.TempleArt = {
    COLORS,
    drawTile,
    drawSwitch,
    drawHero,
    drawNpc,
    drawSlime,
    drawStone,
    drawBoss,
    drawChest,
    drawKey,
    drawCoin,
    drawSign,
    drawCore,
    drawHUD,
    drawDialog,
    drawPanel,
    drawHouse,
    drawHeartPickup,
  };
})(typeof window !== "undefined" ? window : globalThis);
