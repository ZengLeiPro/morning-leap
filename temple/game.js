/**
 * 《晨光神殿》MVP — GDD v1.1 · Canvas 640×360 · vanilla JS
 */
(function () {
  "use strict";

  const Art = window.TempleArt;
  const Maps = window.TempleMaps;
  const T = Maps.T;
  const W = 640, H = 360;
  const SAVE_KEY = "morning-temple-save";
  const SPEED = 80;
  const ATK_MS = 180;
  const ATK_ACTIVE = 80;
  const IFRAME = 800;
  const HITSTOP_MS = 50; // ~3 frames @60

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;

  const MODE = { TITLE: "title", PLAY: "play", DIALOG: "dialog", FADE: "fade", END: "end", DEAD: "dead" };

  let mode = MODE.TITLE;
  let fade = 0, fadeDir = 0, fadeCb = null;
  let hitstop = 0;
  let time = 0;
  let cam = { x: 0, y: 0 };
  let room = null;
  let roomId = "village";

  // runtime entities
  let player = null;
  let enemies = [];
  let chests = [];
  let golds = [];
  let hearts = [];
  let switches = [];
  let groundKeys = [];
  let core = null;
  let particles = [];

  let dialog = null; // { name, lines[], i }
  let toast = null; // { text, t }
  let panelBtns = [];

  let flags = {};
  let openedChests = {};
  let takenPickups = {};
  let bestEnding = false;
  let hasSword = false;
  let questOn = false;

  // input
  const keys = Object.create(null);
  let touchAxis = { x: 0, y: 0 };
  let touchSword = false;
  let touchInteract = false;
  let atkQueued = false;

  function defaultPlayer() {
    return {
      x: 0, y: 0,
      vx: 0, vy: 0,
      dir: 0, // 0 down 1 up 2 left 3 right
      hp: 3, maxHp: 3,
      gold: 0, keys: 0, bossKeys: 0,
      swingT: -1,
      iframe: 0,
      walkFrame: 0,
      walkAcc: 0,
      hurtFlash: 0,
      winPose: 0,
      knock: { x: 0, y: 0 },
    };
  }

  // ─── Save / Load ────────────────────────────────────────────────────────
  function serialize() {
    return {
      maxHp: player.maxHp,
      hp: player.hp,
      gold: player.gold,
      keys: player.keys,
      bossKeys: player.bossKeys,
      flags: Object.assign({}, flags),
      chests: Object.assign({}, openedChests),
      pickups: Object.assign({}, takenPickups),
      roomId,
      px: player.x,
      py: player.y,
      hasSword,
      questOn,
      bestEnding,
      v: 2,
    };
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
    } catch (_) {}
  }

  function loadRaw() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch (_) {
      return null;
    }
  }

  function applySave(data) {
    player = defaultPlayer();
    player.maxHp = data.maxHp || 3;
    player.hp = data.hp != null ? data.hp : player.maxHp;
    player.gold = data.gold || 0;
    player.keys = data.keys || 0;
    player.bossKeys = data.bossKeys || 0;
    flags = data.flags || {};
    openedChests = data.chests || {};
    takenPickups = data.pickups || {};
    hasSword = !!data.hasSword || !!flags.metElder;
    questOn = !!data.questOn || !!flags.metElder;
    bestEnding = !!data.bestEnding;
    enterRoom(data.roomId || "village", data.px, data.py, true);
  }

  function newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    player = defaultPlayer();
    flags = {};
    openedChests = {};
    takenPickups = {};
    hasSword = false;
    questOn = false;
    bestEnding = false;
    enterRoom("village", null, null, true);
    mode = MODE.PLAY;
    save();
  }

  function hasSave() {
    return !!loadRaw();
  }

  // ─── Room ───────────────────────────────────────────────────────────────
  function enterRoom(id, px, py, skipFade) {
    const def = Maps.ROOMS[id];
    if (!def) return;
    roomId = id;
    room = def;
    enemies = [];
    chests = [];
    golds = [];
    hearts = [];
    switches = [];
    groundKeys = [];
    core = null;
    particles = [];

    // chests
    for (const c of def.chests || []) {
      chests.push({
        id: c.id,
        x: c.x, y: c.y,
        reward: c.reward,
        open: !!openedChests[c.id],
      });
    }
    // gold pickups
    for (const g of def.goldPickups || []) {
      if (!takenPickups[g.id]) golds.push({ id: g.id, x: g.x, y: g.y });
    }
    // hearts
    for (const h of def.hearts || []) {
      if (!takenPickups[h.id]) hearts.push({ id: h.id, x: h.x, y: h.y });
    }
    // switches
    for (const s of def.switches || []) {
      const pressed = !!flags[s.flag || "switchT3"];
      switches.push({
        id: s.id,
        x: s.x, y: s.y,
        flag: s.flag || "switchT3",
        pressed,
        dropsBossKey: s.dropsBossKey,
        keyPos: s.keyPos,
        justPressed: 0,
      });
      if (pressed && s.dropsBossKey && !flags.bossKeySpawnedTaken && !flags.gotBossKeyPickup) {
        // key already dropped historically — if not picked, respawn key if not in inventory
        if ((player.bossKeys | 0) < 1 && !flags.gotBossKeyPickup) {
          groundKeys.push({ id: "boss_key", x: s.keyPos.x, y: s.keyPos.y, boss: true });
        }
      }
    }
    // enemies (reset on enter — death also resets temple enemies)
    for (const e of def.enemies || []) {
      enemies.push(spawnEnemy(e));
    }
    if (def.boss && !flags.bossDead) {
      enemies.push(spawnBoss(def.boss));
    }
    if (flags.bossDead && id === "T5") {
      core = { x: def.boss.x, y: def.boss.y, t: 0 };
    }

    // player pos
    if (px != null && py != null) {
      player.x = px; player.y = py;
    } else {
      player.x = def.spawn.x;
      player.y = def.spawn.y;
    }
    player.vx = player.vy = 0;
    updateDoorVisuals();
    if (!skipFade) save();
  }

  function spawnEnemy(e) {
    if (e.type === "slime") {
      return {
        type: "slime", hp: 1, maxHp: 1, dmg: 0.5, speed: 40,
        x: e.x, y: e.y, flash: 0, squash: 0, stun: 0, dead: false, knock: { x: 0, y: 0 },
      };
    }
    if (e.type === "stone") {
      return {
        type: "stone", hp: 3, maxHp: 3, dmg: 1, speed: 28,
        x: e.x, y: e.y, flash: 0, stun: 0, dead: false, knock: { x: 0, y: 0 },
        patrolDir: 1, patrolAcc: 0,
      };
    }
    return spawnBoss(e);
  }

  function spawnBoss(b) {
    return {
      type: "boss", hp: b.hp || 8, maxHp: 8, dmg: 1, speed: 32,
      x: b.x, y: b.y, flash: 0, stun: 0, dead: false, knock: { x: 0, y: 0 },
      phase: 1, telegraph: 0, dash: 0, dashVx: 0, dashVy: 0,
      summoned: false, deathT: 0, phaseFlash: 0,
    };
  }

  function updateDoorVisuals() {
    if (!room) return;
    for (const d of room.doors || []) {
      const open = isDoorOpen(d);
      for (let i = 0; i < (d.w || 1); i++) {
        for (let j = 0; j < (d.h || 1); j++) {
          const idx = (d.y + j) * room.w + (d.x + i);
          // locked visual when closed and was lockable
          if (d.lockedVisual || d.needKey || d.needBossKey || d.needSwitchT3 || d.needClear) {
            room.tiles[idx] = open ? 6 : 7;
          } else {
            room.tiles[idx] = 6;
          }
        }
      }
    }
  }

  function roomCleared() {
    return enemies.every((e) => e.dead || e.hp <= 0);
  }

  function isDoorOpen(d) {
    if (d.needKey) return player.keys >= 1;
    if (d.needBossKey) return player.bossKeys >= 1;
    if (d.needSwitchT3) return !!flags.switchT3;
    if (d.needClear) return roomCleared();
    return true;
  }

  // ─── Collision ──────────────────────────────────────────────────────────
  function footBox(px, py) {
    return { x: px - 5, y: py + 2, w: 10, h: 8 };
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function solidAt(wx, wy) {
    const tx = Math.floor(wx / T);
    const ty = Math.floor(wy / T);
    if (!room || tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return true;
    const id = room.tiles[ty * room.w + tx];
    // locked door tiles solid; open door walkable
    if (id === 7) return true;
    return Maps.isSolid(id);
  }

  function tryMove(ent, dx, dy) {
    const nx = ent.x + dx;
    const ny = ent.y + dy;
    const box = footBox(nx, ny);
    const pts = [
      [box.x, box.y], [box.x + box.w, box.y],
      [box.x, box.y + box.h], [box.x + box.w, box.y + box.h],
    ];
    let blocked = false;
    for (const [px, py] of pts) {
      if (solidAt(px, py)) { blocked = true; break; }
    }
    // NPC / chest soft block
    if (!blocked && ent === player) {
      for (const n of room.npcs || []) {
        const nb = { x: n.x - 6, y: n.y - 4, w: 12, h: 12 };
        if (aabb(box, nb)) { blocked = true; break; }
      }
    }
    if (!blocked) {
      ent.x = nx; ent.y = ny;
      return true;
    }
    // axis slide
    if (dx !== 0 && tryMoveAxis(ent, dx, 0)) return true;
    if (dy !== 0 && tryMoveAxis(ent, 0, dy)) return true;
    return false;
  }

  function tryMoveAxis(ent, dx, dy) {
    const nx = ent.x + dx;
    const ny = ent.y + dy;
    const box = footBox(nx, ny);
    const pts = [
      [box.x, box.y], [box.x + box.w, box.y],
      [box.x, box.y + box.h], [box.x + box.w, box.y + box.h],
    ];
    for (const [px, py] of pts) if (solidAt(px, py)) return false;
    if (ent === player) {
      for (const n of room.npcs || []) {
        const nb = { x: n.x - 6, y: n.y - 4, w: 12, h: 12 };
        if (aabb(box, nb)) return false;
      }
    }
    ent.x = nx; ent.y = ny;
    return true;
  }

  // ─── Combat ─────────────────────────────────────────────────────────────
  function swordBox() {
    if (player.swingT < 0 || player.swingT > ATK_ACTIVE) return null;
    const w = 18, h = 12;
    let x = player.x, y = player.y;
    if (player.dir === 0) { x -= 9; y += 4; return { x, y, w, h }; }
    if (player.dir === 1) { x -= 9; y -= 16; return { x, y, w, h }; }
    if (player.dir === 2) { x -= 18; y -= 6; return { x: x, y: y, w: h, h: w }; }
    if (player.dir === 3) { x += 4; y -= 6; return { x: x, y: y, w: h, h: w }; }
    return null;
  }

  function hitEnemy(e) {
    if (e.dead || e.hp <= 0) return;
    e.hp -= 1;
    e.flash = 120;
    if (e.type === "stone") e.stun = 120;
    // knockback away from player
    const dx = e.x - player.x, dy = e.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    e.knock.x = (dx / len) * 5;
    e.knock.y = (dy / len) * 5;
    hitstop = HITSTOP_MS;
    if (e.hp <= 0) {
      e.dead = true;
      if (e.type === "slime") e.squash = 200;
      if (e.type === "boss") {
        e.deathT = 600;
        flags.bossDead = true;
      } else if (Math.random() < (e.type === "stone" ? 0.5 : 0.3)) {
        // optional gold drop (economy does not rely on it)
        golds.push({ id: "drop_" + Math.random().toString(36).slice(2), x: e.x, y: e.y, drop: true });
      }
      updateDoorVisuals();
    }
  }

  function hurtPlayer(dmg, from) {
    if (player.iframe > 0 || mode !== MODE.PLAY) return;
    player.hp = Math.max(0, player.hp - dmg);
    player.iframe = IFRAME;
    player.hurtFlash = IFRAME;
    if (from) {
      const dx = player.x - from.x, dy = player.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      player.knock.x = (dx / len) * 6;
      player.knock.y = (dy / len) * 6;
    }
    if (player.hp <= 0) {
      mode = MODE.DEAD;
      toast = null;
      setTimeout(() => respawnVillage(), 900);
    }
  }

  function respawnVillage() {
    // keep gold/keys/bossKeys; HP full; switches stay; chests stay
    // temple enemies reset on re-enter
    player.hp = player.maxHp;
    player.iframe = 0;
    player.knock.x = player.knock.y = 0;
    showDialog("旁白", ["眼前一黑……晨光还在等你。"], () => {
      enterRoom("village", Maps.ROOMS.village.spawn.x, Maps.ROOMS.village.spawn.y);
      mode = MODE.PLAY;
      save();
    });
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────
  function showDialog(name, lines, onDone) {
    dialog = { name, lines: lines.slice(), i: 0, onDone: onDone || null };
    mode = MODE.DIALOG;
  }

  function advanceDialog() {
    if (!dialog) return;
    dialog.i++;
    if (dialog.i >= dialog.lines.length) {
      const cb = dialog.onDone;
      dialog = null;
      mode = MODE.PLAY;
      if (cb) cb();
      save();
    }
  }

  function showToast(text) {
    toast = { text, t: 1400 };
  }

  function interact() {
    if (mode === MODE.DIALOG) { advanceDialog(); return; }
    if (mode === MODE.TITLE || mode === MODE.END) return;
    if (mode !== MODE.PLAY) return;

    // NPCs
    const pb = footBox(player.x, player.y);
    const reach = { x: pb.x - 8, y: pb.y - 8, w: pb.w + 16, h: pb.h + 16 };

    for (const n of room.npcs || []) {
      const nb = { x: n.x - 10, y: n.y - 10, w: 20, h: 20 };
      if (!aabb(reach, nb)) continue;
      talkNpc(n);
      return;
    }
    for (const s of room.signs || []) {
      const sb = { x: s.x - 10, y: s.y - 10, w: 20, h: 20 };
      if (!aabb(reach, sb)) continue;
      const lines = [s.text];
      if (s.story === "stele" && !flags.stele) {
        flags.stele = true;
      }
      showDialog("石碑", lines);
      return;
    }
    for (const c of chests) {
      if (c.open) continue;
      const cb = { x: c.x - 10, y: c.y - 8, w: 20, h: 16 };
      if (!aabb(reach, cb)) continue;
      openChest(c);
      return;
    }
    if (core) {
      const cb = { x: core.x - 12, y: core.y - 12, w: 24, h: 24 };
      if (aabb(reach, cb)) {
        takeCore();
        return;
      }
    }
  }

  function talkNpc(n) {
    if (n.id === "elder") {
      if (!flags.metElder) {
        showDialog("长老", [
          "晨光核被拖进神殿了。拿上这把钝剑，先去东侧找钥匙商人问问路。",
          "——对了，心要护好。",
        ], () => {
          flags.metElder = true;
          hasSword = true;
          questOn = true;
          n.flash = false;
          save();
        });
      } else if (flags.ending) {
        showDialog("长老", ["你让早晨回来了。旅人，喝杯热的再上路吧。"]);
      } else {
        showDialog("长老", ["神殿在村子北边。钥匙找东边的商人。"]);
      }
      return;
    }
    if (n.id === "merchant") {
      if (player.keys >= 1 || flags.boughtKey) {
        showDialog("钥匙商人", ["小心石头人——要砍好几下。", "草地上有五枚金币，记得捡。"]);
      } else if (player.gold >= 5) {
        showDialog("钥匙商人", ["神殿钥匙，五枚金币。成交？"], () => {
          player.gold -= 5;
          player.keys = Math.min(9, player.keys + 1);
          flags.boughtKey = true;
          showToast("获得神殿钥匙 ×1");
          save();
        });
      } else {
        showDialog("钥匙商人", [
          "神殿钥匙五枚金币。",
          "金币不够（要 5）。",
          "草地上有五枚金币。",
        ]);
      }
      return;
    }
    if (n.id === "villager") {
      showDialog("村民", ["史莱姆怕剑光，石卫士要多砍几下。"]);
    }
  }

  function openChest(c) {
    c.open = true;
    openedChests[c.id] = true;
    if (c.reward === "maxhp") {
      player.maxHp = Math.min(4, player.maxHp + 1);
      player.hp = player.maxHp;
      showDialog("宝箱", ["心的上限增加了！"]);
    } else if (c.reward === "gold5") {
      player.gold = Math.min(99, player.gold + 5);
      showDialog("宝箱", ["获得金币 ×5"]);
    } else {
      showDialog("宝箱", ["空空如也。"]);
    }
    save();
  }

  function takeCore() {
    flags.ending = true;
    bestEnding = true;
    showDialog("旁白", [
      "暖光涌回屋顶。",
      "长老：你让早晨回来了。旅人，喝杯热的再上路吧。",
    ], () => {
      mode = MODE.END;
      save();
    });
  }

  // ─── Fade transition ────────────────────────────────────────────────────
  function fadeTo(cb) {
    mode = MODE.FADE;
    fade = 0;
    fadeDir = 1;
    fadeCb = cb;
  }

  function tryDoor() {
    if (!room) return;
    const pb = footBox(player.x, player.y);
    for (const d of room.doors || []) {
      const db = { x: d.x * T, y: d.y * T, w: (d.w || 1) * T, h: (d.h || 1) * T };
      // expand slightly
      db.x -= 2; db.y -= 2; db.w += 4; db.h += 4;
      if (!aabb(pb, db)) continue;

      if (!isDoorOpen(d)) {
        if (!toast || toast.t < 200) showToast(d.lockedMsg || "门还锁着。");
        // nudge back
        if (d.y === 0) player.y += 2;
        else if (d.y >= room.h - 1) player.y -= 2;
        else if (d.x === 0) player.x += 2;
        else player.x -= 2;
        return;
      }

      // consume keys
      const dest = d.target;
      const sx = d.spawnAt.x, sy = d.spawnAt.y;
      fadeTo(() => {
        if (d.consumeKey && d.needKey) {
          player.keys = Math.max(0, player.keys - 1);
        }
        if (d.consumeBossKey && d.needBossKey) {
          player.bossKeys = Math.max(0, player.bossKeys - 1);
        }
        enterRoom(dest, sx, sy);
        mode = MODE.PLAY;
        fadeDir = -1;
        updateDoorVisuals();
        save();
      });
      return;
    }
  }

  // ─── Update ─────────────────────────────────────────────────────────────
  function update(dt) {
    time += dt;
    if (toast) {
      toast.t -= dt;
      if (toast.t <= 0) toast = null;
    }

    if (mode === MODE.FADE) {
      fade += fadeDir * (dt / 200);
      if (fadeDir > 0 && fade >= 1) {
        fade = 1;
        if (fadeCb) { const c = fadeCb; fadeCb = null; c(); }
        fadeDir = -1;
      } else if (fadeDir < 0 && fade <= 0) {
        fade = 0;
        fadeDir = 0;
        if (mode === MODE.FADE) mode = MODE.PLAY;
      }
      if (mode !== MODE.PLAY && mode !== MODE.FADE) return;
    }

    if (hitstop > 0) {
      hitstop -= dt;
      // still tick flash timers lightly
    }

    if (mode === MODE.DIALOG || mode === MODE.TITLE || mode === MODE.END || mode === MODE.DEAD) {
      return;
    }

    if (hitstop > 0) return; // freeze world during hitstop

    // player timers
    if (player.iframe > 0) player.iframe -= dt;
    if (player.hurtFlash > 0) player.hurtFlash -= dt;
    if (player.swingT >= 0) {
      player.swingT += dt;
      if (player.swingT >= ATK_MS) player.swingT = -1;
    }

    // knockback decay
    if (player.knock.x || player.knock.y) {
      tryMove(player, player.knock.x, player.knock.y);
      player.knock.x *= 0.7;
      player.knock.y *= 0.7;
      if (Math.abs(player.knock.x) < 0.2) player.knock.x = 0;
      if (Math.abs(player.knock.y) < 0.2) player.knock.y = 0;
    }

    // movement
    let mx = 0, my = 0;
    if (keys.ArrowLeft || keys.a || keys.A) mx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) mx += 1;
    if (keys.ArrowUp || keys.w || keys.W) my -= 1;
    if (keys.ArrowDown || keys.s || keys.S) my += 1;
    mx += touchAxis.x;
    my += touchAxis.y;
    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      mx /= len; my /= len;
      if (Math.abs(mx) > Math.abs(my)) player.dir = mx < 0 ? 2 : 3;
      else player.dir = my < 0 ? 1 : 0;
      const step = SPEED * (dt / 1000);
      tryMove(player, mx * step, my * step);
      player.walkAcc += dt;
      if (player.walkAcc > 120) {
        player.walkAcc = 0;
        player.walkFrame = (player.walkFrame + 1) % 2;
      }
    }

    // attack
    if ((atkQueued || touchSword || keys.j || keys.J || keys.z || keys.Z) && hasSword && player.swingT < 0) {
      player.swingT = 0;
      atkQueued = false;
      touchSword = false;
    } else {
      atkQueued = false;
    }

    // sword hits
    const sb = swordBox();
    if (sb) {
      for (const e of enemies) {
        if (e.dead && e.type !== "boss") continue;
        if (e.hp <= 0 && e.type === "boss") continue;
        if (e._hitThisSwing) continue;
        const eb = enemyBox(e);
        if (aabb(sb, eb)) {
          e._hitThisSwing = true;
          hitEnemy(e);
        }
      }
    } else {
      for (const e of enemies) e._hitThisSwing = false;
    }

    // spikes
    const ptx = Math.floor(player.x / T);
    const pty = Math.floor((player.y + 4) / T);
    if (room && ptx >= 0 && pty >= 0 && ptx < room.w && pty < room.h) {
      if (room.tiles[pty * room.w + ptx] === 10) {
        hurtPlayer(0.5, { x: player.x, y: player.y - 1 });
      }
    }

    // switches
    for (const sw of switches) {
      if (sw.pressed) continue;
      const sbx = { x: sw.x + 4, y: sw.y + 4, w: 8, h: 8 };
      if (aabb(footBox(player.x, player.y), sbx)) {
        sw.pressed = true;
        sw.justPressed = 80;
        flags[sw.flag] = true;
        if (sw.dropsBossKey) {
          groundKeys.push({ id: "boss_key", x: sw.keyPos.x, y: sw.keyPos.y, boss: true });
          showToast("机关启动！Boss钥匙出现了");
        }
        // opens T2 north via flag
        updateDoorVisuals();
        // also update T2 tiles if we're not there — flag is enough
        save();
      }
    }
    for (const sw of switches) {
      if (sw.justPressed > 0) sw.justPressed -= dt;
    }

    // pickups
    const reach = footBox(player.x, player.y);
    for (let i = golds.length - 1; i >= 0; i--) {
      const g = golds[i];
      const gb = { x: g.x - 5, y: g.y - 5, w: 10, h: 10 };
      if (aabb(reach, gb)) {
        player.gold = Math.min(99, player.gold + 1);
        if (!g.drop) takenPickups[g.id] = true;
        golds.splice(i, 1);
        save();
      }
    }
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      const hb = { x: h.x - 4, y: h.y - 4, w: 8, h: 8 };
      if (aabb(reach, hb)) {
        player.hp = Math.min(player.maxHp, player.hp + 1);
        takenPickups[h.id] = true;
        hearts.splice(i, 1);
        showToast("恢复了心力");
        save();
      }
    }
    for (let i = groundKeys.length - 1; i >= 0; i--) {
      const k = groundKeys[i];
      const kb = { x: k.x - 6, y: k.y - 8, w: 12, h: 14 };
      if (aabb(reach, kb)) {
        if (k.boss) {
          player.bossKeys = Math.min(9, player.bossKeys + 1);
          flags.gotBossKeyPickup = true;
          showToast("获得Boss钥匙 ×1");
        } else {
          player.keys = Math.min(9, player.keys + 1);
          showToast("获得钥匙 ×1");
        }
        groundKeys.splice(i, 1);
        save();
      }
    }

    // enemies AI
    for (const e of enemies) {
      if (e.dead && e.type !== "boss") {
        if (e.squash > 0) e.squash -= dt;
        continue;
      }
      if (e.type === "boss" && e.hp <= 0) {
        e.deathT -= dt;
        if (e.deathT <= 0 && !core) {
          core = { x: e.x, y: e.y, t: 0 };
          e.dead = true;
        }
        continue;
      }
      if (e.flash > 0) e.flash -= dt;
      if (e.stun > 0) { e.stun -= dt; continue; }
      if (e.knock.x || e.knock.y) {
        tryMove(e, e.knock.x, e.knock.y);
        e.knock.x *= 0.6; e.knock.y *= 0.6;
      }

      if (e.type === "slime") {
        const dx = player.x - e.x, dy = player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        tryMove(e, (dx / len) * e.speed * dt / 1000, (dy / len) * e.speed * dt / 1000);
      } else if (e.type === "stone") {
        e.patrolAcc += dt;
        if (e.patrolAcc > 1200) { e.patrolAcc = 0; e.patrolDir *= -1; }
        const dx = player.x - e.x, dy = player.y - e.y;
        if (Math.hypot(dx, dy) < 80) {
          const len = Math.hypot(dx, dy) || 1;
          tryMove(e, (dx / len) * e.speed * dt / 1000, (dy / len) * e.speed * dt / 1000);
        } else {
          tryMove(e, e.patrolDir * e.speed * dt / 1000, 0);
        }
      } else if (e.type === "boss") {
        updateBoss(e, dt);
      }

      // contact damage
      if (e.hp > 0) {
        const eb = enemyBox(e);
        if (aabb(footBox(player.x, player.y), eb)) {
          hurtPlayer(e.dmg, e);
        }
      }
    }

    // door check
    tryDoor();

    // camera
    cam.x = Math.round(player.x - W / 2);
    cam.y = Math.round(player.y - H / 2);
    cam.x = Math.max(0, Math.min(cam.x, room.w * T - W));
    cam.y = Math.max(0, Math.min(cam.y, room.h * T - H));
    if (room.w * T < W) cam.x = Math.round((room.w * T - W) / 2);
    if (room.h * T < H) cam.y = Math.round((room.h * T - H) / 2);
  }

  function enemyBox(e) {
    if (e.type === "boss") return { x: e.x - 14, y: e.y - 14, w: 28, h: 28 };
    if (e.type === "stone") return { x: e.x - 8, y: e.y - 8, w: 16, h: 16 };
    return { x: e.x - 7, y: e.y - 5, w: 14, h: 10 };
  }

  function updateBoss(e, dt) {
    // phase transition
    if (e.hp <= 4 && e.phase === 1) {
      e.phase = 2;
      e.phaseFlash = 600;
      e.speed = 48;
      showToast("残阳守卫进入第二阶段！");
      if (!e.summoned) {
        e.summoned = true;
        enemies.push({
          type: "slime", hp: 1, maxHp: 1, dmg: 0.5, speed: 40,
          x: e.x + 30, y: e.y, flash: 0, squash: 0, stun: 0, dead: false,
          knock: { x: 0, y: 0 },
        });
      }
    }
    if (e.phaseFlash > 0) e.phaseFlash -= dt;

    if (e.telegraph > 0) {
      e.telegraph -= dt;
      if (e.telegraph <= 0) {
        // start dash
        const dx = player.x - e.x, dy = player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        e.dash = 280;
        e.dashVx = (dx / len) * 140;
        e.dashVy = (dy / len) * 140;
      }
      return;
    }
    if (e.dash > 0) {
      e.dash -= dt;
      tryMove(e, e.dashVx * dt / 1000, e.dashVy * dt / 1000);
      return;
    }

    // chase + occasionally telegraph dash
    const dx = player.x - e.x, dy = player.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    tryMove(e, (dx / len) * e.speed * dt / 1000, (dy / len) * e.speed * dt / 1000);
    e._dashCd = (e._dashCd || 0) - dt;
    if (e._dashCd <= 0 && Math.hypot(dx, dy) < 120) {
      e.telegraph = 300; // red-eye telegraph P0
      e._dashCd = e.phase === 2 ? 1600 : 2400;
    }
  }

  // ─── Draw ───────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);

    if (mode === MODE.TITLE) {
      drawTitle();
      return;
    }

    // world
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    if (room.outdoor) {
      // sky gradient in world? draw behind tiles in screen space — do after
    }

    // tiles
    const x0 = Math.max(0, Math.floor(cam.x / T));
    const y0 = Math.max(0, Math.floor(cam.y / T));
    const x1 = Math.min(room.w - 1, Math.ceil((cam.x + W) / T));
    const y1 = Math.min(room.h - 1, Math.ceil((cam.y + H) / T));
    if (room.outdoor) {
      // fill sky in screen space later; grass already drawn
    } else {
      ctx.fillStyle = "#2a3a3b";
      ctx.fillRect(cam.x, cam.y, W, H);
    }

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const id = room.tiles[ty * room.w + tx];
        Art.drawTile(ctx, id, tx * T, ty * T, tx + ty * 17);
      }
    }

    // switches
    for (const sw of switches) {
      Art.drawSwitch(ctx, sw.x, sw.y, sw.pressed);
    }

    // props houses
    for (const p of room.props || []) {
      if (p.type === "house") Art.drawHouse(ctx, p.x, p.y, p.w, p.h);
    }

    // signs
    for (const s of room.signs || []) Art.drawSign(ctx, s.x, s.y);

    // chests
    for (const c of chests) Art.drawChest(ctx, c.x, c.y, c.open);

    // golds / hearts / keys
    for (const g of golds) Art.drawCoin(ctx, g.x, g.y, Math.sin(time * 0.008) * 2);
    for (const h of hearts) Art.drawHeartPickup(ctx, h.x, h.y, time);
    for (const k of groundKeys) Art.drawKey(ctx, k.x, k.y, Math.sin(time * 0.008) * 2);

    // sort entities by y
    const ents = [];
    for (const n of room.npcs || []) ents.push({ y: n.y, draw: () => Art.drawNpc(ctx, n.x, n.y, n.kind, n.flash && !flags.metElder) });
    for (const e of enemies) {
      if (e.dead && e.type === "slime" && e.squash <= 0) continue;
      if (e.dead && e.type === "boss" && e.deathT <= 0) continue;
      ents.push({
        y: e.y,
        draw: () => {
          if (e.type === "slime") Art.drawSlime(ctx, e.x, e.y, !room.outdoor, e.squash > 0, e.flash > 0);
          else if (e.type === "stone") Art.drawStone(ctx, e.x, e.y, e.flash > 0);
          else if (e.type === "boss") {
            // red-eye telegraph: draw extra glow
            if (e.telegraph > 0) {
              ctx.save();
              ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 0.04);
              ctx.fillStyle = "#E76F51";
              ctx.beginPath();
              ctx.arc(e.x - 5, e.y - 4, 6, 0, Math.PI * 2);
              ctx.arc(e.x + 5, e.y - 4, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
            Art.drawBoss(ctx, e.x, e.y, e.phase, e.flash > 0 || e.phaseFlash > 0, e.hp <= 0);
          }
        },
      });
    }
    if (core) ents.push({ y: core.y, draw: () => Art.drawCore(ctx, core.x, core.y, time) });
    ents.push({
      y: player.y,
      draw: () => Art.drawHero(
        ctx, player.x, player.y, player.dir, player.walkFrame,
        player.swingT < 0 ? 0 : player.swingT,
        player.hurtFlash > 0,
        false
      ),
    });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    ctx.restore();

    // outdoor sky vignette top
    if (room && room.outdoor) {
      const g = ctx.createLinearGradient(0, 0, 0, 48);
      g.addColorStop(0, "rgba(255,232,200,0.35)");
      g.addColorStop(1, "rgba(255,232,200,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 48);
    }

    // HUD
    if (mode !== MODE.TITLE) {
      const totalKeys = player.keys + player.bossKeys;
      Art.drawHUD(
        ctx,
        player.hp,
        player.maxHp,
        totalKeys,
        player.gold,
        questOn && !flags.ending ? "目标：取回晨光核" : ""
      );
    }

    if (mode === MODE.DIALOG && dialog) {
      Art.drawDialog(ctx, dialog.name, dialog.lines[dialog.i] || "");
    }

    if (toast) {
      ctx.fillStyle = "rgba(42,31,26,0.7)";
      ctx.fillRect(W / 2 - 120, 40, 240, 28);
      ctx.fillStyle = "#F5E6D3";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(toast.text, W / 2, 58);
      ctx.textAlign = "left";
    }

    if (mode === MODE.END) {
      Art.drawPanel(ctx, "早晨回来了", "晨光核归位。村子又吵又暖。——通关", ["再走一程", "回村闲逛"]);
    }

    if (mode === MODE.DEAD) {
      ctx.fillStyle = "rgba(42,31,26,0.55)";
      ctx.fillRect(0, 0, W, H);
    }

    if (fade > 0) {
      ctx.fillStyle = "rgba(42,31,26," + Math.min(1, fade) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawTitle() {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#FFE8C8");
    g.addColorStop(1, "#F4A261");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(42,31,26,0.25)";
    ctx.beginPath();
    ctx.moveTo(0, 260); ctx.lineTo(120, 200); ctx.lineTo(280, 250); ctx.lineTo(400, 190); ctx.lineTo(640, 240); ctx.lineTo(640, 360); ctx.lineTo(0, 360);
    ctx.fill();
    Art.drawHero(ctx, 320, 150, 0, 0, 0, false, true);
    ctx.fillStyle = "#2A1F1A";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("《晨光神殿》", 320, 60);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#6F4E37";
    ctx.fillText("取回晨光核", 320, 86);

    const btns = hasSave() ? ["新游戏", "继续"] : ["新游戏"];
    panelBtns = btns;
    btns.forEach((b, i) => {
      const bw = 140, bh = 36;
      const bx = 320 - bw / 2;
      const by = 220 + i * 48;
      ctx.fillStyle = "#F4A261";
      roundRectPath(ctx, bx, by, bw, bh, 6);
      ctx.fill();
      ctx.strokeStyle = "#2A1F1A";
      ctx.stroke();
      ctx.fillStyle = "#F5E6D3";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(b, 320, by + 24);
    });
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(42,31,26,0.7)";
    ctx.fillText("WASD/方向移动 · J/Z/空格挥剑 · E对话", 320, 340);
    ctx.textAlign = "left";
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ─── Input ──────────────────────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(e.key)) e.preventDefault();
    if (e.key === "e" || e.key === "E" || e.key === "Enter") {
      if (mode === MODE.DIALOG) advanceDialog();
      else if (mode === MODE.PLAY) interact();
    }
    if (e.key === " " || e.key === "Spacebar") {
      if (mode === MODE.DIALOG) { advanceDialog(); e.preventDefault(); }
      else if (mode === MODE.PLAY && hasSword) { atkQueued = true; e.preventDefault(); }
      else if (mode === MODE.TITLE) clickTitle(0);
    }
    if ((e.key === "j" || e.key === "J" || e.key === "z" || e.key === "Z") && mode === MODE.PLAY) atkQueued = true;
    if (e.key === "Escape" && mode === MODE.DIALOG) advanceDialog();
  });
  window.addEventListener("keyup", (e) => { keys[e.key] = false; });

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (W / rect.width);
    const sy = (e.clientY - rect.top) * (H / rect.height);
    if (mode === MODE.TITLE) {
      const btns = hasSave() ? ["新游戏", "继续"] : ["新游戏"];
      btns.forEach((b, i) => {
        const bx = 320 - 70, by = 220 + i * 48;
        if (sx >= bx && sx <= bx + 140 && sy >= by && sy <= by + 36) clickTitle(i);
      });
      return;
    }
    if (mode === MODE.END) {
      // 再走一程 / 回村闲逛
      const by0 = (360 - 160) / 2 + 160 - 52 - 42;
      const by1 = (360 - 160) / 2 + 160 - 52;
      if (sx >= 250 && sx <= 390) {
        if (sy >= by0 && sy <= by0 + 36) { newGame(); }
        else if (sy >= by1 && sy <= by1 + 36) {
          enterRoom("village", Maps.ROOMS.village.spawn.x, Maps.ROOMS.village.spawn.y);
          mode = MODE.PLAY;
          save();
        }
      }
      return;
    }
    if (mode === MODE.DIALOG) {
      advanceDialog();
      return;
    }
    if (mode === MODE.PLAY) interact();
  });

  function clickTitle(i) {
    if (i === 0) newGame();
    else {
      const data = loadRaw();
      if (data) {
        applySave(data);
        mode = MODE.PLAY;
      } else newGame();
    }
  }

  // Touch controls
  const touchUI = document.getElementById("touch");
  const stick = document.getElementById("stick");
  const knob = document.getElementById("knob");
  const btnSword = document.getElementById("btn-sword");
  const btnInteract = document.getElementById("btn-interact");

  function isTouchDevice() {
    return matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  }
  if (isTouchDevice()) touchUI.classList.add("show");

  let stickTouchId = null;
  stick.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    stickTouchId = t.identifier;
    moveStick(t);
  }, { passive: false });
  stick.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) moveStick(t);
    }
  }, { passive: false });
  function endStick(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) {
        stickTouchId = null;
        touchAxis.x = touchAxis.y = 0;
        knob.style.transform = "translate(0,0)";
      }
    }
  }
  stick.addEventListener("touchend", endStick);
  stick.addEventListener("touchcancel", endStick);

  function moveStick(t) {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const max = r.width * 0.35;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    knob.style.transform = "translate(" + dx + "px," + dy + "px)";
    touchAxis.x = dx / max;
    touchAxis.y = dy / max;
    if (Math.abs(touchAxis.x) < 0.25) touchAxis.x = 0;
    if (Math.abs(touchAxis.y) < 0.25) touchAxis.y = 0;
  }

  btnSword.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (mode === MODE.DIALOG) advanceDialog();
    else if (mode === MODE.PLAY) { touchSword = true; atkQueued = true; }
    else if (mode === MODE.TITLE) clickTitle(0);
  }, { passive: false });

  btnInteract.addEventListener("touchstart", (e) => {
    e.preventDefault();
    interact();
  }, { passive: false });

  // ─── Loop ───────────────────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) {
    let dt = now - last;
    last = now;
    if (dt > 50) dt = 50;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // boot
  player = defaultPlayer();
  requestAnimationFrame(frame);
})();
