# 《晨光神殿》音频素材清单 v1（CC0）
> 产品：补基础声场 + 可静音；不扩地图
> 已落地目录：`temple/assets/audio/`（源：chen-guang-feiyue/assets-audio/game）

## 授权

| 包 | 作者 | 授权 | 链接 |
|----|------|------|------|
| 50 RPG sound effects | Kenney | **CC0**（署名非必须） | https://opengameart.org/content/50-rpg-sound-effects |
| 15 Melodic RPG Chiptunes | Aureolus_Omicron | **CC0** | https://opengameart.org/content/15-melodic-rpg-chiptunes |

Credits 建议：`Audio: Kenney.nl · Aureolus_Omicron`

---

## 推荐接线表（直接用）

| 用途 | 文件（已拷到 game/） | 源文件 |
|------|----------------------|--------|
| 村 BGM | `bgm_village.ogg` | rpgchip03_town.ogg |
| 神殿 BGM | `bgm_temple.ogg` | rpgchip06_dungeon.ogg |
| Boss 房 BGM（可选） | `bgm_boss.ogg` | rpgchip12_the_evil_one.ogg |
| 挥剑 | `sfx_sword.ogg` | knifeSlice.ogg |
| 受伤 | `sfx_hurt.ogg` | chop.ogg |
| 开门 | `sfx_door.ogg` | doorOpen_1.ogg |
| 捡物/金币 | `sfx_pickup.ogg` | handleCoins.ogg |
| 对话哔 | `sfx_dialog.ogg` | bookFlip2.ogg |
| Boss 预警 | `sfx_boss_warn.ogg` | metalLatch.ogg |

备选挥剑：`knifeSlice2.ogg` / `drawKnife1.ogg`  
备选开门：`doorOpen_2.ogg`  
备选对话：`metalClick.ogg`（更短哔）

---

## 客户端约定

1. Web Audio / `Audio` 均可；BGM loop；SFX 短触发不排队卡死
2. 默认开声；UI 提供静音开关（localStorage 记住）
3. 切房：村↔神殿 crossfade 或硬切 BGM；Boss 房切 `bgm_boss`
4. 体积：chiptune ogg 偏大，可只进 `town`+`dungeon` 两首，Boss 复用神殿轨也行
5. 落地路径：`temple/assets/audio/`

## 明确不做（本刀）

完整 OST、语音、立体声定位、自适应音乐
