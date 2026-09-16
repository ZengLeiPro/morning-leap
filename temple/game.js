/**
 * 《晨光神殿》手感片 — GDD-feel-slice-v1 · 320×180 · 方案 B 图集
 */
(function () {
  "use strict";

  const Art = window.TempleArt;
  const Maps = window.TempleMaps;
  const AudioX = window.TempleAudio;
  const T = Maps.T;
  const W = 320, H = 180;
  const SAVE_KEY = "morning-temple-save";
  const SPEED = 58;
  const ATK_MS = 180;
  const ATK_ACTIVE_START = 40;
  const ATK_ACTIVE_END = 120;
  const IFRAME = 700;
  const HITSTOP_MS = 55;
  const STICK_DEAD = 0.28;

  const canvas = document.getElementById("game");
  const stage = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  Art.noSmooth(ctx);

  const uiLoading = document.getElementById("ui-loading");
  const uiTitle = document.getElementById("ui-title");
  const uiTitleBtns = document.getElementById("ui-title-btns");
  const uiHud = document.getElementById("ui-hud");
  const uiHudStats = document.getElementById("ui-hud-stats");
  const uiHudQuest = document.getElementById("ui-hud-quest");
  const uiToast = document.getElementById("ui-toast");
  const uiDialog = document.getElementById("ui-dialog");
  const uiDialogName = document.getElementById("ui-dialog-name");
  const uiDialogBody = document.getElementById("ui-dialog-body");
  const uiEnd = document.getElementById("ui-end");
  const btnMuteTitle = document.getElementById("btn-mute-title");
  const btnMuteHud = document.getElementById("btn-mute-hud");


  const MODE = { TITLE: "title", PLAY: "play", DIALOG: "dialog", FADE: "fade", END: "end", DEAD: "dead" };

  let mode = MODE.TITLE;
  let fade = 0, fadeDir = 0, fadeCb = null;
  let deathTimer = 0;
  let hitstop = 0;
  let doorCool = 0;
  let time = 0;
  let cam = { x: 0, y: 0 };
  let room = null;
  let roomId = "village";
  let assetsReady = false;

  let player = null;
  let enemies = [];
  let chests = [];
  let golds = [];
  let hearts = [];
  let switches = [];
  let groundKeys = [];
  let core = null;

  let dialog = null;
  let toast = null;
  let panelBtns = [];
  let moving = false;

  let flags = {};
  let openedChests = {};
  let takenPickups = {};
  let bestEnding = false;
  let hasSword = false;
  let questOn = false;

  const keys = Object.create(null);
  let touchAxis = { x: 0, y: 0 };
  let touchSword = false;
  let atkQueued = false;

  function defaultPlayer() {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      dir: 0,
      hp: 3, maxHp: 3,
      gold: 0, keys: 0, bossKeys: 0,
      swingT: -1, iframe: 0,
      walkFrame: 0, walkAcc: 0,
      hurtFlash: 0, knock: { x: 0, y: 0 },
      spawnProt: 0,
    };
  }

  // ─── Integer nearest scale (stage box; overlays match, no CSS transform) ─
  function fitCanvas() {
    const sx = Math.floor(window.innerWidth / W);
    const sy = Math.floor(window.innerHeight / H);
    const scale = Math.max(1, Math.min(sx, sy));
    const pw = W * scale, ph = H * scale;
    stage.style.width = pw + "px";
    stage.style.height = ph + "px";
    stage.style.setProperty("--ui-scale", String(scale));
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.imageRendering = "pixelated";
  }
  window.addEventListener("resize", fitCanvas);
  fitCanvas();

  function syncMuteUI() {
    const on = !(AudioX && AudioX.isMuted());
    const label = on ? "声音:开" : "声音:关";
    const pressed = on ? "false" : "true";
    if (btnMuteTitle) {
      btnMuteTitle.textContent = label;
      btnMuteTitle.setAttribute("aria-pressed", pressed);
    }
    if (btnMuteHud) {
      btnMuteHud.textContent = on ? "声" : "静";
      btnMuteHud.setAttribute("aria-pressed", pressed);
      btnMuteHud.title = on ? "静音" : "取消静音";
    }
  }
  function unlockAudio() {
    if (AudioX) AudioX.unlock();
  }
  function onMuteClick(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    unlockAudio();
    if (AudioX) AudioX.toggleMute();
    syncMuteUI();
  }
  if (btnMuteTitle) btnMuteTitle.addEventListener("click", onMuteClick);
  if (btnMuteHud) btnMuteHud.addEventListener("click", onMuteClick);
  syncMuteUI();

  // Browsers require a user gesture before AudioContext can start
  function gestureUnlock() {
    unlockAudio();
    window.removeEventListener("pointerdown", gestureUnlock, true);
    window.removeEventListener("keydown", gestureUnlock, true);
  }
  window.addEventListener("pointerdown", gestureUnlock, true);
  window.addEventListener("keydown", gestureUnlock, true);


  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle("hidden", !!hidden);
  }

  let titleBtnKey = "";
  function rebuildTitleButtons() {
    const btns = hasSave() ? ["新游戏", "继续"] : ["新游戏"];
    const key = btns.join("|");
    if (key === titleBtnKey && uiTitleBtns.childElementCount === btns.length) {
      panelBtns = btns;
      return;
    }
    titleBtnKey = key;
    panelBtns = btns;
    uiTitleBtns.innerHTML = "";
    btns.forEach((label, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ui-btn";
      b.textContent = label;
      b.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        clickTitle(i);
      });
      uiTitleBtns.appendChild(b);
    });
  }

  /** Sharp HTML overlays for Chinese UI — pixel world stays on canvas */
  function syncUI() {
    setHidden(uiLoading, assetsReady);
    const showTitle = assetsReady && mode === MODE.TITLE;
    setHidden(uiTitle, !showTitle);
    if (showTitle) rebuildTitleButtons();

    const showHud = assetsReady && mode !== MODE.TITLE && player;
    setHidden(uiHud, !showHud);
    if (showHud) {
      uiHudStats.textContent = "金" + player.gold + " 钥" + player.keys + " B" + player.bossKeys;
      const quest = questOn && !flags.ending ? "目标：取回晨光核" : "";
      uiHudQuest.textContent = quest;
      setHidden(uiHudQuest, !quest);
    }

    const showToast = !!(toast && toast.text && mode !== MODE.TITLE);
    setHidden(uiToast, !showToast);
    if (showToast) {
      uiToast.innerHTML = '<div class="ui-toast-msg"></div>';
      uiToast.querySelector(".ui-toast-msg").textContent = toast.text;
    }

    const showDialog = mode === MODE.DIALOG && dialog;
    setHidden(uiDialog, !showDialog);
    if (showDialog) {
      uiDialogName.textContent = dialog.name || "";
      uiDialogBody.textContent = dialog.lines[dialog.i] || "";
    }

    setHidden(uiEnd, mode !== MODE.END);
  }

  // ─── Save / Load ────────────────────────────────────────────────────────
  function serialize() {
    return {
      maxHp: player.maxHp, hp: player.hp, gold: player.gold,
      keys: player.keys, bossKeys: player.bossKeys,
      flags: Object.assign({}, flags),
      chests: Object.assign({}, openedChests),
      pickups: Object.assign({}, takenPickups),
      roomId, px: player.x, py: player.y,
      hasSword, questOn, bestEnding, v: 3,
    };
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (_) {}
  }

  function loadRaw() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
  }

  function applySave(data) {
    clearFadeAndDead();
    player = defaultPlayer();
    player.maxHp = data.maxHp || 3;
    let hp = data.hp != null ? data.hp : player.maxHp;
    if (!(hp > 0)) hp = player.maxHp; // never resume into a dead state
    player.hp = Math.min(player.maxHp, hp);
    player.gold = data.gold || 0;
    player.keys = data.keys || 0;
    player.bossKeys = data.bossKeys || 0;
    flags = data.flags || {};
    if (!flags.cleared || typeof flags.cleared !== "object") flags.cleared = {};
    // migrate old switchT3 → switchT2
    if (flags.switchT3 && !flags.switchT2) flags.switchT2 = true;
    openedChests = data.chests || {};
    takenPickups = data.pickups || {};
    hasSword = !!data.hasSword || !!flags.metElder;
    questOn = !!data.questOn || !!flags.metElder;
    bestEnding = !!data.bestEnding;
    const rid = Maps.ROOMS[data.roomId] ? data.roomId : "village";
    enterRoom(rid, data.px, data.py, true);
    player.spawnProt = 4000; // longer on village — easier to find elder, avoid false death
  }

  function newGame() {
    clearFadeAndDead();
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    player = defaultPlayer();
    flags = { cleared: {} };
    openedChests = {};
    takenPickups = {};
    hasSword = false;
    questOn = false;
    bestEnding = false;
    enterRoom("village", null, null, true);
    player.spawnProt = 5000;
    mode = MODE.PLAY;
    save();
  }

  function hasSave() { return !!loadRaw(); }


  function clearFadeAndDead() {
    fade = 0;
    fadeDir = 0;
    fadeCb = null;
    if (deathTimer) { clearTimeout(deathTimer); deathTimer = 0; }
  }

  // ─── Room ───────────────────────────────────────────────────────────────
  function enterRoom(id, px, py, skipFade) {
    const def = Maps.ROOMS[id];
    if (!def) return;
    roomId = id;
    room = def;
    enemies = []; chests = []; golds = []; hearts = [];
    switches = []; groundKeys = []; core = null;

    for (const c of def.chests || []) {
      chests.push({ id: c.id, x: c.x, y: c.y, reward: c.reward, open: !!openedChests[c.id] });
    }
    for (const g of def.goldPickups || []) {
      if (!takenPickups[g.id]) golds.push({ id: g.id, x: g.x, y: g.y });
    }
    for (const h of def.hearts || []) {
      if (!takenPickups[h.id]) hearts.push({ id: h.id, x: h.x, y: h.y });
    }
    for (const s of def.switches || []) {
      const pressed = !!flags[s.flag || "switchT2"];
      switches.push({
        id: s.id, x: s.x, y: s.y, flag: s.flag || "switchT2",
        pressed, dropsBossKey: s.dropsBossKey, keyPos: s.keyPos, justPressed: 0,
      });
      if (pressed && s.dropsBossKey && !flags.gotBossKeyPickup && (player.bossKeys | 0) < 1) {
        groundKeys.push({ id: "boss_key", x: s.keyPos.x, y: s.keyPos.y, boss: true });
      }
    }
    ensureClearedMap();
    if (!flags.cleared[id]) {
      for (const e of def.enemies || []) enemies.push(spawnEnemy(e));
    }
    if (def.boss && !flags.bossDead) enemies.push(spawnBoss(def.boss));
    if (flags.bossDead && id === "T3" && def.boss) {
      core = { x: def.boss.x, y: def.boss.y, t: 0 };
    }

    if (px != null && py != null) { player.x = px; player.y = py; }
    else { player.x = def.spawn.x; player.y = def.spawn.y; }
    player.vx = player.vy = 0;
    updateDoorVisuals();
    if (AudioX) AudioX.playBgmForRoom(id, false);
    if (!skipFade) save();
  }

  function spawnEnemy(e) {
    const spawnInvuln = 3000;
    if (e.type === "slime") {
      return {
        type: "slime", hp: 1, maxHp: 1, dmg: 1, speed: e.slow ? 18 : 40,
        x: e.x, y: e.y, flash: 0, squash: 0, stun: 0, dead: false,
        knock: { x: 0, y: 0 }, spawnInvuln,
      };
    }
    if (e.type === "stone") {
      return {
        type: "stone", hp: 3, maxHp: 3, dmg: 1, speed: 28,
        x: e.x, y: e.y, flash: 0, stun: 0, dead: false, knock: { x: 0, y: 0 },
        patrolDir: 1, patrolAcc: 0, spawnInvuln,
      };
    }
    return spawnBoss(e);
  }

  function spawnBoss(b) {
    return {
      type: "boss", hp: b.hp || 8, maxHp: 8, dmg: 1, speed: 32,
      x: b.x, y: b.y, flash: 0, stun: 0, dead: false, knock: { x: 0, y: 0 },
      phase: 1, telegraph: 0, dash: 0, dashVx: 0, dashVy: 0,
      windup: 0, slam: 0, slamVx: 0, slamVy: 0, atkKind: "dash",
      summoned: false, deathT: 0, phaseFlash: 0,
    };
  }

  function doorLooksOpen(d) {
    // Visual: switch alone opens T1 north look; boss key still required to enter
    if (d.needSwitchT2 && d.needBossKey) return !!flags.switchT2;
    return isDoorOpen(d);
  }

  function updateDoorVisuals() {
    if (!room) return;
    for (const d of room.doors || []) {
      const open = doorLooksOpen(d);
      for (let i = 0; i < (d.w || 1); i++) {
        for (let j = 0; j < (d.h || 1); j++) {
          const idx = (d.y + j) * room.w + (d.x + i);
          if (d.lockedVisual || d.needKey || d.needBossKey || d.needSwitchT2 || d.needClear) {
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
  function ensureClearedMap() {
    if (!flags.cleared || typeof flags.cleared !== "object") flags.cleared = {};
  }
  function markRoomClearedIfDone() {
    ensureClearedMap();
    if (roomCleared()) flags.cleared[roomId] = true;
  }
  function isRoomPermanentlyCleared() {
    ensureClearedMap();
    return !!flags.cleared[roomId];
  }

  function isDoorOpen(d) {
    if (d.needKey) {
      if (!hasSword) return false;
      return !!flags.templeUnlocked || player.keys >= 1;
    }
    // T1 north: switchT2 unlocks path; boss key still required to enter T3
    if (d.needSwitchT2 && d.needBossKey) {
      if (!flags.switchT2) return false;
      return !!flags.bossDoorOpen || player.bossKeys >= 1;
    }
    if (d.needBossKey) return !!flags.bossDoorOpen || player.bossKeys >= 1;
    if (d.needSwitchT2) return !!flags.switchT2;
    if (d.needClear) return isRoomPermanentlyCleared() || roomCleared();
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
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (!room || tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return true;
    const id = room.tiles[ty * room.w + tx];
    if (id === 7) return true;
    return Maps.isSolid(id);
  }
  function tryMove(ent, dx, dy) {
    const nx = ent.x + dx, ny = ent.y + dy;
    const box = footBox(nx, ny);
    const pts = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]];
    let blocked = false;
    for (const [px, py] of pts) if (solidAt(px, py)) { blocked = true; break; }
    if (!blocked && ent === player) {
      for (const n of room.npcs || []) {
        if (aabb(box, { x: n.x - 6, y: n.y - 4, w: 12, h: 12 })) { blocked = true; break; }
      }
    }
    if (!blocked) { ent.x = nx; ent.y = ny; return true; }
    if (dx !== 0 && tryMoveAxis(ent, dx, 0)) return true;
    if (dy !== 0 && tryMoveAxis(ent, 0, dy)) return true;
    return false;
  }
  function tryMoveAxis(ent, dx, dy) {
    const nx = ent.x + dx, ny = ent.y + dy;
    const box = footBox(nx, ny);
    const pts = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]];
    for (const [px, py] of pts) if (solidAt(px, py)) return false;
    if (ent === player) {
      for (const n of room.npcs || []) {
        if (aabb(box, { x: n.x - 6, y: n.y - 4, w: 12, h: 12 })) return false;
      }
    }
    ent.x = nx; ent.y = ny;
    return true;
  }

  // ─── Combat ─────────────────────────────────────────────────────────────
  function swordBox() {
    if (player.swingT < ATK_ACTIVE_START || player.swingT > ATK_ACTIVE_END) return null;
    const w = 18, h = 12;
    let x = player.x, y = player.y;
    if (player.dir === 0) { x -= 9; y += 4; return { x, y, w, h }; }
    if (player.dir === 1) { x -= 9; y -= 16; return { x, y, w, h }; }
    if (player.dir === 2) { x -= 18; y -= 6; return { x, y, w: h, h: w }; }
    if (player.dir === 3) { x += 4; y -= 6; return { x, y, w: h, h: w }; }
    return null;
  }

  function hitEnemy(e) {
    if (e.dead || e.hp <= 0) return;
    e.hp -= 1;
    e.flash = 120;
    if (e.type === "stone") e.stun = 120;
    const dx = e.x - player.x, dy = e.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    e.knock.x = (dx / len) * 24;
    e.knock.y = (dy / len) * 24;
    hitstop = HITSTOP_MS;
    if (e.hp <= 0) {
      e.dead = true;
      if (e.type === "slime") e.squash = 200;
      if (e.type === "boss") { e.deathT = 600; flags.bossDead = true; }
      markRoomClearedIfDone();
      updateDoorVisuals();
    }
  }

  function hurtPlayer(dmg, from) {
    if (player.spawnProt > 0 || player.iframe > 0 || mode !== MODE.PLAY) return;
    if (AudioX) AudioX.playSfx("hurt");
    player.hp = Math.max(0, player.hp - dmg);
    player.iframe = IFRAME;
    player.hurtFlash = IFRAME;
    if (from) {
      const dx = player.x - from.x, dy = player.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      player.knock.x = (dx / len) * 26;
      player.knock.y = (dy / len) * 26;
    }
    if (player.hp <= 0) {
      // Keep empty hearts while DEAD so HUD never pairs full HP with death copy
      player.hp = 0;
      mode = MODE.DEAD;
      dialog = null;
      showToast("眼前一黑……");
      if (deathTimer) clearTimeout(deathTimer);
      deathTimer = setTimeout(() => { deathTimer = 0; respawnVillage(); }, 700);
    }
  }

  function respawnVillage() {
    clearFadeAndDead();
    player.iframe = 0;
    player.knock.x = player.knock.y = 0;
    // Auto-respawn — no E-to-dismiss death dialog (avoids stuck dead UI)
    enterRoom("village", Maps.ROOMS.village.spawn.x, Maps.ROOMS.village.spawn.y);
    player.spawnProt = 4000;
    // Refill only when leaving DEAD → PLAY (soft toast, not death line)
    mode = MODE.PLAY;
    player.hp = player.maxHp;
    showToast("已回村");
    save();
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────
  function showDialog(name, lines, onDone) {
    dialog = { name, lines: lines.slice(), i: 0, onDone: onDone || null };
    mode = MODE.DIALOG;
    if (AudioX) AudioX.playSfx("dialog");
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
    } else if (AudioX) {
      AudioX.playSfx("dialog");
    }
  }
  function showToast(text) { toast = { text, t: 1400 }; }

  function interact() {
    if (mode === MODE.DIALOG) { advanceDialog(); return; }
    if (mode === MODE.TITLE || mode === MODE.END) return;
    if (mode !== MODE.PLAY) return;

    const pb = footBox(player.x, player.y);
    const reach = { x: pb.x - 8, y: pb.y - 8, w: pb.w + 16, h: pb.h + 16 };

    for (const n of room.npcs || []) {
      if (!aabb(reach, { x: n.x - 10, y: n.y - 10, w: 20, h: 20 })) continue;
      talkNpc(n);
      return;
    }
    for (const s of room.signs || []) {
      if (!aabb(reach, { x: s.x - 10, y: s.y - 10, w: 20, h: 20 })) continue;
      if (s.story === "stele") flags.stele = true;
      showDialog("石碑", [s.text]);
      return;
    }
    for (const c of chests) {
      if (c.open) continue;
      if (!aabb(reach, { x: c.x - 10, y: c.y - 8, w: 20, h: 16 })) continue;
      openChest(c);
      return;
    }
    if (core && aabb(reach, { x: core.x - 12, y: core.y - 12, w: 24, h: 24 })) {
      takeCore();
    }
  }

  function talkNpc(n) {
    if (n.id === "elder") {
      if (!flags.metElder) {
        showDialog("长老", ["晨光核在神殿里。东边商人有钥匙——心看好。"], () => {
          flags.metElder = true;
          hasSword = true;
          questOn = true;
          n.flash = false;
          save();
        });
      } else if (flags.ending) {
        showDialog("长老", ["早晨回来了。村子又吵又暖。"]);
      } else {
        showDialog("长老", ["晨光核在神殿里。东边商人有钥匙——心看好。"]);
      }
      return;
    }
    if (n.id === "merchant") {
      if (!hasSword) {
        showDialog("钥匙商人", ["先去找长老吧。"]);
      } else if (player.keys >= 1 || flags.boughtKey) {
        showDialog("钥匙商人", ["小心石头人——要砍好几下。"]);
      } else if (player.gold >= 5) {
        showDialog("钥匙商人", ["神殿钥匙，五枚金币。成交？"], () => {
          player.gold -= 5;
          player.keys = Math.min(9, player.keys + 1);
          flags.boughtKey = true;
          if (AudioX) AudioX.playSfx("pickup");
          showToast("获得神殿钥匙 ×1");
          save();
        });
      } else {
        showDialog("钥匙商人", ["神殿钥匙五枚金币。草地上有五枚。"]);
      }
    }
  }

  function openChest(c) {
    c.open = true;
    openedChests[c.id] = true;
    if (AudioX) AudioX.playSfx("pickup");
    if (c.reward === "maxhp") {
      player.maxHp = Math.min(4, player.maxHp + 1);
      player.hp = player.maxHp;
      showDialog("宝箱", ["心的上限增加了！"]);
    } else {
      showDialog("宝箱", ["空空如也。"]);
    }
    save();
  }

  function takeCore() {
    flags.ending = true;
    bestEnding = true;
    if (AudioX) AudioX.playSfx("pickup");
    showDialog("旁白", ["早晨回来了。村子又吵又暖。"], () => {
      mode = MODE.END;
      save();
    });
  }

  // ─── Fade — callback must NOT set PLAY; only when fade<=0 ───────────────
  function fadeTo(cb) {
    mode = MODE.FADE;
    fade = 0;
    fadeDir = 1;
    fadeCb = cb;
  }

  function tryDoor() {
    if (!room || doorCool > 0 || mode === MODE.FADE) return;
    const pb = footBox(player.x, player.y);
    for (const d of room.doors || []) {
      const db = { x: d.x * T - 2, y: d.y * T - 2, w: (d.w || 1) * T + 4, h: (d.h || 1) * T + 4 };
      if (!aabb(pb, db)) continue;

      if (!isDoorOpen(d)) {
        let msg = d.lockedMsg || "门还锁着。";
        if (d.needKey && !hasSword) msg = "先找长老拿剑。";
        else if (d.needKey && !(flags.templeUnlocked || player.keys >= 1)) msg = "需要钥匙。";
        else if (d.needSwitchT2 && !flags.switchT2) msg = "门还锁着。";
        else if (d.needBossKey && !(flags.bossDoorOpen || player.bossKeys >= 1)) msg = "需要钥匙。";
        if (!toast || toast.t < 200) showToast(msg);
        if (d.y === 0) player.y += 2;
        else if (d.y >= room.h - 1) player.y -= 2;
        else if (d.x === 0) player.x += 2;
        else player.x -= 2;
        return;
      }

      const dest = d.target, sx = d.spawnAt.x, sy = d.spawnAt.y;
      doorCool = 500;
      if (AudioX) AudioX.playSfx("door");
      fadeTo(() => {
        if (d.consumeKey && d.needKey && !flags.templeUnlocked) {
          player.keys = Math.max(0, player.keys - 1);
          flags.templeUnlocked = true;
        }
        if (d.consumeBossKey && d.needBossKey && !flags.bossDoorOpen) {
          player.bossKeys = Math.max(0, player.bossKeys - 1);
          flags.bossDoorOpen = true;
        }
        enterRoom(dest, sx, sy);
        player.spawnProt = Math.max(player.spawnProt || 0, dest === "village" ? 4000 : 1200);
        // Stay in FADE until fade-out completes; FADE branch sets PLAY at fade<=0
        updateDoorVisuals();
        save();
      });
      return;
    }
  }

  // ─── Update ─────────────────────────────────────────────────────────────
  function update(dt) {
    time += dt;
    if (AudioX) AudioX.update(dt);
    if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
    if (doorCool > 0) doorCool -= dt;

    if (mode === MODE.FADE) {
      fade += fadeDir * (dt / 180);
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

    if (mode === MODE.DIALOG || mode === MODE.TITLE || mode === MODE.END || mode === MODE.DEAD) {
      return;
    }
    if (hitstop > 0) { hitstop -= dt; return; }

    if (player.spawnProt > 0) player.spawnProt -= dt;
    if (player.iframe > 0) player.iframe -= dt;
    if (player.hurtFlash > 0) player.hurtFlash -= dt;
    if (player.swingT >= 0) {
      player.swingT += dt;
      if (player.swingT >= ATK_MS) player.swingT = -1;
    }

    if (player.knock.x || player.knock.y) {
      tryMove(player, player.knock.x, player.knock.y);
      player.knock.x *= 0.72; player.knock.y *= 0.72;
      if (Math.abs(player.knock.x) < 0.2) player.knock.x = 0;
      if (Math.abs(player.knock.y) < 0.2) player.knock.y = 0;
    }

    // hold-to-move via e.code (layout/IME-safe); release = immediate stop
    let mx = 0, my = 0;
    if (keys.ArrowLeft || keys.KeyA) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (keys.ArrowUp || keys.KeyW) my -= 1;
    if (keys.ArrowDown || keys.KeyS) my += 1;
    mx += touchAxis.x;
    my += touchAxis.y;
    moving = !!(mx || my);
    if (moving) {
      const len = Math.hypot(mx, my) || 1;
      mx /= len; my /= len;
      if (Math.abs(mx) > Math.abs(my)) player.dir = mx < 0 ? 2 : 3;
      else player.dir = my < 0 ? 1 : 0;
      let step = SPEED * (dt / 1000);
      if (player.swingT >= 0) step *= 0.55;
      tryMove(player, mx * step, my * step);
      player.walkAcc += dt;
      if (player.walkAcc > 100) {
        player.walkAcc = 0;
        player.walkFrame = (player.walkFrame + 1) % 3;
      }
    } else {
      player.walkAcc = 0;
    }

    // Attack: edge-queued KeyJ/KeyZ only (not Space, not hold-repeat from stuck keys)
    if (mode === MODE.PLAY && (atkQueued || touchSword) && hasSword && player.swingT < 0) {
      player.swingT = 0;
      if (AudioX) AudioX.playSfx("sword");
      atkQueued = false;
      touchSword = false;
    } else {
      atkQueued = false;
      if (mode !== MODE.PLAY) touchSword = false;
    }

    const sb = swordBox();
    if (sb) {
      for (const e of enemies) {
        if (e.dead && e.type !== "boss") continue;
        if (e.hp <= 0 && e.type === "boss") continue;
        if (e._hitThisSwing) continue;
        if (aabb(sb, enemyBox(e))) { e._hitThisSwing = true; hitEnemy(e); }
      }
    } else {
      for (const e of enemies) e._hitThisSwing = false;
    }

    for (const sw of switches) {
      if (sw.pressed) continue;
      if (aabb(footBox(player.x, player.y), { x: sw.x + 4, y: sw.y + 4, w: 8, h: 8 })) {
        sw.pressed = true;
        sw.justPressed = 80;
        flags[sw.flag] = true;
        if (sw.dropsBossKey) {
          groundKeys.push({ id: "boss_key", x: sw.keyPos.x, y: sw.keyPos.y, boss: true });
          showToast("机关启动！Boss钥匙出现了");
        }
        updateDoorVisuals();
        save();
      }
    }
    for (const sw of switches) if (sw.justPressed > 0) sw.justPressed -= dt;

    const reach = footBox(player.x, player.y);
    for (let i = golds.length - 1; i >= 0; i--) {
      const g = golds[i];
      if (aabb(reach, { x: g.x - 5, y: g.y - 5, w: 10, h: 10 })) {
        player.gold = Math.min(99, player.gold + 1);
        if (!g.drop) takenPickups[g.id] = true;
        golds.splice(i, 1);
        if (AudioX) AudioX.playSfx("pickup");
        save();
      }
    }
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      if (aabb(reach, { x: h.x - 4, y: h.y - 4, w: 8, h: 8 })) {
        player.hp = Math.min(player.maxHp, player.hp + 1);
        takenPickups[h.id] = true;
        hearts.splice(i, 1);
        if (AudioX) AudioX.playSfx("pickup");
        showToast("恢复了心力");
        save();
      }
    }
    for (let i = groundKeys.length - 1; i >= 0; i--) {
      const k = groundKeys[i];
      if (aabb(reach, { x: k.x - 6, y: k.y - 8, w: 12, h: 14 })) {
        if (k.boss) {
          player.bossKeys = Math.min(9, player.bossKeys + 1);
          flags.gotBossKeyPickup = true;
          showToast("获得Boss钥匙 ×1");
        } else {
          player.keys = Math.min(9, player.keys + 1);
          showToast("获得钥匙 ×1");
        }
        groundKeys.splice(i, 1);
        if (AudioX) AudioX.playSfx("pickup");
        save();
      }
    }

    for (const e of enemies) {
      if (e.dead && e.type !== "boss") { if (e.squash > 0) e.squash -= dt; continue; }
      if (e.type === "boss" && e.hp <= 0) {
        e.deathT -= dt;
        if (e.deathT <= 0 && !core) { core = { x: e.x, y: e.y, t: 0 }; e.dead = true; }
        continue;
      }
      if (e.flash > 0) e.flash -= dt;
      if (e.spawnInvuln > 0) e.spawnInvuln -= dt;
      if (e.stun > 0) { e.stun -= dt; continue; }
      if (e.knock.x || e.knock.y) {
        tryMove(e, e.knock.x, e.knock.y);
        e.knock.x *= 0.65; e.knock.y *= 0.65;
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
      if (e.hp > 0 && !(e.spawnInvuln > 0)) {
        if (aabb(footBox(player.x, player.y), enemyBox(e))) hurtPlayer(e.dmg, e);
      }
    }

    if (enemies.length && roomCleared()) markRoomClearedIfDone();
    tryDoor();

    // Maps append ≥1 bottom pad tile so south decoration isn't flush-cut
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
    if (e.hp <= 4 && e.phase === 1) {
      e.phase = 2; e.phaseFlash = 600; e.speed = 48;
      showToast("残阳守卫进入第二阶段！");
      if (!e.summoned) {
        e.summoned = true; e.summonWarn = 500;
        e.summonX = e.x + 30; e.summonY = e.y;
      }
    }
    if (e.phaseFlash > 0) e.phaseFlash -= dt;
    if (e.summonWarn > 0) {
      e.summonWarn -= dt;
      if (e.summonWarn <= 0) {
        e.summonWarn = 0;
        enemies.push({
          type: "slime", hp: 1, maxHp: 1, dmg: 1, speed: 40,
          x: e.summonX, y: e.summonY, flash: 0, squash: 0, stun: 0, dead: false,
          knock: { x: 0, y: 0 }, spawnInvuln: 500,
        });
      }
    }
    if (e.telegraph > 0) {
      e.telegraph -= dt;
      if (e.telegraph <= 0) {
        const dx = player.x - e.x, dy = player.y - e.y, len = Math.hypot(dx, dy) || 1;
        e.dash = 280; e.dashVx = (dx / len) * 140; e.dashVy = (dy / len) * 140;
      }
      return;
    }
    if (e.dash > 0) { e.dash -= dt; tryMove(e, e.dashVx * dt / 1000, e.dashVy * dt / 1000); return; }
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) {
        e.windup = 0;
        const dx = player.x - e.x, dy = player.y - e.y, len = Math.hypot(dx, dy) || 1;
        e.slam = 200; e.slamVx = (dx / len) * 110; e.slamVy = (dy / len) * 110;
      }
      return;
    }
    if (e.slam > 0) { e.slam -= dt; tryMove(e, e.slamVx * dt / 1000, e.slamVy * dt / 1000); return; }

    const dx = player.x - e.x, dy = player.y - e.y, len = Math.hypot(dx, dy) || 1;
    tryMove(e, (dx / len) * e.speed * dt / 1000, (dy / len) * e.speed * dt / 1000);
    e._dashCd = (e._dashCd || 0) - dt;
    if (e._dashCd <= 0 && Math.hypot(dx, dy) < 100) {
      e._atkAlt = !e._atkAlt;
      if (e._atkAlt) { e.atkKind = "windup"; e.windup = 520; }
      else { e.atkKind = "dash"; e.telegraph = 320; }
      if (AudioX) AudioX.playSfx("boss_warn");
      e._dashCd = e.phase === 2 ? 1500 : 2200;
    }
  }

  // ─── Draw ───────────────────────────────────────────────────────────────
  function draw() {
    Art.noSmooth(ctx);
    ctx.clearRect(0, 0, W, H);
    syncUI();

    if (!assetsReady) {
      ctx.fillStyle = "#2A1F1A";
      ctx.fillRect(0, 0, W, H);
      return;
    }

    if (mode === MODE.TITLE) { drawTitle(); return; }

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    if (!room.outdoor) {
      ctx.fillStyle = "#1a2425";
      ctx.fillRect(cam.x, cam.y, W, H);
    }

    const x0 = Math.max(0, Math.floor(cam.x / T));
    const y0 = Math.max(0, Math.floor(cam.y / T));
    const x1 = Math.min(room.w - 1, Math.ceil((cam.x + W) / T));
    const y1 = Math.min(room.h - 1, Math.ceil((cam.y + H) / T));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        Art.drawTile(ctx, room.tiles[ty * room.w + tx], tx * T, ty * T, tx + ty * 17, room.outdoor);
      }
    }

    for (const sw of switches) Art.drawSwitch(ctx, sw.x, sw.y, sw.pressed);
    for (const p of room.props || []) {
      if (p.type === "house") Art.drawHouse(ctx, p.x, p.y, p.w, p.h);
    }
    for (const s of room.signs || []) Art.drawSign(ctx, s.x, s.y);
    for (const c of chests) Art.drawChest(ctx, c.x, c.y, c.open, room.outdoor);
    for (const g of golds) Art.drawCoin(ctx, g.x, g.y, Math.sin(time * 0.008) * 2);
    for (const h of hearts) Art.drawHeartPickup(ctx, h.x, h.y, time);
    for (const k of groundKeys) Art.drawKey(ctx, k.x, k.y, Math.sin(time * 0.008) * 2);

    for (const e of enemies) {
      if (e.type === "boss" && e.summonWarn > 0) {
        const pulse = 0.65 + 0.35 * Math.sin(time * 0.02);
        ctx.strokeStyle = "rgba(244,162,97," + (0.55 + 0.35 * pulse) + ")";
        ctx.fillStyle = "rgba(244,162,97," + (0.18 * pulse) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(e.summonX, e.summonY + 4, 10 + pulse * 3, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
    }

    const ents = [];
    for (const n of room.npcs || []) {
      ents.push({ y: n.y, draw: () => Art.drawNpc(ctx, n.x, n.y, n.kind, n.flash && !flags.metElder) });
    }
    for (const e of enemies) {
      if (e.dead && e.type === "slime" && e.squash <= 0) continue;
      if (e.dead && e.type === "boss" && e.deathT <= 0) continue;
      ents.push({
        y: e.y,
        draw: () => {
          if (e.type === "slime") Art.drawSlime(ctx, e.x, e.y, !room.outdoor, e.squash > 0, e.flash > 0);
          else if (e.type === "stone") Art.drawStone(ctx, e.x, e.y, e.flash > 0);
          else if (e.type === "boss") {
            Art.drawBoss(ctx, e.x, e.y, e.phase, e.flash > 0 || e.phaseFlash > 0, e.hp <= 0, e.telegraph > 0, time, e.windup > 0);
          }
        },
      });
    }
    if (core) ents.push({ y: core.y, draw: () => Art.drawCore(ctx, core.x, core.y, time) });
    ents.push({
      y: player.y,
      draw: () => Art.drawHeroIdle(
        ctx, player.x, player.y, player.dir, player.walkFrame,
        moving, player.swingT >= 0, player.hurtFlash > 0
      ),
    });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();
    ctx.restore();

    if (mode !== MODE.TITLE) {
      Art.drawHUD(ctx, player.hp, player.maxHp);
    }
    // dialog / toast / ending copy → HTML overlays (syncUI)
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
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#FFE8C8");
    g.addColorStop(1, "#F4A261");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (Art.imgs.warrior) {
      Art.drawHeroIdle(ctx, W / 2, 78, 0, (time / 200 | 0) % 3, false, false, false);
    }
    // Title / buttons / hints → sharp HTML overlay
  }

  // ─── Input — e.code for movement (IME/layout-safe); attack edge-queue ────
  const MOVE_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
  const CODE_KEY_ALIASES = {
    KeyW: ["w", "W"], KeyA: ["a", "A"], KeyS: ["s", "S"], KeyD: ["d", "D"],
    KeyJ: ["j", "J"], KeyZ: ["z", "Z"],
    ArrowUp: ["ArrowUp"], ArrowDown: ["ArrowDown"], ArrowLeft: ["ArrowLeft"], ArrowRight: ["ArrowRight"],
  };
  function clearCodeAndAliases(code, key) {
    if (code) delete keys[code];
    if (key) {
      delete keys[key];
      delete keys[key.toLowerCase()];
      delete keys[key.toUpperCase()];
    }
    const aliases = CODE_KEY_ALIASES[code];
    if (aliases) for (const a of aliases) delete keys[a];
  }

  window.addEventListener("keydown", (e) => {
    // Movement state keyed by physical code — never e.key (IME mismatch sticks)
    if (MOVE_CODES.has(e.code)) {
      keys[e.code] = true;
      e.preventDefault();
    }
    if (e.code === "Space") e.preventDefault();

    // Dialog / confirm: E Enter Space Escape — never swing
    if (e.code === "KeyE" || e.code === "Enter" || e.code === "Escape") {
      if (mode === MODE.DIALOG) advanceDialog();
      else if (mode === MODE.PLAY) interact();
      return;
    }
    if (e.code === "Space") {
      if (mode === MODE.DIALOG) advanceDialog();
      else if (mode === MODE.TITLE) clickTitle(hasSave() ? 1 : 0);
      else if (mode === MODE.PLAY) interact(); // Space = confirm/talk, NOT attack
      return;
    }
    // Attack: keydown edge only (ignore repeat / stuck hold)
    if ((e.code === "KeyJ" || e.code === "KeyZ") && mode === MODE.PLAY && !e.repeat) {
      atkQueued = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    clearCodeAndAliases(e.code, e.key);
  });

  canvas.addEventListener("click", () => {
    if (mode === MODE.TITLE || mode === MODE.END) return; // HTML buttons
    if (mode === MODE.DIALOG) { advanceDialog(); return; }
    if (mode === MODE.PLAY) interact();
  });

  uiEnd.querySelectorAll("[data-end]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (mode !== MODE.END) return;
      const act = btn.getAttribute("data-end");
      if (act === "new") newGame();
      else if (act === "village") {
        enterRoom("village", Maps.ROOMS.village.spawn.x, Maps.ROOMS.village.spawn.y);
        mode = MODE.PLAY;
        save();
      }
    });
  });

  uiDialog.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (mode === MODE.DIALOG) advanceDialog();
  });

  function clickTitle(i) {
    clearFadeAndDead();
    if (i === 0) newGame();
    else {
      const data = loadRaw();
      if (data) { applySave(data); mode = MODE.PLAY; }
      else newGame();
    }
  }

  // Touch
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
    stickTouchId = e.changedTouches[0].identifier;
    moveStick(e.changedTouches[0]);
  }, { passive: false });
  stick.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === stickTouchId) moveStick(t);
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

  function clearMoveInput() {
    for (const k of Object.keys(keys)) delete keys[k];
    touchAxis.x = 0;
    touchAxis.y = 0;
    touchSword = false;
    atkQueued = false;
    stickTouchId = null;
    if (knob) knob.style.transform = "translate(0,0)";
  }
  // Clear on lose focus AND on regain focus (kills ghost walk after Alt-Tab)
  window.addEventListener("blur", clearMoveInput);
  window.addEventListener("focus", clearMoveInput);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") clearMoveInput();
  });

  function moveStick(t) {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const max = r.width * 0.35;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    knob.style.transform = "translate(" + dx + "px," + dy + "px)";
    let ax = dx / max, ay = dy / max;
    if (Math.hypot(ax, ay) < STICK_DEAD) { ax = 0; ay = 0; }
    else {
      // renormalize after deadzone
      const L = Math.hypot(ax, ay) || 1;
      ax /= L; ay /= L;
    }
    touchAxis.x = ax; touchAxis.y = ay;
  }

  btnSword.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (mode === MODE.DIALOG) advanceDialog();
    else if (mode === MODE.PLAY) { touchSword = true; atkQueued = true; }
    else if (mode === MODE.TITLE) clickTitle(hasSave() ? 1 : 0);
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
    if (assetsReady) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  player = defaultPlayer();
  const boot = Promise.all([
    Art.loadAll(),
    AudioX ? AudioX.loadAll() : Promise.resolve(),
  ]);
  boot.then(() => {
    assetsReady = true;
    syncMuteUI();
    if (AudioX) AudioX.playBgm("village", true);
  }).catch((err) => {
    console.error(err);
    assetsReady = true; // allow fallback draw
  });
  requestAnimationFrame(frame);
})();
