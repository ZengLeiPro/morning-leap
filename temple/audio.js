/**
 * 《晨光神殿》 Web Audio — BGM + SFX, mute persists morning-temple-mute
 */
(function (global) {
  "use strict";

  const MUTE_KEY = "morning-temple-mute";
  const BASE = "assets/audio/";
  const BGM_VOL = 0.32;
  const SFX_VOL = 0.55;
  const FADE_MS = 420;

  const FILES = {
    village: "bgm_village.ogg",
    temple: "bgm_temple.ogg",
    boss: "bgm_boss.ogg",
    sword: "sfx_sword.ogg",
    hurt: "sfx_hurt.ogg",
    door: "sfx_door.ogg",
    pickup: "sfx_pickup.ogg",
    dialog: "sfx_dialog.ogg",
    boss_warn: "sfx_boss_warn.ogg",
  };

  let ctx = null;
  let masterGain = null;
  let bgmGain = null;
  let sfxGain = null;
  let buffers = Object.create(null);
  let loadPromise = null;
  let unlocked = false;
  let muted = false;
  let currentBgmId = null;
  let bgmSrc = null;
  let bgmFade = null; // { from, to, t, dur, targetId } for gain crossfade
  let pendingBgmId = null;
  let nextBgmSrc = null;
  let nextBgmGain = null;

  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch (_) {}

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    bgmGain = ctx.createGain();
    sfxGain = ctx.createGain();
    bgmGain.gain.value = BGM_VOL;
    sfxGain.gain.value = SFX_VOL;
    masterGain.gain.value = muted ? 0 : 1;
    bgmGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function applyMuteGain() {
    if (!masterGain || !ctx) return;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(muted ? 0 : 1, now);
  }

  function persistMute() {
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch (_) {}
  }

  async function decodeFile(key, file) {
    const res = await fetch(BASE + file);
    if (!res.ok) throw new Error("audio fetch " + file + " " + res.status);
    const ab = await res.arrayBuffer();
    const ac = ensureCtx();
    if (!ac) return;
    buffers[key] = await ac.decodeAudioData(ab.slice(0));
  }

  function loadAll() {
    if (loadPromise) return loadPromise;
    ensureCtx();
    const keys = Object.keys(FILES);
    loadPromise = Promise.all(
      keys.map((k) =>
        decodeFile(k, FILES[k]).catch((err) => {
          console.warn("[TempleAudio] skip", k, err);
        })
      )
    ).then(() => true);
    return loadPromise;
  }

  function unlock() {
    const ac = ensureCtx();
    if (!ac) return;
    if (ac.state === "suspended") {
      ac.resume().catch(() => {});
    }
    unlocked = true;
    if (pendingBgmId && !currentBgmId) {
      const id = pendingBgmId;
      pendingBgmId = null;
      playBgm(id, true);
    } else if (currentBgmId && (!bgmSrc || !bgmPlaying())) {
      playBgm(currentBgmId, true);
    }
  }

  function bgmPlaying() {
    return !!(bgmSrc && bgmSrc._alive);
  }

  function stopSource(src, gainNode) {
    if (!src) return;
    try {
      src.onended = null;
      src.stop(0);
    } catch (_) {}
    src._alive = false;
    if (gainNode) {
      try {
        gainNode.disconnect();
      } catch (_) {}
    }
  }

  function startLoop(buffer, destGain) {
    if (!ctx || !buffer) return null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(destGain);
    src._alive = true;
    src.onended = () => {
      src._alive = false;
    };
    try {
      src.start(0);
    } catch (_) {
      src._alive = false;
      return null;
    }
    return src;
  }

  function playBgm(id, hard) {
    if (!id || !buffers[id]) {
      pendingBgmId = id || pendingBgmId;
      return;
    }
    if (!unlocked && (!ctx || ctx.state === "suspended")) {
      pendingBgmId = id;
      currentBgmId = id;
      return;
    }
    if (currentBgmId === id && bgmPlaying() && !bgmFade) return;

    const ac = ensureCtx();
    if (!ac) return;

    if (hard || !bgmPlaying() || !currentBgmId) {
      stopSource(bgmSrc, null);
      if (nextBgmSrc) stopSource(nextBgmSrc, nextBgmGain);
      nextBgmSrc = null;
      nextBgmGain = null;
      bgmFade = null;
      bgmGain.gain.cancelScheduledValues(ac.currentTime);
      bgmGain.gain.setValueAtTime(BGM_VOL, ac.currentTime);
      bgmSrc = startLoop(buffers[id], bgmGain);
      currentBgmId = id;
      pendingBgmId = null;
      return;
    }

    // Light crossfade: fade out current, fade in next on separate gain
    if (nextBgmSrc) stopSource(nextBgmSrc, nextBgmGain);
    nextBgmGain = ac.createGain();
    nextBgmGain.gain.value = 0;
    nextBgmGain.connect(masterGain);
    nextBgmSrc = startLoop(buffers[id], nextBgmGain);
    bgmFade = { t: 0, dur: FADE_MS, targetId: id };
    pendingBgmId = null;
  }

  function update(dt) {
    if (!bgmFade || !ctx) return;
    bgmFade.t += dt;
    const u = Math.min(1, bgmFade.t / bgmFade.dur);
    const out = BGM_VOL * (1 - u);
    const inn = BGM_VOL * u;
    try {
      bgmGain.gain.setValueAtTime(out, ctx.currentTime);
      if (nextBgmGain) nextBgmGain.gain.setValueAtTime(inn, ctx.currentTime);
    } catch (_) {}
    if (u >= 1) {
      stopSource(bgmSrc, null);
      bgmSrc = nextBgmSrc;
      if (bgmSrc) {
        try {
          bgmSrc.disconnect();
        } catch (_) {}
        try {
          bgmSrc.connect(bgmGain);
        } catch (_) {}
      }
      if (nextBgmGain) {
        try {
          nextBgmGain.disconnect();
        } catch (_) {}
      }
      nextBgmSrc = null;
      nextBgmGain = null;
      bgmGain.gain.setValueAtTime(BGM_VOL, ctx.currentTime);
      currentBgmId = bgmFade.targetId;
      bgmFade = null;
    }
  }

  function playSfx(name) {
    if (muted) return;
    const buf = buffers[name];
    const ac = ensureCtx();
    if (!ac || !buf) return;
    if (ac.state === "suspended") {
      ac.resume().catch(() => {});
    }
    try {
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(sfxGain);
      src.start(0);
    } catch (_) {}
  }

  function bgmForRoom(roomId) {
    if (roomId === "village") return "village";
    if (roomId === "T3") return "boss";
    if (roomId === "T1" || roomId === "T2") return "temple";
    return "village";
  }

  function setMuted(v) {
    muted = !!v;
    persistMute();
    applyMuteGain();
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function stopBgm() {
    stopSource(bgmSrc, null);
    if (nextBgmSrc) stopSource(nextBgmSrc, nextBgmGain);
    bgmSrc = null;
    nextBgmSrc = null;
    nextBgmGain = null;
    bgmFade = null;
    currentBgmId = null;
  }

  global.TempleAudio = {
    MUTE_KEY,
    loadAll,
    unlock,
    update,
    playSfx,
    playBgm,
    bgmForRoom,
    playBgmForRoom(roomId, hard) {
      playBgm(bgmForRoom(roomId), !!hard);
    },
    setMuted,
    toggleMute,
    isMuted,
    stopBgm,
  };
})(typeof window !== "undefined" ? window : globalThis);
