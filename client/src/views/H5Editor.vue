<template>
  <!-- 宣传页编辑器（/me/h5/:id）——2026-11-27 用户定稿重构：
       单页单页做 + 所见即所得：画布即当前页的真实渲染（H5Render 编辑模式，点任意块选中、
       琥珀虚线描边、块内动作短路），内容表单在底部弹层里改、画布实时刷新；
       底部操作条与名片工作台 dock 同款四态翻转：main=编辑块/页面/配色/发布，
       点任一键整行翻转出选项行（点中即改、面板不关可连试），↙ 收起回主行。
       发布仅等同保存草稿（2026-11-28 用户定稿：发布≠上架，编辑器无上架菜单）；上架/下架/关联名片/复制链接在宣传页列表页管理。
       2026-11-27 编辑体验一流化（用户反馈「要自由拖动、一些动作」）：
       ① 画布长按块 350ms 拖动排序（跟手 + 命中即重排，H5Render emit reorder 落数组）；
       ② 块入场动效可选（BottomSelect，公开页进入视口自动播放）；
       ③ 加块插到选中块之后（不再固定尾部）、新增复制块；
       ④ 按钮动作原 <select> 违规改 BottomSelect（H5 下拉必须 BottomSelect 约束），动作新增「复制文本」。 -->
  <div class="he" :class="{ 'he-preview': previewMode }">
    <!-- 预览（?preview=1）= 访客视角：编辑器顶栏/操作条/画布留白全部退出，内容四边贴满视口，
         只留左上 ✕ 浮标退出回编辑器（2026-11-28 用户定稿「预览要像其它用户在看的那种体验」） -->
    <header v-if="!previewMode" class="he-top">
      <button class="he-back" @click="router.push('/me/h5')">‹</button>
      <input v-model="title" class="he-title" placeholder="宣传页标题" @input="markDirty" />
      <button class="he-back" :disabled="!canUndo" @click="undo" aria-label="撤销">↶</button>
      <button class="he-back" :disabled="!canRedo" @click="redo" aria-label="重做">↷</button>
      <span class="he-save small muted">{{ saveState }}</span>
    </header>
    <button v-else class="he-exit" @click="exitPreview" aria-label="退出预览">✕</button>

    <!-- 画布：编辑模式只渲染当前编辑页（点选/拖动/四角缩放/旋转）；预览模式（?preview=1，2026-11-28 用户定稿
         「预览不改」）渲染全部页面、可滑动翻页、无编辑手势与 dock -->
    <div class="he-canvas" v-if="loaded">
      <div class="he-canvas-in">
        <!-- page-offset：画布只渲染当前页，offset 让块的 key 与真实页号对齐（选中态/拖动不串页）；
             编辑态 key=selPage：切页重挂载播放入场动画（预览/公开页走翻页动效，编辑画布单页靠这个有翻页感） -->
        <H5Render ref="renderEl" :key="previewMode ? 'preview' : selPage" class="he-page-anim" :data="previewMode ? previewData : curPageData" :editable="!previewMode" :page-offset="selPage" :sel-key="selKey" @pick="onPick" @reorder="onReorder" @quick="onQuick" @inplace="markDirty" @geom="markDirty" @addtext="addBlock('text')" />
      </div>
      <div v-if="!previewMode" class="he-hint small muted">每页一屏 · 内容多了点「页面 → 加一页」 · 点选元素 · 拖动移动 · 四角缩放 · 再点改内容{{ block ? ` · 当前：第 ${selPage + 1} 页 ${TYPE_LABEL[block.type]}` : '' }}</div>
    </div>
    <div v-else class="he-loading">加载中…</div>

    <!-- dock 四态翻转（与名片工作台同款交互）；预览模式整条隐藏 -->
    <div v-if="!previewMode" :class="['he-dock', { 'he-dock-flip': dockMode !== 'main' }]">
      <template v-if="dockMode === 'main'">
        <button class="he-dock-btn primary" @click="dockMode = 'edit'">✎ 编辑块</button>
        <button class="he-dock-btn" @click="dockMode = 'pages'">▦ 页面</button>
        <button class="he-dock-btn" @click="dockMode = 'theme'">◑ 配色</button>
        <button class="he-dock-btn" @click="dockMode = 'pub'">⇪ 发布</button>
      </template>
      <template v-else>
        <button class="he-dock-back" @click="dockMode = 'main'" aria-label="收起，返回主操作条">↙</button>
        <div class="he-dock-scroll">
          <div class="he-dock-flow">
            <!-- 编辑行（自由画布，2026-11-27 用户定稿）：选中元素 → 上下文调节选项（点中即改，› 为循环切换）；
                 未选中 → 加元素。透明度/层级/行高/完整属性在「⋯ 属性」面板 -->
            <template v-if="dockMode === 'edit'">
              <template v-if="block">
                <span class="he-grp">{{ TYPE_LABEL[block.type] }}</span>
                <!-- 文本：字体/字号/粗体/对齐/颜色 -->
                <template v-if="block.type === 'text'">
                  <button class="he-chip" @click="cycleFont">字·{{ fontLabel }} ›</button>
                  <button class="he-chip" @click="stepSize(-4)" :disabled="Number(block.size) <= 12">A−</button>
                  <button class="he-chip" @click="stepSize(4)" :disabled="Number(block.size) >= 160">A＋</button>
                  <button class="he-chip" :class="{ on: block.bold }" @click="block.bold = !block.bold; markDirty()">B 粗体</button>
                  <button class="he-chip" @click="cycleAlign">{{ alignLabel }} ›</button>
                  <span class="he-grp">颜色</span>
                  <button v-for="c in EL_COLORS" :key="'t' + c" class="he-dot he-dot-sm" :class="{ on: block.color === c }" :style="{ background: c }" @click="block.color = c; markDirty()"></button>
                </template>
                <!-- 图片：换图/圆角/适配 -->
                <template v-else-if="block.type === 'image'">
                  <button class="he-chip" @click="openImageSheet">▣ 换图</button>
                  <button class="he-chip" @click="stepRadius(-8)" :disabled="Number(block.radius) <= 0">圆角−</button>
                  <button class="he-chip" @click="stepRadius(8)" :disabled="Number(block.radius) >= 200">圆角＋</button>
                  <button class="he-chip" @click="block.fit = block.fit === 'contain' ? 'cover' : 'contain'; markDirty()">{{ block.fit === 'contain' ? '完整显示 ›' : '裁切填满 ›' }}</button>
                </template>
                <!-- 形状：形状循环/填充色/圆角 -->
                <template v-else-if="block.type === 'shape'">
                  <button class="he-chip" @click="cycleShape">{{ shapeLabel }} ›</button>
                  <span class="he-grp">填充</span>
                  <button v-for="c in EL_COLORS" :key="'s' + c" class="he-dot he-dot-sm" :class="{ on: block.color === c }" :style="{ background: c }" @click="block.color = c; markDirty()"></button>
                  <template v-if="block.shape !== 'circle'">
                    <button class="he-chip" @click="stepRadius(-8)" :disabled="Number(block.radius) <= 0">圆角−</button>
                    <button class="he-chip" @click="stepRadius(8)" :disabled="Number(block.radius) >= 400">圆角＋</button>
                  </template>
                </template>
                <!-- 按钮：填充色/文字色/圆角（文字与动作进属性面板） -->
                <template v-else-if="block.type === 'button'">
                  <span class="he-grp">填充</span>
                  <button v-for="c in EL_COLORS" :key="'b' + c" class="he-dot he-dot-sm" :class="{ on: block.bg === c }" :style="{ background: c }" @click="block.bg = c; markDirty()"></button>
                  <span class="he-grp">文字色</span>
                  <button v-for="c in EL_COLORS" :key="'bc' + c" class="he-dot he-dot-sm" :class="{ on: block.color === c }" :style="{ background: c }" @click="block.color = c; markDirty()"></button>
                  <button class="he-chip" @click="stepRadius(-8)" :disabled="Number(block.radius) <= 0">圆角−</button>
                  <button class="he-chip" @click="stepRadius(8)" :disabled="Number(block.radius) >= 400">圆角＋</button>
                </template>
                <!-- 通用：入场动效循环 + 完整面板 + 复制/删除（行尾加「操作」组标签，样式调节与结构操作分开） -->
                <button class="he-chip" @click="cycleAnim">动·{{ animLabel }} ›</button>
                <button class="he-chip on" @click="openEdit">{{ FREE_TYPES.includes(block.type) ? '⋯ 属性' : '✎ 编辑内容' }}</button>
                <span class="he-grp">操作</span>
                <button class="he-chip" @click="duplicateBlock" :disabled="curEls.length >= 40">⧉ 复制</button>
                <button class="he-chip warn" @click="removeBlock">✕ 删除</button>
              </template>
              <template v-else>
                <span class="he-grp">自由元素</span>
                <button v-for="t in ADDABLE_FREE" :key="t" class="he-chip" @click="addBlock(t)">＋{{ TYPE_LABEL[t] }}</button>
                <span class="he-grp">功能组件</span>
                <button v-for="t in ADDABLE_COMP" :key="t" class="he-chip" @click="addBlock(t)">＋{{ TYPE_LABEL[t] }}</button>
              </template>
            </template>
            <!-- 页面行（页面结构层）：切页 / 加删页 / 本页背景 / 背景音乐 / 整套模板 / 翻页动效——
                 整页级设置统一收在这行（2026-11-28 用户定稿「音乐和翻页这些应该放一起」），
                 不与全局配色混放；背景音乐是整套唯一的整页组件（选曲跨页收敛，「不用音乐」全清） -->
            <template v-else-if="dockMode === 'pages'">
              <button v-for="(p, i) in schema.pages" :key="i" :class="['he-chip', { on: i === selPage }]" @click="selPage = i; selBlock = 0">第{{ i + 1 }}页·{{ elsCount(p) }}元素</button>
              <button v-if="pagesCount < maxPages" class="he-chip on" @click="pageAddOpen = true">＋ 加一页</button>
              <button v-else class="he-chip" @click="showToast(paid ? `最多 ${maxPages} 页` : `免费版最多 ${maxPages} 页，开通套餐解锁`, 'error')">已达上限</button>
              <button v-if="pagesCount > 1" class="he-chip warn" @click="pageDelConfirm = true">✕ 删本页</button>
              <span class="he-grp">本页</span>
              <button class="he-chip" @click="openBg">◧ 页面背景</button>
              <span class="he-grp">背景音乐</span>
              <BottomSelect :model-value="musicModel" :options="MUSIC_PRESETS" title="背景音乐（整套宣传页同一首）" @update:modelValue="onMusicPick" />
              <span class="he-grp">整页模板</span>
              <button class="he-chip" @click="openTpls">套用官方模板…</button>
              <span class="he-grp">整页动效</span>
              <BottomSelect :model-value="schema.transition || 'auto'" :options="TRANSITION_OPTS" title="页面切换动效" @update:modelValue="schema.transition = $event; markDirty()" />
            </template>
            <!-- 配色行（全局视觉层）：主题色 + 整套配色，纯视觉调节 -->
            <template v-else-if="dockMode === 'theme'">
              <span class="he-grp">主题色</span>
              <button v-for="c in COLORS" :key="c" :class="['he-dot', { on: (schema.accent || '') === c }]" :style="{ background: c }" @click="setAccent(c)"></button>
              <span class="he-grp">整套配色</span>
              <button class="he-chip" @click="palOpen = true">一键换全套 ›</button>
            </template>
            <!-- 发布行（2026-11-28 用户定稿）：编辑器只有「发布」=保存草稿，不承担上架；
                 上架/更新上架/下架/关联名片/复制链接都在宣传页列表页管理 -->
            <template v-else>
              <span :class="['he-status', { on: saveState.startsWith('✓') }]">{{ saveState || '改动会自动保存' }}</span>
              <button class="he-chip on" :disabled="publishing" @click="publish">{{ publishing ? '发布中…' : '⇪ 发布' }}</button>
            </template>
          </div>
        </div>
      </template>
    </div>

    <!-- 选中块内容编辑弹层：v-model 直绑块字段，画布实时刷新（所见即所得） -->
    <BottomSheet :show="formOpen" @update:show="formOpen = $event">
      <div class="he-form" v-if="block">
        <div class="he-f-head">
          <b>{{ TYPE_LABEL[block.type] }}</b>
          <span class="he-f-actions">
            <button class="he-mini" @click="duplicateBlock(); formOpen = false" :disabled="curEls.length >= 40">⧉ 复制</button>
            <button class="he-mini danger" @click="removeBlock(); formOpen = false">✕ 删除</button>
            <button class="he-mini" @click="formOpen = false">完成</button>
          </span>
        </div>
        <template v-if="block.type === 'cover'">
          <label>主标题<input v-model="block.title" maxlength="40" @input="markDirty" placeholder="一句话吸引点进来" /></label>
          <label>副标题<input v-model="block.subtitle" maxlength="60" @input="markDirty" placeholder="公司名 / 一句补充" /></label>
          <ImageField v-model="block.cover" label="封面背景图（不传用主题色渐变）" @update:modelValue="markDirty" />
        </template>
        <template v-else-if="block.type === 'text'">
          <label>小标题<input v-model="block.heading" maxlength="40" @input="markDirty" /></label>
          <label>正文<textarea v-model="block.body" rows="6" maxlength="1200" @input="markDirty" placeholder="支持换行"></textarea></label>
          <div class="he-row"><span class="small muted">文字对齐</span>
            <BottomSelect :model-value="block.align || 'left'" :options="TEXT_ALIGN_OPTS" title="文字对齐" @update:modelValue="block.align = $event; markDirty()" />
          </div>
          <div class="he-row"><span class="small muted">文字大小</span>
            <BottomSelect :model-value="block.size || 'md'" :options="TEXT_SIZE_OPTS" title="文字大小" @update:modelValue="block.size = $event; markDirty()" />
          </div>
        </template>
        <template v-else-if="block.type === 'hero'">
          <ImageField v-model="block.image" label="图片" @update:modelValue="markDirty" />
          <label>标题<input v-model="block.title" maxlength="40" @input="markDirty" /></label>
          <label>描述<textarea v-model="block.desc" rows="3" maxlength="300" @input="markDirty"></textarea></label>
        </template>
        <template v-else-if="block.type === 'gallery'">
          <div class="he-sec">排列与来源</div>
          <div class="he-row"><span class="small muted">排列方式</span>
            <BottomSelect v-model="block.layout" :options="GAL_LAYOUT_OPTS" title="图集排列方式" @update:modelValue="markDirty" />
          </div>
          <div class="he-row"><span class="small muted">图片来源</span>
            <button class="he-btn ghost sm" @click="block.source = block.source === 'card' ? 'upload' : 'card'; markDirty()">{{ block.source === 'card' ? '公司相册（自动同步）' : '手动上传' }}</button>
          </div>
          <p v-if="block.source === 'card'" class="small muted" style="margin:0 0 8px">图片自动来自名片页「公司相册」，在名片里上传一次，这里与名片页两处同步展示、无需重复传图。</p>
          <template v-else>
            <div class="he-sec">图片位</div>
            <div v-for="(img, gi) in block.images" :key="gi" class="he-gal-row">
              <ImageField v-model="block.images[gi]" @update:modelValue="markDirty" />
              <button class="he-mini danger" @click="block.images.splice(gi, 1); markDirty()">✕</button>
            </div>
            <button v-if="block.images.length < 9" class="he-btn ghost block" @click="block.images.push(''); markDirty()">＋ 添加图片位</button>
          </template>
        </template>
        <template v-else-if="block.type === 'contact'">
          <p class="small muted" style="margin:0 0 8px">联系方式自动来自你的名片资料，这里只控制展示项。</p>
          <label class="he-switch"><input type="checkbox" v-model="block.showMobile" @change="markDirty" />展示电话（可拨打）</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showWechat" @change="markDirty" />展示微信号（点击复制）</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showAddress" @change="markDirty" />展示地址</label>
        </template>
        <template v-else-if="block.type === 'map'">
          <label>位置名称<input v-model="block.label" maxlength="80" @input="markDirty" placeholder="如：XX市XX区XX路XX号" /></label>
          <div class="he-row" style="gap:8px">
            <button class="he-btn ghost" @click="mapOpen = true">📍 地图选点</button>
            <button v-if="Number.isFinite(+block.lat) && Number.isFinite(+block.lng)" class="he-btn ghost" @click="block.lat = null; block.lng = null; markDirty()">清除坐标</button>
          </div>
          <p v-if="Number.isFinite(+block.lat) && Number.isFinite(+block.lng)" class="small" style="margin:4px 0 0;color:#16a34a">已选坐标：{{ (+block.lat).toFixed(5) }}, {{ (+block.lng).toFixed(5) }} · 访客导航直达此点</p>
          <p v-else class="small muted" style="margin:4px 0 0">未选点时，访客点「导航到这里」按位置名称搜索。建议选点，导航更精准。</p>
        </template>
        <template v-else-if="block.type === 'buttons'">
          <div v-for="(it, ii) in block.items" :key="ii" class="he-btn-edit">
            <label>按钮文字<input v-model="it.label" maxlength="12" @input="markDirty" /></label>
            <label>动作
              <!-- 原生 select 违反「H5 下拉必须 BottomSelect」约束，已换统一底部弹窗选择器 -->
              <BottomSelect v-model="it.action" :options="ACTION_OPTS" title="按钮动作" @update:modelValue="markDirty" />
            </label>
            <label>{{ ACTION_VALUE_LABEL[it.action] || '内容' }}<input v-model="it.value" @input="markDirty" /></label>
            <button class="he-mini danger" @click="block.items.splice(ii, 1); markDirty()">删除此按钮</button>
          </div>
          <button v-if="block.items.length < 3" class="he-btn ghost block" @click="block.items.push({ label: '', action: 'tel', value: '' }); markDirty()">＋ 添加按钮</button>
        </template>
        <template v-else-if="block.type === 'video'">
          <label>视频地址<input v-model="block.url" @input="markDirty" placeholder="mp4 链接" /></label>
        </template>
        <template v-else-if="block.type === 'form'">
          <div class="he-sec">引导文案</div>
          <label>小标题<input v-model="block.heading" maxlength="40" @input="markDirty" placeholder="如：预约到店 / 留下您的需求" /></label>
          <label>说明文字<input v-model="block.desc" maxlength="120" @input="markDirty" placeholder="一句引导文案（选填）" /></label>
          <div class="he-sec">收集项</div>
          <label class="he-switch"><input type="checkbox" v-model="block.showName" @change="markDirty" />收集姓名</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showPhone" @change="markDirty" />收集电话</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showMessage" @change="markDirty" />收集留言</label>
          <div class="he-sec">提交设置</div>
          <label>按钮文字<input v-model="block.buttonText" maxlength="12" @input="markDirty" placeholder="提交" /></label>
          <label>提交成功提示<input v-model="block.successText" maxlength="60" @input="markDirty" placeholder="已收到，我们会尽快联系你" /></label>
          <p class="small muted" style="margin:0">访客提交后自动存入线索，可在宣传页列表「线索」里查看、复制电话回访。</p>
        </template>
        <template v-else-if="block.type === 'music'">
          <!-- 常用曲目统一在底部操作条「页面 → 背景音乐」选择（2026-11-28 用户定稿整页设置收拢页面行），
               这里只管自定义音频与播放方式，避免双入口口径不一致 -->
          <div class="he-sec">自定义音频</div>
          <label>音频地址<input v-model="block.url" @input="markDirty" placeholder="mp3 链接（需可公开访问）" /></label>
          <div class="he-sec">播放</div>
          <label class="he-switch"><input type="checkbox" v-model="block.autoplay" @change="markDirty" />访客打开页面自动播放</label>
          <audio v-if="block.url" :src="block.url" controls class="he-audio"></audio>
          <p class="small muted" style="margin:0 0 8px">常用曲目在底部操作条「页面 → 背景音乐」里选择。公开页以右下角 ♪ 按钮播放/暂停，手机浏览器禁止带声自动播放时，访客首次触摸页面后自动起播、循环播放。</p>
        </template>
        <template v-else-if="block.type === 'endcard'">
          <p class="small muted" style="margin:0">尾页自动展示你的名片卡与二维码，访客看完直接跳名片。{{ watermark ? '免费版尾页带品牌水印，开通套餐后自动去除。' : '当前套餐：无水印。' }}</p>
        </template>
        <!-- 通用：入场动效（所有块）。未设置=按块类型智能默认；公开页滚动到该块时自动播放 -->
        <div class="he-anim-row">
          <label>入场动效
            <BottomSelect v-model="block.anim" :options="ANIM_OPTS" title="入场动效" @update:modelValue="markDirty" />
          </label>
          <p class="small muted" style="margin:4px 0 0">访客浏览到这个模块时自动播放的小动画，让页面更生动。</p>
        </div>
      </div>
    </BottomSheet>

    <!-- 套用官方模板弹层：整页内容被替换（项目统一确认弹层二次确认），替换后从第 1 页继续单页编辑 -->
    <BottomSheet :show="tplOpen" @update:show="tplOpen = $event">
      <div class="he-form">
        <div class="he-f-head"><b>套用官方模板</b><button class="he-mini" @click="tplOpen = false">关闭</button></div>
        <p class="small muted" style="margin:0 0 10px">套用会<b>覆盖当前全部页面内容</b>（不可恢复），请先留存当前内容。</p>
        <div class="he-tpl-list">
          <button v-for="t in templates" :key="t.key" class="he-tpl" :disabled="applying" @click="applyTpl(t)">
            <span class="he-tpl-dot" :style="{ background: t.accent }"></span>
            <span class="he-tpl-t"><b>{{ t.name }}</b><span class="small muted">{{ t.industry }} · {{ t.desc }}</span></span>
            <i>›</i>
          </button>
        </div>
      </div>
    </BottomSheet>

    <!-- 覆盖确认（项目统一弹层，替代浏览器原生 confirm） -->
    <ConfirmDialog :show="!!tplConfirm" title="套用模板" :text="`套用「${tplConfirm?.name}」会覆盖当前全部页面内容，确定？`" confirm-text="套用" @confirm="confirmApplyTpl" @cancel="tplConfirm = null" />

    <!-- 删本页确认（整页级破坏性操作不静默） -->
    <ConfirmDialog :show="pageDelConfirm" title="删除本页" :text="`删除第 ${selPage + 1} 页的全部内容？删除后可用顶栏 ↶ 撤销。`" confirm-text="删除" danger @confirm="confirmRemovePage" @cancel="pageDelConfirm = false" />

    <!-- 加页选版式：预置成稿骨架，选完即切到新页 -->
    <BottomSheet :show="pageAddOpen" @update:show="pageAddOpen = $event">
      <div class="he-form">
        <div class="he-f-head"><b>添加页面</b><button class="he-mini" @click="pageAddOpen = false">关闭</button></div>
        <div class="he-tpl-list">
          <button v-for="l in PAGE_LAYOUTS" :key="l.key" class="he-tpl" @click="addPage(l.key); pageAddOpen = false">
            <span class="he-tpl-t"><b>{{ l.name }}</b><span class="small muted">{{ l.desc }}</span></span>
            <i>›</i>
          </button>
        </div>
      </div>
    </BottomSheet>

    <!-- 一键整套配色：色板行（左名称右色组预览），点中即应用 -->
    <BottomSheet :show="palOpen" @update:show="palOpen = $event">
      <div class="he-form">
        <div class="he-f-head"><b>整套配色</b><button class="he-mini" @click="palOpen = false">关闭</button></div>
        <p class="small muted" style="margin:0 0 10px">一键替换全页文字、形状与按钮的颜色，换错可用顶栏 ↶ 撤销。</p>
        <div class="he-tpl-list">
          <button v-for="p in PALETTES" :key="p.name" class="he-tpl" @click="applyPalette(p); palOpen = false">
            <span class="he-tpl-t"><b>{{ p.name }}</b></span>
            <span class="he-pal-dots">
              <i v-for="c in p.colors" :key="c" :style="{ background: c }"></i>
            </span>
            <i>›</i>
          </button>
        </div>
      </div>
    </BottomSheet>

    <!-- 换图弹层（2026-11-27 画布直操化）：快捷条「▣ 换图」直达，不进通用表单 -->
    <BottomSheet :show="imgOpen" @update:show="imgOpen = $event">
      <div class="he-form" v-if="block && imgField">
        <div class="he-f-head"><b>更换图片</b><button class="he-mini" @click="imgOpen = false">完成</button></div>
        <ImageField :model-value="block[imgField]" label="图片（不传用主题色渐变）" @update:modelValue="block[imgField] = $event; markDirty()" />
      </div>
    </BottomSheet>

    <!-- 属性面板（2026-11-27 自由画布）：自由元素（文本/图片/形状/按钮）的样式与几何都在这调；
         通用区（动效/透明度/层级）所有元素都有，组件元素另有「编辑内容」表单 -->
    <BottomSheet :show="styleOpen" @update:show="styleOpen = $event">
      <div class="he-form" v-if="block && block.g">
        <div class="he-f-head">
          <b>{{ TYPE_LABEL[block.type] }} 属性</b>
          <span class="he-f-actions">
            <button class="he-mini" @click="duplicateBlock(); styleOpen = false" :disabled="curEls.length >= 40">⧉ 复制</button>
            <button class="he-mini danger" @click="removeBlock(); styleOpen = false">✕ 删除</button>
            <button class="he-mini" @click="styleOpen = false">完成</button>
          </span>
        </div>
        <!-- 文本 -->
        <template v-if="block.type === 'text'">
          <div class="he-sec">内容</div>
          <label>文字内容<textarea v-model="block.text" rows="4" maxlength="300" @input="markDirty" placeholder="支持换行"></textarea></label>
          <div class="he-sec">样式</div>
          <div class="he-row"><span class="small muted">字体</span>
            <BottomSelect :model-value="block.font || ''" :options="FONT_OPTS" title="字体" @update:modelValue="block.font = $event; markDirty()" />
          </div>
          <div class="he-row"><span class="small muted">字号 {{ block.size }}px</span>
            <input class="he-range" type="range" min="12" max="160" step="1" :value="block.size" @input="block.size = Number($event.target.value); markDirty()" />
          </div>
          <div class="he-row"><span class="small muted">颜色</span></div>
          <div class="he-colors">
            <button v-for="c in EL_COLORS" :key="c" :class="['he-dot', { on: block.color === c }]" :style="{ background: c }" @click="block.color = c; markDirty()"></button>
          </div>
          <div class="he-row"><span class="small muted">对齐</span>
            <BottomSelect :model-value="block.align || 'left'" :options="TEXT_ALIGN_OPTS" title="文字对齐" @update:modelValue="block.align = $event; markDirty()" />
          </div>
          <div class="he-row"><span class="small muted">行高 {{ block.lh }}</span>
            <input class="he-range" type="range" min="1" max="3" step="0.1" :value="block.lh" @input="block.lh = Number($event.target.value); markDirty()" />
          </div>
          <label class="he-switch"><input type="checkbox" v-model="block.vertical" @change="markDirty" />竖排文字（中文海报风）</label>
          <label class="he-switch"><input type="checkbox" v-model="block.shadow" @change="markDirty" />文字阴影（图片上更清晰）</label>
          <label class="he-switch"><input type="checkbox" v-model="block.bold" @change="markDirty" />加粗</label>
        </template>
        <!-- 图片 -->
        <template v-else-if="block.type === 'image'">
          <div class="he-sec">图片</div>
          <ImageField v-model="block.url" label="图片" @update:modelValue="markDirty" />
          <div class="he-sec">呈现</div>
          <div class="he-row"><span class="small muted">适配方式</span>
            <BottomSelect :model-value="block.fit || 'cover'" :options="FIT_OPTS" title="图片适配" @update:modelValue="block.fit = $event; markDirty()" />
          </div>
          <div class="he-row"><span class="small muted">圆角 {{ block.radius }}px</span>
            <input class="he-range" type="range" min="0" max="200" step="1" :value="block.radius" @input="block.radius = Number($event.target.value); markDirty()" />
          </div>
        </template>
        <!-- 形状 -->
        <template v-else-if="block.type === 'shape'">
          <div class="he-sec">形状与填充</div>
          <div class="he-row"><span class="small muted">形状</span>
            <BottomSelect :model-value="block.shape || 'rect'" :options="SHAPE_OPTS" title="形状" @update:modelValue="block.shape = $event; markDirty()" />
          </div>
          <div class="he-row"><span class="small muted">填充色</span></div>
          <div class="he-colors">
            <button v-for="c in EL_COLORS" :key="c" :class="['he-dot', { on: block.color === c }]" :style="{ background: c }" @click="block.color = c; markDirty()"></button>
          </div>
          <div class="he-row" v-if="block.shape !== 'circle'"><span class="small muted">圆角 {{ block.radius }}px</span>
            <input class="he-range" type="range" min="0" max="400" step="1" :value="block.radius" @input="block.radius = Number($event.target.value); markDirty()" />
          </div>
        </template>
        <!-- 按钮 -->
        <template v-else-if="block.type === 'button'">
          <div class="he-sec">内容</div>
          <label>按钮文字<input v-model="block.label" maxlength="12" @input="markDirty" /></label>
          <label>动作
            <BottomSelect v-model="block.action" :options="ACTION_OPTS" title="按钮动作" @update:modelValue="markDirty" />
          </label>
          <label>{{ ACTION_VALUE_LABEL[block.action] || '内容' }}<input v-model="block.value" @input="markDirty" /></label>
          <div class="he-sec">样式</div>
          <div class="he-row"><span class="small muted">填充色</span></div>
          <div class="he-colors">
            <button v-for="c in EL_COLORS" :key="c" :class="['he-dot', { on: block.bg === c }]" :style="{ background: c }" @click="block.bg = c; markDirty()"></button>
          </div>
          <div class="he-row"><span class="small muted">文字色</span></div>
          <div class="he-colors">
            <button v-for="c in EL_COLORS" :key="c" :class="['he-dot', { on: block.color === c }]" :style="{ background: c }" @click="block.color = c; markDirty()"></button>
          </div>
          <div class="he-row"><span class="small muted">圆角 {{ block.radius }}px</span>
            <input class="he-range" type="range" min="0" max="400" step="1" :value="block.radius" @input="block.radius = Number($event.target.value); markDirty()" />
          </div>
        </template>
        <!-- 通用（所有元素都有）：动效与层级单独成组，不与内容/样式混排 -->
        <div class="he-sec">动效与层级</div>
        <div class="he-anim-row">
          <label>入场动效
            <BottomSelect :model-value="block.anim || ''" :options="ANIM_OPTS" title="入场动效" @update:modelValue="block.anim = $event; markDirty()" />
          </label>
          <div class="he-row"><span class="small muted">透明度 {{ Math.round((block.g.opacity != null ? block.g.opacity : 1) * 100) }}%</span>
            <input class="he-range" type="range" min="0.1" max="1" step="0.05" :value="block.g.opacity != null ? block.g.opacity : 1" @input="block.g.opacity = Number($event.target.value); markDirty()" />
          </div>
          <div class="he-row"><span class="small muted">层级</span>
            <span class="he-f-actions">
              <button class="he-mini" @click="layerOp('top')">置顶</button>
              <button class="he-mini" @click="layerOp('up')">上移</button>
              <button class="he-mini" @click="layerOp('down')">下移</button>
              <button class="he-mini" @click="layerOp('bottom')">置底</button>
            </span>
          </div>
          <p class="small muted" style="margin:4px 0 0">访客浏览到这个元素时自动播放的小动画，让页面更生动。</p>
        </div>
      </div>
    </BottomSheet>

    <!-- 页面背景弹层（2026-11-27 自由画布）：本页背景图/背景色，背景图优先 -->
    <BottomSheet :show="bgOpen" @update:show="bgOpen = $event">
      <div class="he-form">
        <div class="he-f-head"><b>页面背景</b><button class="he-mini" @click="bgOpen = false">完成</button></div>
        <ImageField :model-value="curPage.bg && curPage.bg.image" label="背景图（优先于背景色）" @update:modelValue="setBg('image', $event)" />
        <div class="he-row"><span class="small muted">背景色（无背景图时生效）</span></div>
        <div class="he-colors">
          <button :class="['he-dot', 'he-dot-none', { on: !(curPage.bg && curPage.bg.color) }]" @click="setBg('color', '')">无</button>
          <button v-for="c in BG_COLORS" :key="c" :class="['he-dot', { on: (curPage.bg && curPage.bg.color) === c }]" :style="{ background: c }" @click="setBg('color', c)"></button>
        </div>
        <p class="small muted" style="margin:10px 0 0">不设置时使用默认深色背景。背景图建议 750×1334 以上竖图。</p>
      </div>
    </BottomSheet>

    <!-- 地图选点（复用名片编辑同款 MapPicker，懒加载；确认后坐标落 map 块，导航直达坐标点） -->
    <div v-if="mapOpen" class="map-mask" @click.self="mapOpen = false">
      <div class="map-modal">
        <div class="map-modal-head">
          <b>地图选点</b>
          <button class="he-mini" @click="mapOpen = false">关闭</button>
        </div>
        <MapPicker :lat="Number.isFinite(+block?.lat) ? +block.lat : null" :lng="Number.isFinite(+block?.lng) ? +block.lng : null" @confirm="onMapPicked" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, defineAsyncComponent, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import { reverseGeocode } from '../utils/geo'
import H5Render from '../components/H5Render.vue'
import ImageField from '../components/ImageField.vue'
import BottomSheet from '../components/BottomSheet.vue'
import BottomSelect from '../components/BottomSelect.vue'
// 地图选点懒加载（与名片编辑同口径）：打开选点弹层才下载 leaflet
const MapPicker = defineAsyncComponent(() => import('../components/MapPicker.vue'))
import ConfirmDialog from '../components/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()

const TYPE_LABEL = { cover: '封面', text: '文本', hero: '图文', image: '图片', shape: '形状', button: '按钮', gallery: '图集', contact: '联系方式', map: '位置', buttons: '按钮组', video: '视频', form: '表单留资', music: '背景音乐', endcard: '名片尾页' }
// 自由画布（2026-11-27 用户定稿上 MAKA 同款）：文本/图片/形状/按钮为自由元素，其余为组件元素（绝对定位复用原表单）
const FREE_TYPES = ['text', 'image', 'shape', 'button']
// 加元素清单分两组（2026-11-28 用户定稿「归类清晰、不能乱」）：自由元素=画布上直接摆的，
// 功能组件=带业务能力的块；音乐是整页级设置，在「页面 → 背景音乐」管理，不在清单里
const ADDABLE_FREE = ['text', 'image', 'shape', 'button']
const ADDABLE_COMP = ['gallery', 'contact', 'map', 'buttons', 'video', 'form', 'endcard']
// 加页版式（2026-11-28 取百家之长：竞品加页都给版式选择，不再是光秃秃一行标题）
const PAGE_LAYOUTS = [
  { key: 'title', name: '标题页', desc: '大字标题居中，适合开场 / 口号' },
  { key: 'image', name: '大图页', desc: '满幅图片 + 底部标题，视觉冲击' },
  { key: 'pic', name: '图文页', desc: '标题 + 图片 + 正文说明' },
  { key: 'gallery', name: '图集页', desc: '两列图集，适合案例 / 环境展示' },
  { key: 'form', name: '留资页', desc: '表单收集姓名电话，适合预约报名' },
  { key: 'vcard', name: '名片页', desc: '自动带入名片头像 / 姓名 / 电话 / 微信（竞品做不到的业务联动）' },
  { key: 'blank', name: '空白页', desc: '什么都不放，自由发挥' }
]
// 整套配色（2026-11-28 取百家之长：一键换全页文字/形状/按钮色，PPT 主题色同思路）。
// 每套 = [亮色(正文/白字映射), 主色(主题色), 辅助色, 深色]；映射按现有颜色出现频次排序，白字最多→亮色，保深底可读。
const PALETTES = [
  { name: '米白 × 绛红', colors: ['#f7ede2', '#a62b2b', '#d4a373', '#5c1f19'] },
  { name: '月白 × 黛蓝', colors: ['#eef3fa', '#2b5bb5', '#7fa8d9', '#122b57'] },
  { name: '暖白 × 松绿', colors: ['#f0f5ef', '#12897f', '#6fbfb4', '#0a3d38'] },
  { name: '杏白 × 橘棕', colors: ['#fdf3e7', '#c2410c', '#e8a26c', '#6b2a0a'] },
  { name: '雪白 × 玫粉', colors: ['#fdeef4', '#be185d', '#e77fab', '#6b1040'] },
  { name: '浅金 × 紫檀', colors: ['#f3eefa', '#7c2d92', '#b784c9', '#3b1560'] },
  { name: '灰白 × 石墨', colors: ['#f4f5f7', '#334155', '#94a3b8', '#0f172a'] },
  { name: '暖白 × 金棕', colors: ['#faf3e6', '#a16207', '#d4b16a', '#52360a'] }
]
// 页面切换过渡动效（2026-11-28 用户定稿「动效可设置 + 智能选型」）：智能为默认（渲染层按落点页内容挑最合适的过渡），旧「上下滚动」已并入智能不再单列
const TRANSITION_OPTS = [
  { value: 'auto', label: '智能（推荐）' },
  { value: 'slide', label: '滑动翻页' }, { value: 'fade', label: '淡入淡出' }, { value: 'flip', label: '翻页动效' }
]
// 常用背景音乐（2026-11-28 用户要求扩充并重制）：站内自产免版权合成曲，循环无缝；选中的直接当 block.url
const MUSIC_PRESETS = [
  { value: '/music/bgm-calm.wav', label: '悠扬舒缓' },
  { value: '/music/bgm-soothe.wav', label: '空灵舒缓' },
  { value: '/music/bgm-zen.wav', label: '禅意古风' },
  { value: '/music/bgm-romantic.wav', label: '浪漫柔美' },
  { value: '/music/bgm-light.wav', label: '清亮明快' },
  { value: '/music/bgm-warm.wav', label: '温暖治愈' },
  { value: '/music/bgm-business.wav', label: '沉稳大气' },
  { value: '/music/bgm-fresh.wav', label: '轻快活力' },
  { value: '', label: '不用音乐' }
]
// 入场动效选项（'' = 智能默认，与渲染层 animOf 的类型默认一致；none = 关闭）
const ANIM_OPTS = [
  { value: '', label: '默认（智能）' }, { value: 'none', label: '无动效' }, { value: 'up', label: '向上浮入' },
  { value: 'fade', label: '淡入' }, { value: 'zoom', label: '缩放入场' }, { value: 'left', label: '左侧滑入' }, { value: 'right', label: '右侧滑入' }
]
// 按钮动作（2026-11-27 新增 copy）：value 的语义随动作变化，输入框标签跟着换
const ACTION_OPTS = [{ value: 'tel', label: '拨打电话' }, { value: 'wechat', label: '复制微信号' }, { value: 'link', label: '打开链接' }, { value: 'copy', label: '复制文本' }]
const ACTION_VALUE_LABEL = { tel: '电话号码', wechat: '微信号（留空用名片微信号）', link: '链接地址', copy: '要复制的文本' }
// 图集排列：展播=自动轮播+动效（2026-11-27 相册 H5 动效展示），stagger=错落瀑布（2026-11-27 路线④），swipe/grid 为原静态布局
const GAL_LAYOUT_OPTS = [{ value: 'showcase', label: '动效展播（自动轮播）' }, { value: 'stagger', label: '错落瀑布' }, { value: 'swipe', label: '横滑大图' }, { value: 'grid', label: '两列网格' }]
// 文字基础样式（2026-11-27 路线④）：对齐 + 字号三档
const TEXT_ALIGN_OPTS = [{ value: 'left', label: '左对齐' }, { value: 'center', label: '居中' }, { value: 'right', label: '右对齐' }]
const TEXT_SIZE_OPTS = [{ value: 'sm', label: '小字' }, { value: 'md', label: '正常' }, { value: 'lg', label: '大字' }]
// 自由元素属性面板（2026-11-27 自由画布）：字体三档 / 形状 / 图片适配 / 元素色板 / 页面背景色板
const FONT_OPTS = [{ value: '', label: '黑体（默认）' }, { value: 'serif', label: '衬线宋' }, { value: 'kaiti', label: '楷体' }]
const SHAPE_OPTS = [{ value: 'rect', label: '直角矩形' }, { value: 'round', label: '圆角矩形' }, { value: 'circle', label: '圆形' }, { value: 'line', label: '线条' }]
const FIT_OPTS = [{ value: 'cover', label: '裁切填满' }, { value: 'contain', label: '完整显示' }]
const EL_COLORS = ['#ffffff', '#000000', '#d1d5db', '#fbbf24', '#f87171', '#60a5fa', '#34d399', '#a78bfa']
const BG_COLORS = ['#101319', '#1c2029', '#0f172a', '#1e1b4b', '#3b0764', '#f4f6fb', '#ffffff']
// 主题色板：与名片模板色系呼应，点中即改全页 accent
const COLORS = ['#a62b2b', '#c2410c', '#b45309', '#0f766e', '#4338ca', '#17357c', '#7c2d92', '#be185d']
const FREE_MAX_PAGES = 3, PAID_MAX_PAGES = 12

const page = ref(null)
const title = ref('')
const schema = ref({ pages: [] })
const loaded = ref(false)
const selPage = ref(0)
const selBlock = ref(0)
const saveState = ref('')
const publishing = ref(false)
// dock 四态翻转 + 弹层
const dockMode = ref('main')
const formOpen = ref(false)
const styleOpen = ref(false) // 自由元素属性面板（2026-11-27 自由画布）
const bgOpen = ref(false) // 页面背景弹层
// 背景音乐（整页级组件，2026-11-28 用户定稿「音乐和翻页这些整页设置放一起」+
// 「整页组件元素整套只能设一个，不能每页都设」）：整套宣传页唯一——选曲跨页收敛，
// 音乐元素挂在哪一页都只算同一个 BGM（改它的 url、多余的清掉），没有才新建在当前页右上角
// （编辑画布的可视占位；公开页是右下浮动 ♪）；「不用音乐」全部移除。
// 模板智能配曲本来就是整套一首，不受影响。音乐不在「加元素」清单里。
const pageMusic = computed(() => {
  for (const p of schema.value.pages) for (const e of (p.els || [])) if (e.type === 'music') return e
  return null
})
const musicModel = computed(() => {
  const u = pageMusic.value?.url || ''
  return MUSIC_PRESETS.some(p => p.value === u) ? u : ''
})
function onMusicPick(v) {
  // 跨页收集全部 music 元素（历史数据/误操作可能多页各挂一个）
  const found = []
  schema.value.pages.forEach((p, pi) => (p.els || []).forEach((e, ei) => {
    if (e.type === 'music') found.push({ p, ei })
  }))
  if (v === '') {
    if (found.length) {
      for (let i = found.length - 1; i >= 0; i--) found[i].p.els.splice(found[i].ei, 1)
      markDirty()
    }
    return
  }
  if (found.length) {
    found[0].p.els[found[0].ei].url = v
    // 整套唯一：多余的音乐元素清掉
    for (let i = found.length - 1; i >= 1; i--) found[i].p.els.splice(found[i].ei, 1)
    markDirty()
    return
  }
  const arr = curEls.value
  let maxZ = 0
  for (const e of arr) maxZ = Math.max(maxZ, Number(e.g?.z) || 0)
  arr.push({ type: 'music', url: v, autoplay: true, anim: '', g: { x: 470, y: 30, w: 256, h: 74, rot: 0, opacity: 1, z: maxZ + 1 } })
  markDirty()
}
const tplOpen = ref(false)
const templates = ref([])
const applying = ref(false)
// 闸门口径展示：以服务端实测为准（保存超限会被拦），前端只做引导
const paid = ref(false)
const maxPages = ref(PAID_MAX_PAGES) // 前端只做引导，服务端强制
const watermark = ref(true)

const cardData = ref(null)
// 画布只渲染当前页（单页单页做），其余页在「页面」行切换。
// 自由画布：页内元素一律 els（打开旧 blocks 页时已自动转换），curEls 是当前页元素数组
const curPage = computed(() => schema.value.pages[selPage.value] || { els: [] })
const curEls = computed(() => curPage.value.els || [])
const curPageData = computed(() => ({ schema: { accent: schema.value.accent || '', transition: schema.value.transition || 'auto', pages: [curPage.value] }, card: cardData.value, watermark: watermark.value }))
// 只读预览（?preview=1）：全屏访客视角——渲染数据与公开页同源，草稿实时看；✕ 退出回编辑器
// （编辑器自动保存，退出重进即回到草稿。2026-11-28 用户定稿「预览要像其它用户在看的那种体验」）
const previewMode = route.query.preview === '1'
function exitPreview() { router.replace(`/me/h5/${route.params.id}`) }
const previewData = computed(() => ({ schema: schema.value, card: cardData.value, watermark: watermark.value }))
const selKey = computed(() => (selBlock.value >= 0 ? `${selPage.value}-${selBlock.value}` : ''))
const block = computed(() => curEls.value[selBlock.value] || null)
const pagesCount = computed(() => schema.value.pages.length)
const elsCount = p => (p && p.els ? p.els.length : 0)

// 快捷编辑（2026-11-27 用户定稿「像名片那样」，对齐名片工作台两段式）：
// 首点元素只选中（琥珀虚线描边，防误触）；再点同一个已选中元素直接开编辑（自由元素=属性面板、
// 组件元素=内容表单；文字类就地编辑在画布上双击完成）。点空白画布 = 取消选中。
function onPick(key) {
  if (!key) { selBlock.value = -1; return }
  const [pi, bi] = key.split('-').map(Number)
  if (selPage.value === pi && selBlock.value === bi && block.value) { openEdit(); return }
  selPage.value = pi
  selBlock.value = bi
  // 选中元素 → 工具栏自动变成该元素的调节选项（2026-11-27 用户定稿）
  if (dockMode.value !== 'edit') dockMode.value = 'edit'
}

// ---- 选中元素快捷调节（dock 上下文行，点中即改、› 为循环切换） ----
const fontLabel = computed(() => (FONT_OPTS.find(o => o.value === (block.value?.font || '')) || FONT_OPTS[0]).label)
function cycleFont() {
  const b = block.value; if (!b) return
  const i = FONT_OPTS.findIndex(o => o.value === (b.font || ''))
  b.font = FONT_OPTS[(i + 1) % FONT_OPTS.length].value
  markDirty()
}
function stepSize(d) {
  const b = block.value; if (!b) return
  b.size = Math.max(12, Math.min(160, (Number(b.size) || 32) + d))
  markDirty()
}
const alignLabel = computed(() => (TEXT_ALIGN_OPTS.find(o => o.value === (block.value?.align || 'left')) || TEXT_ALIGN_OPTS[0]).label)
function cycleAlign() {
  const b = block.value; if (!b) return
  const i = TEXT_ALIGN_OPTS.findIndex(o => o.value === (b.align || 'left'))
  b.align = TEXT_ALIGN_OPTS[(i + 1) % TEXT_ALIGN_OPTS.length].value
  markDirty()
}
function stepRadius(d) {
  const b = block.value; if (!b) return
  const max = b.type === 'shape' || b.type === 'button' ? 400 : 200
  b.radius = Math.max(0, Math.min(max, (Number(b.radius) || 0) + d))
  markDirty()
}
const shapeLabel = computed(() => (SHAPE_OPTS.find(o => o.value === (block.value?.shape || 'rect')) || SHAPE_OPTS[0]).label)
function cycleShape() {
  const b = block.value; if (!b) return
  const i = SHAPE_OPTS.findIndex(o => o.value === (b.shape || 'rect'))
  b.shape = SHAPE_OPTS[(i + 1) % SHAPE_OPTS.length].value
  markDirty()
}
const animLabel = computed(() => (ANIM_OPTS.find(o => o.value === (block.value?.anim || '')) || ANIM_OPTS[0]).label)
function cycleAnim() {
  const b = block.value; if (!b) return
  const i = ANIM_OPTS.findIndex(o => o.value === (b.anim || ''))
  b.anim = ANIM_OPTS[(i + 1) % ANIM_OPTS.length].value
  markDirty()
}
function openEdit() {
  const b = block.value
  if (!b) return
  if (FREE_TYPES.includes(b.type)) styleOpen.value = true
  else formOpen.value = true
}

let saveTimer = 0
function markDirty() {
  clearTimeout(saveTimer)
  scheduleSnap()
  saveState.value = '有未保存的修改…'
  saveTimer = setTimeout(save, 1200)
}
async function save(silent = true) {
  clearTimeout(saveTimer)
  try {
    await api.put(`/api/h5/${route.params.id}`, { title: title.value, schema: schema.value })
    saveState.value = '✓ 已自动保存'
  } catch (e) {
    saveState.value = '保存失败：' + (e?.message || '网络异常')
    if (!silent) showToast(saveState.value, 'error')
  }
}
// 发布 = 保存草稿（2026-11-28 用户定稿：发布不等于上架，编辑器不承担上架；上架在宣传页列表页）
async function publish() {
  if (publishing.value) return
  clearTimeout(saveTimer)
  publishing.value = true
  try {
    await save()
    showToast('已发布，内容已保存', 'success')
  } finally { publishing.value = false }
}

// ---- 转换页实测自愈（2026-11-28 用户反馈「模板元素错位不像故意设计的」）----
// blocks→els 转换按估高堆叠初稿，但组件/文本真实渲染高度自适应（g.h 只是声明框），估高偏差会让
// 后面的元素叠压前面的文字。渲染层量出每个元素的真实高度后回写 g.h 并自上而下重排——
// 只动「刚转换、用户还没编辑过」的页（relayoutPages 标记，排完即清），用户自己摆的布局绝不重排。
const renderEl = ref(null)
const relayoutPages = new Set()
function restackEls(els) {
  const order = els.map((e, i) => i).sort((a, b) => (Number(els[a].g?.y) || 0) - (Number(els[b].g?.y) || 0))
  for (let k = 1; k < order.length; k++) {
    const prev = els[order[k - 1]], cur = els[order[k]]
    cur.g.y = Math.min(29000, (Number(prev.g?.y) || 0) + (Number(prev.g?.h) || 0) + 26)
  }
}
function tryRelayout() {
  const r = renderEl.value
  if (!r || !r.measurePages || !relayoutPages.size) return
  let changed = false
  for (const pd of r.measurePages()) {
    if (!relayoutPages.has(pd.idx) || !pd) continue
    relayoutPages.delete(pd.idx)
    const els = schema.value.pages[pd.idx]?.els || []
    // 公开态隐藏块（没填联系方式的 contact 等 v-if 不渲染）数量对不上 → 放弃该页，绝不误排
    if (pd.heights.length !== els.length) continue
    els.forEach((e, i) => {
      if (!e.g) return
      const real = Math.round(pd.heights[i] / (pd.u || 1))
      if (real > 0 && Math.abs((Number(e.g.h) || 0) - real) > 2) { e.g.h = real; changed = true }
    })
    restackEls(els)
  }
  if (changed) markDirty()
}
watch(selPage, () => nextTick(tryRelayout))

// ---- 结构编辑（自由画布） ----
// 组件元素初始字段（gallery/contact/… 复用原内容表单）
function blank(type) {
  if (type === 'gallery') return { type, images: [''], layout: 'grid', source: 'upload' }
  if (type === 'contact') return { type, showMobile: true, showWechat: true, showAddress: true }
  if (type === 'map') return { type, lat: null, lng: null, label: '' }
  if (type === 'buttons') return { type, items: [{ label: '', action: 'tel', value: '' }] }
  if (type === 'video') return { type, url: '', poster: '' }
  if (type === 'form') return { type, heading: '', desc: '', showName: true, showPhone: true, showMessage: true, buttonText: '提交', successText: '' }
  if (type === 'music') return { type, url: '', autoplay: true }
  return { type: 'endcard' }
}
// 组件元素估高（转换/新增时的初始几何；渲染时组件高度自适应）
const EST_H = { gallery: 520, contact: 260, map: 220, buttons: 200, video: 280, form: 620, music: 160, endcard: 340 }
// 新元素落点：已有元素排完的下方；z 取当前最大 + 1
function nextG(h) {
  const els = curEls.value
  let maxY = 60, maxZ = 0
  for (const e of els) {
    const g = e.g || {}
    maxY = Math.max(maxY, (Number(g.y) || 0) + (Number(g.h) || 0))
    maxZ = Math.max(maxZ, Number(g.z) || 0)
  }
  return { x: 22, y: Math.min(29000, maxY + 30), w: 706, h, rot: 0, opacity: 1, z: maxZ + 1 }
}
function blankEl(type) {
  const anim = ''
  if (type === 'text') return { type, text: '点我编辑文字', size: 32, color: '#ffffff', align: 'left', bold: false, font: '', lh: 1.5, anim, g: nextG(60) }
  if (type === 'image') return { type, url: '', radius: 20, fit: 'cover', anim, g: nextG(260) }
  if (type === 'shape') return { type, shape: 'round', color: '#ffffff', radius: 16, anim, g: nextG(120) }
  if (type === 'button') return { type, label: '按钮', action: 'tel', value: '', color: '#ffffff', bg: '#a62b2b', radius: 22, anim, g: nextG(56) }
  return { ...blank(type), anim, g: nextG(EST_H[type] || 240) }
}
// 老 blocks 页 → els 转换（打开旧页/套模板自动执行）：估高堆叠成自由画布初稿，用户再自由调整。
// 几何按「成稿美感」给基准参数（2026-11-28 用户定稿「元素都要有相应美感的参数」）：
// 封面全幅铺满整屏、标题压在下三分之一留白带；正文 48px 边距留白；图片 20px 圆角；
// 封面后续内容 y 从 1360 起，超出一屏由 splitOverflowPages 自动切到下一页。
function pageToEls(p) {
  if (p && Array.isArray(p.els) && p.els.length) return p.els
  const els = []
  let y = 60, z = 0
  const G = (x, yy, w, h) => ({ x, y: yy, w, h, rot: 0, opacity: 1, z: z++ })
  for (const b of ((p && p.blocks) || [])) {
    const anim = b.anim || ''
    if (b.type === 'cover') {
      // 封面图 880 高 + 标题/副题压图底，正文块紧跟在 930 起——封面页内容饱满不空（2026-11-28 用户定稿「DEMO 页内容尽量丰富」）
      els.push({ type: 'image', url: b.cover || '', radius: 0, fit: 'cover', anim: anim || 'zoom', g: G(0, 0, 750, 880) })
      if (b.title) els.push({ type: 'text', text: b.title, size: 54, color: '#ffffff', align: 'left', bold: true, font: '', lh: 1.25, anim: 'up', g: G(48, 600, 654, 88) })
      if (b.subtitle) els.push({ type: 'text', text: b.subtitle, size: 26, color: 'rgba(255,255,255,.85)', align: 'left', bold: false, font: '', lh: 1.5, anim: 'up', g: G(48, 712, 654, 50) })
      y = 930
    } else if (b.type === 'hero') {
      els.push({ type: 'image', url: b.image || '', radius: 20, fit: 'cover', anim: anim || 'up', g: G(48, y, 654, 420) })
      y += 450
      if (b.title) { els.push({ type: 'text', text: b.title, size: 40, color: '#ffffff', align: 'left', bold: true, font: '', lh: 1.3, anim: '', g: G(48, y, 654, 56) }); y += 78 }
      if (b.desc) { els.push({ type: 'text', text: b.desc, size: 26, color: '#cbd5e1', align: 'left', bold: false, font: '', lh: 1.7, anim: '', g: G(48, y, 654, 96) }); y += 122 }
    } else if (b.type === 'text') {
      const align = ['left', 'center', 'right'].includes(b.align) ? b.align : 'left'
      if (b.heading) { els.push({ type: 'text', text: b.heading, size: 42, color: '#ffffff', align, bold: true, font: '', lh: 1.3, anim: anim || 'up', g: G(48, y, 654, 60) }); y += 84 }
      if (b.body) {
        const s = String(b.body || '')
        // 估高按「逐段折行」算（26px 字 / 654px 宽 ≈ 每行 22 字留余量），多行段不再被行数取大稀释；
        // 初稿估高只决定首帧，渲染后 tryRelayout 用实测高度回写（转换页实测自愈）
        const lines = s.split('\n').reduce((n, seg) => n + Math.max(1, Math.ceil(seg.length / 22)), 0)
        const h = Math.round(lines * 26 * 1.8)
        els.push({ type: 'text', text: s, size: 26, color: '#cbd5e1', align, bold: false, font: '', lh: 1.8, anim: anim || 'up', g: G(48, y, 654, h) })
        y += h + 30
      }
    } else {
      const h = EST_H[b.type] || 240
      els.push({ ...JSON.parse(JSON.stringify(b)), anim: anim || '', g: G(22, y, 706, h) })
      y += h + 26
    }
  }
  if (!els.length) els.push({ type: 'text', text: '点我编辑文字', size: 32, color: '#ffffff', align: 'left', bold: false, font: '', lh: 1.5, anim: '', g: G(48, 60, 654, 60) })
  return els
}
// 估高堆叠 → 按一屏（750×1334）切分成多页：放不下的元素整块搬到下一页并上移对齐（2026-11-28 用户定稿
// 「不允许长页，可以多页」）。元素按 y 升序（堆叠顺序天然有序）；存量长 els 页走同一条路，打开编辑器即迁移。
function splitOverflowPages(els) {
  const out = []
  let cur = [], base = 0
  for (const e of els) {
    const g = e.g || {}
    const y0 = Number(g.y) || 0
    const h = Math.min(Number(g.h) || 120, 1334)
    if (cur.length && y0 - base + h > 1334) { out.push(cur); cur = []; base = y0 - 60 }
    e.g = { ...g, y: Math.max(0, y0 - base) }
    cur.push(e)
  }
  if (cur.length) out.push(cur)
  return out
}
// 插入位置：选中元素之后（跟编辑焦点走），否则排末尾
function insertAt() {
  const arr = curEls.value
  return (selBlock.value >= 0 && selBlock.value < arr.length) ? selBlock.value + 1 : arr.length
}
function addBlock(type) {
  const arr = curEls.value
  const at = insertAt()
  arr.splice(at, 0, blankEl(type))
  selBlock.value = at
  markDirty()
  // 加组件就是为了填内容：组件元素加完直接开内容表单，不用再去找元素点编辑（自由元素画布直调，不弹）。
  // 同时把画布滚到新元素——它落在现有内容下方，可能超出首屏。
  if (!FREE_TYPES.includes(type)) openEdit()
  nextTick(() => {
    const el = document.querySelector('.hp-sel')
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}
function duplicateBlock() {
  const src = block.value
  if (!src) return
  const copy = JSON.parse(JSON.stringify(src))
  if (copy.g) { copy.g.y = (Number(copy.g.y) || 0) + 40; copy.g.z = (Number(copy.g.z) || 0) + 1 }
  const arr = curEls.value
  const at = insertAt()
  arr.splice(at, 0, copy)
  selBlock.value = at
  markDirty()
  showToast('已复制，可拖动到任意位置', 'success')
}
// 画布长按拖动重排（仅老流式页 emit；自由画布页走元素自由拖移，不重排数组）
function onReorder({ from, to }) {
  const arr = curEls.value
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return
  const [m] = arr.splice(from, 1)
  arr.splice(to, 0, m)
  selBlock.value = to
  markDirty()
}

// ---- 画布直操化（2026-11-27 MAKA 对标）：浮动快捷条动作 + 换图直达弹层 ----
const imgOpen = ref(false)
const imgField = ref('') // 'cover' | 'image' | 'url'：当前换图目标字段
function openImageSheet() {
  const b = block.value
  if (!b) return
  imgField.value = b.type === 'cover' ? 'cover' : b.type === 'image' ? 'url' : 'image'
  imgOpen.value = true
}
function onQuick({ action }) {
  if (action === 'dup') duplicateBlock()
  else if (action === 'del') removeBlock()
  else if (action === 'edit' || action === 'style') openEdit()
  else if (action === 'image') openImageSheet()
}
// 页面背景（自由画布）：bg = { color, image }，背景图优先于背景色
function openBg() {
  if (!curPage.value.bg) curPage.value.bg = { color: '', image: '' }
  bgOpen.value = true
}
function setBg(field, v) {
  if (!curPage.value.bg) curPage.value.bg = { color: '', image: '' }
  curPage.value.bg[field] = v
  markDirty()
}

// ---- 地图选点（map 块）：确认后坐标落块，位置名称为空时用逆地理地址回填 ----
const mapOpen = ref(false)
async function onMapPicked(p) {
  block.value.lat = p.lat
  block.value.lng = p.lng
  mapOpen.value = false
  if (!block.value.label) {
    try {
      const addr = await reverseGeocode(p.lat, p.lng)
      const text = [addr?.province, addr?.district, addr?.street].filter(Boolean).join('')
      if (text) block.value.label = text
    } catch { /* 逆地理失败不阻塞，位置名称留空由用户手填 */ }
  }
  markDirty()
}

// ---- 撤销/重做（时间线快照，MAKA 同款顶栏 ↶↷）：变更停 600ms 落一档，undo 前先冲掉未落档的改动 ----
const hist = ref([])
const histIdx = ref(-1)
const canUndo = computed(() => histIdx.value > 0)
const canRedo = computed(() => histIdx.value < hist.value.length - 1)
function snapNow() {
  const s = JSON.stringify({ title: title.value, schema: schema.value })
  const cur = hist.value[histIdx.value]
  if (cur && cur.s === s) return // 与当前档相同不重复落档
  hist.value = hist.value.slice(0, histIdx.value + 1).concat({ s })
  if (hist.value.length > 50) hist.value = hist.value.slice(-50)
  histIdx.value = hist.value.length - 1
}
let histTimer = 0
function scheduleSnap() { clearTimeout(histTimer); histTimer = setTimeout(snapNow, 600) }
function applyHist(i) {
  const rec = hist.value[i]
  if (!rec) return
  const st = JSON.parse(rec.s)
  title.value = st.title
  schema.value = st.schema
  histIdx.value = i
  selBlock.value = 0
  if (selPage.value >= schema.value.pages.length) selPage.value = Math.max(0, schema.value.pages.length - 1)
  markDirty()
}
function undo() { snapNow(); if (canUndo.value) applyHist(histIdx.value - 1) }
function redo() { snapNow(); if (canRedo.value) applyHist(histIdx.value + 1) }
function removeBlock() {
  if (selBlock.value < 0 || !block.value) { showToast('先点选要删除的元素', 'error'); return }
  curEls.value.splice(selBlock.value, 1)
  selBlock.value = Math.max(0, selBlock.value - 1)
  markDirty()
  showToast('已删除', 'success')
}
// 层级（自由画布）：↑↓ 数组排序不再适用，改为 z 序调整（属性面板「层级」）
function layerOp(op) {
  const b = block.value
  if (!b || !b.g) return
  const zs = curEls.value.map(e => (e.g ? Number(e.g.z) || 0 : 0))
  const maxZ = zs.length ? Math.max.apply(null, zs) : 0
  const minZ = zs.length ? Math.min.apply(null, zs) : 0
  if (op === 'top') b.g.z = maxZ + 1
  else if (op === 'bottom') b.g.z = Math.max(0, minZ - 1)
  else if (op === 'up') b.g.z = (Number(b.g.z) || 0) + 1
  else b.g.z = Math.max(0, (Number(b.g.z) || 0) - 1)
  markDirty()
}
// 按版式加页：预置成稿骨架（字段结构与 pageToEls 产物一致），用户在骨架上改内容
const pageAddOpen = ref(false)
const palOpen = ref(false)
function addPage(kind) {
  const T = over => ({ type: 'text', color: '#ffffff', align: 'center', bold: true, font: '', lh: 1.3, anim: '', ...over })
  const G = (x, y, w, h, z) => ({ x, y, w, h, rot: 0, opacity: 1, z })
  const layouts = {
    title: { els: [T({ text: '输入标题', size: 44, g: G(48, 560, 654, 90, 1) })] },
    image: { els: [
      { type: 'image', url: '', radius: 0, fit: 'cover', anim: '', g: G(0, 0, 750, 900, 1) },
      T({ text: '输入标题', size: 40, g: G(48, 950, 654, 80, 2) })
    ] },
    pic: { els: [
      T({ text: '输入标题', size: 40, align: 'left', g: G(48, 80, 654, 80, 1) }),
      { type: 'image', url: '', radius: 20, fit: 'cover', anim: '', g: G(48, 200, 654, 620, 2) },
      T({ text: '输入正文说明', size: 26, align: 'left', bold: false, g: G(48, 860, 654, 120, 3) })
    ] },
    gallery: { els: [{ type: 'gallery', images: ['', '', ''], layout: 'grid', source: 'upload', anim: '', g: G(22, 80, 706, 520, 1) }] },
    form: { els: [{ type: 'form', heading: '预约报名', desc: '留下电话，我们尽快联系你', showName: true, showPhone: true, showMessage: false, buttonText: '提交', successText: '', anim: '', g: G(22, 80, 706, 620, 1) }] },
    // 名片页（业务联动，竞品没有）：头像/姓名/职位公司/电话微信按钮直接取名片资料，换名片资料后此处仍需手动同步
    vcard: (() => {
      const c = cardData.value || {}
      return { els: [
        ...(c.avatar ? [{ type: 'image', url: c.avatar, radius: 100, fit: 'cover', anim: 'zoom', g: G(275, 130, 200, 200, 1) }] : []),
        T({ text: c.name || '输入姓名', size: 48, g: G(48, 380, 654, 100, 2) }),
        T({ text: [c.title, c.company].filter(Boolean).join(' · ') || '职位 · 公司', size: 26, bold: false, g: G(48, 500, 654, 60, 3) }),
        { type: 'buttons', items: [
          { label: '打电话', action: 'tel', value: c.mobile || c.phone || '' },
          { label: '加微信', action: 'wechat', value: c.wechat || '' }
        ], anim: 'up', g: G(22, 620, 706, 200, 4) }
      ] }
    })(),
    blank: { els: [] }
  }
  const l = layouts[kind] || layouts.title
  schema.value.pages.push({ bg: { color: '', image: '' }, els: JSON.parse(JSON.stringify(l.els)) })
  selPage.value = schema.value.pages.length - 1; selBlock.value = 0
  markDirty()
}
function removePage() {
  if (schema.value.pages.length <= 1) return
  schema.value.pages.splice(selPage.value, 1)
  selPage.value = Math.max(0, selPage.value - 1); selBlock.value = 0
  markDirty()
}
// 删本页是整页级破坏性操作：先确认再删（撤销栈兜底，但大动作不静默）
const pageDelConfirm = ref(false)
function confirmRemovePage() {
  pageDelConfirm.value = false
  removePage()
  showToast('已删除本页，顶栏 ↶ 可撤销', 'success')
}
function setAccent(c) { schema.value.accent = c; markDirty() }
// 一键整套配色：收集全页自由元素用到的颜色（文字色/形状填充/按钮填充与文字色），按出现频次
// 依次映射到新色板（白字最多→亮色位，保深底可读），主题色取色板主色；undo 可整体回退。
function applyPalette(p) {
  const freq = new Map()
  for (const pg of schema.value.pages) for (const e of (pg.els || [])) {
    const cs = e.type === 'text' || e.type === 'shape' ? [e.color] : e.type === 'button' ? [e.bg, e.color] : []
    for (const c of cs) if (c) freq.set(c, (freq.get(c) || 0) + 1)
  }
  const sorted = [...freq.keys()]
  const map = new Map(sorted.map((c, i) => [c, p.colors[i % p.colors.length]]))
  for (const pg of schema.value.pages) for (const e of (pg.els || [])) {
    if ((e.type === 'text' || e.type === 'shape') && map.has(e.color)) e.color = map.get(e.color)
    if (e.type === 'button') {
      if (map.has(e.bg)) e.bg = map.get(e.bg)
      if (map.has(e.color)) e.color = map.get(e.color)
    }
  }
  schema.value.accent = p.colors[1]
  markDirty()
  showToast(`已套用「${p.name}」，顶栏 ↶ 可撤销`, 'success')
}
async function openTpls() {
  if (!templates.value.length) {
    try { templates.value = (await api.get('/api/h5/templates')).data.data.list } catch {}
  }
  tplOpen.value = true
}
// 套用模板：先经项目统一确认弹层（2026-11-28 用户定稿「所有提示样式一定要与项目搭配」，不用原生 confirm）
const tplConfirm = ref(null)
function applyTpl(t) {
  if (applying.value) return
  tplConfirm.value = t
}
function confirmApplyTpl() {
  const t = tplConfirm.value
  if (!t || applying.value) return
  tplConfirm.value = null
  // 模板是 blocks 格式：套用即转自由画布 els（估高堆叠初稿），一屏放不下自动分页，保持同一编辑形态
  const pages = JSON.parse(JSON.stringify(t.pages || [])).flatMap(p => splitOverflowPages(pageToEls(p)).map(els => ({ bg: { ...(p.bg || { color: '', image: '' }) }, els })))
  schema.value = { accent: t.accent, transition: t.transition || 'auto', pages }
  selPage.value = 0; selBlock.value = 0
  tplOpen.value = false; dockMode.value = 'main'
  // 全部页都是刚转换的：标记待实测自愈（渲染后回写真实高度并重排，消除估高叠压）
  for (let i = 0; i < pages.length; i++) relayoutPages.add(i)
  nextTick(tryRelayout)
  markDirty()
  showToast(`已套用「${t.name}」，继续编辑即可`, 'success')
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/api/h5/${route.params.id}`)
    page.value = data.data.page
    title.value = page.value.title
    // 自由画布唯一编辑形态：旧 blocks 页打开即自动转 els（估高堆叠初稿），已是 els 的页原样。
    // 刚从 blocks 转出来的页标记待实测自愈（已是 els 的老页绝不重排——那是用户自己的布局）
    const raw = page.value.schema || {}
    const rawPages = (raw.pages && raw.pages.length) ? raw.pages : [{ blocks: [{ type: 'cover', title: '', subtitle: '', cover: '' }] }]
    let pageIdx = 0
    schema.value = {
      accent: raw.accent || '',
      transition: raw.transition || 'auto',
      pages: rawPages.flatMap(p => {
        const converted = !(p.els && p.els.length)
        const parts = splitOverflowPages(pageToEls(p))
        if (converted) for (let k = 0; k < parts.length; k++) relayoutPages.add(pageIdx + k)
        pageIdx += parts.length
        return parts.map(els => ({ bg: p.bg || { color: '', image: '' }, els }))
      })
    }
    loaded.value = true
    // 旧 blocks 页已就地转 els（管线细节不提示，编辑体验口径由顶部 he-hint 承载）
    snapNow() // 撤销栈初始档：此后每次改动停顿落一档
    // 预览数据：名片公开资料 + 套餐闸门口径（服务端实测，含水印开关）
    try {
      const mine = (await api.get('/api/h5/mine')).data.data
      paid.value = !!mine.limits?.paid
      watermark.value = !mine.limits?.paid
      maxPages.value = mine.limits?.maxPages || (paid.value ? PAID_MAX_PAGES : FREE_MAX_PAGES)
    } catch {}
    try {
      cardData.value = (await api.get('/api/cards/mine')).data.data
      // 图集 source='card'（公司相册）预览图源：与名片页同一份 card_materials，图片 URL 挂到 card.gallery
      try {
        const mats = (await api.get('/api/cards/mine/materials')).data.data?.list || []
        const gallery = mats.filter(m => m.type === 'file' && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(m.url || '')).map(m => m.url)
        if (gallery.length) cardData.value = { ...cardData.value, gallery }
      } catch {}
    } catch {}
    // 名片资料到位后再实测自愈——contact 等块的高度取决于电话/微信/地址是否有值，资料未到时量出来是空的
    nextTick(tryRelayout)
  } catch (e) { showToast(e?.message || '加载失败', 'error'); router.push('/me/h5') }
})
watch(() => route.params.id, () => { if (route.name === 'h5-editor') location.reload() })
</script>

<style scoped>
/* 底部操作条 fixed 贴底（与配色/资料编辑页同款，2026-11-27 实修）：
   原 sticky bottom:0 在老微信 X5 WebView 上可能不贴视口底、且会被全局 tabbar 盖住；
   页面留 76px 空位，画布与提示行不会被操作条遮住。 */
.he { min-height: 100vh; padding-bottom: 76px; padding-bottom: calc(76px + env(safe-area-inset-bottom)); background: var(--bg-page, #f4f6fb); display: flex; flex-direction: column; }
/* 只读预览：无 dock/顶栏，不预留任何空位；⚠️ 必须锁一屏确定高度（height 而非 min-height）——
   翻页模式下页面是绝对定位叠放，渲染树逐级 height:100%，根容器高度随内容时整个画布塌成 0 = 黑屏（实锤）。
   全屏口径（2026-11-28 用户定稿）：画布四边贴满视口、无圆角/描边/留白，与公开页访客所见一致 */
.he.he-preview { height: 100svh; padding-bottom: 0; }
.he-preview .he-canvas { padding: 0; }
.he-preview .he-canvas-in { width: 100%; border-radius: 0; border: 0; box-shadow: none; }
.he-exit { position: fixed; top: calc(10px + var(--safe-top, 0px)); left: 12px; z-index: 30; width: 34px; height: 34px; border: 0; border-radius: 50%; background: rgba(15,23,42,.5); color: #fff; font-size: 15px; line-height: 1; cursor: pointer; -webkit-tap-highlight-color: transparent; }
/* 编辑画布切页入场动画：预览/公开页走翻页动效，编辑态单页重挂载用这个补翻页感 */
.he-page-anim { animation: he-page-in .42s cubic-bezier(.22, .8, .3, 1) both; }
@keyframes he-page-in { from { opacity: 0; transform: translateY(26px); } }
@media (prefers-reduced-motion: reduce) { .he-page-anim { animation: none !important; } }
.he-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 8px; padding: calc(10px + var(--safe-top, 0px)) 12px 10px; background: rgba(255,255,255,.95); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.he-back { width: 34px; height: 34px; border: 1px solid var(--line); border-radius: 9px; background: #fff; font-size: 19px; color: #374151; cursor: pointer; flex: 0 0 34px; }
.he-back:disabled { opacity: .35; cursor: default; }
.he-title { flex: 1; min-width: 0; padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px; font-size: 15px; font-weight: 700; }
.he-save { flex: 0 0 auto; white-space: nowrap; padding-right: 2px; }

/* 画布：手机宽度居中，占满剩余高度；内容即真实渲染（所见即所得） */
.he-canvas { flex: 1; display: flex; flex-direction: column; padding: 12px 12px 0; min-height: 0; }
.he-canvas-in { flex: 1; min-height: 0; width: min(430px, 100%); margin: 0 auto; border-radius: 18px; overflow: hidden; border: 1px solid var(--line); box-shadow: 0 12px 32px rgba(15,23,42,.14); background: #0f1115; }
.he-hint { text-align: center; padding: 8px 0 4px; flex: 0 0 auto; }
.he-loading { flex: 1; display: grid; place-items: center; color: #6b7280; }

/* dock：底部固定操作条，四态翻转（与名片工作台同款交互语言）。
   背景与名片页返回签同质感：暖调磨砂玻璃（2026-11-28 全站底栏统一），按钮淡透片深墨字 */
.he-dock { position: fixed; left: 0; right: 0; bottom: 0; z-index: 105; width: min(560px, 100%); margin: 0 auto; display: flex; align-items: center; gap: 8px; padding: 10px 12px calc(10px + var(--safe-bottom, 0px)); background: rgba(255,255,255,.50); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border-top: 1px solid rgba(255,255,255,.55); border-radius: 16px 16px 0 0; box-shadow: inset 0 1px 0 rgba(255,255,255,.65); }
@media (min-width: 900px) { .he-dock { left: 50%; right: auto; transform: translateX(-50%); border-radius: 14px 14px 0 0; } }
.he-dock-flip { background: rgba(255,255,255,.58); }
.he-dock-btn { flex: 1; padding: 12px 4px; border: 1px solid rgba(38,34,28,.12); border-radius: 11px; background: rgba(255,255,255,.55); color: #26221c; font-size: 13.5px; font-weight: 700; cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; }
.he-dock-btn.primary { background: var(--primary, #a62b2b); border-color: transparent; color: #fff; }
.he-dock-back { flex: 0 0 36px; height: 44px; border: 1px solid rgba(38,34,28,.12); border-radius: 11px; background: rgba(255,255,255,.55); color: #26221c; font-size: 17px; cursor: pointer; }
.he-dock-scroll { flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.he-dock-scroll::-webkit-scrollbar { display: none; }
.he-dock-flow { display: flex; align-items: center; gap: 8px; width: max-content; padding: 2px; }
.he-chip { height: 44px; padding: 0 14px; border: 1px solid rgba(38,34,28,.12); border-radius: 999px; background: rgba(255,255,255,.55); color: #26221c; font-size: 12.5px; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.he-chip.on { background: var(--primary, #a62b2b); border-color: transparent; color: #fff; font-weight: 700; }
.he-chip.warn { color: #b45309; }
.he-chip:disabled { opacity: .45; cursor: default; }
.he-grp { flex: 0 0 auto; font-size: 10.5px; letter-spacing: .12em; color: #6b7280; background: rgba(38,34,28,.06); padding: 4px 9px; border-radius: 7px; white-space: nowrap; }
/* 属性面板分组标题：留白+小节字标分层（不画分割线，轻奢去线条），组与组之间拉开 */
.he-sec { margin: 20px 0 10px; font-size: 11px; font-weight: 700; letter-spacing: .18em; color: #9ca3af; }
.he-sec:first-of-type { margin-top: 4px; }
.he-dot { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 50%; border: 2px solid rgba(38,34,28,.25); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.he-dot.on { box-shadow: 0 0 0 3px rgba(38,34,28,.45); }
/* dock 上下文调节行的小号色点（2026-11-27 选中元素即调） */
.he-dot-sm { width: 28px; height: 28px; flex: 0 0 28px; }
/* 属性面板（自由画布）：色板行 + 滑杆（覆盖 .he-form input 的输入框样式） */
.he-colors { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
.he-colors .he-dot { border-color: rgba(0,0,0,.15); }
.he-colors .he-dot.on { box-shadow: 0 0 0 3px var(--primary, #a62b2b); }
.he-dot-none { background: #fff; position: relative; overflow: hidden; }
.he-dot-none:after { content: ''; position: absolute; top: 50%; left: 6px; right: 6px; height: 2px; background: #dc2626; transform: rotate(-45deg); }
.he-form input.he-range { display: inline-block; width: auto; flex: 1; min-width: 130px; margin: 0 0 0 12px; padding: 0; border: 0; background: transparent; accent-color: var(--primary, #a62b2b); }
.he-status { flex: 0 0 auto; font-size: 11.5px; color: #6b7280; white-space: nowrap; padding: 0 2px; }
.he-status.on { color: #16a34a; font-weight: 700; }
/* dock 行里的 BottomSelect（切换动效）：触发项压成白瓷片胶囊，与 chips 同语言（深字细描边，浅底自带对比） */
.he-dock-flow .bsel { display: inline-block; flex: 0 0 auto; }
.he-dock-flow :deep(.bsel-trigger) { height: 44px; width: auto; padding: 0 14px; border: 1px solid rgba(38,34,28,.12); border-radius: 999px; background: rgba(255,255,255,.55); color: #26221c; font-size: 12.5px; white-space: nowrap; }
.he-dock-flow :deep(.bsel-label) { max-width: 110px; }
.he-dock-flow :deep(.bsel-arrow) { color: rgba(38,34,28,.55); }
/* 背景音乐块表单试听 */
.he-audio { width: 100%; margin-top: 6px; }

/* 内容编辑弹层表单（对齐全站 BottomSheet 弹层组件口径：18px 侧边距 + 头部行 + 卡片式行，
   与 Profile avatar-sheet / CardEdit logo-sheet 同语言，不再贴边） */
.he-form { padding: 8px 18px 18px; max-height: 72vh; overflow-y: auto; overscroll-behavior: contain; }
.he-f-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 12px; font-size: 15px; }
.he-f-head b { font-size: 15px; }
.he-f-actions { display: flex; gap: 8px; }
.he-anim-row { margin-top: 6px; padding-top: 12px; border-top: 1px dashed var(--line); }
.he-form label { display: block; margin-bottom: 12px; font-size: 12.5px; color: #6b7280; }
.he-form input, .he-form textarea, .he-form select { display: block; width: 100%; box-sizing: border-box; margin-top: 6px; padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; background: #fff; }
/* 开关行：卡片式选择行（avatar-sheet-item 同语言），替代裸 checkbox 贴边 */
.he-form .he-switch { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 12px 14px; border: 1px solid var(--line, #e8edf4); border-radius: 10px; background: var(--bg-page, #f8fafc); font-size: 13.5px; color: var(--text, #0f172a); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.he-form .he-switch:active { background: #eef2f7; }
.he-form .he-switch input { width: auto; margin: 0; flex: 0 0 auto; accent-color: var(--primary, #a62b2b); }
.he-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.he-gal-row { display: flex; align-items: center; gap: 8px; }
.he-gal-row > *:first-child { flex: 1; }
.he-btn-edit { border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin-bottom: 10px; }
.he-mini { padding: 7px 14px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: #374151; font-size: 12.5px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.he-mini:active { background: #eef2f7; }
.he-btn { padding: 10px 14px; border: 0; border-radius: 9px; background: var(--primary, #a62b2b); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
.he-btn.ghost { background: #fff; color: #374151; border: 1px solid var(--line); }
.he-btn.sm { padding: 6px 10px; font-size: 12px; }
.he-btn.block { width: 100%; margin-top: 4px; }
.he-mini.danger { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
/* 套模板弹层 */
.he-tpl-list { display: flex; flex-direction: column; gap: 8px; }
.he-tpl { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 11px; background: #fff; text-align: left; cursor: pointer; }
.he-tpl:active { border-color: var(--primary, #a62b2b); }
.he-tpl-dot { width: 14px; height: 14px; flex: 0 0 14px; border-radius: 50%; }
.he-tpl-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
.he-tpl i { font-style: normal; color: #9ca3af; }
/* 整套配色色板预览点 */
.he-pal-dots { display: flex; gap: 4px; flex: 0 0 auto; }
.he-pal-dots i { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(38,34,28,.15); }
/* 地图选点弹层（复用名片编辑形态；遮罩四边定位，老 WebView 不认 inset 简写） */
.map-mask { position: fixed; top: 0; right: 0; bottom: 0; left: 0; background: rgba(15,23,42,.55); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.map-modal { width: 100%; max-width: 680px; background: #fff; border-radius: 14px; padding: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.map-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
</style>
