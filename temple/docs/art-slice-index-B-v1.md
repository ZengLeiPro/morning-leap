# 方案 B · 切片索引表 v1（手感片）
> 产品裁示：Kenney Tiny Town + Tiny Dungeon + Puny Characters  
> 逻辑画布 **320×180** · 瓦片 **16×16** · `imageSmoothingEnabled = false` · nearest 整数倍  
> 素材根目录：`/workspace/chen-guang-feiyue/assets-b/game/`  
> 矢量规范降级为调试线框，**禁止再当成品**

---

## 0. 授权（Credits 页建议写上）

| 包 | 作者 | 授权 |
|----|------|------|
| Tiny Town / Tiny Dungeon | Kenney (kenney.nl) | **CC0** |
| Puny Characters | Shade | **CC0**（可商用，署名非必须） |

---

## 1. Atlas 寻址公式

### 1.1 Kenney packed（村 / 殿）

- 文件：
  - 村：`game/town/tilemap_packed.png`（192×176）
  - 殿：`game/dungeon/tilemap_packed.png`（192×176）
- 格：16×16，**无间距（packed）**，**12 列 × 11 行**，id `0…131`（192×176）
- 源矩形：
```js
const COLS = 12, TW = 16, GAP = 0, STRIDE = TW + GAP; // 16 — packed atlases only
function tileRect(id) {
  const c = id % COLS, r = (id / COLS) | 0;
  return { sx: c * STRIDE, sy: r * STRIDE, sw: TW, sh: TW };
}
```
> 若改用带 1px 缝的 `tilemap.png`，则用 `GAP = 1, STRIDE = 17`。成品手感片一律 `tilemap_packed.png` + `STRIDE = 16`。
也可直接用原包 `Tiles/tile_XXXX.png`（已解压在 `assets-b/kenney-*/Tiles/`）。

### 1.2 Puny 角色表

- 主角：`game/characters/Warrior-Blue.png`（768×256）
- 帧：**32×32**，**24 列 × 8 行**
```js
const FW = 32, FH = 32, FCOLS = 24;
function punyRect(row, col) {
  return { sx: col * FW, sy: row * FH, sw: FW, sh: FH };
}
// 绘制时缩到逻辑 16×16（或脚对齐用 16×16 裁中心）
```

**行 = 八方向（须用预览核对，暂定）：**  
`0=S, 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW`  
手感片可先只用 **0/2/4/6** 四向。

**列 = 动画段（按 OGA 说明 + 抽帧，手感片够用）：**

| 段 | 列 | 用途 |
|----|----|------|
| Idle | 0–2 | 站立循环 |
| Walk | 3–5 | 行走 |
| Sword | 6–8 | 挥剑（有效帧建议 col 7–8） |
| Bow | 9–11 | 手感片不用 |
| Stave | 12–14 | 不用 |
| Throw | 15–17 | 不用 |
| Hurt | 18–20 | 受伤；其中常见有白闪帧可用作 hit flash |
| Death | 21–23 | 倒地 |

> 若实机发现段边界差 1 列，以 `assets-b/puny-row*.png` 预览为准微调，勿改画布。

**史莱姆：** `game/characters/Slime.png`（480×32）→ 15 帧 ×32，左右巡逻用 0–3 循环即可。

---

## 2. 游戏逻辑 ID → Kenney 瓦片（手感片最小集）

### 2.1 村（Tiny Town atlas）

| 逻辑 ID | 含义 | Kenney id（约） | 备注 |
|---------|------|-----------------|------|
| V_GRASS | 草地 | 0 | 平铺 |
| V_GRASS_DECO | 草丛点缀 | 1 | 装饰 |
| V_FLOWER | 小花 | 2 | 装饰 |
| V_TREE | 树（挡） | 4 或 5 | 碰撞实心 |
| V_BUSH | 灌木（挡） | 6–8 | 碰撞 |
| V_PATH | 土路中填 | **25**（纯土）；边可用 24/26 | **禁**大面积平铺 12（角/边，填满会碎） |
| V_HOUSE_WALL | 屋墙 | **72 / 74** | 禁 60+（图标板感） |
| V_ROOF | 屋顶 | **48, 49, 50** | 左/中/右 |
| V_DOOR | 门 | **85** | 房子门；禁墙用 60+ |
| V_WELL | 井 | ~92 | 装饰挡 |
| V_SIGN | 路牌 | ~126 | |
| V_CHEST_C | 心箱关 | 130 | 村 +1 MaxHP |
| V_CHEST_O | 心箱开 | 131 | |
| V_COIN | 地上金 | 93 | 固定×5 |
| V_KEY_ICON | 钥（UI/掉落） | 116 | |
| V_WATER | 水塘 | — | 手感片**移除**；Tiny Town 无水瓦，禁止矢量填色 |
| V_GATE | 神殿门外观 | **Dungeon 9 锁 / 10 开**（或 Town 城堡门 111–114） | 村→殿入口；**禁止** Town 108/109（石墙） |

### 2.2 殿（Tiny Dungeon atlas）

| 逻辑 ID | 含义 | Kenney id（约） | 备注 |
|---------|------|-----------------|------|
| D_FLOOR | 神殿地 | 0 | |
| D_WALL_* | 墙/角 | 1–6, 11… | 按需要拼 |
| D_SWITCH_OFF | 地板开关未踩 | **7** | 灰钮 |
| D_SWITCH_ON | 已踩 | **8** | 青光 |
| D_DOOR_LOCK | 锁门（先见） | 9 或关着的木门 33–35 | 北门 |
| D_DOOR_OPEN | 开门 | 10 或 45–47 | 开关后 |
| D_CHEST_C/O | 宝箱 | 89 一带 / 开态 | Boss 钥箱 |
| D_HEART | 心拾取 / HUD | **115** 红药代理 | **禁 114**（绿药） |
| D_STAIRS | 阶 | 54–55 | 可选 |
| D_NPC_ELDER | 静态 NPC 备 | **84**（或 111） | 紫帽长老；**禁止** Warrior-Blue |
| D_NPC_MERCH | 商人备 | **86** | |
| D_NPC_VILLAGER | 村民备 | **85** | |
| D_SLIME | 静帧敌 | 92 | 动效用 Puny Slime |
| D_BOSS | Boss 静帧备 | **109（独眼巨人）×2** | 122/124 为蛛/鼠；P2 红闪 OK |

> 「约」= 以 `assets-b/town-numbered.png` / `dungeon-numbered.png` 黄字为准做最终钉死；上表已按抽样行核对开关 **7/8**。

---

## 3. 实体绘制约定（替换旧矢量 API）

| 旧 API | 新做法 |
|--------|--------|
| `drawHero` 矢量豆 | `drawImage(Warrior-Blue, punyRect(dirRow, col), dx,dy,16,16)` |
| `drawTile` 色块 | `drawImage(town\|dungeon packed, tileRect(id), …)` |
| `drawSwitch` | `D_SWITCH_OFF/ON`（id 7/8） |
| `drawHeartPickup` / HUD 心 | 殿图 **115** 红药；逻辑仍 8×8 拾取盒 |
| `drawSlime` | Puny `Slime.png` 帧循环 |
| `drawBoss` | Dungeon **109 独眼巨人** + 缩放 2× + P2 红闪 |
| `drawDialog/HUD` | 可用 Kenney UI 色块或纯 Canvas 字；心槽用红心 tile |

---

## 4. 客户端接入清单（最小）

1. 拷贝 `assets-b/game/` → 仓库 `temple/assets/`
2. 预加载 3 张主图：`town/tilemap_packed.png`、`dungeon/tilemap_packed.png`、`characters/Warrior-Blue.png`（+ Slime）
3. 相机/UI 坐标按 320×180 重算
4. 全局 `ctx.imageSmoothingEnabled = false`
5. Credits：`Art: Kenney.nl, Shade (Puny Characters)`

---

## 5. 明确不做

- 混用方案 A 森林包
- 矢量角色/瓦片当成品
- 非 nearest 缩放
- 未写入本表的随机 itch 包

文件：`/workspace/chen-guang-feiyue/docs/art-slice-index-B-v1.md`

---

## 6. 手感片勘误（art 钉死）

| 项 | 正确 | 禁止 |
|----|------|------|
| packed 步距 | `GAP=0` `STRIDE=16` | `GAP=1` / `STRIDE=17`（会撕瓦） |
| 村路中填 | Town **25** | 大面积 **12** |
| 房子 | 顶 48/49/50 · 墙 72/74 · 门 **85** | 墙用 **60+** |
| HUD/地上心 | 殿 **115** | 殿 **114** 绿药 |
| 标题有存档 | Continue 与 help/credits **纵向堆叠留空** | Continue 盖住操作说明 |
| 神殿墙 | 实心 **14**（可选 28/40） | 随机 variants **1–6**（角碎屑） |
| 神殿门 | 拱门 **9/10** 或门口 **22/33** | — |
| Puny 绘制 | 内容 bbox ~(9,8,14,15) 再画到逻辑尺寸 | 整帧 32×32 压到 16×16 |
| 失焦粘键 | `blur` / `visibilitychange(hidden)` 清 key+touch | — |


---

## 紧急勘误 v1.3（2026-09-16）— NPC 同模 / 脚锚点

### P0：长老 ≠ 玩家（禁止同模）

| 角色 | 必须用 | 禁止 |
|------|--------|------|
| **玩家** | `Warrior-Blue` + `blitPuny` bbox `(9,8,14,15)` 脚对齐 | NPC 表、Dungeon 84 |
| **长老** | Dungeon atlas **id=84** 紫帽静帧 + flash halo | `Warrior-Blue`、`Soldier-*`、`npc-elder-candidate` |
| **商人** | `npc-mage.png` bbox；备选 Dungeon **86** | 与长老同一张图 |

### 落点偏上

实体坐标 = 脚点。`appendBottomPad` 只在南墙**以南**加视觉边距（`padRows`/`contentH`）；相机默认按 `contentH` clamp，避免整幅上移 2–3 格。`footBox` 跨在脚点上，勿再 `py+2` 偏到脚下方。
