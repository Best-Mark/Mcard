# MCard 电子名片系统

一个从零构建的全栈电子名片项目：**二维码永久不变、资料随时可改（含公司简介）、一键存进通讯录、地址直接导航、实体名片版式直接下载、按时段套餐开通**，提供 **H5 + 微信/支付宝/抖音三端小程序** 两套前端。

## 功能一览

### 两端覆盖
| 功能 | H5 | 微信小程序 | 支付宝小程序 | 抖音小程序 |
|---|---|---|---|---|
| 公开名片 / 稳定二维码 | ✅ | ✅ | ✅ | ✅ |
| 注册登录 / 资料编辑（含公司简介） | ✅ | ✅ | ✅ | ✅ |
| 二维码存相册 / 电话邮箱微信复制 | ✅ | ✅ | ✅ | ✅ |
| 地址导航 | 五家地图直达 | 复制地址到地图 | 同左 | 同左 |
| 套餐购买 / 模拟支付 / 状态刷新 | ✅ | ✅ | ✅ | ✅ |
| 实体名片版式 | SVG + 300dpi PNG 直接下载 | 二维码海报存相册 + 复制印刷页地址 | 同左 | 同左 |
| 一键存通讯录 vCard | ✅（.vcf 文件） | 复制名片信息 / 链接到 H5 导入 | 同左 | 同左 |

### 用户端
- 注册 / 登录，创建属于自己的名片（可自定义短码）
- 资料编辑：姓名、英文名、职位、公司、**公司简介**、部门、个人简介、标签、头像、**LOGO**、电话/手机/邮箱/微信/WhatsApp、地址；公司简介独立展示在公开名片，并写入 vCard 备注与实体名片背面
- **LOGO 在线处理**：直接上传 JPG/PNG/WebP/GIF/SVG，服务端自动识别背景色并转成透明底 PNG；提供「智能识别背景 / 只去白底 / 保留原图」三种模式与去底强度滑杆，原图保留可反复调参，无需用户懂图片格式；处理后的 LOGO 显示在名片、印刷版正反面及二维码中心
- **微信 / 支付宝**：可填账号，并分别上传「加好友码」与「收款码」；H5 在当前 App 内提示长按识别、否则提示保存后扫码；小程序按微信/支付宝/抖音环境分别提示「长按识别」或「保存相册后扫一扫」
- **主页与店铺**：公司主页 URL（沿用 `website` 字段，避免重复定义）与店铺 URL 均可一键打开或复制，同时写入 vCard 的 `URL;TYPE=WORK` 与 `X-SHOP-URL`
- **改资料不改二维码**：`/c/{slug}` 与二维码图案由 `slug` 唯一决定，更新接口白名单里没有 `slug`，已印刷的名片永不作废
- 自定义链接矩阵（作品集、公众号、店铺……）
- **五套展示模板 × 五套配色主题自由搭配**：模板决定排版结构（经典商务 / 极简素雅 / 尊享黑金 / 活力格调 / 印章方格），主题决定配色（深海蓝 / 墨黑金 / 暖阳橘 / 青竹绿 / 典雅紫），编辑时实时预览；模板清单由服务端 `GET /api/cards/public/templates` 统一下发，两端不各自硬编码。印章方格为深蓝几何方块质感，真实二维码始终另行显示、可正常扫码
- 二维码前景/背景/中心 Logo 可配
- 一键存通讯录：标准 vCard 3.0（`.vcf`），iPhone / 安卓 / Outlook 通用；微信内引导跳转浏览器
- 一键保存二维码：SVG / PNG 双格式，大图模式支持长按保存
- 地址导航：高德 / 百度 / 腾讯 / Apple / Google 五家地图一键唤起
- 分享：Web Share API 优先，自动降级复制邀请链接
- **名片集市**：主动上架后按距离发现附近、行业对口的商务伙伴；支持浏览器/小程序精确定位，或选内置城市作中心；按行业（12 类）+ 关键词（姓名/公司/业务）筛选，距离由近到远排序。只展示姓名、职位、公司、行业、城市、简介与标签，联系方式不公开，随时可关闭下架
- 交换名片：扫码后登记互换记录，双方均可在后台看到
- 数据统计：累计浏览、近 14 天趋势、交换数量
- 实体名片版式下载：3 套模板、正反面、90×54mm 成品 + 3mm 出血 + 4.5mm 安全线，SVG 矢量稿 / 300dpi PNG
- PWA：可「添加到主屏幕」，具备离线壳

### 管理端
- 数据概览（用户 / 名片 / 开通数 / 收入 / 浏览趋势）
- **时段套餐**：自由设定价格、天数、权益、排序、上下架；有效期按「当前到期时间与现在取较晚者 + 新天数」叠加，续期不吃亏
- 名片管理（搜索 / 状态管控 / 直达公开页）
- 订单管理（筛选 / 异常补单标记已支付）
- 用户管理（禁用 / 启用）
- 站点配置（名称、简介、联系方式、公告、二维码品牌字）

## 技术栈

| 层 | 技术 |
|---|---|
| H5 前端 | Vue 3 + Vite + vue-router + 原生 CSS（响应式，手机/桌面通吃） |
| 小程序 | uni-app（Vue 3）一套代码编译 mp-weixin / mp-alipay / mp-toutiao 三端 |
| 后端 | Node.js + Express |
| 存储 | SQLite（`better-sqlite3`，单文件、零外部依赖），数据位于 `server/data/` |
| 二维码 | `qrcode`，容错级别 H，支持上传的透明 LOGO 嵌在中心 |
| 图像处理 | `sharp`：LOGO 边缘洪水填充去底 + 羽化 + 自动裁切，输出透明 PNG |
| 支付 | 微信支付 V3 Native；`PAY_MODE=mock` 时一键模拟支付 |
| 部署 | 静态产物 + Node 服务同源，支持 PWA / SEO 元信息注入 |

## 快速开始

```bash
npm run setup          # 安装根、server、client、miniapp 四处依赖
npm run dev            # 同时启动 API(:3000) 与 H5(:5173)
```

打开 http://localhost:5173 。

- 用户：注册手机号即可创建名片
- 后台：http://localhost:5173/admin ，默认 `admin` / `admin123456`（部署后务必修改环境变量）
- 公开名片示例：`http://localhost:5173/c/{你的短码}`

> 开发模式下二维码内容指向 `BASE_URL`（默认 `http://localhost:5173`），手机扫码需要改成可访问的域名，见下文。

### 小程序开发 / 构建

先把 `miniapp/src/utils/request.js` 顶部的 `API_BASE` 改成后端可访问地址（真机预览需填局域网 IP 或线上域名），再按需编译：

```bash
npm --prefix miniapp run dev:mp-weixin     # 微信开发者工具导入 miniapp/dist/build/mp-weixin
npm --prefix miniapp run dev:mp-alipay     # 支付宝开发者工具导入 dist/build/mp-alipay
npm --prefix miniapp run dev:mp-toutiao    # 抖音开发者工具导入 dist/build/mp-toutiao
npm run build:miniapp                      # 三端一次性出包
```

`miniapp/src/manifest.json` 里分别填三端 `appid`。公共方法全部集中在 `miniapp/src/utils/request.js`，新增工具请继续追加到该文件，不要新建纯 require 的 js 文件（部分开发者工具热重载会白屏）。微信端保存相册单独做了 `scope.writePhotosAlbum` 授权/设置引导，支付宝与抖音端走通用保存接口。

## 生产部署

在 `server/.env` 配置（可复制 `.env.example`）：

```dotenv
PORT=3000
BASE_URL=https://card.example.com
JWT_SECRET=换成一个随机长字符串
ADMIN_INIT_USERNAME=admin
ADMIN_INIT_PASSWORD=换成强密码
PAY_MODE=wechat
WECHAT_MCH_ID=商户号
WECHAT_APP_ID=公众号/小程序 AppID
WECHAT_API_V3_KEY=APIv3密钥
WECHAT_CERT_SERIAL_NO=商户证书序列号
WECHAT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WECHAT_NOTIFY_URL=https://card.example.com/api/pay/notify/wechat
```

构建与启动：

```bash
npm run build                 # 产物输出到 client/dist，由 Express 同源托管
cd server && npm start        # 或 pm2 start src/app.js --name mcard
```

nginx 只需反代 `/` 到 Node 服务（`/uploads`、`/api`、静态资源都由 Express 处理）。启用 HTTPS 后 Service Worker 才会注册。

### 实操示例：单域名 + nginx 反代（以 card.microeco.net 为例）

1) DNS：把 `card.microeco.net` 的 A 记录指向服务器 IP，放行 80/443。

2) 服务器装依赖并拉代码（部署目录必须是 Git 仓库并配好 `origin`，后台自动更新依赖它）：

```bash
mkdir -p /www/wwwroot/card.microeco.net && cd /www/wwwroot/card.microeco.net
git clone <你的仓库地址> .
npm run setup                 # 装根/server/client/miniapp 四处依赖
npm run build                 # 产出 client/dist（Express 同源托管）
cp server/.env.example server/.env
```

3) 编辑 `server/.env`（HTTPS 是推荐值；若暂只有 HTTP，把 BASE_URL 与 WECHAT_NOTIFY_URL 改成 http 即可，但见下方限制）：

```dotenv
PORT=3000
HOST=0.0.0.0
BASE_URL=https://card.microeco.net
JWT_SECRET=换成随机长字符串
ADMIN_INIT_USERNAME=admin
ADMIN_INIT_PASSWORD=换成强密码
PAY_MODE=mock                 # 接入微信支付时改 wechat 并填下列商户参数
```

4) 启动（二选一）：

```bash
cd server && npm start                         # 前台
pm2 start src/app.js --name mcard && pm2 save  # 推荐：后台常驻 + 开机自启
```

5) nginx 反代（域名根路径全部转给 Node 3000）：

```nginx
server {
    listen 80;
    server_name card.microeco.net;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

配好证书后把 `listen 443 ssl` 加上证书路径，并加一个 80→443 跳转。

6) 验证：`curl http://127.0.0.1:3000/api/health` 应返回 `code:0`；浏览器打开域名能看到首页即成功。

> **HTTP 的限制（重要）**：① 小程序真机 request 合法域名**强制 HTTPS**，纯 HTTP 域名小程序连不上（H5 不受影响）；② 浏览器 `navigator.geolocation`（地图选点/附近发现）在非 HTTPS 下多数浏览器拒绝授权；③ 微信 JS-SDK、PWA Service Worker 也要求 HTTPS。因此**生产建议务必启用 HTTPS**。`BASE_URL` 决定二维码内容，改域名后旧二维码仍指向旧域名——首次上线定域名要谨慎。

### 开通与资金说明
- 支付直接进你的微信商户号，本系统不设余额账户、不做资金池、不参与资金清分，无二清风险。
- 回调验签：AES-256-GCM 解密 + 商户订单号与金额双校验；配置 `WECHAT_PLATFORM_CERT`（平台证书 PEM）后还会校验微信应答签名。
- 未收到回调时可点「我已支付，刷新状态」主动查单兜底；后台也可手动标记补单。

## 版本检查与更新（管理后台）

后台「版本更新」页支持**手动检查 / 手动更新**与**定时检查 / 自动更新**两种模式：

- 版本源：优先读 GitHub Release（`https://api.github.com/repos/Best-Mark/Mcard/releases/latest`），无 Release 时用 `git show origin/<分支>:package.json` 读取远端版本号（与更新共用 git 通道，HTTPS 受限也可用）。版本号唯一真相源 = 根目录 `package.json` 的 `version`，不在多处重复定义；远端全部不可达时回退上次成功结果并标记「缓存」，首次检查则给出明确错误，不影响主站运行
- 手动：点「检查更新」查看最新版本号与更新说明；有新版时点「立即更新」，二次确认后执行
- 自动：可配置检查间隔（1–720 小时）、是否定时检查、是否发现新版自动更新。默认只自动检查、不自动更新
- 更新流程：`git fetch` → `git pull --ff-only` → 按变更文件按需 `npm install` / 重建 H5 / 重建三端小程序 → 若 `server/` 有变更，在 pm2 下自动重启，否则提示手动重启
- 权限：查看与检查需管理员；执行更新与修改更新设置仅超级管理员
- 状态与最近一次更新记录写入 `site_config`，页面可直接查看

> 自动更新会执行 git 拉取与进程重启，建议先保持「自动检查」开启、确认稳定后再启用自动更新。部署目录必须是 Git 仓库且配置了 `origin` 远端。

## 关键设计

### 名片集市的隐私与距离口径
上架是**主动 opt-in**（`cards.market_opt_in`，默认关闭），且只收录 `status='active'`、未过期的名片。集市列表接口 `GET /api/cards/public/market` 只返回 `marketView` 白名单字段（姓名/职位/公司/行业/城市/简介/标签/头像/LOGO/距离/浏览量），**绝不外泄**电话、邮箱、微信、收款码与精确经纬度。距离用 Haversine 在服务端计算，只回 one-decimal 的公里数，无坐标的名片排末尾。定位原点优先级：客户端精确经纬度 > 城市名匹配内置坐标表 > 无原点按热度排序。行业清单与城市坐标表的唯一真相源是 `server/src/utils/market.js`，通过 `GET /api/cards/public/market/meta` 下发，两端不硬编码。坐标录入有三种方式：① 选内置城市自动填中心坐标；② 一键精确定位（H5 `navigator.geolocation` / 小程序 `uni.getLocation`）；③ **地图拖拽选点**——H5 用 Leaflet + OpenStreetMap 瓦片（无需申请 Key，组件按需懒加载、不进首屏包），小程序用原生 `map` 组件拖动 + `getCenterLocation` 取中心（微信/支付宝可用，抖音等平台降级到城市选择）。定位失败（拒绝授权/平台不支持）一律降级到城市选择，不阻断浏览。

### 展示模板与配色主题是两个独立维度
`cards.template`（布局形态：classic / minimal / elite / vivid）与 `cards.theme`（配色：ocean / ink / ...）正交，一张名片 = 一个 template + 一个 theme，可任意组合。模板 key 的唯一真相源是 `server/src/utils/cardTemplates.js`，既做 PUT 写入白名单校验，也通过 `GET /api/cards/public/templates` 下发给两端编辑器渲染选择器，前端不各自硬编码 key。模板只改布局/形状（封面、头像、对齐、圆角），配色始终走主题 CSS 变量 `--t-*`，因此新增模板无需动配色，新增配色也无需动模板。非法/存量空 template 一律回落 `classic`，保证老名片布局不变。

### 为什么二维码永不变
二维码内容只有 `${BASE_URL}/c/${slug}`。`slug` 在创建时生成一次，更新资料的 `PUT /api/cards/mine` 字段白名单**不包含 slug / status / expires_at / views**。因此换头像、换公司、换地址都不会改变二维码图案，实体名片可放心批量印刷。

### 一键保存的跨端策略
| 目标 | 实现 |
|---|---|
| 存进通讯录 | 服务端生成 vCard 3.0（CRLF + BOM 兼容旧机型），下载后导入 |
| 存二维码 | PNG / SVG 双通道；普通浏览器直接下载，微信内提示长按大图或跳浏览器 |
| 添加到桌面 | PWA manifest + Service Worker |
| 分享 | `navigator.share` → 剪贴板 → 手动复制三级降级 |

### 印刷版式
SVG viewBox 以毫米为单位（96×60，含 3mm 出血），二维码用模块路径直接绘制（非位图嵌入），因此矢量放大不糊。PNG 导出按 300dpi 栅格化（约 1134×709px）。辅助线仅预览显示，不进入下载文件。

### LOGO 去底原理
上传后统一缩放到最长边 800px，从四角采样背景色，以边框像素为种子做洪水填充：颜色距离在阈值内的像素置全透明，阈值外 26 级区间做羽化半透明，最后裁掉透明边并输出 PNG。SVG 原稿处理完即删除、不对外提供，避免脚本文件直链风险。二维码纠错等级为 H，中心 LOGO 控制在整体 18% 以内，扫码不受影响。

## 目录结构

```
Mcard/
├── client/                 # Vue 3 单页应用（前台 + 用户中心 + 后台）
│   ├── src/views/          # 公开名片、编辑、套餐、支付、印刷版、后台
│   ├── src/utils/          # 主题、保存、分享、印刷版式生成
│   └── public/             # PWA manifest / icon / sw
├── miniapp/                # uni-app Vue3：微信 / 支付宝 / 抖音三端
│   ├── src/pages/          # 首页、登录、公开名片、我的、编辑、套餐、支付、版式
│   └── src/utils/request.js# 三端共用的请求/登录/保存/上传/跳转方法
├── server/
│   ├── src/routes/         # auth / cards / packages / orders / upload / pay / admin
│   ├── src/services/       # qrcode / vcard / payment / orders(开通续期)
│   └── src/app.js          # Express 入口 + SEO 元信息注入
└── README.md
```

## 后续可扩展
短信验证码登录与风控、多名片/多身份、企业通讯录与批量导入、NFC 写卡引导页、Apple/Google Wallet Pass、短链域名与扫码来源分析、发票与对账导出。
