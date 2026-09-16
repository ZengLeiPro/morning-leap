/**
 * 《晨光神殿》方案 B 美术 — Kenney Tiny Town/Dungeon + Puny Characters
 * 矢量仅可选 DEBUG_WIRE；成品一律 drawImage 图集。
 */
(function (global) {
  "use strict";

  // tilemap_packed.png is tightly packed (192×176 = 12×11 @ 16px) — NO 1px gap
  const COLS = 12, TW = 16, GAP = 0, STRIDE = TW + GAP; // 16
  const FW = 32, FH = 32, FCOLS = 24;
  const DEBUG_WIRE = false;

  // logical tile id → kenney atlas id (village uses town, temple uses dungeon)
  const TOWN_MAP = {
    0: 0,   // empty → grass fallback
    1: 0,   // grass
    2: 25,  // path center dirt (Kenney 25; avoid 12 edge shred)
    3: 0,   // (unused outdoors)
    4: 4,   // wall → tree solid look
    5: 5,   // alt tree
    // 6/7 village→temple gate: drawn from dungeon atlas door 10/9 (not town 108/109 stone)
    6: 10,  // open door (dungeon kid; see drawTile outdoor special-case)
    7: 9,   // locked door (dungeon kid)
    8: 0,   // water removed from feel-slice — grass if any leftover
    9: 2,   // flower
    10: 1,  // deco grass
    11: 0,
  };

  const DUN_MAP = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,   // floor
    4: 14,
    5: 14,  // solid wall (Kenney 14; avoid corner scraps 1–6)
    6: 10,  // door open — arch 10 (alt doorway 22)
    7: 9,   // door locked — arch 9 (alt doorway 33)
    8: 0,   // water → floor (no spikes/water in feel-slice)
    9: 0,
    10: 0,
    11: 0,  // boss accent — draw floor + tint in drawTile
  };

  const imgs = {
    town: null,
    dungeon: null,
    warrior: null,
    slime: null,
    elder: null,
    mage: null,
    ready: false,
  };

  function tileRect(id) {
    const c = id % COLS, r = (id / COLS) | 0;
    return { sx: c * STRIDE, sy: r * STRIDE, sw: TW, sh: TW };
  }

  function punyRect(row, col) {
    return { sx: col * FW, sy: row * FH, sw: FW, sh: FH };
  }

  // Puny frames are 32×32 with lots of empty pad — never scale full frame to 16×16 (noise).
  // Content bbox ~ (9,8,14,15); foot-align bottom to (x,y).
  const PUNY_OX = 9, PUNY_OY = 8, PUNY_CW = 14, PUNY_CH = 15;

  function blitPuny(ctx, img, sx, sy, x, y, outW, outH) {
    const dw = outW == null ? PUNY_CW : outW;
    const dh = outH == null ? PUNY_CH : outH;
    noSmooth(ctx);
    ctx.drawImage(
      img,
      sx + PUNY_OX, sy + PUNY_OY, PUNY_CW, PUNY_CH,
      Math.round(x - dw / 2), Math.round(y - dh),
      dw, dh
    );
    return { dw, dh, dx: Math.round(x - dw / 2), dy: Math.round(y - dh) };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("fail " + src));
      im.src = src;
    });
  }

  function loadAll() {
    const base = "assets/";
    return Promise.all([
      loadImage(base + "town/tilemap_packed.png"),
      loadImage(base + "dungeon/tilemap_packed.png"),
      loadImage(base + "characters/Warrior-Blue.png"),
      loadImage(base + "characters/Slime.png"),
      loadImage(base + "characters/npc-elder-candidate.png"),
      loadImage(base + "characters/npc-mage.png"),
    ]).then(([town, dungeon, warrior, slime, elder, mage]) => {
      imgs.town = town;
      imgs.dungeon = dungeon;
      imgs.warrior = warrior;
      imgs.slime = slime;
      imgs.elder = elder;
      imgs.mage = mage;
      imgs.ready = true;
      return imgs;
    });
  }

  function noSmooth(ctx) {
    ctx.imageSmoothingEnabled = false;
  }

  function blitTile(ctx, atlas, kid, x, y) {
    if (!atlas) return;
    const r = tileRect(kid);
    noSmooth(ctx);
    ctx.drawImage(atlas, r.sx, r.sy, r.sw, r.sh, x, y, TW, TW);
  }

  function drawTile(ctx, id, x, y, seed, outdoor) {
    noSmooth(ctx);
    if (outdoor) {
      // Village→temple entrance: dungeon door 9 locked / 10 open (art review SHA 056f6fc)
      if (id === 6 || id === 7) {
        blitTile(ctx, imgs.dungeon, id === 6 ? 10 : 9, x, y);
      } else if (id === 1 && ((seed || 0) % 7 === 0)) {
        blitTile(ctx, imgs.town, 1, x, y); // grass deco
      } else if (id === 8) {
        // Water removed — no Tiny Town water tile; draw grass (pond excised from map)
        blitTile(ctx, imgs.town, 0, x, y);
      } else {
        const kid = TOWN_MAP[id] != null ? TOWN_MAP[id] : 0;
        blitTile(ctx, imgs.town, kid, x, y);
      }
    } else {
      const kid = DUN_MAP[id] != null ? DUN_MAP[id] : 0;
      if (id === 5 || id === 4) {
        // solid wall tile 14 (optional alts 28/40 — no random 1–6 corner scraps)
        blitTile(ctx, imgs.dungeon, 14, x, y);
      } else if (id === 11) {
        blitTile(ctx, imgs.dungeon, 0, x, y);
        ctx.fillStyle = "rgba(107,123,132,0.35)";
        ctx.fillRect(x + 1, y + 1, 14, 14);
      } else {
        blitTile(ctx, imgs.dungeon, kid, x, y);
      }
    }
    if (DEBUG_WIRE) {
      ctx.strokeStyle = "rgba(255,0,0,0.25)";
      ctx.strokeRect(x + 0.5, y + 0.5, TW - 1, TW - 1);
    }
  }

  // dir: 0 down 1 up 2 left 3 right → puny rows 0=S,4=N,6=W,2=E
  function dirRow(dir) {
    if (dir === 1) return 4;
    if (dir === 2) return 6;
    if (dir === 3) return 2;
    return 0;
  }

  function drawHero(ctx, x, y, dir, walkFrame, swingT, hurt, winPose) {
    // Player ONLY — Warrior-Blue via blitPuny. Never dungeon atlas / tile 84.
    noSmooth(ctx);
    const img = imgs.warrior;
    if (!img) {
      ctx.fillStyle = "#F4A261";
      ctx.fillRect(x - 8, y - 12, 16, 16);
      return;
    }
    let col = 0;
    const row = dirRow(dir);
    if (hurt) col = 18 + (walkFrame % 2);
    else if (swingT > 0) col = 6 + Math.min(2, (swingT / 60) | 0);
    else if (winPose) col = 0;
    else if (walkFrame != null && walkFrame >= 0) {
      // walkFrame cycles; if moving caller passes active frame
      col = 3 + (walkFrame % 3);
    } else {
      col = (walkFrame || 0) % 3; // idle
    }
    // Prefer idle when walkFrame is specially -1? game passes 0/1 — use moving flag via swing
    const r = punyRect(row, col);
    const b = blitPuny(ctx, img, r.sx, r.sy, x, y);
    if (hurt) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#fff";
      ctx.fillRect(b.dx, b.dy, b.dw, b.dh);
      ctx.globalAlpha = 1;
    }
  }

  function drawHeroIdle(ctx, x, y, dir, frame, moving, swinging, hurt) {
    // Player ONLY — Warrior-Blue via blitPuny bbox. Never dungeon tile 84 (purple mage).
    noSmooth(ctx);
    const img = imgs.warrior;
    if (!img) return;
    const row = dirRow(dir);
    let col;
    if (hurt) col = 18 + (frame % 2);
    else if (swinging) col = 7 + (frame % 2);
    else if (moving) col = 3 + (frame % 3);
    else col = frame % 3;
    const r = punyRect(row, col);
    const b = blitPuny(ctx, img, r.sx, r.sy, x, y);
    if (hurt) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#fff";
      ctx.fillRect(b.dx, b.dy, b.dw, b.dh);
      ctx.globalAlpha = 1;
    }
  }

  function drawSlime(ctx, x, y, indoor, dead, flash) {
    noSmooth(ctx);
    const img = imgs.slime;
    if (!img) {
      ctx.fillStyle = indoor ? "#3D8B6E" : "#5B8FA8";
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const frame = dead ? 4 : ((performance.now() / 120) | 0) % 4;
    const sx = frame * 32;
    // sample Puny content bbox; squash dead vertically a bit with foot align
    const outW = dead ? 14 : 14;
    const outH = dead ? 8 : 15;
    const b = blitPuny(ctx, img, sx, 0, x, y, outW, outH);
    if (flash) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#fff";
      ctx.fillRect(b.dx, b.dy, b.dw, b.dh);
      ctx.globalAlpha = 1;
    }
  }

  function drawStone(ctx, x, y, flash) {
    noSmooth(ctx);
    // dungeon static enemy tile ~92 (slime-ish)
    if (imgs.dungeon) {
      blitTile(ctx, imgs.dungeon, 92, Math.round(x - 8), Math.round(y - 8));
    } else {
      ctx.fillStyle = "#6B7B84";
      ctx.fillRect(x - 8, y - 8, 16, 16);
    }
    if (flash) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#fff";
      ctx.fillRect(Math.round(x - 8), Math.round(y - 8), 16, 16);
      ctx.globalAlpha = 1;
    }
  }

  function drawBoss(ctx, x, y, phase, flash, dead, telegraph, time, windup) {
    noSmooth(ctx);
    const scale = 2;
    const dw = 16 * scale, dh = 16 * scale;
    if (imgs.dungeon) {
      const kid = 109; // cyclops ×2 (122/124 are spider/rat)
      const r = tileRect(kid);
      ctx.drawImage(imgs.dungeon, r.sx, r.sy, r.sw, r.sh, Math.round(x - dw / 2), Math.round(y - dh / 2), dw, dh);
    } else {
      ctx.fillStyle = "#E76F51";
      ctx.fillRect(x - 14, y - 14, 28, 28);
    }
    if (telegraph) {
      ctx.strokeStyle = "#F4A261";
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(x - dw / 2) - 2, Math.round(y - dh / 2) - 2, dw + 4, dh + 4);
    }
    if (windup) {
      ctx.strokeStyle = "#F5E6D3";
      ctx.lineWidth = 1;
      const pulse = 10 + 4 * Math.sin((time || 0) * 0.02);
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (flash || phase >= 2) {
      ctx.globalAlpha = flash ? 0.45 : 0.15;
      ctx.fillStyle = flash ? "#fff" : "#E76F51";
      ctx.fillRect(Math.round(x - dw / 2), Math.round(y - dh / 2), dw, dh);
      ctx.globalAlpha = 1;
    }
    if (dead) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#2A1F1A";
      ctx.fillRect(Math.round(x - dw / 2), Math.round(y - dh / 2), dw, dh);
      ctx.globalAlpha = 1;
    }
  }

  function drawNpc(ctx, x, y, kind, flash) {
    noSmooth(ctx);
    // Prefer dedicated Puny sheets (same bbox as hero) — NEVER Warrior-Blue, NEVER player from dungeon 84.
    // Elder → npc-elder-candidate; merchant/villager → npc-mage (distinct from blue helmet warrior).
    let img = null;
    if (kind === "elder" && imgs.elder) img = imgs.elder;
    else if ((kind === "merchant" || kind === "villager") && imgs.mage) img = imgs.mage;
    else if (kind === "elder" && imgs.mage) img = imgs.mage;

    if (img) {
      const r = punyRect(0, (flash ? ((performance.now() / 200) | 0) % 3 : 0));
      const b = blitPuny(ctx, img, r.sx, r.sy, x, y);
      if (flash) {
        const a = 0.55 + 0.45 * Math.sin(performance.now() * 0.01);
        ctx.globalAlpha = a;
        ctx.fillStyle = "#F4A261";
        ctx.fillRect(b.dx - 2, b.dy - 4, b.dw + 4, 3);
        // soft halo so elder is easy to spot outdoors
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(performance.now() * 0.01);
        ctx.fillStyle = "#FFE8C8";
        ctx.fillRect(b.dx - 1, b.dy - 1, b.dw + 2, b.dh + 2);
        ctx.globalAlpha = 1;
      }
      return;
    }

    // Fallback only: dungeon static 84/86/85, foot-aligned + slight Y offset so not mistaken for player
    const kid = kind === "elder" ? 84 : kind === "merchant" ? 86 : 85;
    if (imgs.dungeon) {
      blitTile(ctx, imgs.dungeon, kid, Math.round(x - 8), Math.round(y - 16));
    }
    if (flash) {
      const a = 0.55 + 0.45 * Math.sin(performance.now() * 0.01);
      ctx.globalAlpha = a;
      ctx.fillStyle = "#F4A261";
      ctx.fillRect(Math.round(x - 9), Math.round(y - 20), 18, 3);
      ctx.globalAlpha = 1;
    }
  }

  function drawSwitch(ctx, x, y, pressed) {
    noSmooth(ctx);
    if (imgs.dungeon) blitTile(ctx, imgs.dungeon, pressed ? 8 : 7, x, y);
    else {
      ctx.fillStyle = pressed ? "#3D8B6E" : "#6B7B84";
      ctx.fillRect(x + 3, y + 3, 10, 10);
    }
  }

  function drawChest(ctx, x, y, open, outdoor) {
    noSmooth(ctx);
    if (outdoor && imgs.town) {
      blitTile(ctx, imgs.town, open ? 131 : 130, Math.round(x - 8), Math.round(y - 8));
    } else if (imgs.dungeon) {
      blitTile(ctx, imgs.dungeon, open ? 90 : 89, Math.round(x - 8), Math.round(y - 8));
    } else {
      ctx.fillStyle = "#6F4E37";
      ctx.fillRect(x - 7, y - 6, 14, 12);
    }
  }

  function drawCoin(ctx, x, y, bob) {
    noSmooth(ctx);
    const yy = y + (bob || 0);
    if (imgs.town) blitTile(ctx, imgs.town, 93, Math.round(x - 8), Math.round(yy - 8));
    else {
      ctx.fillStyle = "#F4A261";
      ctx.beginPath();
      ctx.arc(x, yy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHeartPickup(ctx, x, y, time) {
    noSmooth(ctx);
    const bob = Math.sin((time || 0) * 0.008) * 2;
    if (imgs.dungeon) {
      // red potion HP proxy (115); 114 is green — do not use
      blitTile(ctx, imgs.dungeon, 115, Math.round(x - 8), Math.round(y - 8 + bob));
    } else {
      ctx.fillStyle = "#E76F51";
      ctx.fillRect(x - 4, y - 4 + bob, 8, 8);
    }
  }

  function drawKey(ctx, x, y, bob) {
    noSmooth(ctx);
    const yy = y + (bob || 0);
    if (imgs.town) blitTile(ctx, imgs.town, 116, Math.round(x - 8), Math.round(yy - 8));
    else {
      ctx.fillStyle = "#F4A261";
      ctx.fillRect(x - 3, yy - 6, 6, 12);
    }
  }

  function drawSign(ctx, x, y) {
    noSmooth(ctx);
    if (imgs.town) blitTile(ctx, imgs.town, 126, Math.round(x - 8), Math.round(y - 8));
    else {
      ctx.fillStyle = "#6F4E37";
      ctx.fillRect(x - 2, y - 8, 4, 12);
    }
  }

  function drawHouse(ctx, x, y, w, h) {
    noSmooth(ctx);
    if (!imgs.town) {
      ctx.fillStyle = "#6F4E37";
      ctx.fillRect(x, y, w, h);
      return;
    }
    // roof 48/49/50 · walls 72/74 · door 85 (never wall 60+ → icon board)
    const tw = Math.max(2, Math.round(w / 16));
    const th = Math.max(2, Math.round(h / 16));
    for (let j = 0; j < th; j++) {
      for (let i = 0; i < tw; i++) {
        let kid;
        if (j === 0) {
          if (i === 0) kid = 48;
          else if (i === tw - 1) kid = 50;
          else kid = 49;
        } else if (j === th - 1 && i === ((tw / 2) | 0)) {
          kid = 85; // door
        } else {
          kid = (i % 2 === 0) ? 72 : 74; // wall
        }
        blitTile(ctx, imgs.town, kid, x + i * 16, y + j * 16);
      }
    }
  }

  function drawCore(ctx, x, y, time) {
    const pulse = 6 + 2 * Math.sin((time || 0) * 0.01);
    ctx.save();
    ctx.fillStyle = "#FFE8C8";
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#F4A261";
    ctx.beginPath();
    ctx.arc(x, y, pulse * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Pixel hearts only — Chinese HUD text lives on sharp HTML overlay */
  function drawHUD(ctx, hp, maxHp) {
    noSmooth(ctx);
    for (let i = 0; i < maxHp; i++) {
      const filled = i < Math.ceil(hp);
      const hx = 6 + i * 12;
      const hy = 4;
      if (imgs.dungeon) {
        ctx.globalAlpha = filled ? 1 : 0.35;
        blitTile(ctx, imgs.dungeon, 115, hx - 4, hy - 2);
        ctx.globalAlpha = 1;
        if (!filled) {
          ctx.fillStyle = "rgba(42,31,26,0.5)";
          ctx.fillRect(hx - 2, hy, 10, 10);
        }
      } else {
        ctx.fillStyle = filled ? "#E76F51" : "rgba(42,31,26,0.4)";
        ctx.fillRect(hx, hy, 9, 8);
      }
    }
  }

  function drawDialog(ctx, name, line) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const boxH = 48;
    ctx.fillStyle = "rgba(42,31,26,0.88)";
    ctx.fillRect(8, H - boxH - 6, W - 16, boxH);
    ctx.strokeStyle = "#F4A261";
    ctx.lineWidth = 1;
    ctx.strokeRect(8.5, H - boxH - 5.5, W - 17, boxH - 1);
    ctx.fillStyle = "#F4A261";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(name, 14, H - boxH + 6);
    ctx.fillStyle = "#F5E6D3";
    ctx.font = "9px sans-serif";
    wrapText(ctx, line, 14, H - boxH + 18, W - 28, 11);
    ctx.fillStyle = "rgba(245,230,211,0.6)";
    ctx.font = "8px sans-serif";
    ctx.fillText("E / 谈 继续", W - 58, H - 10);
  }

  function wrapText(ctx, text, x, y, maxW, lh) {
    let line = "";
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, x, y);
        line = ch;
        y += lh;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
  }

  function drawPanel(ctx, title, sub, buttons) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = "rgba(42,31,26,0.72)";
    ctx.fillRect(0, 0, W, H);
    const pw = 200, ph = 110;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    ctx.fillStyle = "#2A1F1A";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#F4A261";
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    ctx.fillStyle = "#F5E6D3";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, W / 2, py + 22);
    ctx.font = "8px sans-serif";
    ctx.fillStyle = "#F4A261";
    ctx.fillText(sub, W / 2, py + 38);
    (buttons || []).forEach((b, i) => {
      const bw = 120, bh = 20;
      const bx = W / 2 - bw / 2;
      const by = py + ph - 52 - (buttons.length - 1 - i) * 24;
      ctx.fillStyle = "#F4A261";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "#2A1F1A";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText(b, W / 2, by + 14);
    });
    ctx.textAlign = "left";
  }

  global.TempleArt = {
    loadAll,
    imgs,
    drawTile,
    drawHero,
    drawHeroIdle,
    drawSlime,
    drawStone,
    drawBoss,
    drawNpc,
    drawSwitch,
    drawChest,
    drawCoin,
    drawHeartPickup,
    drawKey,
    drawSign,
    drawHouse,
    drawCore,
    drawHUD,
    drawDialog,
    drawPanel,
    noSmooth,
  };
})(typeof window !== "undefined" ? window : globalThis);
