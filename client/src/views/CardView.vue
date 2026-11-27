<template>
  <!--
    名片模板全局约定（所有 18 套模板必须遵守，新增模板时逐条核对）：
    1. 二维码是信息入口：小图只放姓名区右上角，点击弹层放大；正文不摆大块二维码卡，避免无谓下拉；
    2. 主操作（拨号/复制号码/存入通讯录/分享）单排 4 个收在底部 dock；次要操作（导航/收藏/交换名片）收进悬浮「⋯」，不铺在内容区；
    3. 「存入通讯录」的操作步骤只在 guide 弹层内展示，页面任何位置都不摆步骤；
    4. 公司名水印缩在卡片右下角、低透明，不遮挡姓名/职位/联系方式；
    5. 联系方式值按模板底色取高对比色：固定配色模板用 --cv-ink，主题驱动模板用 --t-text，不得用装饰色牺牲可读性；
       次级操作（导航/收藏/交换）只在公开访客页的悬浮「⋯」里；owner 工作台预览不显示——
       自己的名片无收藏/交换可言（后端也会拦「不能收藏自己的名片」），导航在地址区已有按钮（2026-11-25 用户定稿）；
    6. 页面底部留白 ≥ dock 高度（单排约 92px），末张卡片不被遮挡；
    7. 配色/质感跟随主题强调色，不写死白色；尊重 prefers-reduced-motion。
  -->
  <div class="cv-page" :class="['cv-tpl-' + template, { 'cv-clean': isCleanTpl, 'cv-embed': embed, 'cv-owner': owner }]" :style="vars">
    <div class="cv-cover">
      <button v-if="!owner && full" class="cv-back" @click="goBack" aria-label="返回">‹</button>
      <!-- 硬编码 MCard 品牌角标已移除（2026-11-26）：封面高度收窄后与右上角二维码重叠，
           只露出「rd」半截字（用户实际把它误认为二维码水印）。中心品牌字统一走后台「二维码水印」设置 -->
    </div>

    <div v-if="loading" class="container cv-loading">名片加载中…</div>
    <div v-else-if="error" class="container cv-loading">
      <b>名片加载失败</b><p class="small muted">{{ error }}</p>
      <button class="btn btn-primary" @click="load">重新加载</button>
    </div>

    <template v-else-if="card">
      <!-- 二维码调节态（2026-11-26 定稿；2026-11-27 用户截图「二维码里没有功能了」修整）：
           ① 下方码色选项行原先被 qrSub 死状态挡住（恒为 ''），整行空白——已去掉该状态，码色常显；
           ② 大码不再光秃秃：白码卡外围加四个 L 形角框（扫码框观感），纯 DOM/CSS 装饰层，
              只画在码图之外的 padding 区，不覆盖 PNG 任何像素、不侵占静音区 → 识别率 0 影响；
           ③ 大图与卡片右上角小码同源（qr.png 不带 scan=1，保留美化样式），qrStamp 击穿缓存，点选码色即时生效。
           信息层只有码图+一句说明，所有操作留在底部翻转行，点行首↙退出才回到整体名片 -->
      <div v-if="dockMode === 'qr'" class="cv-qr-tune">
        <div class="cv-qr-tune-card">
          <span class="cv-qr-corner tl"></span><span class="cv-qr-corner tr"></span>
          <img :src="qrApi + '/qr.png?size=560&v=' + qrStamp" alt="当前名片二维码" />
          <span class="cv-qr-corner bl"></span><span class="cv-qr-corner br"></span>
        </div>
        <p class="small muted cv-qr-tune-tip">当前二维码 · 点下方码色即时生效</p>
      </div>
      <CardSheet
        v-else
        :card="card" :tags="card.tags || []" :materials="materialsList" :site-name="siteConfig.site_name"
        :qr-url="full ? (qrApi + '/qr.png?size=200&v=' + qrStamp) : ''"
        :full="full" :interactive="full && !embed" :show-edit="!!owner" :quick-edit="!!owner && !embed"
        @edit="router.push('/me/card')" @qr="qrModal = true" @edit-field="openQuickEdit"
        @copy="copy" @tel="tel" @sms="sms" @mailto="mailto"
        @open-gallery="openGallery" @open-material="openMaterial" @map="openMapSheet"
      >
        <template #after-profile>
          <div v-if="full && !card.active" class="card card-pad notice-card">
            <b>这张名片尚未开通或已到期</b>
            <p class="small muted">联系持有者开通后，二维码仍会指向这里，无需更换。</p>
          </div>
          <div v-if="full && isOwner && !card.active" class="btn-row" style="margin:12px 0">
            <router-link to="/me/plans" class="btn btn-primary">立即开通</router-link>
          </div>
        </template>
        <template #after-address>
          <div v-if="showCreateOwn" class="card card-pad cv-create-own">
            <div class="cv-create-copy">
              <b>也想拥有这样一张名片？</b>
              <p class="small muted">二维码终身不变、资料随时改，免费创建</p>
            </div>
            <router-link :to="auth.token ? '/me/card' : '/login?redirect=/me/card'" class="btn btn-primary">免费创建我的名片 →</router-link>
          </div>
        </template>
      </CardSheet>
      <!-- 次级操作收进悬浮「⋯」：导航/收藏/交换名片，不铺在正文。
           owner 工作台是自己的名片：收藏会被后端拦、交换对自己无意义、导航地址区已有按钮，故不显示。 -->
      <button v-if="full && !owner" class="cv-fab" :class="{ on: moreOpen }" @click="moreOpen = !moreOpen" aria-label="更多操作">⋯</button>
      <div v-if="full && !owner && moreOpen" class="cv-fab-mask" @click="moreOpen = false">
        <div class="cv-fab-menu" @click.stop>
          <button v-if="fullAddress && maps.length" @click="moreOpen = false; openMapSheet()">导航到此处</button>
          <button @click="moreOpen = false; toggleFavorite()">{{ favorite ? '已收藏' : '收藏名片' }}</button>
          <button @click="moreOpen = false; openExchange()">交换名片</button>
        </div>
      </div>
      <!-- 宣传页挂钩（2026-11-27 一对多定稿）：关联开关在宣传页侧（card_linked），
           已发布且已关联的宣传页全部出现在名片公开页（多条并列），访客点开即看图文介绍；
           宣传页尾页也有名片码跳回来——双向转化 -->
      <template v-if="full && !owner && card.promos && card.promos.length">
        <button v-for="pr in card.promos" :key="pr.slug" class="cv-promo-entry" @click="router.push('/h5/' + pr.slug)">
          <span class="cv-pe-ico">◈</span>
          <span class="cv-pe-t"><b>{{ pr.title || '企业宣传页' }}</b><small>图文介绍 · 点开看看</small></span>
          <i>›</i>
        </button>
      </template>
      <!-- dock 四态翻转（2026-11-27 用户定稿）：main=编辑/配色/二维码/上架；
           点「配色」整行翻转成模板缩略行（点中即换、页面实时预览、可连着试）；
           点「二维码」名片本体让位给顶部二维码大图，dock 二级=码色选项行（点中即改、面板不关可连试）；
           点「上架」整行翻转成上架操作行（开关/行业 chips 点中即保存、状态实时反映）——
             不再跳独立页、不再开底部弹层，与配色/二维码同一操作方式（用户 2026-11-27 定稿「往上抽取」）；
           ↙ 二维码二级退回一级（大码保持），一级 ↙ / 上架行 ↙ 收起回整体名片。
           公开页 dock 不变：打电话 / 复制号码 / 存入通讯录 / 分享 -->
      <div v-if="full && owner" :class="['cv-dock cv-dock-glass', { 'cv-dock-flip': dockMode !== 'main' }]">
        <template v-if="dockMode === 'main'">
          <button class="btn btn-primary dock-btn" @click="router.push('/me/card')"><span class="dock-ico">✎</span>编辑</button>
          <button class="btn btn-ghost dock-btn" @click="toggleDock('tpl')"><span class="dock-ico">▦</span>配色</button>
          <button class="btn btn-ghost dock-btn" @click="toggleDock('qr')"><span class="dock-ico">▣</span>二维码</button>
          <!-- 上架集市：底部 tab 的「集市」是逛别人的名片，这里管「让别人找到我」；
               文案随 market_opt_in 反映当前上架状态；公开页 dock 本就 4 键等分（flex:1）。 -->
          <button class="btn btn-ghost dock-btn" @click="toggleDock('market')"><span class="dock-ico">◎</span>{{ card.market_opt_in ? '已上架' : '上架' }}</button>
        </template>
        <!-- 模板行：左右滑动点中即应用整套配色并保存，页面即实时预览 -->
        <template v-else-if="dockMode === 'tpl'">
          <button class="dock-back" @click="closeDock" aria-label="收起配色行，返回名片">↙</button>
          <div class="dock-scroll">
            <div class="dock-flow">
              <button v-for="t in tpls" :key="t.key" :class="['dock-tpl', { on: card.template === t.key, busy: tplBusy }]" @click="chooseTpl(t)">
                <span class="tpl-thumb" :class="'thumb-' + t.key"><i class="tpl-ava"></i></span>
                <span class="dock-tpl-label">{{ t.label }}</span>
              </button>
            </div>
            <div v-if="!tpls.length" class="dock-tpl-loading">模板清单加载中…</div>
          </div>
        </template>
        <!-- 上架集市行（2026-11-27 用户定稿「往上抽取」）：开关 + 行业 chips 点中即 PUT 保存、card 就地合并，
             dock 第 4 键实时变「已上架」；完成度(行业/地区/坐标)与地区文案同行尾静态展示；
             未开通套餐显示「去开通套餐」引导（服务端也有硬闸门）；完整设置仍走独立页。 -->
        <template v-else-if="dockMode === 'market'">
          <button class="dock-back" @click="closeDock" aria-label="收起上架设置，返回名片">↙</button>
          <div class="dock-scroll">
            <div class="dock-flow dock-market-flow">
              <button :class="['dock-mk-btn', { on: !!card.market_opt_in, busy: marketBusy }]" @click="toggleMarket">
                {{ card.market_opt_in ? '✓ 已上架' : '○ 加入集市' }}
              </button>
              <span class="dock-grp">行业</span>
              <button v-for="i in marketIndustries" :key="i.key" :class="['dock-mk-chip', { on: card.industry === i.key }]" @click="chooseIndustry(i.key)">{{ i.label }}</button>
              <span v-if="!marketIndustries.length" class="dock-tpl-loading">行业清单加载中…</span>
              <button v-if="!card.active" class="dock-mk-chip warn" @click="router.push('/me/plans')">去开通套餐 ›</button>
              <button class="dock-mk-chip" @click="router.push('/me/card/market')">完整设置 ↗</button>
              <span class="dock-mk-status">{{ marketStatusText }}</span>
            </div>
          </div>
        </template>
        <!-- 二维码调节（2026-11-27 识别率定稿）：码点/码眼已固定为标准方点、中心 LOGO 已移除，
             只保留不伤识别率的码色。2026-11-27 修：原 v-if="qrSub === 'color'" 的 qrSub 恒为 ''，
             整行永远空白（用户截图「二维码里没有功能了」）——只剩一个分类，选项常显即可。↙ 收起回整体名片 -->
        <template v-else-if="dockMode === 'qr'">
          <button class="dock-back" @click="closeDock" aria-label="收起二维码调节，返回名片">↙</button>
          <div class="dock-scroll">
            <div class="dock-flow">
              <button v-for="c in colorOpts" :key="'color-' + c.key" :class="['dock-tpl', { on: card.qr_fg === c.fg && card.qr_bg === c.bg, busy: qrBusy }]" @click="applyQrColor(c)">
                <img class="qr-swatch qr-swatch-live" :src="qrStyleSwatch({}, c.fg, c.bg)" alt="" />
                <span class="dock-tpl-label">{{ c.label }}</span>
              </button>
            </div>
          </div>
        </template>
      </div>
      <div v-else-if="full" class="cv-dock cv-dock-glass">
        <button class="btn btn-primary dock-btn" :disabled="!contactPhone" @click="tel(contactPhone)"><span class="dock-ico dock-ico-phone"></span>打电话</button>
        <button class="btn btn-ghost dock-btn" :disabled="!contactPhone" @click="copy(contactPhone, '号码')"><span class="dock-ico">⧉</span>复制号码</button>
        <a v-if="contactNative" class="btn btn-ghost dock-btn" :title="contactActionTip" :aria-label="contactActionLabel" :href="contactHref"><span class="dock-ico">◉</span>存入通讯录</a>
        <button v-else class="btn btn-ghost dock-btn" :title="contactActionTip" :aria-label="contactActionLabel" @click="saveContact"><span class="dock-ico">◉</span>存入通讯录</button>
        <button class="btn btn-ghost dock-btn" @click="doShare"><span class="dock-ico">↗</span>分享</button>
      </div>
      <BottomSheet :show="mapOpen" @update:show="mapOpen = $event">
        <div class="map-sheet-head"><b>选择导航地图</b><button @click="mapOpen = false">×</button></div>
        <div class="map-sheet-list">
          <a v-for="m in maps" :key="m.key" :href="m.href" target="_blank" rel="noopener" @click="mapOpen = false">
            <img class="map-ico" :src="mapIcon(m.key)" alt="" /><span>{{ m.label }}地图</span><span class="map-arrow">↗</span>
          </a>
        </div>
      </BottomSheet>
      <!-- 通讯录兜底：intent 拉不起来的个别机型/PC/鸿蒙，用复制基本信息代替下载 VCF（信息层展示，操作收在弹层） -->
      <BottomSheet :show="contactFallbackOpen" @update:show="contactFallbackOpen = $event">
        <div class="map-sheet-head"><b>存入通讯录 · 复制信息</b><button @click="contactFallbackOpen = false">×</button></div>
        <div class="cf-body">
          <p class="small muted">当前手机无法直接打开通讯录，复制下面的信息，到通讯录新建联系人粘贴即可。</p>
          <pre class="cf-info">{{ contactCopyText }}</pre>
          <button class="btn btn-primary btn-block" @click="copyContactInfo">一键复制名片信息</button>
        </div>
      </BottomSheet>
    </template>

    <!-- 快捷编辑弹层（2026-11-27 用户定稿）：点名片里的字段 → 字段后面浮出「✎ 改这项」标 → 点标只弹这一项；
         保存即 PUT /api/cards/mine 并就地合并 card，名片本体立即刷新、二维码与链接都不变。 -->
    <BottomSheet :show="qeOpen" @update:show="qeOpen = $event">
      <div class="qe-sheet" v-if="qeConf">
        <div class="qe-head"><b>修改{{ qeConf.label }}</b><button type="button" @click="qeOpen = false">×</button></div>
        <label v-if="qeKey === 'address'" class="qe-field">
          <span>省 / 市 / 区（三联选择）</span>
          <button type="button" class="qe-region-btn" @click="qeRegionOpen = true">{{ qeRegionPath }}</button>
        </label>
        <label v-for="f in qeConf.fields" :key="f.key" class="qe-field">
          <span>{{ f.label }}</span>
          <ImageField v-if="f.type === 'image'" v-model="qeForm[f.key]" />
          <textarea v-else-if="f.type === 'textarea'" v-model="qeForm[f.key]" rows="4" :maxlength="f.max || 1000" :placeholder="f.ph || ''"></textarea>
          <input v-else v-model="qeForm[f.key]" :maxlength="f.max || 100" :placeholder="f.ph || ''" :inputmode="f.inputmode || 'text'" />
        </label>
        <div class="qe-actions">
          <button class="btn btn-ghost" type="button" @click="qeOpen = false">取消</button>
          <button class="btn btn-primary" type="button" :disabled="qeSaving" @click="saveQuickEdit">{{ qeSaving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </BottomSheet>

    <!-- 省市区三列滚轮（复用编辑页同款组件，2026-11-27 用户追问「改地址没有三联联动吗」）：
         后渲染 Teleport 在上层，盖住快捷编辑弹层；确定即回填并按地址补坐标 -->
    <BottomSheet :show="qeRegionOpen" @update:show="qeRegionOpen = $event">
      <RegionPicker
        :province="qeRegion.province" :city="qeRegion.city" :district="qeRegion.district" :street="qeRegion.street"
        @confirm="onQeRegionPicked"
        @close="qeRegionOpen = false"
      />
    </BottomSheet>

    <!-- 快捷编辑·公司相册管理弹层（2026-11-27）：集合型数据不走单字段表单，独立管理弹层。
         与 CardEdit「公司相册」同口径：独立上传（/api/upload）、保存整份替换 PUT /api/cards/mine/materials；
         只管理图片行，链接/文件行原样保留。 -->
    <BottomSheet :show="qeGalOpen" @update:show="qeGalOpen = $event">
      <div class="qe-sheet">
        <div class="qe-head"><b>管理公司相册</b><button type="button" @click="qeGalOpen = false">×</button></div>
        <div class="qe-gal-wrap">
          <p class="small muted" style="margin:0 0 8px">已上传 {{ qeGalImages.length }} / {{ GALLERY_MAX }} 张，访客点开进全屏展播。</p>
          <div class="qe-gal-grid">
            <div v-for="(m, i) in qeGalImages" :key="m.url" class="qe-gal-cell">
              <img :src="fullUrl(m.url)" :alt="'相册图片 ' + (i + 1)" loading="lazy" />
              <button class="qe-gal-del" type="button" aria-label="移除此图" @click="removeGalImage(m.url)">✕</button>
            </div>
            <label v-if="qeGalImages.length < GALLERY_MAX" class="qe-gal-add" :class="{ disabled: qeGalUploading }" :aria-label="qeGalUploading ? '图片上传中' : '上传图片'">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple :disabled="qeGalUploading" @change="onGalUpload" />
              <span>{{ qeGalUploading ? '…' : '＋' }}</span>
              <small v-if="qeGalUploading">上传中</small>
            </label>
          </div>
        </div>
        <div class="qe-actions">
          <button class="btn btn-ghost" type="button" @click="qeGalOpen = false">取消</button>
          <button class="btn btn-primary" type="button" :disabled="qeGalSaving || qeGalUploading" @click="saveGalleryEdit">{{ qeGalSaving ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </BottomSheet>

    <!-- 名片二维码双码弹层（2026-11-26 定稿「两个都要」；2026-11-27 微信真机实测修正）：
         联系人码 = 名片页 URL + contact=1（微信扫一扫打开页面后自动弹「存入通讯录」入口）；
         名片链接码 = 名片页 URL（扫了看名片）。默认联系人码。
         ⚠️ 不再是 vCard 文本码：微信不解析 BEGIN:VCARD，扫了只显示「暂不支持展示二维码中的文本内容」黑屏。
         一律 PNG（微信「识别图中二维码」不认 SVG），链接仅作文案可复制 -->
    <div v-if="qrModal" class="modal-mask" @click.self="qrModal = false">
      <div class="modal center">
        <h3>我的名片</h3>
        <div class="qr-mode-tabs">
          <button :class="['qr-mode-tab', { on: qrMode === 'vcard' }]" @click="qrMode = 'vcard'">联系人码</button>
          <button :class="['qr-mode-tab', { on: qrMode === 'link' }]" @click="qrMode = 'link'">名片链接码</button>
        </div>
        <img :src="qrModalSrc" style="width:264px;height:264px;margin:4px auto 10px;display:block" :alt="qrMode === 'vcard' ? '名片联系人二维码' : '名片地址二维码'" />
        <!-- 2026-11-27 识别率定稿：弹层大码/保存一律用纯黑白标准识别码（plain=1），微信长按 100% 出
             「识别图中二维码」；名片本体码为标准方点 + 用户自选配色，不受影响 -->
        <p class="small muted center">扫一扫</p>
        <!-- 一个入口承载三件事：存联系人的码/打开名片的码、复制链接、公开页（关闭弹层即当前公开页） -->
        <div class="btn-row" style="justify-content:center;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-primary" @click="copy(publicLink, '名片链接')">复制名片链接</button>
          <button class="btn btn-ghost" @click="saveQr">保存二维码</button>
          <button class="btn btn-ghost" @click="qrModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 联系人码落地页（?contact=1，2026-11-27）：微信扫一扫打开名片页后自动弹「存入通讯录」入口。
         引导与操作按钮只在弹层（不铺在信息区），与底部 dock「存入通讯录」同一入口/同一口径。 -->
    <div v-if="contactAutoOpen" class="modal-mask" @click.self="contactAutoOpen = false">
      <div class="modal center">
        <h3>存入通讯录</h3>
        <p class="small muted center">已扫「联系人码」{{ card && card.name ? ' · ' + card.name : '' }}{{ contactPhone ? ' · ' + contactPhone : '' }}</p>
        <p class="small muted center">微信内无法直接写入通讯录，点按钮按提示在浏览器中打开即可一步添加。</p>
        <div class="btn-row" style="justify-content:center;margin-top:14px;flex-wrap:wrap">
          <a v-if="contactNative" class="btn btn-primary" :href="contactHref" @click="contactAutoOpen = false">存入通讯录</a>
          <button v-else class="btn btn-primary" :disabled="contactAutoBusy" @click="onContactAutoSave">存入通讯录</button>
          <button class="btn btn-ghost" @click="contactAutoOpen = false">稍后再说</button>
        </div>
      </div>
    </div>

    <!-- 全屏看图·相册展播（2026-11-27 用户定稿「H5 式动效展示」）：自动轮播（4.2s/张，可循环）+
         Ken Burns 缓推缓拉动效，点图暂停/继续、左右滑手动切换、双击缩放、下滑关闭；
         进度点在翻页栏，保存/返回等操作全在这一层，不铺在名片内容区。 -->
    <div v-if="galleryIndex >= 0" class="gallery-fullscreen" role="dialog" aria-label="相册大图浏览">
      <div class="gf-top">
        <button class="gf-back" aria-label="返回名片" @click="closeGallery">‹ 返回</button>
        <span class="gf-count">{{ galleryIndex + 1 }} / {{ imageMaterials.length }}</span>
        <span class="gf-title">{{ imageMaterials[galleryIndex]?.title || '相册' }}</span>
        <button class="gf-save" type="button" @click="saveGalleryImage">保存</button>
      </div>
      <div class="gf-stage" @touchstart.passive="onGfTouchStart" @touchend.passive="onGfTouchEnd" @click.self="closeGallery">
        <img
          v-if="!gfFailed"
          :key="gfRetryKey + '-' + galleryIndex"
          :class="{ 'is-zoomed': gfZoom, 'gf-kb': imageMaterials.length > 1 && !gfZoom, 'gf-kb-pause': !gfPlaying }"
          :src="fullUrl(imageMaterials[galleryIndex]?.url)"
          :alt="imageMaterials[galleryIndex]?.title"
          @error="gfFailed = true"
          @click="onGfClick"
        />
        <div v-else class="gf-error">
          <span>图片加载失败</span>
          <button type="button" @click="retryGalleryImage">重试</button>
        </div>
        <div class="gf-hint">点图暂停/播放 · 左右滑切换 · 双击缩放 · 下滑关闭</div>
      </div>
      <div v-if="imageMaterials.length > 1" ref="gfThumbs" class="gf-thumbs">
        <button
          v-for="(m, i) in imageMaterials" :key="m.id || (m.url + '-' + i)"
          class="gf-thumb" :class="{ on: i === galleryIndex }"
          type="button" :data-idx="i" :aria-label="'查看第 ' + (i + 1) + ' 张'"
          @click="jumpGallery(i)"
        >
          <img :src="fullUrl(m.url)" :alt="m.title || ('第 ' + (i + 1) + ' 张')" loading="lazy" />
        </button>
      </div>
      <div class="gf-nav">
        <button :disabled="galleryIndex <= 0" @click="stepGallery(-1)">‹ 上一张</button>
        <button v-if="imageMaterials.length > 1" class="gf-play" type="button" :aria-label="gfPlaying ? '暂停自动播放' : '自动播放'" @click="toggleGfPlay">{{ gfPlaying ? '❚❚' : '▶' }}</button>
        <div v-if="imageMaterials.length > 1" class="gf-dots" aria-hidden="true">
          <i v-for="(m, i) in imageMaterials" :key="m.id || (m.url + '-' + i)" :class="{ on: i === galleryIndex }"></i>
        </div>
        <button :disabled="galleryIndex >= imageMaterials.length - 1" @click="stepGallery(1)">下一张 ›</button>
      </div>
    </div>

    <!-- 保存引导弹层：微信内「去浏览器添加」的步骤只在这里出现，不铺在名片页面上 -->
    <div v-if="guide" class="modal-mask" @click.self="closeGuide">
      <div class="modal">
        <h3>{{ guide === 'contact' ? '存入通讯录' : '保存二维码' }}</h3>
        <template v-if="guide === 'contact'">
          <p class="guide-lead">按下面步骤操作即可把名片存进手机通讯录：</p>
          <div class="guide-steps">
            <div class="guide-steps-t">{{ contactSteps.title }}</div>
            <ol><li v-for="(s, i) in contactSteps.lines" :key="i" v-html="s"></li></ol>
          </div>
        </template>
        <template v-else-if="inWeChat">
          <p>微信内置浏览器限制下载。请点右上角「···」→ <b>在浏览器中打开</b>{{ guideWithLogin ? '（已自动带上登录状态）' : '（无需登录）' }}，再点保存。</p>
        </template>
        <template v-else>
          <p v-html="saveTip"></p>
        </template>
        <img v-if="guide !== 'contact'" :src="guideImage || scanQrUrl(slug, 'vcard.png', 520)" style="width:200px;height:200px;margin:10px auto;object-fit:contain" alt="二维码" />
        <div class="btn-row" style="justify-content:flex-end">
          <button class="btn btn-ghost" @click="closeGuide">知道了</button>
        </div>
      </div>
    </div>

    <!-- 交换名片 -->
    <div v-if="exchangeOpen" class="modal-mask" @click.self="exchangeOpen = false">
      <div class="modal">
        <h3>交换名片</h3>
        <p>填入你的名片短码（例如名片链接 /c/ 后面的部分），双方即建立互换记录。</p>
        <input v-model.trim="mySlug" class="input" placeholder="你的名片短码" />
        <div class="btn-row" style="margin-top:14px;justify-content:flex-end">
          <button class="btn btn-ghost" @click="exchangeOpen = false">取消</button>
          <button class="btn btn-primary" :disabled="exchanging" @click="doExchange">{{ exchanging ? '提交中…' : '确认交换' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// embed：嵌入模式（只渲染封面+身份区，其余由宿主页呈现）；owner：持有者预览（/me 我的名片）。
// ⚠️ owner 与公开页「同一套模板、同一套样式、同一屏内容」；差异只在 dock（持有者=编辑/配色/二维码/上架集市，
// 公开页=打电话/复制号码/存入通讯录/分享）与封面左上的编辑入口，且不设置微信分享/不查收藏/不上报访问。
// 2026-11-25 用户定稿。
const props = defineProps({
  embed: { type: Boolean, default: false },
  embedSlug: { type: String, default: '' },
  owner: { type: Boolean, default: false }
})
import api from '../api'
import { showToast, auth, siteConfig } from '../store'
import { THEMES, TEMPLATE_PALETTES, themeOf, themeVars } from '../utils/themes'
import { isWeChat, isIOS, saveImageUrl, prepareExternalOpen, openVcfInline, androidContactIntent, deviceEnv, SAVE_IMAGE_TIPS } from '../utils/save-image'
import { shareOrCopy, mapLinks } from '../utils/share'
import { setCardShare } from '../utils/wx-share'
import { scanQrUrl } from '../utils/qr'
import { loadQrStyles } from '../utils/qrStyles'
// dock 翻转行的模板缩略（与配色风格页/编辑页同一份唯一真相源）
import '../styles/template-thumbs.css'
import { getCachedPosition, geocode } from '../utils/geo'
import BottomSheet from '../components/BottomSheet.vue'
import CardSheet from '../components/CardSheet.vue'
import ImageField from '../components/ImageField.vue'

const route = useRoute(); const router = useRouter()
// 返回要「回到来源」而不是盲调 history.back：从集市点进来的名片必须回集市；
// 直接打开/分享链接没有上一页时回首页，避免点了没反应被当成没有返回入口。
function goBack() {
  if (String(route.query.src || '') === 'market') return router.push('/market')
  if (window.history.state?.back) return router.back()
  router.replace('/')
}
const embed = props.embed
const owner = props.owner
// 是否渲染公开页整页内容：owner 模式与公开页完全一致，只有 embed 才裁成头部
const full = !embed
// slug 必须响应式：名片夹/后台可连续打开 /c/a → /c/b，组件复用时不会重新挂载，
// 常量写法会让第二张名片仍显示第一张（编辑返回不更新的同类问题）。
const slug = computed(() => props.embedSlug || route.params.slug)
const qrApi = computed(() => `/api/cards/public/${slug.value}`)
const vcfApi = computed(() => `${qrApi.value}/card.vcf`)
// 二维码分工（2026-11-26 定稿双 tab；2026-11-27 微信真机实测修正内容口径）：
// 弹层大码/保存码两 tab 的内容都是「名片页 URL」——联系人码多带 contact=1（落地自动弹存入通讯录入口），
// 链接码直接看名片。微信不解析 vCard 文本码（扫了黑屏「暂不支持展示二维码中的文本内容」），故已下线。
// 身份卡右上角小装饰码仍是 qr.png 链接码（尺寸小、信息量小），小码带用户美化码型；
// 弹层大码/保存一律 plain=1 纯黑白标准码，保证长按识别。
const card = ref(null); const loading = ref(true); const error = ref('')

// dock 四态翻转（owner「配色」/「二维码」/「上架」键，2026-11-27 用户定稿）：
// main（编辑/配色/二维码/上架）→ tpl（模板缩略行，整张名片实时预览）/ qr（名片本体让位，顶部直视二维码大图 + 码色选项行）
// / market（上架操作行：开关/行业点中即保存），↙ 收起。
// 二维码 dock：↙ 收起回整体名片；2026-11-27 识别率定稿后只剩码色一个分类（选项行常显，不再有二级分类状态）。
// 模板清单来自公开接口（与 CardStyle/CardEdit 同源，缓存一次）；
// 点中即 PUT /api/cards/mine 应用整套配色（与 CardStyle done 同口径），card 就地合并 → 页面实时预览；
// 条保持打开可连续切换对比。未开通由服务端套餐闸门拦（403 → toast）。
const dockMode = ref('main')
// 2026-11-27 识别率定稿：码点/码眼固定标准方点、LOGO 移除，调节面板只留码色（不伤识别率的美化）。
// 原 qrSub 二级分类状态在多分类下线后恒为 ''，导致码色选项整行空白 —— 已删除该死状态，选项常显。
const tpls = ref([]); const tplBusy = ref(false)
let tplsLoaded = false
// 进入二维码调节态：名片本体让位，顶部直视大码；从任意滚动位置点底部 dock 都要先回页顶，
// 否则用户下滑后点「二维码」只见调节行、看不到上方大码（2026-11-26 用户截图实锤）。
function scrollPageTop() { try { windowRef.scrollTo?.(0, 0) } catch { /* 老 WebView 无 scrollTo 选项时忽略 */ } }
function closeDock() { dockMode.value = 'main'; scrollPageTop() }
function toggleDock(m) {
  dockMode.value = dockMode.value === m ? 'main' : m
  if (dockMode.value === 'qr') scrollPageTop()
  if (dockMode.value === 'market') loadMarketMeta()
  if (dockMode.value === 'tpl' && !tplsLoaded) {
    api.get(`/api/cards/public/templates?t=${Date.now()}`).then(({ data }) => {
      const list = data?.data?.templates || []
      if (list.length) { tpls.value = list; tplsLoaded = true }
    }).catch(() => { /* 清单拉取失败静默，行内显示「加载中」可收起再开重试 */ })
  }
}
async function chooseTpl(t) {
  if (tplBusy.value || !card.value || card.value.template === t.key) return
  const pal = TEMPLATE_PALETTES[t.key] || { theme: 'ocean', qrFg: '#0f172a', qrBg: '#ffffff' }
  const patch = {
    template: t.key,
    theme: pal.theme,
    accent: (THEMES[pal.theme] || THEMES.ocean).accent,
    qr_fg: pal.qrFg,
    qr_bg: pal.qrBg
  }
  tplBusy.value = true
  try {
    await api.put('/api/cards/mine', patch)
    // 不弹成功 toast：名片本体实时变化 + 缩略高亮即是反馈，弹层反而挡行打断「连着试」（2026-11-26 用户定）
    card.value = { ...card.value, ...patch }
    // ⚠️ 名片本体的模板类名/主题色变量由独立 ref 派生（load() 时赋值，根类名 cv-tpl-{template}、vars 走 currentTheme）：
    // 必须与 card 合并同步更新，否则只有缩略高亮变、上面名片不跟着换（2026-11-26 用户截图实锤）。
    currentTheme.value = THEMES[patch.theme] ? patch.theme : 'ocean'
    template.value = patch.template || 'contact'
    // 整套配色含二维码前景/背景色（服务端渲染）：击穿二维码图缓存让新色立刻可见
    qrStamp.value = Date.now()
  } catch (e) { showToast(e.message, 'error') } finally { tplBusy.value = false }
}
// 码色选项由服务端 /api/cards/public/meta 下发（唯一真相源），本页挂载时拉取一次（utils/qrStyles 带缓存+兜底）。
// 2026-11-27 识别率定稿：码点/码眼/预设清单已收敛到标准方点，面板只留码色。
const colorOpts = ref([])
const qrBusy = ref(false)
// 二维码图 URL 缓存击穿：qr_fg/qr_bg 由服务端渲染，固定 URL 会被 CDN/浏览器缓存 60s，
// 换色后必须换 query 才能立刻看到新码
const qrStamp = ref(0)
// 弹层码显示 264px：按屏幕 DPR 请求原图尺寸（528/792），避免 640→264 浏览器降采样
// 把码点间细缝糊掉——微信长按识别用的是屏幕截图做本地 QR 检测，糊掉的码点会检测失败。
// 弹层大码恒用 plain=1 纯黑白标准识别码（2026-11-27 定稿：长按识别 100% 可用）。
const qrImgSize = Math.round(264 * Math.min(3, Math.max(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 2)))
const qrModalSrc = computed(() => scanQrUrl(slug.value, qrMode.value === 'vcard' ? 'vcard.png' : 'qr.png', qrImgSize)
  + '&plain=1&v=' + qrStamp.value)
// 码色缩略直接用服务端真实渲染（?style= 覆盖），所见即所得；
// 固定参数不跟着 qrStamp 变，浏览器/CDN 缓存即可。
function qrStyleSwatch(patch, fg, bg) {
  const s = { ...(card.value?.qr_style || {}), ...patch, logoShape: 'none', bgImage: '' }
  const f = encodeURIComponent(fg || card.value?.qr_fg || '#0f172a')
  const b = encodeURIComponent(bg || card.value?.qr_bg || '#ffffff')
  return `${qrApi.value}/qr.svg?size=108&logo=0&fg=${f}&bg=${b}&style=${encodeURIComponent(JSON.stringify(s))}`
}
// 码色走既有 cards.qr_fg / qr_bg（不新建参数）；深码浅底成对保存，服务端白名单与套餐闸门已覆盖这两字段。
async function applyQrColor(c) {
  if (qrBusy.value || !card.value) return
  if (card.value.qr_fg === c.fg && card.value.qr_bg === c.bg) return
  qrBusy.value = true
  try {
    await api.put('/api/cards/mine', { qr_fg: c.fg, qr_bg: c.bg })
    card.value = { ...card.value, qr_fg: c.fg, qr_bg: c.bg }
    qrStamp.value = Date.now()
  } catch (e) { showToast(e.message, 'error') } finally { qrBusy.value = false }
}
// 部分合并应用 qr_style（预设=dot+eye+gradTo 整组，码型细调=单项），点中即保存实时生效
async function applyQrStyle(patch) {
  if (qrBusy.value) return
  const cur = card.value?.qr_style || {}
  if (Object.keys(patch).every(k => cur[k] === patch[k] || (patch[k] === '' && !cur[k]))) return
  const qr_style = { ...cur, ...patch }
  qrBusy.value = true
  try {
    await api.put('/api/cards/mine', { qr_style })
    // 同模板切换：选中高亮 + 二维码实时刷新即反馈（上方名片小码跟着变），不弹成功 toast
    card.value = { ...card.value, qr_style }
    qrStamp.value = Date.now()
  } catch (e) { showToast(e.message, 'error') } finally { qrBusy.value = false }
}

// 上架集市翻转行（2026-11-27 用户定稿「往上抽取」）：与配色/二维码同款「点中即保存」。
// 开关/行业 chips 直接 PUT /api/cards/mine 并就地合并 card → dock 第 4 键文案实时反映状态，不跳页、不弹层。
// 行业清单来自公开 meta（唯一真相源，缓存一次）；完成度只展示行业/地区/坐标，地区与坐标的维护仍在编辑资料页。
// 套餐闸门：开启上架但套餐无效 → 引导开通且不发请求（关闭下架放行，与服务端 PLAN_GATED_FIELDS 同口径）。
// 完整设置（集市展示预览/地区坐标检查）保留独立页 /me/card/market，与配色既有独立页双入口同构。
const marketBusy = ref(false)
const marketIndustries = ref([])
let marketMetaLoaded = false
function loadMarketMeta() {
  if (marketMetaLoaded) return
  api.get('/api/cards/public/market/meta').then(({ data }) => {
    const list = data?.data?.industries || []
    if (list.length) { marketIndustries.value = list; marketMetaLoaded = true }
  }).catch(() => { /* 清单拉取失败静默，行内显示「加载中」可收起再开重试 */ })
}
const marketStatusText = computed(() => {
  const c = card.value || {}
  const region = [c.province, c.city, c.district].filter(Boolean).join('·')
  return `${c.industry ? '✓' : '○'}行业 ${region ? '✓' : '○'}地区 ${c.latitude != null ? '✓' : '○'}坐标${region ? ' · ' + region : ''}`
})
async function saveMarket(patch, tip) {
  if (marketBusy.value || !card.value) return
  if (patch.market_opt_in && !card.value.active) {
    showToast('上架集市需要先开通套餐', 'error')
    router.push('/me/plans')
    return
  }
  marketBusy.value = true
  try {
    await api.put('/api/cards/mine', patch)
    card.value = { ...card.value, ...patch }
    if (tip) showToast(tip, 'success')
  } catch (e) { showToast(e.message, 'error') } finally { marketBusy.value = false }
}
function toggleMarket() {
  const next = !card.value?.market_opt_in
  saveMarket({ market_opt_in: next }, next ? '已上架名片集市' : '已下架名片集市')
}
function chooseIndustry(key) {
  if (card.value?.industry === key) return
  saveMarket({ industry: key })
}

// 快捷编辑（2026-11-27 用户定稿「点字段出标、点标改此项」）：
// key 与 CardSheet emit 的字段名一一对应；fields 是该弹层要改的服务端列（地址/职位是两列一组），
// 全部落在 PUT /api/cards/mine 的 EDITABLE 白名单内，不涉及 slug/expires_at（二维码终身不变）。
// 只提交这一项的 patch —— 不像整份表单那样全量提交，避免覆盖其它分类里未加载的字段。
const QE_CONF = {
  logo: { label: '头像 / LOGO', fields: [{ key: 'logo', label: '图片（公司 LOGO 优先展示）', type: 'image' }] },
  name: { label: '姓名', fields: [{ key: 'name', label: '姓名', max: 30 }] },
  name_en: { label: '英文名', fields: [{ key: 'name_en', label: '英文名', max: 40 }] },
  title: { label: '职位 / 部门', fields: [{ key: 'title', label: '职位', max: 40 }, { key: 'department', label: '部门（选填）', max: 40 }] },
  company: { label: '公司 / 品牌', fields: [{ key: 'company', label: '公司 / 品牌', max: 60 }] },
  tags: { label: '标签', fields: [{ key: 'tags', label: '标签（逗号分隔，最多 8 个）', type: 'tags', max: 200 }] },
  bio: { label: '简介', fields: [{ key: 'bio', label: '简介', type: 'textarea', max: 1000 }] },
  mobile: { label: '手机号', fields: [{ key: 'mobile', label: '手机号', max: 30, inputmode: 'tel' }] },
  phone: { label: '座机', fields: [{ key: 'phone', label: '座机', max: 30, inputmode: 'tel' }] },
  email: { label: '邮箱', fields: [{ key: 'email', label: '邮箱', max: 80, inputmode: 'email' }] },
  wechat: { label: '微信号', fields: [{ key: 'wechat', label: '微信号', max: 60 }] },
  alipay: { label: '支付宝', fields: [{ key: 'alipay', label: '支付宝', max: 60 }] },
  whatsapp: { label: 'WhatsApp', fields: [{ key: 'whatsapp', label: 'WhatsApp', max: 60 }] },
  address: { label: '地址', fields: [{ key: 'address', label: '详细地址', max: 120 }, { key: 'address_detail', label: '门牌 / 楼层（选填）', max: 80 }] },
  website: { label: '公司主页', fields: [{ key: 'website', label: '网址', max: 200, ph: 'https://…' }] },
  shop_url: { label: '店铺主页', fields: [{ key: 'shop_url', label: '网址', max: 200, ph: 'https://…' }] }
}
const qeOpen = ref(false)
const qeKey = ref('')
const qeForm = ref({})
const qeSaving = ref(false)
const qeConf = computed(() => QE_CONF[qeKey.value] || null)
// 地址弹层的省市区三联（2026-11-27 用户追问）：复用编辑页同款 RegionPicker 三列滚轮，
// 确定后按地址补坐标（与编辑页「选地区→自动定位」同一口径），保存随 patch 一起提交。
// 服务端 EDITABLE 白名单本就含 province/city/district/street/latitude/longitude。
const RegionPicker = defineAsyncComponent(() => import('../components/RegionPicker.vue'))
const qeRegionOpen = ref(false)
const qeRegion = ref({ province: '', city: '', district: '', street: '' })
const qeGeo = ref(null) // geocode 成功的坐标 { latitude, longitude }；失败不动原坐标（与编辑页一致不阻塞）
const qeRegionPath = computed(() => {
  const r = qeRegion.value
  return [r.province, r.city, r.district, r.street].filter(Boolean).join(' / ') || '请选择省 / 市 / 区'
})
function onQeRegionPicked(r) {
  qeRegion.value = { province: r.province || '', city: r.city || '', district: r.district || '', street: r.street || '' }
  qeRegionOpen.value = false
  const text = [r.province, r.city, r.district, r.street, qeForm.value.address].filter(Boolean).join('')
  if (!text) return
  geocode(text, r.city).then(g => { if (g) qeGeo.value = { latitude: g.lat, longitude: g.lng } }).catch(() => {})
}
function openQuickEdit(key) {
  const k = key === 'shop' ? 'shop_url' : key // CardSheet 的 siteLinks 用 'shop' 短名
  // 公司相册：集合型数据走独立管理弹层（上传网格 + 整份替换保存），不进单字段表单
  if (k === 'gallery') { openGalleryEdit(); return }
  const conf = QE_CONF[k]
  if (!conf) return
  qeKey.value = k
  const c = card.value || {}
  if (k === 'address') {
    qeRegion.value = { province: c.province || '', city: c.city || '', district: c.district || '', street: c.street || '' }
    qeGeo.value = null
  }
  const form = {}
  for (const f of conf.fields) {
    const raw = c[f.key] ?? ''
    if (f.type === 'tags') {
      let arr = raw
      if (typeof arr === 'string' && arr.trim().startsWith('[')) { try { arr = JSON.parse(arr) } catch {} }
      form[f.key] = Array.isArray(arr) ? arr.join('，') : arr
    } else form[f.key] = raw
  }
  qeForm.value = form
  qeOpen.value = true
}
async function saveQuickEdit() {
  const conf = qeConf.value
  if (qeSaving.value || !conf) return
  const patch = {}
  for (const f of conf.fields) {
    let v = qeForm.value[f.key] ?? ''
    if (f.type === 'tags') v = String(v).split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 8)
    patch[f.key] = v
  }
  if (qeKey.value === 'address') {
    Object.assign(patch, qeRegion.value)
    if (qeGeo.value) Object.assign(patch, qeGeo.value)
  }
  qeSaving.value = true
  try {
    await api.put('/api/cards/mine', patch)
    card.value = { ...card.value, ...patch } // 就地合并 → 名片本体即时刷新；二维码 slug 不变
    qeOpen.value = false
    showToast(`已保存${conf.label}`, 'success')
  } catch (e) { showToast(e.message, 'error') } finally { qeSaving.value = false }
}

// 快捷编辑·公司相册管理（2026-11-27）：与 CardEdit「公司相册」同口径——独立上传（/api/upload）、
// 保存走 PUT /api/cards/mine/materials 整份替换；只动图片行（type:'file' 且是图），链接/文件行原样保留。
// 保存成功后就地刷新 materialsList，相册区与展播入口立即可见。
const GALLERY_MAX = 20
const qeGalOpen = ref(false)
const qeGalList = ref([]) // 打开弹层时的全量快照（含非图片行，保存时合并回去）
const qeGalUploading = ref(false)
const qeGalSaving = ref(false)
const qeGalImages = computed(() => qeGalList.value.filter(m => isImageMaterial(m)))
function openGalleryEdit() {
  qeGalList.value = materialsList.value.map(m => ({ ...m }))
  qeGalOpen.value = true
}
function removeGalImage(url) { qeGalList.value = qeGalList.value.filter(m => !(m.url === url && isImageMaterial(m))) }
// 相册上传：多选、逐张串行上传（严格按选择顺序追加）；成对防重入（disabled + busy 守卫），
// 达上限停止；单张失败提示但不中断整批，已成功的照常入相册。
async function onGalUpload(e) {
  if (qeGalUploading.value) return
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  if (!files.length) return
  const room = GALLERY_MAX - qeGalImages.value.length
  if (room <= 0) { showToast(`相册最多 ${GALLERY_MAX} 张`, 'error'); return }
  const picked = files.slice(0, room)
  if (files.length > room) showToast(`最多 ${GALLERY_MAX} 张，本次只上传 ${room} 张`, 'error')
  qeGalUploading.value = true
  try {
    for (const file of picked) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const { data } = await api.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        if (data?.data?.url) qeGalList.value.push({ type: 'file', title: '', url: data.data.url })
      } catch (err) { showToast(`${file.name} 上传失败：${err.message || '网络异常'}`, 'error') }
    }
  } finally { qeGalUploading.value = false }
}
async function saveGalleryEdit() {
  if (qeGalSaving.value || qeGalUploading.value) return
  qeGalSaving.value = true
  try {
    // 图片行重排在前（按网格顺序），非图片行按原序垫后——访客展播只看图片，链接/文件不受影响
    const imgs = qeGalList.value.filter(m => isImageMaterial(m))
    const others = qeGalList.value.filter(m => !isImageMaterial(m) && m.url)
    const items = [...imgs, ...others].map((m, i) => ({ ...m, sort: i }))
    const { data } = await api.put('/api/cards/mine/materials', { items })
    materialsList.value = data.data?.list || materialsList.value
    qeGalOpen.value = false
    showToast('公司相册已保存', 'success')
  } catch (e) { showToast(e.message || '相册保存失败，请重试', 'error') } finally { qeGalSaving.value = false }
}
const currentTheme = ref('ocean'); const isOwner = ref(false)
// 当前登录用户是否已建自己的名片（看别人的名片时用来决定是否显示「免费创建我的名片」）
const hasOwnCard = ref(false)
const template = ref('contact')
// 18 套模板统一同一套「连续大卡」骨架（2026-11-25 用户定稿）：模板切换只换 --cv-* 配色，不再有结构差异。
// 旧版 6 套（classic/minimal/elite/vivid/seal/navygold）原先是分开的多张卡，现在也走 cv-clean 骨架，
// 配色在样式表末尾「全模板统一层」里给出；原模板专属结构规则被该统一层按特异性覆盖，不逐条删除以便回滚。
const isCleanTpl = computed(() => true)
const qrModal = ref(false); const qrMode = ref('vcard'); const guide = ref(''); const guideImage = ref(''); const exchangeOpen = ref(false)
// 联系人码落地弹层（?contact=1）：微信扫一扫打开名片页自动弹；成对防重入（disabled + busy 守卫）
const contactAutoOpen = ref(false); const contactAutoBusy = ref(false)
async function onContactAutoSave() {
  if (contactAutoBusy.value) return
  contactAutoBusy.value = true
  contactAutoOpen.value = false
  try { await saveContact() } finally { contactAutoBusy.value = false }
}
const contactFallbackOpen = ref(false) // 安卓 intent 拉不起通讯录时的兜底：复制基本信息卡片（全程不下载）
const mapOpen = ref(false); const moreOpen = ref(false)
const mySlug = ref(''); const exchanging = ref(false)
const favorite = ref(false); const favBusy = ref(false)
const materialsList = ref([])
const galleryIndex = ref(-1)
const imageMaterials = computed(() => materialsList.value.filter(m => isImageMaterial(m)))
// 链接/资源 URL 归一：CardSheet 展示时已处理，这里供全屏看图与资料直开使用
function safeUrl(u) {
  if (!u) return '#'
  const s = String(u).trim()
  const full = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try { const x = new URL(full); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#' } catch { return '#' }
}
const fullUrl = u => (u ? new URL(u, window.location.origin).href : '')
// 相册直看：图片是可预览的图片文件链接，其余（网页/文档）直接打开不跳页
function isImageMaterial(m) {
  if (!m || m.type !== 'file' || !m.url) return false
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(m.url)
}
function openGallery(m) {
  const idx = imageMaterials.value.findIndex(x => x.id === m.id)
  galleryIndex.value = idx < 0 ? 0 : idx
  gfPlaying.value = imageMaterials.value.length > 1 // 展播默认自动播放，单图无需轮播
  countMaterialView(m)
}
async function openMaterial(m) {
  const u = m.type === 'link' ? safeUrl(m.url) : fullUrl(m.url)
  if (!u || u === '#') return showToast('链接无效')
  countMaterialView(m)
  windowRef.open(u, '_blank', 'noopener')
}
async function countMaterialView(m) {
  try { await api.post(`/api/cards/public/materials/${m.id}/view`) } catch { /* 计数失败不影响查看 */ }
}

// 看图操作层：手势/按钮/键盘三条入口共用同一组状态，切换时统一复位（加载失败、缩放、双击计时）。
// 相册展播（2026-11-27）：gfPlaying 自动轮播（4.2s/张，到尾回绕循环），点图暂停/继续（双击缩放优先），
// Ken Burns 动效由 .gf-kb / .gf-kb-pause 两个类驱动（CSS 动画，老 WebView 不支持时只是不动，无害）。
const gfZoom = ref(false)
const gfFailed = ref(false)
const gfRetryKey = ref(0)
const gfThumbs = ref(null)
const gfPlaying = ref(false)
let gfTimer = 0
let gfTapTimer = 0
let gfTouch = null
let gfLastTap = 0
let gfKeyHandler = null
const GF_SLIDE_MS = 4200
function gfSchedule() {
  clearTimeout(gfTimer)
  if (!gfPlaying.value || imageMaterials.value.length < 2) return
  gfTimer = setTimeout(() => {
    galleryIndex.value = (galleryIndex.value + 1) % imageMaterials.value.length // 循环展播
    gfSchedule()
  }, GF_SLIDE_MS)
}
function toggleGfPlay() { gfPlaying.value = !gfPlaying.value; gfSchedule() }
function closeGallery() { galleryIndex.value = -1 }
function stepGallery(step) {
  const next = galleryIndex.value + step
  if (next < 0 || next >= imageMaterials.value.length) return
  galleryIndex.value = next
}
function jumpGallery(i) {
  if (i >= 0 && i < imageMaterials.value.length) galleryIndex.value = i
}
function retryGalleryImage() { gfFailed.value = false; gfRetryKey.value++ }
async function saveGalleryImage() {
  const m = imageMaterials.value[galleryIndex.value]
  if (!m) return
  const r = await saveImageUrl(fullUrl(m.url), `相册-${galleryIndex.value + 1}`)
  if (r?.kind === 'downloaded') showToast('已开始下载', 'success')
  else if (r?.kind === 'longpress') showToast(isWeChat() ? '长按图片保存到手机' : '长按图片保存', 'success')
  else showToast('已在新窗口打开，长按可保存', 'success')
}
function onGfTouchStart(e) {
  const pt = e.touches?.[0]
  if (!pt) return
  gfTouch = { x: pt.clientX, y: pt.clientY, at: Date.now() }
}
function onGfTouchEnd(e) {
  if (!gfTouch) return
  const pt = e.changedTouches?.[0]
  if (!pt) { gfTouch = null; return }
  const dx = pt.clientX - gfTouch.x
  const dy = pt.clientY - gfTouch.y
  const quick = Date.now() - gfTouch.at < 400
  gfTouch = null
  // 轻点：320ms 内第二次即双击缩放（取消待定的单击动作）；单击延迟一拍执行播放/暂停，避免与双击打架。
  // gfLastTap 每次轻点都刷新（含双击的第二下），让触屏后的合成 click（onGfClick 600ms 守卫）全部跳过。
  if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
    if (quick && Date.now() - gfLastTap < 320) {
      clearTimeout(gfTapTimer); gfZoom.value = !gfZoom.value
    } else {
      clearTimeout(gfTapTimer)
      gfTapTimer = setTimeout(() => toggleGfPlay(), 320)
    }
    gfLastTap = Date.now()
    return
  }
  if (gfZoom.value) return
  if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx) * 1.2) { closeGallery(); return }
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) stepGallery(dx < 0 ? 1 : -1)
}
function onGfClick() {
  // 触屏 tap 刚由 onGfTouchEnd 延迟处理过，这里合成 click 跳过，避免一次触摸切换两次
  if (Date.now() - gfLastTap < 600) return
  toggleGfPlay()
}
function preloadNeighbors() {
  const i = galleryIndex.value
  for (const n of [i - 1, i + 1]) {
    const u = imageMaterials.value[n]?.url
    if (u) { const img = new Image(); img.src = fullUrl(u) }
  }
}
function centerGalleryThumb() {
  const el = gfThumbs.value?.querySelector(`[data-idx="${galleryIndex.value}"]`)
  if (!el || !el.scrollIntoView) return
  try { el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }
  catch { el.scrollIntoView() }
}
function onGalleryKey(e) {
  if (e.key === 'Escape') closeGallery()
  else if (e.key === 'ArrowLeft') stepGallery(-1)
  else if (e.key === 'ArrowRight') stepGallery(1)
}
watch(galleryIndex, v => {
  gfZoom.value = false
  gfFailed.value = false
  gfLastTap = 0
  gfTouch = null
  if (v >= 0) {
    preloadNeighbors()
    nextTick(centerGalleryThumb)
    gfSchedule() // 手动切换/自动轮播都从这一刻重新计时
    if (!gfKeyHandler) { gfKeyHandler = onGalleryKey; window.addEventListener('keydown', gfKeyHandler) }
  } else {
    gfPlaying.value = false
    clearTimeout(gfTimer)
    if (gfKeyHandler) {
      window.removeEventListener('keydown', gfKeyHandler)
      gfKeyHandler = null
    }
  }
})
// 缩放查看时暂停轮播，收起缩放恢复（避免看着图被自动翻走）
watch(gfZoom, z => {
  if (z) clearTimeout(gfTimer)
  else gfSchedule()
})
onBeforeUnmount(() => {
  clearTimeout(gfTimer)
  clearTimeout(gfTapTimer)
  if (gfKeyHandler) window.removeEventListener('keydown', gfKeyHandler)
})

const t = computed(() => themeOf({ theme: currentTheme.value, accent: card.value?.accent }))
// 动态光效用主题强调色而非写死白色：把 #rrggbb 转 rgb 分量，CSS 里 rgba(var(--glow-rgb), .x)
function hexToRgb(hex) {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''))
  if (!h) return '37,99,235'
  const n = parseInt(h[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
const vars = computed(() => ({ ...themeVars(t.value), '--glow-rgb': hexToRgb(t.value.accent) }))
// 访客点开分享的名片必须先看到名片本身；「我也要创建」只作为名片下方的次要入口，
// 绝不能反过来一进来就拦去创建页——那会完全忽视「先看名片」的场景需要。
// 「看场景」口径（2026-11-26 用户定）：已登录且自己已经建了名片的用户，去集市/分享看别人的名片时
// 不再显示「免费创建我的名片」（人家已经有了，再引导是打扰）；只给未登录或已登录但尚无名片的人看。
const showCreateOwn = computed(() => !owner && !isOwner.value && !(auth.token && hasOwnCard.value))
const fullAddress = computed(() => {
  const c = card.value || {}
  return [c.province, c.city, c.district, c.street, c.address, c.address_detail].filter(Boolean).join('')
})
// 有坐标时优先用经纬度生成各地图导航，否则回落地址字符串
const maps = computed(() => {
  const c = card.value || {}
  if (c.latitude != null && c.longitude != null) {
    const lat = Number(c.latitude), lng = Number(c.longitude), name = encodeURIComponent(c.name || '位置')
    return [
      { key: 'amap', label: '高德', href: `https://uri.amap.com/marker?position=${lng},${lat}&name=${name}` },
      { key: 'baidu', label: '百度', href: `https://api.map.baidu.com/marker?location=${lat},${lng}&title=${name}&content=${name}&output=html` },
      { key: 'qq', label: '腾讯', href: `https://apis.map.qq.com/uri/v1/marker?marker=coord:${lat},${lng};title:${name}&referer=MCard` },
      { key: 'apple', label: 'Apple', href: `https://maps.apple.com/?ll=${lat},${lng}&q=${name}` }
    ]
  }
  return mapLinks(c.address || '')
})
const windowRef = window
// 分享唯一真相源：服务端 publicView 下发的 url = ${origin}/c/${slug}（动态域名、干净无 query）。
// 微信「···」原生转发用的是 JS-SDK 配置的 link，不是地址栏 URL——owner 页也必须配成这个地址，
// 否则别人打开的是 /me（被守卫踢去登录，登录后看到「我的名片页」），而不是被分享的那张名片。
const publicLink = computed(() => card.value?.url || `${windowRef.location.origin}/c/${slug.value}`)
// 微信内引导「在浏览器中打开」是否真的带上了登录凭证：未登录访客拿不到 ticket，文案不能谎称已带登录态
const guideWithLogin = ref(false)
// 模板里区分微信/Safari 的保存引导（微信→去浏览器，iOS→长按图片）
const inWeChat = isWeChat()
const deviceEnvKey = deviceEnv()
// iOS：用真实 <a href=".vcf"> 顶层导航弹系统添加联系人（Safari 只信任用户点击的顶层导航）。
// 安卓：必须走按钮点击 saveContact —— 需要监听 visibilitychange 判断 intent 是否拉起，拉不起来弹复制卡片兜底。
const contactNative = deviceEnvKey === 'ios'
// iOS：.vcf 直链弹添加联系人；安卓：intent:// 直接拉起预填的添加联系人界面（收到 vcf 只会下载，必须走 intent）。
// 安卓不设 browser_fallback_url（那是下载），拉不起来时由 saveContact 的 visibilitychange 检测弹「复制信息」卡片。
const contactHref = computed(() => {
  if (deviceEnvKey !== 'android') return vcfApi.value
  return androidContactIntent(card.value)
})
const saveTip = SAVE_IMAGE_TIPS[deviceEnvKey] || SAVE_IMAGE_TIPS.other
// 通讯录操作按环境出文案：iOS/Android 直接开系统界面、鸿蒙/其它下载 vcf、微信引导去浏览器
const CONTACT_ACTION = {
  ios: { label: '打开通讯录', tip: '点此直接打开系统添加联系人界面' },
  android: { label: '打开通讯录', tip: '点此直接打开系统添加联系人界面' },
  harmony: { label: '复制信息', tip: '点此复制名片信息，到通讯录新建联系人粘贴' },
  wechat: { label: '去浏览器添加', tip: '微信内无法直接写入通讯录，请点右上角「···」在浏览器中打开' },
  other: { label: '复制信息', tip: '点此复制名片信息，到通讯录新建联系人粘贴' }
}
const contactActionLabel = (CONTACT_ACTION[deviceEnvKey] || CONTACT_ACTION.other).label
const contactActionTip = (CONTACT_ACTION[deviceEnvKey] || CONTACT_ACTION.other).tip
const contactPhone = computed(() => String(card.value?.mobile || card.value?.phone || '').trim())
// 卡内「按环境」操作指引：参考简洁联络卡的 steps 区块，文案按当前环境给可操作步骤
const CONTACT_STEPS = {
  wechat: { title: '微信内 · 推荐这样存', lines: [
    '点右上角「···」→ <b>在浏览器中打开</b>',
    '在浏览器页面底部点「存入通讯录」',
    '按系统提示添加；或先点底部「复制号码」，再去通讯录新建联系人粘贴'
  ] },
  ios: { title: 'iPhone 浏览器 · 三步存好', lines: [
    '点页面底部「存入通讯录」，系统弹出添加联系人界面',
    '确认姓名与号码无误',
    '点「完成」即保存到通讯录'
  ] },
  android: { title: '安卓 · 通常一步到位', lines: [
    '点页面底部「存入通讯录」，直接拉起已填好资料的添加联系人界面',
    '确认姓名与号码无误，点「保存」即存入',
    '个别机型拉不起时，会自动弹出名片信息，一键复制后到通讯录新建粘贴即可'
  ] },
  harmony: { title: '鸿蒙 · 复制信息保存', lines: [
    '点页面底部「存入通讯录」，弹出名片信息',
    '点「一键复制名片信息」',
    '到通讯录新建联系人，粘贴保存即可'
  ] },
  other: { title: '电脑端 / 其他浏览器', lines: [
    '点页面底部「存入通讯录」，弹出名片信息',
    '点「一键复制名片信息」',
    '到通讯录 / Outlook 新建联系人，粘贴保存即可'
  ] }
}
// 保存名片到通讯录本就不需要登录（登录用户/访客一样能存），步骤文案不提登录状态（2026-11-27 用户定稿）
const contactSteps = computed(() => CONTACT_STEPS[deviceEnvKey] || CONTACT_STEPS.other)

// 微信内显示「去浏览器打开」引导前，尝试把登录凭证写进当前 URL，外部浏览器打开即免二次登录。
// 未登录访客（含非注册用户）拿不到 ticket——记录结果，文案据实说明，不能谎称已带登录态。
async function showGuide(kind) {
  guideWithLogin.value = isWeChat() ? !!(await prepareExternalOpen(api)) : false
  guide.value = kind
}
// 引导看完即抹掉地址栏上的一次性登录凭证：避免用户紧接着用微信「···」转发时把 ticket 带出去
function closeGuide() {
  guide.value = ''
  const u = new URL(windowRef.location.href)
  if (u.searchParams.has('wx_ticket')) {
    u.searchParams.delete('wx_ticket')
    windowRef.history.replaceState(null, '', u.toString())
  }
}

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get(qrApi.value)
    card.value = data.data
    currentTheme.value = THEMES[data.data.theme] ? data.data.theme : 'ocean'
    template.value = data.data.template || 'contact'
    // owner 页（/me）同样要配置微信分享卡片：微信「···」原生转发取的是这里配的 link，
    // 不配就会把当前 /me 链接发出去 → 别人打开被守卫踢去登录，登录后看到「我的名片页」。
    // 口径与工作台共用 setCardShare（唯一真相源）。
    // 分享缩略图口径（2026-11-26 定稿）：服务端名片「身份卡区域」图 → 公司LOGO → 用户头像 → 项目LOGO → 分享池。
    // share.png 按名片页顶部身份卡重绘（头像左+姓名/职位/公司/标签+右上本人美化码），setCardShare 会带主题配色，
    // 一眼认出是谁的名片；公开接口无需登录、webp 头像也能内联渲染，访客转发一样生效。
    if (full) setCardShare(api, card.value, publicLink.value, `${qrApi.value}/share.png`)
    if (!embed && !owner && auth.token) {
      try {
        const mine = await api.get('/api/cards/mine')
        hasOwnCard.value = !!mine.data.data
        isOwner.value = mine.data.data?.slug === slug.value
      } catch { /* 忽略：请求失败保持 hasOwnCard=false，引导仍显示，不误伤 */ }
      if (!isOwner.value) {
        try { favorite.value = !!(await api.get(`${qrApi.value}/favorite`)).data.data?.favorite } catch { /* 忽略 */ }
      }
    }
    // 工作台「我的名片二维码」跳过来：弹名片地址码，微信扫开名片页后再存入通讯录
    if (String(route.query.save) === '1') {
      qrModal.value = true
      // save 是一次性展示参数，清掉它和可能残留的登录凭证，避免被原生转发带出去
      const u = new URL(windowRef.location.href)
      let changed = false
      for (const k of ['save', 'wx_ticket']) if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true }
      if (changed) windowRef.history.replaceState(null, '', u.toString())
    }
    // 联系人码落地（2026-11-27）：扫码 URL 带 contact=1 → 名片页加载完自动弹「存入通讯录」入口。
    // 读真实 URL 而非 route.query：replaceState 后 vue-router 的 query 不会更新，切名片重跑 load 会重复弹。
    // 只删 contact，不碰 wx_ticket（微信内「去浏览器打开」的一次性凭证由 closeGuide 负责清）。
    {
      const u = new URL(windowRef.location.href)
      if (u.searchParams.get('contact') === '1') {
        contactAutoOpen.value = true
        u.searchParams.delete('contact')
        windowRef.history.replaceState(null, '', u.toString())
      }
    }
  } catch (e) { error.value = e.message } finally { loading.value = false }
  // 资料夹是名片正文的一部分：owner 预览也要拉，否则「公司相册」在 /me 永远空白。
  // 嵌入预览（只裁头部的旧用法）才整段跳过。失败静默不阻塞主流程。
  if (!embed) {
    try { materialsList.value = (await api.get(`${qrApi.value}/materials`)).data.data?.list || [] } catch { /* 忽略 */ }
  }
  // 浏览上报仅公开页：owner/embed 不污染访问统计
  if (!embed && !owner) traceVisit()
}
async function traceVisit() {
  try {
    const src = String(route.query.src || '')
    // 只读已缓存位置，不主动触发定位授权（看名片不该弹定位框）；
    // 默认城市兜底不算真实定位，不上报，避免把未授权访客都记成「上海」脏数据
    let city = ''
    try { const p = getCachedPosition(); city = p.source && p.source !== 'default' ? (p.city || '') : '' } catch { /* 无缓存 */ }
    if (src || city) await api.post(`${qrApi.value}/trace`, { source: src, city })
  } catch { /* 上报失败静默 */ }
}
onMounted(() => {
  load()
  // 样式选项独立启动，挂在 load 链尾会被前置请求拖住（同密钥加载教训）
  loadQrStyles().then(s => { colorOpts.value = s.colors })
})
// 同组件参数变化（名片夹连续看 /c/a → /c/b）：组件复用不会重新 mounted，
// 必须重置跟随名片的状态再重新加载，否则第二张名片显示第一张的内容。
watch(slug, () => {
  card.value = null
  materialsList.value = []
  qrModal.value = false; guide.value = ''; exchangeOpen.value = false
  mapOpen.value = false; moreOpen.value = false; galleryIndex.value = -1
  dockMode.value = 'main'
  favorite.value = false; isOwner.value = false; hasOwnCard.value = false; mySlug.value = ''
  windowRef.scrollTo?.(0, 0)
  load()
})

function tel(v) { if (v) windowRef.location.href = `tel:${v}`; else showToast('尚未填写电话') }
function sms(v) { if (v) windowRef.location.href = `sms:${v}`; else showToast('尚未填写手机号') }
function mailto(v) { if (v) windowRef.location.href = `mailto:${v}`; else showToast('尚未填写邮箱') }
function openMapSheet() {
  if (!maps.value.length) return showToast('尚未填写地址')
  mapOpen.value = true
}
// 地图图标：直接用各家 App Store 上架的官方图标（client/public/maps/*.png，本地静态资源）。
// simple-icons 那种单色剪影和真实 App 图标对不上，用户看不出来是哪家；这里只做「点开即用该地图」的指示性使用。
const MAP_ICON_KEYS = ['amap', 'baidu', 'qq', 'apple', 'google']
function mapIcon(key) {
  const k = MAP_ICON_KEYS.includes(key) ? key : 'amap'
  return `${import.meta.env.BASE_URL}maps/${k}.png`
}
async function copy(v, label) {
  if (!v) return showToast(`尚未填写${label}`)
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(v)
    else {
      const ta = document.createElement('textarea')
      ta.value = v; ta.style.cssText = 'position:fixed;left:-9999px;opacity:0'
      document.body.appendChild(ta); ta.select()
      const ok = document.execCommand('copy'); document.body.removeChild(ta)
      if (!ok) throw new Error('copy failed')
    }
    showToast(`${label}已复制`, 'success')
  } catch { showToast(`复制失败，${label}：${v}`) }
}
async function saveQr() {
  guideImage.value = ''
  // 保存当前 tab 的码：联系人码（名片页 URL + contact=1，扫=打开页面弹存通讯录入口）或链接码；一律纯黑白标准码
  const isVcard = qrMode.value === 'vcard'
  const r = await saveImageUrl(
    scanQrUrl(slug.value, isVcard ? 'vcard.png' : 'qr.png', 900) + '&plain=1',
    `${slug.value}-${isVcard ? '名片码' : '二维码'}.png`
  )
  if (r.kind === 'longpress') { await showGuide('qr'); return }
  showToast(r.kind === 'downloaded' ? '二维码已开始下载' : '已打开二维码，请长按保存', 'success')
}
// 复制名片里的关键信息（不下载任何文件）：安卓 intent 拉不起通讯录时的兜底，用户复制到通讯录新建即可。
const contactCopyText = computed(() => {
  const c = card.value || {}
  const lines = [['姓名', c.name || c.name_en], ['公司', c.company], ['职位', [c.title, c.department].filter(Boolean).join(' · ')], ['手机', c.mobile || c.phone], ['邮箱', c.email]]
  return lines.filter(([, v]) => v).map(([k, v]) => `${k}：${v}`).join('\n')
})
async function copyContactInfo() {
  if (!contactCopyText.value) return
  await copy(contactCopyText.value, '名片信息')
  contactFallbackOpen.value = false
  showToast('已复制，去通讯录新建联系人粘贴即可', 'success')
}

let contactLeftPage = false
async function saveContact() {
  if (!card.value) return
  if (isWeChat()) { await showGuide('contact'); return }
  if (/Android|Adr/i.test(navigator.userAgent)) {
    // 安卓：intent 拉起预填的添加联系人界面。若 1.2s 内页面没进入后台（说明 intent 没拉起），
    // 弹「复制基本信息」卡片兜底——全程不下载 VCF，个别机型照样能存。
    contactLeftPage = false
    const markLeft = () => {
      if (document.visibilityState === 'hidden') contactLeftPage = true
    }
    document.addEventListener('visibilitychange', markLeft)
    window.addEventListener('pagehide', () => { contactLeftPage = true })
    window.location.href = contactHref.value
    setTimeout(() => {
      document.removeEventListener('visibilitychange', markLeft)
      if (!contactLeftPage && document.visibilityState === 'visible') contactFallbackOpen.value = true
    }, 1200)
    return
  }
  if (isIOS()) {
    // iOS Safari：.vcf 直链弹系统「添加联系人」界面（服务端按 UA 去掉 attachment）。
    openVcfInline(vcfApi.value)
    return
  }
  // PC / 鸿蒙 / 其它：不下载，直接弹复制信息卡片
  contactFallbackOpen.value = true
}
async function doShare() {
  if (isWeChat()) {
    showToast('已设为名片卡片：点右上角「···」→ 发送给朋友 / 分享到朋友圈', 'error')
    return
  }
  // 复制出去的必须是干净的公开名片地址，绝不能是带 wx_ticket/save 的地址栏 URL
  const r = await shareOrCopy({ title: card.value?.name || '电子名片', text: card.value?.title || '扫一扫保存我的名片', url: publicLink.value })
  if (r === 'copied') showToast('链接已复制，快分享给朋友', 'success')
  else if (r === 'failed') showToast('复制失败，请手动复制地址栏链接', 'error')
}
function openExchange() {
  if (isOwner.value && card.value) mySlug.value = slug.value
  exchangeOpen.value = true
}
async function doExchange() {
  if (!mySlug.value) return showToast('请填写你的名片短码')
  exchanging.value = true
  try {
    await api.post(`${qrApi.value}/exchange`, { slug: mySlug.value })
    showToast('交换成功，已在双方记录中留存', 'success')
    exchangeOpen.value = false
  } catch (e) { showToast(e.message, 'error') } finally { exchanging.value = false }
}
async function toggleFavorite() {
  if (favBusy.value) return
  if (!auth.token) return showToast('请先登录再收藏名片', 'error')
  if (isOwner.value) return showToast('不能收藏自己的名片')
  favBusy.value = true
  try {
    const { data } = await api.post(`${qrApi.value}/favorite`)
    favorite.value = !!data.data?.favorite
    showToast(favorite.value ? '已收藏到我的名片夹' : '已取消收藏', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { favBusy.value = false }
}
</script>


