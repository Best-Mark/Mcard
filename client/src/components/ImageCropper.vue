<template>
  <Teleport to="body">
    <div v-if="modelValue" class="ic-mask">
      <div class="ic-dialog">
        <div class="ic-head">
          <span class="ic-title">{{ title }}</span>
          <span class="ic-close" @click="cancel" title="关闭">✕</span>
        </div>

        <div class="ic-content">
          <p class="ic-tip">
            图片格式必须为：png,jpeg,jpg；不可大于2M；建议使用png格式图片，以保持最佳效果；<br />
            建议图片尺寸为{{ outputSize }}px*{{ outputSize }}px
          </p>

          <button type="button" class="ic-btn ic-btn-default" @click="pickFile">上传文件</button>

          <div class="ic-body">
            <div class="ic-stage">
              <template v-if="imgSrc">
                <img class="ic-img" :src="imgSrc" :style="imgStyle" draggable="false" />
                <div
                  class="ic-sel"
                  :style="selStyle"
                  @pointerdown.stop.prevent="startDrag('move', $event)"
                >
                  <span v-for="h in ['nw','ne','sw','se']" :key="h" class="ic-handle" :class="'ic-handle--' + h"
                    @pointerdown.stop.prevent="startDrag(h, $event)" />
                </div>
              </template>
            </div>

            <div class="ic-right">
              <p class="ic-right-title">预览</p>
              <div class="ic-previews">
                <div class="ic-preview" :style="previewStyle(112)" />
                <div class="ic-preview ic-preview--round" :style="previewStyle(112)" />
              </div>
            </div>
          </div>

        </div>

        <div class="ic-foot">
          <button type="button" class="ic-btn ic-btn-primary" :disabled="!imgSrc || submitting" @click="submit">
            {{ submitting ? '上传中…' : '提交' }}
          </button>
        </div>

        <input ref="fileEl" type="file" :accept="accept" style="display:none" @change="onFile" />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { showToast } from '../store';

// 纯前端裁剪弹窗（无第三方依赖，移植自 MSHOP 同名组件，两端保持同款交互）：
// 左上标题 + 右上关闭叉 → 灰色格式说明 → 「上传文件」按钮 →
// 左侧小裁剪区（虚线选框 + 四角手柄）+ 右侧浅灰预览面板（两个并排预览）→ 底部居中「提交」。
// 图片按 contain 铺进舞台，选框为正方形，可拖动 / 四角缩放；
// 提交时按选框映射回原图像素，居中输出 outputSize×outputSize 的 PNG，
// 由父组件负责真正上传（本组件只产出 Blob，不碰网络——职责单一）。
const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '修改头像' },
  accept: { type: String, default: 'image/png,image/jpeg,image/jpg' },
  // 输出边长（px），裁剪结果强制正方形
  outputSize: { type: Number, default: 512 },
});
const emit = defineEmits(['update:modelValue', 'confirm']);

const STAGE = 200;          // 裁剪舞台边长
const MIN_SEL = 32;         // 选框最小边长

const fileEl = ref(null);
const imgSrc = ref('');
let img = null;             // HTMLImageElement（非响应式即可）

// 图片在舞台内的显示矩形（contain 居中）
const disp = ref({ x: 0, y: 0, w: 0, h: 0 });
// 选框：相对图片显示区左上角
const sel = ref({ x: 0, y: 0, size: 0 });

const submitting = ref(false);
let drag = null;            // { mode, startX, startY, orig:{x,y,size} }

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

function pickFile() {
  fileEl.value && fileEl.value.click();
}

function onFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
    showToast('仅支持 png / jpg 格式', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('图片不可大于 2M，请压缩后重试', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      img = image;
      imgSrc.value = image.src;
      fitSelection();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/**
 * 图片按 contain 铺进舞台，选框默认直接「全选」——取该图能覆盖的最大正方形并居中。
 *
 * 交互口径（与 MSHOP 一致）：不做缩放/平移，选完图就是全选，直接提交即可；
 * 选框仍可拖动、四角可缩放，是给需要裁局部的人留的，不是必用步骤。
 */
function fitSelection() {
  const w = img.naturalWidth, h = img.naturalHeight;
  const scale = Math.min(STAGE / w, STAGE / h);
  const dw = w * scale, dh = h * scale;
  disp.value = { x: (STAGE - dw) / 2, y: (STAGE - dh) / 2, w: dw, h: dh };
  const size = Math.min(dw, dh);
  sel.value = { x: (dw - size) / 2, y: (dh - size) / 2, size };
}

function startDrag(mode, e) {
  drag = { mode, startX: e.clientX, startY: e.clientY, orig: { ...sel.value } };
  // 挂到 window 上跟踪：拖动手柄时鼠标经常会冲出 200px 的小舞台，
  // 若只监听舞台的 pointermove/pointerleave，一出界拖动就被中断。
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function endDrag() {
  if (!drag) return;
  drag = null;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
}

function onMove(e) {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  const { w, h } = disp.value;
  const o = drag.orig;

  if (drag.mode === 'move') {
    sel.value = {
      ...o,
      x: clamp(o.x + dx, 0, w - o.size),
      y: clamp(o.y + dy, 0, h - o.size),
    };
    return;
  }
  // 四角缩放：以对角为锚点，保持正方形。
  // 位移按「对角线投影」取（把鼠标位移投到该手柄的对角线方向上），任何方向的拖动都连续跟手。
  const anchorX = drag.mode.includes('w') ? o.x + o.size : o.x;
  const anchorY = drag.mode.includes('n') ? o.y + o.size : o.y;
  const sx = drag.mode.includes('w') ? -1 : 1;
  const sy = drag.mode.includes('n') ? -1 : 1;
  let size = o.size + (dx * sx + dy * sy) / 2;
  size = Math.min(Math.max(size, MIN_SEL), Math.min(w, h));
  let x = drag.mode.includes('w') ? anchorX - size : anchorX;
  let y = drag.mode.includes('n') ? anchorY - size : anchorY;
  x = clamp(x, 0, w - size);
  y = clamp(y, 0, h - size);
  sel.value = { x, y, size };
}

const imgStyle = computed(() => {
  const d = disp.value;
  return { left: d.x + 'px', top: d.y + 'px', width: d.w + 'px', height: d.h + 'px' };
});

const selStyle = computed(() => {
  const d = disp.value, s = sel.value;
  return {
    left: d.x + s.x + 'px',
    top: d.y + s.y + 'px',
    width: s.size + 'px',
    height: s.size + 'px',
  };
});

// 预览：按选框内容等比放大到预览框边长 P
function previewStyle(P) {
  const d = disp.value, s = sel.value;
  if (!s.size) return {};
  const k = P / s.size;
  return {
    backgroundImage: `url(${imgSrc.value})`,
    backgroundSize: `${d.w * k}px ${d.h * k}px`,
    backgroundPosition: `${-s.x * k}px ${-s.y * k}px`,
  };
}

function submit() {
  if (!img || submitting.value) return;
  const d = disp.value, s = sel.value;
  const ratio = img.naturalWidth / d.w; // 显示 → 原图像素
  const sx = clamp(Math.round(s.x * ratio), 0, img.naturalWidth);
  const sy = clamp(Math.round(s.y * ratio), 0, img.naturalHeight);
  const ss = Math.max(1, Math.min(
    Math.round(s.size * ratio),
    img.naturalWidth - sx,
    img.naturalHeight - sy,
  ));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = props.outputSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, ss, ss, 0, 0, props.outputSize, props.outputSize);
  canvas.toBlob(async (blob) => {
    if (!blob) { showToast('裁剪失败，请重试', 'error'); return; }
    submitting.value = true;
    try {
      await new Promise((resolve, reject) => {
        emit('confirm', blob, resolve, reject);
      });
      close();
    } finally {
      submitting.value = false;
    }
  }, 'image/png');
}

function cancel() { close(); }
function close() {
  // 保险：万一在拖动中被 ✕ 关闭，别把 window 监听留在页面上
  endDrag();
  emit('update:modelValue', false);
}

watch(() => props.modelValue, (open) => {
  if (open) {
    // 每次打开重置，避免上次的图残留；不自动弹文件框，由「上传文件」按钮触发
    imgSrc.value = '';
    img = null;
    drag = null;
  }
});
</script>

<style scoped>
/* 白底直角弹窗、灰说明文字，居中悬浮 */
.ic-mask {
  position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 3000;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.ic-dialog {
  background: #fff; width: 700px; max-width: 100%;
  box-shadow: 0 6px 24px rgba(0,0,0,0.2);
  color: #353535; font-size: 14px;
  display: flex; flex-direction: column;
  max-height: 100%; overflow: auto;
}

.ic-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 0;
}
.ic-title { font-size: 15px; color: #353535; }
.ic-close { cursor: pointer; color: #9b9b9b; font-size: 16px; line-height: 1; padding: 2px 4px; }
.ic-close:hover { color: #353535; }

.ic-content { padding: 0 44px 24px; }
.ic-tip { font-size: 13px; color: #7a7a7a; line-height: 1.8; margin: 26px 0 16px; }

.ic-btn {
  height: 34px; padding: 0 18px; box-sizing: border-box;
  border-radius: 3px; border: 1px solid transparent; font-size: 14px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; line-height: 1;
}
.ic-btn-default { background: #fff; border-color: #d9d9d9; color: #353535; }
.ic-btn-default:hover { border-color: #60a5fa; color: #60a5fa; }
.ic-btn-primary { background: #4f6ef7; color: #fff; }
.ic-btn-primary:hover { background: #405ce0; }
.ic-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ic-body { display: flex; gap: 44px; margin-top: 24px; }

/* 左：小裁剪舞台 */
.ic-stage {
  position: relative; flex: 0 0 auto; width: 200px; height: 200px;
  background: #f5f5f5; border: 1px solid #e5e5e5; overflow: hidden;
  touch-action: none; user-select: none;
}
.ic-img { position: absolute; pointer-events: none; }
/* 虚线选框 + 框外压暗 */
.ic-sel {
  position: absolute; cursor: move; box-sizing: border-box;
  border: 1px dashed #b2b2b2;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.45);
}
.ic-handle {
  position: absolute; width: 8px; height: 8px; background: #6b6b6b;
  border: 1px solid #fff; box-sizing: border-box;
}
.ic-handle--nw { left: -4px; top: -4px; cursor: nwse-resize; }
.ic-handle--ne { right: -4px; top: -4px; cursor: nesw-resize; }
.ic-handle--sw { left: -4px; bottom: -4px; cursor: nesw-resize; }
.ic-handle--se { right: -4px; bottom: -4px; cursor: nwse-resize; }

/* 右：浅灰预览面板，两个预览并排 */
.ic-right {
  flex: 1 1 auto; min-width: 0; background: #f7f8fa;
  padding: 14px 18px 18px;
}
.ic-right-title { font-size: 13px; color: #9b9b9b; }
.ic-previews { display: flex; gap: 56px; justify-content: center; margin-top: 16px; }
.ic-preview {
  width: 112px; height: 112px; background-repeat: no-repeat;
  background-color: #fff; border: 1px solid #ececec; box-sizing: border-box;
}
.ic-preview--round { border-radius: 50%; }

/* 底部：居中提交 */
.ic-foot { display: flex; justify-content: center; padding: 0 0 28px; }
.ic-foot .ic-btn { min-width: 96px; }
</style>
