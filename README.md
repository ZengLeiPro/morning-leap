# 晨光飞跃（Morning Leap）

一款可在浏览器里直接打开的「咖啡豆穿楼缝」小游戏，玩法类似 Flappy Bird。纯 Canvas 几何绘制，无外部图片与构建步骤。

## 怎么玩

1. 用浏览器打开本仓库的 `index.html`（双击即可，或本地静态服务）。
2. 标题画面点击 **「冲！」**，或按 **空格 / 鼠标 / 触摸** 起飞。
3. 持续点击或按空格让咖啡豆上扬，穿过玻璃写字楼之间的缝隙。
4. 撞到楼、地面或天花板即结束；通过一对障碍 +1 分。
5. 结算后点 **「再来一局」** 重开。最高分保存在浏览器 `localStorage`（键名 `morning-leap-best`）。

前约 10 秒更宽松（缝更宽、滚动更慢），之后逐渐变难。

## 本地打开

```bash
# 方式一：直接打开文件
open index.html   # macOS
# 或在资源管理器中双击 index.html

# 方式二：简易静态服务（可选）
npx --yes serve .
# 或：python3 -m http.server 8080
```

然后访问提示的本地地址即可。

## 文件说明

| 文件 | 说明 |
|------|------|
| `index.html` | 页面入口（400×600 画布） |
| `style.css` | 居中适配与防滚动 |
| `game.js` | 完整游戏逻辑与绘制 |
| `README.md` | 本说明 |

## 操作

- **空格**：拍翅起飞（已阻止页面滚动）
- **鼠标点击 / 触摸**：拍翅起飞

## 技术要点

- 无框架、无打包；系统默认无衬线中文字体
- 配色与造型对齐美术规范 v1.1（晨光橙 + 咖啡棕 + 玻璃蓝灰）

祝你晨光里飞得更远 ☕


## 《晨光神殿》（Zelda-like）

俯视 RPG 小品，路径：[`temple/`](./temple/)。Canvas **640×360**，对齐 `temple/docs/GDD-zeldalike-v1.1.md`。

- 打开 `temple/index.html`，或：`python3 -m http.server 8080` 后访问 `/temple/`
- GitHub Pages：https://zengleipro.github.io/morning-leap/temple/
- 操作：WASD/方向移动，J/Z/空格挥剑，E 对话；触屏有虚拟摇杆与剑键
- 存档：`localStorage` 键名 `morning-temple-save`
