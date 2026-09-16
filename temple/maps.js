/**
 * 《晨光神殿》手感片地图 — GDD-feel-slice-v1
 * 村小片 + T1 门厅 → T2 钥室 → T3 Boss（无旧走廊/刺道）
 * 瓦片: 0空 1草 2路 3神殿地 4村墙 5神殿墙 6门开 7门锁 8水 9花 11Boss圈
 */
(function (global) {
  "use strict";

  const T = 16;

  function fill(w, h, id) {
    const a = new Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = id;
    return a;
  }

  function setRect(tiles, w, x0, y0, x1, y1, id) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (x >= 0 && y >= 0 && x < w) tiles[y * w + x] = id;
  }

  function setBorder(tiles, w, h, id) {
    for (let x = 0; x < w; x++) {
      tiles[x] = id;
      tiles[(h - 1) * w + x] = id;
    }
    for (let y = 0; y < h; y++) {
      tiles[y * w] = id;
      tiles[y * w + w - 1] = id;
    }
  }

  /** Interior id-5 not on the ring and not 4-connected to another wall/door → floor. Keeps borders/doors. */
  function clearOrphanInteriorWalls(room) {
    const w = room.w, h = room.h, tiles = room.tiles;
    const wallish = { 5: 1, 6: 1, 7: 1 };
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (tiles[i] !== 5) continue;
        let n = 0;
        if (wallish[tiles[i - 1]]) n++;
        if (wallish[tiles[i + 1]]) n++;
        if (wallish[tiles[i - w]]) n++;
        if (wallish[tiles[i + w]]) n++;
        if (n === 0) tiles[i] = 3;
      }
    }
  }

  /**
   * Visual-only margin SOUTH of the existing border wall (not playable interior).
   * Pad lets cam max show the south wall without flush-cut; room.padRows records it so
   * camera soft-clamp / south-door edge checks ignore pad and do not shift content up.
   */
  function appendBottomPad(room, fillId, wallId, rows) {
    const n = rows == null ? 2 : rows;
    const w = room.w;
    const tiles = room.tiles.slice();
    for (let r = 0; r < n; r++) {
      for (let x = 0; x < w; x++) {
        // Match border look on sides; fill is scenery only (unreachable past solid south wall)
        const id = (x === 0 || x === w - 1) ? wallId : fillId;
        tiles.push(id);
      }
    }
    room.h = room.h + n;
    room.tiles = tiles;
    room.padRows = n;
    room.contentH = room.h - n; // height to south wall inclusive (pre-pad)
  }

  function punchDoor(tiles, w, d) {
    for (let i = 0; i < (d.w || 1); i++) {
      for (let j = 0; j < (d.h || 1); j++) {
        tiles[(d.y + j) * w + (d.x + i)] = d.lockedVisual ? 7 : 6;
      }
    }
  }

  function buildVillage() {
    // ~1–1.5 screens at 320×180 (20×14 tiles)
    const w = 22, h = 14;
    const tiles = fill(w, h, 1);
    setBorder(tiles, w, h, 4);
    // plaza + paths
    setRect(tiles, w, 8, 5, 13, 10, 2);
    setRect(tiles, w, 10, 2, 11, 5, 2);
    setRect(tiles, w, 13, 7, 19, 8, 2);
    setRect(tiles, w, 3, 7, 8, 8, 2);
    tiles[4 * w + 5] = 9;
    tiles[10 * w + 16] = 9;
    tiles[3 * w + 15] = 9;
    // north temple gate (locked visual) — art draws dungeon door 9/10
    tiles[2 * w + 10] = 7;
    tiles[2 * w + 11] = 7;
    // pond removed: Tiny Town has no water tile (art review — no vector fill)
    return {
      id: "village",
      name: "晨光村",
      w, h, tiles,
      outdoor: true,
      spawn: { x: 11 * T + 8, y: 9 * T + 8 },
      doors: [
        {
          id: "to_temple",
          x: 10, y: 2, w: 2, h: 1,
          needKey: true,
          consumeKey: true,
          target: "T1",
          spawnAt: { x: 9 * T + 8, y: 10 * T + 8 },
          lockedMsg: "需要钥匙。",
          lockedVisual: true,
        },
      ],
      npcs: [
        { id: "elder", kind: "elder", x: 8 * T + 8, y: 7 * T + 8, flash: true },
        { id: "merchant", kind: "merchant", x: 18 * T + 8, y: 8 * T + 8, flash: false },
      ],
      chests: [
        { id: "v_maxhp", x: 4 * T + 8, y: 10 * T + 8, reward: "maxhp" },
      ],
      goldPickups: [
        { id: "vg1", x: 12 * T + 8, y: 11 * T + 8 },
        { id: "vg2", x: 13 * T + 8, y: 11 * T + 8 },
        { id: "vg3", x: 14 * T + 8, y: 11 * T + 8 },
        { id: "vg4", x: 12 * T + 8, y: 12 * T + 8 },
        { id: "vg5", x: 13 * T + 8, y: 12 * T + 8 },
      ],
      // Reviewer: 0 or at most 1 village slime — SE, north of south wall (row 13), off plaza
      enemies: [
        { type: "slime", x: 19 * T + 8, y: 12 * T + 8, slow: true },
      ],
      signs: [],
      props: [
        { type: "house", x: 2 * T, y: 6 * T, w: 48, h: 32 },
        { type: "house", x: 16 * T, y: 5 * T, w: 48, h: 32 },
      ],
      switches: [],
      hearts: [],
    };
  }

  function templeRoom(id, opts) {
    const w = opts.w || 18;
    const h = opts.h || 12;
    const tiles = fill(w, h, 3);
    setBorder(tiles, w, h, 5);
    if (opts.floorAccent) {
      for (const [tx, ty] of opts.floorAccent) tiles[ty * w + tx] = 11;
    }
    for (const d of opts.doors || []) punchDoor(tiles, w, d);
    return {
      id,
      name: opts.name || id,
      w, h, tiles,
      outdoor: false,
      spawn: opts.spawn,
      doors: opts.doors || [],
      npcs: opts.npcs || [],
      chests: opts.chests || [],
      enemies: opts.enemies || [],
      signs: opts.signs || [],
      switches: opts.switches || [],
      props: opts.props || [],
      goldPickups: opts.goldPickups || [],
      hearts: opts.hearts || [],
      boss: opts.boss || null,
    };
  }

  // T1 lobby: north locked (switchT2), west clear→T2, south→village
  const T1 = templeRoom("T1", {
    name: "神殿门厅",
    w: 18, h: 12,
    spawn: { x: 9 * T + 8, y: 10 * T + 8 },
    doors: [
      {
        id: "t1_north",
        x: 8, y: 0, w: 2, h: 1,
        target: "T3",
        spawnAt: { x: 9 * T + 8, y: 10 * T + 8 },
        needSwitchT2: true,
        lockedMsg: "门还锁着。",
        lockedVisual: true,
      },
      {
        id: "t1_west",
        x: 0, y: 5, w: 1, h: 2,
        target: "T2",
        spawnAt: { x: 15 * T + 8, y: 6 * T + 8 },
        needClear: true,
        lockedMsg: "还不能走。",
        lockedVisual: true,
      },
      {
        id: "t1_south",
        x: 8, y: 11, w: 2, h: 1,
        target: "village",
        spawnAt: { x: 11 * T + 8, y: 3 * T + 8 },
      },
    ],
    enemies: [{ type: "slime", x: 9 * T + 8, y: 5 * T + 8, slow: true }],
    signs: [
      { x: 5 * T + 8, y: 4 * T + 8, text: "钥开残阳。", story: "stele" },
    ],
  });

  // T2 switch/key room: switch → boss key + opens T1 north
  const T2 = templeRoom("T2", {
    name: "钥室",
    w: 18, h: 12,
    spawn: { x: 15 * T + 8, y: 6 * T + 8 },
    doors: [
      {
        id: "t2_east",
        x: 17, y: 5, w: 1, h: 2,
        target: "T1",
        spawnAt: { x: 2 * T + 8, y: 6 * T + 8 },
      },
    ],
    enemies: [{ type: "stone", x: 8 * T + 8, y: 7 * T + 8 }],
    switches: [
      {
        id: "t2_sw",
        x: 4 * T,
        y: 4 * T,
        flag: "switchT2",
        dropsBossKey: true,
        keyPos: { x: 10 * T + 8, y: 5 * T + 8 },
      },
    ],
    hearts: [{ id: "t2_heart", x: 12 * T + 8, y: 9 * T + 8 }],
    signs: [
      { x: 9 * T + 8, y: 2 * T + 8, text: "踩下开关，门厅北门将开。" },
    ],
  });

  // T3 Boss — need boss key from T1 north path
  const T3 = templeRoom("T3", {
    name: "残阳大厅",
    w: 20, h: 13,
    spawn: { x: 10 * T + 8, y: 11 * T + 8 },
    floorAccent: (function () {
      const a = [];
      for (let y = 4; y <= 8; y++)
        for (let x = 7; x <= 12; x++) a.push([x, y]);
      return a;
    })(),
    doors: [
      {
        id: "t3_south",
        x: 9, y: 12, w: 2, h: 1,
        target: "T1",
        spawnAt: { x: 9 * T + 8, y: 1 * T + 8 },
      },
    ],
    boss: { x: 10 * T + 8, y: 6 * T + 8, hp: 8 },
  });

  // Apply GDD lock: T1 north = switchT2; entering T3 also consumes boss key
  const t1North = T1.doors.find((d) => d.id === "t1_north");
  t1North.needBossKey = true;
  t1North.consumeBossKey = true;
  t1North.lockedMsg = "需要钥匙。";

  punchDoor(T1.tiles, T1.w, T1.doors.find((d) => d.id === "t1_north"));
  punchDoor(T1.tiles, T1.w, T1.doors.find((d) => d.id === "t1_west"));
  punchDoor(T1.tiles, T1.w, T1.doors.find((d) => d.id === "t1_south"));
  punchDoor(T2.tiles, T2.w, T2.doors[0]);
  punchDoor(T3.tiles, T3.w, T3.doors[0]);

  const village = buildVillage();
  appendBottomPad(village, 1, 4);
  appendBottomPad(T1, 3, 5);
  appendBottomPad(T2, 3, 5);
  appendBottomPad(T3, 3, 5);
  clearOrphanInteriorWalls(T1);
  clearOrphanInteriorWalls(T2);
  clearOrphanInteriorWalls(T3);

  const ROOMS = { village, T1, T2, T3 };

  const SOLID = { 0: 1, 4: 1, 5: 1, 8: 1 };

  function isSolid(tileId) {
    return !!SOLID[tileId];
  }

  global.TempleMaps = { ROOMS, T, isSolid };
})(typeof window !== "undefined" ? window : globalThis);
