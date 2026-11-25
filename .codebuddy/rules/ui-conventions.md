# MCard UI 强制约定

## 1. 移动端所有下拉必须使用底部弹窗（用户 2026-11-25 定稿，强制）

用户端 H5（`client/`）是移动端优先形态，网页原生 `<select>` 在手机上弹出的滚轮/下拉与整体体验割裂，**一律禁止**。

- **唯一实现**：`client/src/components/BottomSelect.vue`（触发项 + `BottomSheet` 底部弹窗选项列表，勾选后自动收起）。
- **用法**：`<BottomSelect v-model="xxx" :options="[{ value, label }]" title="选择…" />`；后台返回的 `[{key,label}]` 数据用 computed 映射成 `{value,label}`，不要在页面里另写弹层。
- **例外**：`client/src/views/Admin.vue` 是后台管理（桌面场景），保留原生 `<select>`；小程序 `miniapp/` 用原生 `<picker>`（本身就是底部弹层），也不在此约束内。
- **新增/改动任何移动端选择控件前先自查**：页面里不得出现 `<select>`。发版前用 `grep -R "<select" client/src/views` 核验，除 `Admin.vue` 外应为 0 命中。

## 2. 页面区块与操作分层（用户 2026-11-25 定稿，强制）

- 信息展示区只放信息（姓名/职位/标签/联系方式/简介/链接/二维码），不夹杂操作按钮与引导文案。
- 操作按钮（拨号/复制/收藏/分享/编辑等）统一收进底部 dock，不铺在内容区。
- 多步骤指引/确认只在弹层出现，页面任何位置都不常驻步骤说明。
- 内容块之间留足间距，底部留白 ≥ dock 高度。

## 3. 同模板同内容（用户 2026-11-25 定稿）

`/me`（持有者预览，CardView `owner` 模式）与公开名片页（`/c/:slug`）用同一套模板、同一套样式、同一屏内容；差异只在操作层：
- 持有者：dock = 编辑名片 / 配色风格 / 名片集市 / 分享，封面左上 `✎`。
- 公开页：dock = 打电话 / 复制号码 / 存入通讯录 / 分享，封面左上返回 `‹`。
- 不再有临时换肤圆点；配色由独立页 `/me/card/style` 正式保存。

## 4. 底部弹层层级（踩坑固化）

全局 tabbar（`MemberNav`）z-index 110。任何底部弹层必须：遮罩 120、弹层 121、常驻功能条 105（或统一用 `BottomSheet` 的 9999）；弹层加 `visibility:hidden` + `overscroll-behavior:contain` + 打开时锁 body 滚动，否则会出现「弹层被 tabbar 盖住点不到」「上拖带动背后页面」。

## 5. 独立设计页不叠 tabbar

`/me/card/style`、`/me/card/market` 自带底部功能条，`App.vue` 的 `hideMemberNav` 按路由隐藏全局 `MemberNav`；保存退出回 `/me` 后恢复。
