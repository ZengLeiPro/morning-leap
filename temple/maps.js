/**
 * 《晨光神殿》地图 — GDD v1.1
 * 瓦片: 0空 1草 2路 3神殿地 4村墙 5神殿墙 6门开 7门锁 8水 9花 10刺 11Boss圈
 * 门锁链路: T2北先锁 → 西进T3踩开关 → 开T2北进T4 → Boss钥进T5
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

  function punchDoor(tiles, w, d) {
    for (let i = 0; i < (d.w || 1); i++) {
      for (let j = 0; j < (d.h || 1); j++) {
        tiles[(d.y + j) * w + (d.x + i)] = d.lockedVisual ? 7 : 6;
      }
    }
  }

  function buildVillage() {
    const w = 40, h = 28;
    const tiles = fill(w, h, 1);
    setBorder(tiles, w, h, 4);
    setRect(tiles, w, 12, 10, 27, 18, 2);
    setRect(tiles, w, 18, 4, 21, 10, 2);
    setRect(tiles, w, 18, 18, 21, 26, 2);
    setRect(tiles, w, 2, 13, 12, 15, 2);
    setRect(tiles, w, 27, 13, 37, 15, 2);
    tiles[8 * w + 8] = 9;
    tiles[9 * w + 30] = 9;
    tiles[20 * w + 6] = 9;
    tiles[6 * w + 25] = 9;
    tiles[4 * w + 19] = 7;
    tiles[4 * w + 20] = 7;
    setRect(tiles, w, 4, 6, 7, 9, 8);
    return {
      id: "village",
      name: "晨光村",
      w, h, tiles,
      outdoor: true,
      spawn: { x: 20 * T + 8, y: 16 * T + 8 },
      doors: [
        {
          id: "to_temple",
          x: 19, y: 4, w: 2, h: 1,
          needKey: true,
          consumeKey: true,
          target: "T1",
          spawnAt: { x: 10 * T + 8, y: 11 * T + 8 },
          lockedMsg: "需要钥匙。",
          lockedVisual: true,
        },
      ],
      npcs: [
        { id: "elder", kind: "elder", x: 16 * T + 8, y: 12 * T + 8, flash: true },
        { id: "merchant", kind: "merchant", x: 32 * T + 8, y: 14 * T + 8, flash: false },
        { id: "villager", kind: "villager", x: 10 * T + 8, y: 17 * T + 8, flash: false },
      ],
      chests: [
        { id: "v_maxhp", x: 8 * T + 8, y: 20 * T + 8, reward: "maxhp" },
      ],
      // Economy B: fixed ground gold ×5 (not drop-dependent)
      goldPickups: [
        { id: "vg1", x: 22 * T + 8, y: 20 * T + 8 },
        { id: "vg2", x: 24 * T + 8, y: 21 * T + 8 },
        { id: "vg3", x: 26 * T + 8, y: 20 * T + 8 },
        { id: "vg4", x: 23 * T + 8, y: 22 * T + 8 },
        { id: "vg5", x: 25 * T + 8, y: 22 * T + 8 },
      ],
      enemies: [
        { type: "slime", x: 24 * T + 8, y: 10 * T + 8 },
        { type: "slime", x: 28 * T + 8, y: 18 * T + 8 },
        { type: "slime", x: 14 * T + 8, y: 20 * T + 8 },
      ],
      signs: [
        { x: 22 * T + 8, y: 12 * T + 8, text: "北：晨光神殿　东：钥匙商人" },
      ],
      props: [
        { type: "house", x: 4 * T, y: 11 * T, w: 48, h: 40 },
        { type: "house", x: 30 * T, y: 10 * T, w: 56, h: 44 },
      ],
      switches: [],
      hearts: [],
    };
  }

  function templeRoom(id, opts) {
    const w = opts.w || 24;
    const h = opts.h || 16;
    const tiles = fill(w, h, 3);
    setBorder(tiles, w, h, 5);
    if (opts.floorAccent) {
      for (const [tx, ty] of opts.floorAccent) tiles[ty * w + tx] = 11;
    }
    if (opts.spikes) {
      for (const [tx, ty] of opts.spikes) tiles[ty * w + tx] = 10;
    }
    if (opts.water) {
      for (const [tx, ty] of opts.water) tiles[ty * w + tx] = 8;
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

  const T1 = templeRoom("T1", {
    name: "神殿门厅",
    w: 20, h: 14,
    spawn: { x: 10 * T + 8, y: 11 * T + 8 },
    doors: [
      {
        id: "t1_north",
        x: 9, y: 0, w: 2, h: 1,
        target: "T2",
        spawnAt: { x: 11 * T + 8, y: 11 * T + 8 },
      },
      {
        id: "t1_south",
        x: 9, y: 13, w: 2, h: 1,
        target: "village",
        spawnAt: { x: 20 * T + 8, y: 5 * T + 8 },
      },
    ],
    enemies: [{ type: "slime", x: 10 * T + 8, y: 6 * T + 8 }],
    signs: [
      { x: 6 * T + 8, y: 5 * T + 8, text: "唯持钥者，得见残阳。", story: "stele" },
    ],
  });

  // T2: north locked until switchT3; west open → T3 (先见锁门)
  const T2 = templeRoom("T2", {
    name: "岔路厅",
    w: 24, h: 14,
    spawn: { x: 11 * T + 8, y: 11 * T + 8 },
    water: [[4, 4], [5, 4], [4, 5], [18, 8], [19, 8], [18, 9]],
    doors: [
      {
        id: "t2_south",
        x: 10, y: 13, w: 2, h: 1,
        target: "T1",
        spawnAt: { x: 10 * T + 8, y: 1 * T + 8 },
      },
      {
        id: "t2_north",
        x: 10, y: 0, w: 2, h: 1,
        target: "T4",
        spawnAt: { x: 10 * T + 8, y: 11 * T + 8 },
        needSwitchT3: true,
        lockedMsg: "门还锁着。",
        lockedVisual: true,
      },
      {
        id: "t2_west",
        x: 0, y: 6, w: 1, h: 2,
        target: "T3",
        spawnAt: { x: 17 * T + 8, y: 7 * T + 8 },
        needClear: true,
        lockedMsg: "还不能走。",
        lockedVisual: true,
      },
    ],
    enemies: [
      { type: "slime", x: 6 * T + 8, y: 6 * T + 8 },
      { type: "slime", x: 16 * T + 8, y: 7 * T + 8 },
      { type: "stone", x: 12 * T + 8, y: 5 * T + 8 },
    ],
    chests: [
      { id: "t2_gold", x: 4 * T + 8, y: 8 * T + 8, reward: "gold5" },
    ],
  });

  const T3 = templeRoom("T3", {
    name: "钥室",
    w: 20, h: 14,
    spawn: { x: 17 * T + 8, y: 7 * T + 8 },
    doors: [
      {
        id: "t3_east",
        x: 19, y: 6, w: 1, h: 2,
        target: "T2",
        spawnAt: { x: 2 * T + 8, y: 7 * T + 8 },
      },
    ],
    enemies: [{ type: "stone", x: 8 * T + 8, y: 8 * T + 8 }],
    switches: [
      {
        id: "t3_sw",
        x: 5 * T,
        y: 5 * T,
        flag: "switchT3",
        dropsBossKey: true,
        keyPos: { x: 12 * T + 8, y: 6 * T + 8 },
      },
    ],
    hearts: [{ id: "t3_heart", x: 14 * T + 8, y: 10 * T + 8 }],
    signs: [
      { x: 10 * T + 8, y: 3 * T + 8, text: "踩下开关，岔路北门将开。" },
    ],
  });

  const T4 = templeRoom("T4", {
    name: "刺道",
    w: 20, h: 14,
    spawn: { x: 10 * T + 8, y: 11 * T + 8 },
    spikes: [
      [6, 4], [7, 4], [8, 4], [9, 4],
      [6, 5], [9, 5],
      [6, 6], [7, 6], [8, 6], [9, 6],
      [11, 7], [12, 7], [13, 7],
      [11, 8], [13, 8],
      [11, 9], [12, 9], [13, 9],
    ],
    doors: [
      {
        id: "t4_south",
        x: 9, y: 13, w: 2, h: 1,
        target: "T2",
        spawnAt: { x: 11 * T + 8, y: 1 * T + 8 },
      },
      {
        id: "t4_north",
        x: 9, y: 0, w: 2, h: 1,
        target: "T5",
        spawnAt: { x: 12 * T + 8, y: 13 * T + 8 },
        needBossKey: true,
        consumeBossKey: true,
        lockedMsg: "需要钥匙。",
        lockedVisual: true,
      },
    ],
    enemies: [
      { type: "slime", x: 14 * T + 8, y: 5 * T + 8 },
      { type: "slime", x: 5 * T + 8, y: 9 * T + 8 },
    ],
    hearts: [{ id: "t4_heart", x: 16 * T + 8, y: 7 * T + 8 }],
  });

  const T5 = templeRoom("T5", {
    name: "残阳大厅",
    w: 24, h: 16,
    spawn: { x: 12 * T + 8, y: 13 * T + 8 },
    floorAccent: (function () {
      const a = [];
      for (let y = 5; y <= 10; y++)
        for (let x = 9; x <= 14; x++) a.push([x, y]);
      return a;
    })(),
    doors: [
      {
        id: "t5_south",
        x: 11, y: 15, w: 2, h: 1,
        target: "T4",
        spawnAt: { x: 10 * T + 8, y: 1 * T + 8 },
      },
    ],
    boss: { x: 12 * T + 8, y: 7 * T + 8, hp: 8 },
  });

  // Fix door holes for west/east after water/spikes
  punchDoor(T2.tiles, T2.w, T2.doors.find((d) => d.id === "t2_west"));
  punchDoor(T2.tiles, T2.w, T2.doors.find((d) => d.id === "t2_north"));
  punchDoor(T2.tiles, T2.w, T2.doors.find((d) => d.id === "t2_south"));
  punchDoor(T3.tiles, T3.w, T3.doors[0]);
  punchDoor(T4.tiles, T4.w, T4.doors.find((d) => d.id === "t4_north"));
  punchDoor(T4.tiles, T4.w, T4.doors.find((d) => d.id === "t4_south"));

  const ROOMS = { village: buildVillage(), T1, T2, T3, T4, T5 };

  const SOLID = { 0: 1, 4: 1, 5: 1, 8: 1 };

  function isSolid(tileId) {
    return !!SOLID[tileId];
  }

  global.TempleMaps = { ROOMS, T, isSolid };
})(typeof window !== "undefined" ? window : globalThis);
