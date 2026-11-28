<template>
  <!-- 宣传页编辑器（/me/h5/:id）——2026-11-27 用户定稿重构：
       单页单页做 + 所见即所得：画布即当前页的真实渲染（H5Render 编辑模式，点任意块选中、
       琥珀虚线描边、块内动作短路），内容表单在底部弹层里改、画布实时刷新；
       底部操作条与名片工作台 dock 同款四态翻转：main=编辑块/页面/配色/发布，
       点任一键整行翻转出选项行（点中即改、面板不关可连试），↙ 收起回主行。
       发布后自动挂到名片公开页（访客看名片可跳宣传页），宣传页尾页也带名片二维码——双向挂钩。
       2026-11-27 编辑体验一流化（用户反馈「要自由拖动、一些动作」）：
       ① 画布长按块 350ms 拖动排序（跟手 + 命中即重排，H5Render emit reorder 落数组）；
       ② 块入场动效可选（BottomSelect，公开页进入视口自动播放）；
       ③ 加块插到选中块之后（不再固定尾部）、新增复制块；
       ④ 按钮动作原 <select> 违规改 BottomSelect（H5 下拉必须 BottomSelect 约束），动作新增「复制文本」。 -->
  <div class="he" :class="{ 'he-preview': previewMode }">
    <header class="he-top">
      <button class="he-back" @click="router.push('/me/h5')">‹</button>
      <input v-if="!previewMode" v-model="title" class="he-title" placeholder="宣传页标题" @input="markDirty" />
      <b v-else class="he-title he-title-plain">{{ title || '宣传页预览' }}</b>
      <button v-if="!previewMode" class="he-back" :disabled="!canUndo" @click="undo" aria-label="撤销">↶</button>
      <button v-if="!previewMode" class="he-back" :disabled="!canRedo" @click="redo" aria-label="重做">↷</button>
      <span v-if="!previewMode" class="he-save small muted">{{ saveState }}</span>
    </header>

    <!-- 画布：编辑模式只渲染当前编辑页（点选/拖动/四角缩放/旋转）；预览模式（?preview=1，2026-11-28 用户定稿
         「预览不改」）渲染全部页面、可滑动翻页、无编辑手势与 dock -->
    <div class="he-canvas" v-if="loaded">
      <div class="he-canvas-in">
        <!-- page-offset：画布只渲染当前页，offset 让块的 key 与真实页号对齐（选中态/拖动不串页） -->
        <H5Render :data="previewMode ? previewData : curPageData" :editable="!previewMode" :page-offset="selPage" :sel-key="selKey" @pick="onPick" @reorder="onReorder" @quick="onQuick" @inplace="markDirty" @geom="markDirty" />
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
                <!-- 通用：入场动效循环 + 完整面板 + 复制/删除 -->
                <button class="he-chip" @click="cycleAnim">动·{{ animLabel }} ›</button>
                <button class="he-chip on" @click="openEdit">{{ FREE_TYPES.includes(block.type) ? '⋯ 属性' : '✎ 编辑内容' }}</button>
                <button class="he-chip" @click="duplicateBlock" :disabled="curEls.length >= 40">⧉ 复制</button>
                <button class="he-chip warn" @click="removeBlock">✕ 删除</button>
              </template>
              <template v-else>
                <span class="he-grp">加元素</span>
                <button v-for="t in ADDABLE" :key="t" class="he-chip" @click="addBlock(t)">＋{{ TYPE_LABEL[t] }}</button>
              </template>
            </template>
            <!-- 页面行：切页 / 加页 / 删本页（单页单页做） -->
            <template v-else-if="dockMode === 'pages'">
              <button v-for="(p, i) in schema.pages" :key="i" :class="['he-chip', { on: i === selPage }]" @click="selPage = i; selBlock = 0">第{{ i + 1 }}页·{{ elsCount(p) }}元素</button>
              <button v-if="pagesCount < maxPages" class="he-chip on" @click="addPage">＋ 加一页</button>
              <button v-else class="he-chip" @click="showToast(paid ? `最多 ${maxPages} 页` : `免费版最多 ${maxPages} 页，开通套餐解锁`, 'error')">已达上限</button>
              <button v-if="pagesCount > 1" class="he-chip warn" @click="removePage">✕ 删本页</button>
            </template>
            <!-- 配色行：主题色点中即改 + 套用官方模板 + 页面切换过渡动效 -->
            <template v-else-if="dockMode === 'theme'">
              <button v-for="c in COLORS" :key="c" :class="['he-dot', { on: (schema.accent || '') === c }]" :style="{ background: c }" @click="setAccent(c)"></button>
              <span class="he-grp">页面</span>
              <button class="he-chip" @click="openBg">◧ 页面背景</button>
              <button class="he-chip" @click="openTpls">套用官方模板…</button>
              <span class="he-grp">切换动效</span>
              <BottomSelect :model-value="schema.transition || 'slide'" :options="TRANSITION_OPTS" title="页面切换动效" @update:modelValue="schema.transition = $event; markDirty()" />
            </template>
            <!-- 发布行：状态 + 发布/更新 + 关联名片开关（一对多，2026-11-27）+ 复制链接 + 下架 -->
            <template v-else>
              <span :class="['he-status', { on: page?.status === 'published' }]">{{ page?.status === 'published' ? '✓ 已发布·名片页可跳转' : '○ 未发布' }}</span>
              <button class="he-chip on" :disabled="publishing" @click="publish">{{ page?.status === 'published' ? '⇪ 更新发布' : '⇪ 发布' }}</button>
              <button class="he-chip" :class="{ on: page?.card_linked }" :disabled="publishing" @click="toggleCardLink">{{ page?.card_linked ? '✓ 已关联名片' : '＋ 关联名片' }}</button>
              <button v-if="page?.status === 'published'" class="he-chip" @click="copyLink">⧉ 复制链接</button>
              <button v-if="page?.status === 'published'" class="he-chip warn" @click="unpublish">下架</button>
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
          <div class="he-row"><span class="small muted">排列方式</span>
            <BottomSelect v-model="block.layout" :options="GAL_LAYOUT_OPTS" title="图集排列方式" @update:modelValue="markDirty" />
          </div>
          <div class="he-row"><span class="small muted">图片来源</span>
            <button class="he-btn ghost sm" @click="block.source = block.source === 'card' ? 'upload' : 'card'; markDirty()">{{ block.source === 'card' ? '公司相册（自动同步）' : '手动上传' }}</button>
          </div>
          <p v-if="block.source === 'card'" class="small muted" style="margin:0 0 8px">图片自动来自名片页「公司相册」，在名片里上传一次，这里与名片页两处同步展示、无需重复传图。</p>
          <template v-else>
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
          <p class="small muted" style="margin:4px 0 0">访客点「导航到这里」按名称搜索。</p>
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
          <label>小标题<input v-model="block.heading" maxlength="40" @input="markDirty" placeholder="如：预约到店 / 留下您的需求" /></label>
          <label>说明文字<input v-model="block.desc" maxlength="120" @input="markDirty" placeholder="一句引导文案（选填）" /></label>
          <label class="he-switch"><input type="checkbox" v-model="block.showName" @change="markDirty" />收集姓名</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showPhone" @change="markDirty" />收集电话</label>
          <label class="he-switch"><input type="checkbox" v-model="block.showMessage" @change="markDirty" />收集留言</label>
          <label>按钮文字<input v-model="block.buttonText" maxlength="12" @input="markDirty" placeholder="提交" /></label>
          <label>提交成功提示<input v-model="block.successText" maxlength="60" @input="markDirty" placeholder="已收到，我们会尽快联系你" /></label>
          <p class="small muted" style="margin:0">访客提交后自动存入线索，可在宣传页列表「线索」里查看、复制电话回访。</p>
        </template>
        <template v-else-if="block.type === 'music'">
          <label>常用曲目
            <BottomSelect :model-value="MUSIC_PRESETS.some(p => p.value === block.url) ? block.url : ''" :options="MUSIC_PRESETS" title="选择背景音乐" @update:modelValue="block.url = $event; markDirty()" />
          </label>
          <label>音频地址<input v-model="block.url" @input="markDirty" placeholder="mp3 链接（需可公开访问），也可不填" /></label>
          <label class="he-switch"><input type="checkbox" v-model="block.autoplay" @change="markDirty" />访客打开页面自动播放</label>
          <audio v-if="block.url" :src="block.url" controls class="he-audio"></audio>
          <p class="small muted" style="margin:0 0 8px">音乐在公开页以右下角 ♪ 按钮承载播放/暂停。手机浏览器禁止带声自动播放时，访客首次触摸页面后自动起播、循环播放。</p>
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

    <!-- 套用官方模板弹层：整页内容被替换（confirm 确认），替换后从第 1 页继续单页编辑 -->
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
          <label>文字内容<textarea v-model="block.text" rows="4" maxlength="300" @input="markDirty" placeholder="支持换行"></textarea></label>
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
          <label class="he-switch"><input type="checkbox" v-model="block.bold" @change="markDirty" />加粗</label>
        </template>
        <!-- 图片 -->
        <template v-else-if="block.type === 'image'">
          <ImageField v-model="block.url" label="图片" @update:modelValue="markDirty" />
          <div class="he-row"><span class="small muted">适配方式</span>
            <BottomSelect :model-value="block.fit || 'cover'" :options="FIT_OPTS" title="图片适配" @update:modelValue="block.fit = $event; markDirty()" />
          </div>
          <div class="he-row"><span class="small muted">圆角 {{ block.radius }}px</span>
            <input class="he-range" type="range" min="0" max="200" step="1" :value="block.radius" @input="block.radius = Number($event.target.value); markDirty()" />
          </div>
        </template>
        <!-- 形状 -->
        <template v-else-if="block.type === 'shape'">
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
          <label>按钮文字<input v-model="block.label" maxlength="12" @input="markDirty" /></label>
          <label>动作
            <BottomSelect v-model="block.action" :options="ACTION_OPTS" title="按钮动作" @update:modelValue="markDirty" />
          </label>
          <label>{{ ACTION_VALUE_LABEL[block.action] || '内容' }}<input v-model="block.value" @input="markDirty" /></label>
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
        <!-- 通用：入场动效 / 透明度 / 层级 -->
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { showToast } from '../store'
import H5Render from '../components/H5Render.vue'
import ImageField from '../components/ImageField.vue'
import BottomSheet from '../components/BottomSheet.vue'
import BottomSelect from '../components/BottomSelect.vue'

const route = useRoute()
const router = useRouter()

const TYPE_LABEL = { cover: '封面', text: '文本', hero: '图文', image: '图片', shape: '形状', button: '按钮', gallery: '图集', contact: '联系方式', map: '位置', buttons: '按钮组', video: '视频', form: '表单留资', music: '背景音乐', endcard: '名片尾页' }
// 自由画布（2026-11-27 用户定稿上 MAKA 同款）：文本/图片/形状/按钮为自由元素，其余为组件元素（绝对定位复用原表单）
const FREE_TYPES = ['text', 'image', 'shape', 'button']
const ADDABLE = ['text', 'image', 'shape', 'button', 'gallery', 'contact', 'map', 'buttons', 'video', 'form', 'music', 'endcard']
// 页面切换过渡动效（2026-11-28 用户定稿「每页全屏 + 翻页动效」）：滑动翻页为默认，旧「上下滚动」已并入默认不再单列
const TRANSITION_OPTS = [
  { value: 'slide', label: '滑动翻页（默认）' }, { value: 'fade', label: '淡入淡出' }, { value: 'flip', label: '翻页动效' }
]
// 常用背景音乐（2026-11-28 用户要求）：站内自产免版权合成曲，循环无缝；选中的直接当 block.url
const MUSIC_PRESETS = [
  { value: '/music/bgm-light.wav', label: '轻快明亮' },
  { value: '/music/bgm-warm.wav', label: '舒缓温暖' },
  { value: '/music/bgm-business.wav', label: '商务大气' },
  { value: '/music/bgm-fresh.wav', label: '清新灵动' },
  { value: '', label: '不用预设' }
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
const curPageData = computed(() => ({ schema: { accent: schema.value.accent || '', transition: schema.value.transition || 'slide', pages: [curPage.value] }, card: cardData.value, watermark: watermark.value }))
// 只读预览（?preview=1）：全页可滑、无编辑手势与 dock，画布行为与公开页一致（2026-11-28 用户定稿「预览不改」）
const previewMode = route.query.preview === '1'
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
async function publish() {
  clearTimeout(saveTimer); await save()
  publishing.value = true
  try {
    const { data } = await api.post(`/api/h5/${route.params.id}/publish`)
    page.value.status = 'published'
    if (data?.data) page.value.card_linked = !!data.data.card_linked
    showToast(page.value.card_linked ? '已发布！入口已挂到你的名片页' : '已发布！点「关联名片」可挂到名片页', 'success')
    copyLink()
  } catch (e) { showToast(e?.message || '发布失败', 'error') } finally { publishing.value = false }
}
// 关联名片开关（2026-11-27 一对多定稿）：状态在宣传页侧维护（防名片侧指定变乱），
// 已发布且已关联的宣传页在名片公开页列多条入口；首次发布自动关联，更新发布不覆盖取消。
async function toggleCardLink() {
  if (!page.value || publishing.value) return
  const linked = !page.value.card_linked
  publishing.value = true
  try {
    await api.post(`/api/h5/${route.params.id}/card-link`, { linked })
    page.value.card_linked = linked
    showToast(linked ? '已关联：访客看你的名片可直达这个宣传页' : '已取消关联，名片页不再显示这个宣传页入口', 'success')
  } catch (e) { showToast(e?.message || '操作失败', 'error') } finally { publishing.value = false }
}
async function unpublish() {
  try {
    await api.post(`/api/h5/${route.params.id}/unpublish`)
    page.value.status = 'draft'
    showToast('已下架，名片页入口同步隐藏', 'success')
  } catch (e) { showToast(e?.message || '操作失败', 'error') }
}
async function copyLink() {
  const link = `${window.location.origin}/h5/${page.value.slug}`
  try { await navigator.clipboard.writeText(link); showToast('链接已复制，可直接发给客户', 'success') } catch { showToast(link) }
}

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
  if (type === 'image') return { type, url: '', radius: 12, fit: 'cover', anim, g: nextG(260) }
  if (type === 'shape') return { type, shape: 'round', color: '#ffffff', radius: 16, anim, g: nextG(120) }
  if (type === 'button') return { type, label: '按钮', action: 'tel', value: '', color: '#ffffff', bg: '#a62b2b', radius: 22, anim, g: nextG(56) }
  return { ...blank(type), anim, g: nextG(EST_H[type] || 240) }
}
// 老 blocks 页 → els 转换（打开旧页/套模板自动执行）：估高堆叠成自由画布初稿，用户再自由调整
function pageToEls(p) {
  if (p && Array.isArray(p.els) && p.els.length) return p.els
  const els = []
  let y = 60, z = 0
  const G = (x, yy, w, h) => ({ x, y: yy, w, h, rot: 0, opacity: 1, z: z++ })
  for (const b of ((p && p.blocks) || [])) {
    const anim = b.anim || ''
    if (b.type === 'cover') {
      els.push({ type: 'image', url: b.cover || '', radius: 0, fit: 'cover', anim: anim || 'zoom', g: G(0, 0, 750, 820) })
      if (b.title) els.push({ type: 'text', text: b.title, size: 60, color: '#ffffff', align: 'left', bold: true, font: '', lh: 1.25, anim: 'up', g: G(48, 560, 654, 90) })
      if (b.subtitle) els.push({ type: 'text', text: b.subtitle, size: 26, color: '#ffffff', align: 'left', bold: false, font: '', lh: 1.5, anim: 'up', g: G(48, 668, 654, 50) })
      y = 900
    } else if (b.type === 'hero') {
      els.push({ type: 'image', url: b.image || '', radius: 18, fit: 'cover', anim: anim || 'up', g: G(22, y, 706, 440) })
      y += 470
      if (b.title) { els.push({ type: 'text', text: b.title, size: 38, color: '#ffffff', align: 'left', bold: true, font: '', lh: 1.3, anim: '', g: G(22, y, 706, 56) }); y += 76 }
      if (b.desc) { els.push({ type: 'text', text: b.desc, size: 26, color: '#d1d5db', align: 'left', bold: false, font: '', lh: 1.7, anim: '', g: G(22, y, 706, 96) }); y += 120 }
    } else if (b.type === 'text') {
      const align = ['left', 'center', 'right'].includes(b.align) ? b.align : 'left'
      if (b.heading) { els.push({ type: 'text', text: b.heading, size: 40, color: '#ffffff', align, bold: true, font: '', lh: 1.3, anim: anim || 'up', g: G(22, y, 706, 58) }); y += 80 }
      if (b.body) {
        const s = String(b.body || '')
        const h = Math.round(Math.max(s.split('\n').length, Math.ceil(s.length / 22)) * 26 * 1.8)
        els.push({ type: 'text', text: s, size: 26, color: '#d1d5db', align, bold: false, font: '', lh: 1.8, anim: anim || 'up', g: G(22, y, 706, h) })
        y += h + 26
      }
    } else {
      const h = EST_H[b.type] || 240
      els.push({ ...JSON.parse(JSON.stringify(b)), anim: anim || '', g: G(22, y, 706, h) })
      y += h + 26
    }
  }
  if (!els.length) els.push({ type: 'text', text: '点我编辑文字', size: 32, color: '#ffffff', align: 'left', bold: false, font: '', lh: 1.5, anim: '', g: G(22, 60, 706, 60) })
  return els
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
function addPage() {
  schema.value.pages.push({ bg: { color: '', image: '' }, els: [{ type: 'text', text: '输入标题', size: 40, color: '#ffffff', align: 'left', bold: true, font: '', lh: 1.3, anim: '', g: { x: 48, y: 80, w: 654, h: 64, rot: 0, opacity: 1, z: 1 } }] })
  selPage.value = schema.value.pages.length - 1; selBlock.value = 0
  markDirty()
}
function removePage() {
  if (schema.value.pages.length <= 1) return
  schema.value.pages.splice(selPage.value, 1)
  selPage.value = Math.max(0, selPage.value - 1); selBlock.value = 0
  markDirty()
}
function setAccent(c) { schema.value.accent = c; markDirty() }
async function openTpls() {
  if (!templates.value.length) {
    try { templates.value = (await api.get('/api/h5/templates')).data.data.list } catch {}
  }
  tplOpen.value = true
}
function applyTpl(t) {
  if (applying.value) return
  if (!confirm(`套用「${t.name}」会覆盖当前全部页面内容，确定？`)) return
  // 模板是 blocks 格式：套用即转自由画布 els（估高堆叠初稿），保持同一编辑形态
  const pages = JSON.parse(JSON.stringify(t.pages || [])).map(p => ({ bg: p.bg || { color: '', image: '' }, els: pageToEls(p) }))
  schema.value = { accent: t.accent, transition: t.transition || 'slide', pages }
  selPage.value = 0; selBlock.value = 0
  tplOpen.value = false; dockMode.value = 'main'
  markDirty()
  showToast(`已套用「${t.name}」，继续编辑即可`, 'success')
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/api/h5/${route.params.id}`)
    page.value = data.data.page
    title.value = page.value.title
    // 自由画布唯一编辑形态：旧 blocks 页打开即自动转 els（估高堆叠初稿），已是 els 的页原样
    const raw = page.value.schema || {}
    const hadBlocks = (raw.pages || []).some(p => p && p.blocks && p.blocks.length && !(p.els && p.els.length))
    const rawPages = (raw.pages && raw.pages.length) ? raw.pages : [{ blocks: [{ type: 'cover', title: '', subtitle: '', cover: '' }] }]
    schema.value = {
      accent: raw.accent || '',
      transition: raw.transition || 'slide',
      pages: rawPages.map(p => ({ bg: p.bg || { color: '', image: '' }, els: pageToEls(p) }))
    }
    loaded.value = true
    if (hadBlocks) showToast('旧版内容已自动转为自由画布，可自由拖动、缩放、旋转', 'success')
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
  } catch (e) { showToast(e?.message || '加载失败', 'error'); router.push('/me/h5') }
})
watch(() => route.params.id, () => { if (route.name === 'h5-editor') location.reload() })
</script>

<style scoped>
/* 底部操作条 fixed 贴底（与配色/资料编辑页同款，2026-11-27 实修）：
   原 sticky bottom:0 在老微信 X5 WebView 上可能不贴视口底、且会被全局 tabbar 盖住；
   页面留 76px 空位，画布与提示行不会被操作条遮住。 */
.he { min-height: 100vh; padding-bottom: 76px; padding-bottom: calc(76px + env(safe-area-inset-bottom)); background: var(--bg-page, #f4f6fb); display: flex; flex-direction: column; }
/* 只读预览：无 dock，不预留底栏空位；⚠️ 必须锁一屏确定高度（height 而非 min-height）——
   翻页模式下页面是绝对定位叠放，渲染树逐级 height:100%，根容器高度随内容时整个画布塌成 0 = 黑屏（实锤） */
.he.he-preview { height: 100svh; padding-bottom: 16px; }
.he-title-plain { border-color: transparent; background: transparent; }
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
</style>
