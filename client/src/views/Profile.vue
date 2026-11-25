<template>
  <div class="page profile-page">
    <header class="topbar">
      <router-link to="/me" class="brand">M<em>Card</em></router-link>
      <div class="spacer"></div>
      <button class="nav-menu-btn" aria-label="菜单" @click="toggleDrawer"><i class="menu-glyph"></i></button>
    </header>

    <!-- 个人中心上半部分：参照 MShop 的深渐变头卡观感（内缩圆角作为视觉焦点例外，
         下方分组列表仍严格遵守用户端「卡片左右贴边、方角」约定）。套餐/日期用 MCard 自有数据。 -->
    <div class="pf-header">
      <span class="pf-sheen" aria-hidden="true"></span>
      <button class="pf-gear" aria-label="设置" @click="toggleDrawer"><AppIcon name="settings" :size="18" /></button>
      <button v-if="card" class="pf-qr" aria-label="我的名片二维码" @click="goQr"><AppIcon name="qrcode" :size="19" /></button>

      <!-- 个人中心只显示账户层信息（users）：头像=账户头像、昵称=账户昵称。
           名片层的姓名/职位/公司/名片头像绝不在此展示（2026-11-25 用户定稿：CTO 不该出现在个人资料里）。 -->
      <div class="pf-user">
        <button class="pf-ava" title="点击更换账户头像" aria-label="更换账户头像" @click="openAvatarPicker">
          <img v-if="avatar" :src="avatar" alt="账户头像" />
          <span v-else>{{ (auth.user?.phone || '名').slice(0, 1) }}</span>
          <i class="pf-ava-cam"><AppIcon name="camera" :size="12" /></i>
        </button>
        <button class="pf-ident" title="点击编辑账户资料" aria-label="编辑账户资料" @click="router.push('/me/account')">
          <div class="pf-name">{{ auth.user?.nickname || auth.user?.phone || '我的账户' }}</div>
          <div class="pf-slogan">账户中心 · 管理你的登录资料</div>
        </button>
      </div>
      <!-- 账户头像：微信头像 / 自定义上传（2026-11-26 用户定，不走素材库） -->
      <BottomSheet :show="avatarMenuOpen" @update:show="avatarMenuOpen = $event">
        <div class="avatar-sheet">
          <div class="avatar-sheet-head">
            <b>更换账户头像</b>
            <button type="button" class="avatar-sheet-close" aria-label="关闭" @click="avatarMenuOpen = false">✕</button>
          </div>
          <button type="button" class="avatar-sheet-item" :disabled="avatarSaving || !wxAvatar" @click="useWxAvatar">
            使用微信头像
            <span v-if="!wxAvatar" class="avatar-sheet-sub">（未获取到微信头像，请重新微信登录）</span>
          </button>
          <label class="avatar-sheet-item" :class="{ disabled: avatarSaving }">
            自定义上传图片
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" :disabled="avatarSaving" @change="onAvatarFile" />
          </label>
          <button type="button" class="avatar-sheet-cancel" @click="avatarMenuOpen = false">取消</button>
        </div>
      </BottomSheet>

      <!-- 套餐有效期玻璃条：到期日期来自 card.expiresAt（兼容 expires_at） -->
      <div class="pf-plan">
        <div class="pf-plan-left">
          <span class="pf-plan-label">套餐有效期</span>
          <b class="pf-plan-date">{{ planInfo.dateText }}</b>
          <span class="pf-plan-sub">{{ planInfo.subText }}</span>
        </div>
        <button class="pf-plan-btn" @click="router.push('/me/plans')">{{ planInfo.expired ? '立即续期' : '续期 ›' }}</button>
      </div>
    </div>

    <div v-if="loadError" class="card card-pad pf-error">
      <b>名片信息加载失败</b>
      <p class="small muted">{{ loadError }}</p>
      <button class="btn btn-sm btn-primary" :disabled="loading" @click="load">重新加载</button>
    </div>
    <div v-else-if="loading" class="card card-pad center">加载中…</div>

    <!-- 快捷入口：MShop 订单宫格观感（图标底块 + 文字），数据用 MCard 自有入口 -->
    <div class="pf-quick">
      <router-link to="/me/contacts" class="pf-quick-item"><i class="pf-qi-ico"><AppIcon name="contacts" :size="20" /></i><span>名片夹</span></router-link>
      <router-link to="/me/stats" class="pf-quick-item"><i class="pf-qi-ico"><AppIcon name="chart" :size="20" /></i><span>浏览统计</span></router-link>
      <router-link to="/me/plans" class="pf-quick-item"><i class="pf-qi-ico"><AppIcon name="gem" :size="20" /></i><span>套餐续期</span></router-link>
      <router-link to="/me/print" class="pf-quick-item"><i class="pf-qi-ico"><AppIcon name="printer" :size="20" /></i><span>实体版式</span></router-link>
    </div>

    <!-- 下半部分：App 分组 cell 列表（贴边方角，图标+标题+副标题+角标+箭头） -->
    <div class="pf-group">
      <div class="pf-group-title">我的名片</div>
      <!-- 公开页/二维码/复制链接本是同一件事：点开二维码弹层，里面可复制地址、可进公开页，
           不再拆成三个 cell（2026-11-25 用户定稿）。 -->
      <button v-if="card" class="pf-cell" @click="goQr">
        <i class="pf-cell-ico pf-cell-ico-qr"><AppIcon name="qrcode" :size="19" /></i><span class="pf-cell-t">我的名片</span>
        <span class="pf-cell-extra">二维码 · 链接</span><span class="pf-cell-arrow">›</span>
      </button>
      <div v-else class="pf-cell pf-cell-muted">还没有名片，可在「名片」栏创建</div>
    </div>

    <!-- 推广中心：仅推广员可见（后台在用户管理开启），普通用户完全不渲染此分组 -->
    <div v-if="auth.isPromoter" class="pf-group">
      <div class="pf-group-title">推广</div>
      <router-link to="/me/promo" class="pf-cell pf-cell-promo">
        <i class="pf-cell-ico"><AppIcon name="nav" :size="20" /></i><span class="pf-cell-t">推广中心</span>
        <span class="pf-cell-extra">邀请 · 收益 · 提现</span><span class="pf-cell-arrow">›</span>
      </router-link>
    </div>

    <div class="pf-group">
      <div class="pf-group-title">账号与服务</div>
      <router-link to="/me/notifications" class="pf-cell" :class="{ 'has-badge': unread > 0 }">
        <i class="pf-cell-ico"><AppIcon name="bell" :size="20" /></i><span class="pf-cell-t">消息通知</span>
        <span v-if="unread > 0" class="pf-cell-badge">{{ unread > 99 ? '99+' : unread }}</span>
        <span class="pf-cell-arrow">›</span>
      </router-link>
      <router-link to="/me/batch-scan" class="pf-cell">
        <i class="pf-cell-ico"><AppIcon name="camera" :size="20" /></i><span class="pf-cell-t">展会连扫收名片</span><span class="pf-cell-arrow">›</span>
      </router-link>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { auth, toggleDrawer, showToast } from '../store'
import AppIcon from '../components/AppIcon.vue'
import BottomSheet from '../components/BottomSheet.vue'

const router = useRouter()
const card = ref(null)
const avatar = ref('')
const wxAvatar = ref('')
const avatarSaving = ref(false)
const avatarMenuOpen = ref(false)
function openAvatarPicker() { avatarMenuOpen.value = true }
const loading = ref(true)
const loadError = ref('')
const unread = ref(0)
let loadStarted = false

// 套餐有效期：expires_at 兼容旧字段；duration_days=0/无到期视为永久
const planInfo = computed(() => {
  const raw = card.value?.expiresAt || card.value?.expires_at
  if (!raw) return { dateText: '永久有效', subText: '当前套餐长期可用', expired: false }
  const d = new Date(String(raw).replace(' ', 'T') + (/Z|[+-]\d\d:\d\d$/.test(String(raw)) ? '' : 'Z'))
  if (isNaN(d.getTime())) return { dateText: '永久有效', subText: '当前套餐长期可用', expired: false }
  const dateText = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000)
  if (days < 0) return { dateText, subText: '套餐已到期，续期后恢复全部功能', expired: true }
  if (days === 0) return { dateText, subText: '今天到期，建议尽快续期', expired: false }
  return { dateText, subText: `剩余 ${days} 天`, expired: false }
})

async function loadUnread() {
  if (!localStorage.getItem('mcard_token')) return
  try {
    const { data } = await api.get('/api/notifications/unread')
    unread.value = data?.data?.unread || 0
  } catch { /* 角标失败静默不打扰 */ }
}

async function load() {
  if (loadStarted && loading.value) return
  loadStarted = true
  loading.value = true
  loadError.value = ''
  try {
    const [c, a] = await Promise.all([api.get('/api/cards/mine'), api.get('/api/auth/avatar')])
    card.value = c?.data?.data || null
    avatar.value = a?.data?.data?.avatar || ''
    wxAvatar.value = a?.data?.data?.wxAvatar || ''
    loadUnread()
  } catch (e) { loadError.value = e.message || '网络异常' }
  finally { loading.value = false }
}
onMounted(load)

// 账户头像两条独立通道（不走素材库）：切回微信头像 / 自定义上传。
// 微信头像原值只存服务端 users.wx_avatar，前端只发起 useWxAvatar 指令，不信任传入 URL。
async function useWxAvatar() {
  if (avatarSaving.value || !wxAvatar.value) return
  avatarMenuOpen.value = false
  avatarSaving.value = true
  try {
    const { data } = await api.put('/api/auth/avatar', { useWxAvatar: true })
    avatar.value = data?.data?.avatar || ''
    showToast('已切换为微信头像', 'success')
  } catch (e) { showToast(e.message || '切换失败', 'error') }
  finally { avatarSaving.value = false }
}
async function onAvatarFile(e) {
  if (avatarSaving.value) return
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  avatarMenuOpen.value = false
  avatarSaving.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const { data: up } = await api.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    const url = up?.data?.url
    if (!url) throw new Error('上传未返回图片地址')
    const { data } = await api.put('/api/auth/avatar', { avatar: url })
    avatar.value = data?.data?.avatar || url
    // 账户头像与名片头像严格分开，不回写 card.value.avatar
    showToast('头像已更新', 'success')
  } catch (e) { showToast(e.message || '头像更新失败', 'error') }
  finally { avatarSaving.value = false }
}
function goQr() {
  if (!card.value?.slug) return showToast('还没有名片', 'error')
  router.push(`/c/${card.value.slug}?save=1`)
}
</script>

<style scoped>
/* 头像=换头像、昵称=编辑资料；下方 cell 不再重复这两项（2026-11-25 用户定稿）。
   顶栏居顶由全局 .page > .topbar:first-child 统一处理，这里不再私有覆写 padding。 */

/* ===== 上半部分：丝绸质感头卡（照 MShop 个人中心 .mh 定稿参数，不再自创）=====
   参考 MShop miniapp/src/pages/mine/mine.vue .mh：哑光微颗粒(0.8px/.055 + 0.7px/.03)
   + 极细缎纹(1px/4px, .02) + 大尺度光影(.12 高光 / .09 暗角)；
   光效：::before 柔光只做 opacity 呼吸 26s（无位移），::after 斜光带 26s、亮度 .05、扫完淡出停半程。
   用户此前反馈过「有遮罩在动 / 颜色从左向右扫」，所以亮度与周期严格按定稿压住。 */
.pf-header { position: relative; margin: 12px 12px 0; padding: 12px 16px 14px; border-radius: 18px; overflow: hidden; color: #fff; background-image: radial-gradient(rgba(255,255,255,.055) .8px, transparent 1.1px), radial-gradient(rgba(255,255,255,.03) .7px, transparent 1px), repeating-linear-gradient(115deg, rgba(255,255,255,.02) 0 1px, transparent 1px 4px), radial-gradient(160% 120% at 20% 0%, rgba(255,255,255,.12) 0%, transparent 52%), radial-gradient(130% 110% at 85% 95%, rgba(0,0,0,.09) 0%, transparent 55%), radial-gradient(120% 140% at 8% 0%, rgba(126,182,255,.42), rgba(126,182,255,0) 48%), radial-gradient(100% 120% at 94% 8%, rgba(34,211,238,.30), rgba(34,211,238,0) 52%), linear-gradient(122deg, #17357c 0%, #2457c5 38%, #2563eb 62%, #0e9bbd 100%); background-size: .4em .4em, .4em .4em, auto, auto, auto, auto, auto, cover; background-position: 0 0, .2em .2em, 0 0, center, center, center, center, center; background-repeat: repeat, repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat; box-shadow: 0 10px 28px rgba(23,53,124,.22); }
.pf-sheen { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0; pointer-events: none; overflow: hidden; border-radius: inherit; }
.pf-sheen::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(140% 110% at 28% 12%, rgba(255,255,255,.10) 0%, rgba(255,255,255,.03) 42%, transparent 68%); animation: pfGlow 26s ease-in-out infinite alternate; }
.pf-sheen::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(105deg, transparent 42%, rgba(255,255,255,.05) 50%, transparent 58%); transform: translateX(-130%); animation: pfSheen 26s ease-in-out infinite; }
@keyframes pfGlow { 0% { opacity: .45; } 100% { opacity: 1; } }
@keyframes pfSheen {
  0% { transform: translateX(-130%); opacity: 0; }
  20% { opacity: 1; }
  46% { transform: translateX(130%); opacity: 1; }
  60% { opacity: 0; }
  100% { transform: translateX(130%); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) { .pf-sheen::before { animation: none; opacity: .7; } .pf-sheen::after { display: none; } }
/* ⚠️ 只给需要盖在光效层上的内容加层级，不能用 > *:not(...) 通配——
   那条选择器特异性高于 .pf-gear/.pf-qr 的(0,1,0)，会把它们的 absolute 覆写成 relative，
   导致齿轮压到头像上、二维码落到套餐条上（2026-11-25 实机截图实锤）。 */
.pf-header > .pf-user, .pf-header > .pf-plan { position: relative; z-index: 1; }
.pf-gear { position: absolute; right: 14px; top: 12px; z-index: 2; width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; display: grid; place-items: center; }
.pf-user { display: flex; align-items: center; gap: 12px; }
.pf-ava { position: relative; width: 54px; height: 54px; flex: 0 0 54px; border-radius: 50%; background: rgba(255,255,255,.2); border: 2.5px solid rgba(255,255,255,.55); display: grid; place-items: center; font-size: 21px; font-weight: 800; overflow: hidden; cursor: pointer; padding: 0; color: #fff; }
.pf-ava:active { transform: scale(.95); }
.pf-ava img { width: 100%; height: 100%; object-fit: cover; }
.pf-ava input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.pf-ava-cam { position: absolute; right: -1px; bottom: -1px; width: 18px; height: 18px; border-radius: 50%; background: #fff; color: #2563eb; display: grid; place-items: center; }
/* 右侧给「二维码 + 设置」两个圆形按钮留位，避免姓名/副标题被压到按钮底下 */
.pf-ident { flex: 1; min-width: 0; padding-right: 72px; background: transparent; border: 0; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.pf-ident:active { opacity: .75; }
/* 账户头像弹层：微信头像 / 自定义上传 */
.avatar-sheet { padding: 8px 18px 18px; }
.avatar-sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 12px; font-size: 15px; }
.avatar-sheet-close { border: 0; background: transparent; color: var(--muted, #64748b); font-size: 17px; cursor: pointer; }
.avatar-sheet-item { position: relative; display: block; width: 100%; padding: 14px 12px; margin-bottom: 8px; border: 1px solid var(--line, #e8edf4); border-radius: 10px; background: var(--bg-page, #f8fafc); color: var(--text, #0f172a); font-size: 14px; text-align: left; cursor: pointer; }
.avatar-sheet-item:disabled, .avatar-sheet-item.disabled { opacity: .55; cursor: not-allowed; }
.avatar-sheet-item input { position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0; cursor: pointer; }
.avatar-sheet-sub { display: block; margin-top: 4px; color: var(--muted, #64748b); font-size: 11px; }
.avatar-sheet-cancel { width: 100%; padding: 12px; border: 0; border-radius: 10px; background: #eef2f7; color: var(--text, #0f172a); font-size: 14px; cursor: pointer; }
.pf-name { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-status { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; flex-shrink: 0; }
.pf-status.ok { background: rgba(255,255,255,.2); color: #fff; }
.pf-status.warn { background: #f59e0b; color: #fff; }
.pf-slogan { font-size: 12px; color: rgba(255,255,255,.75); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 二维码入口固定在头卡右上、齿轮左侧；与齿轮同一水平线，不再压到套餐玻璃条 */
.pf-qr { position: absolute; right: 54px; top: 12px; z-index: 2; width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 18px; display: grid; place-items: center; }
.pf-plan { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.16); }
.pf-plan-left { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pf-plan-label { font-size: 11px; color: rgba(255,255,255,.68); }
.pf-plan-date { font-size: 19px; font-weight: 800; color: #f4d78a; letter-spacing: .3px; }
.pf-plan-sub { font-size: 11px; color: rgba(255,255,255,.72); }
.pf-plan-btn { font-size: 12px; font-weight: 700; color: #17357c; padding: 7px 14px; border-radius: 999px; background: linear-gradient(90deg, #f9edc0, #e7c877); white-space: nowrap; }

/* ===== 快捷入口：宫格观感 ===== */
.pf-quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 12px 0; }
.pf-quick-item { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 13px 4px; border-radius: 14px; background: var(--card, #fff); border: 1px solid var(--line); font-size: 12px; color: var(--text); }
.pf-qi-ico { width: 38px; height: 38px; border-radius: 12px; background: #eff6ff; color: var(--primary); display: grid; place-items: center; font-style: normal; font-size: 18px; }
.pf-quick-item:active { transform: scale(.96); }
@media (max-width: 520px) { .pf-quick { grid-template-columns: repeat(2, 1fr); } }

/* ===== 下半部分：App 分组 cell（按用户端约定卡片左右贴边、方角） ===== */
.pf-group { margin: 14px 0 0; background: var(--card, #fff); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.pf-group-title { padding: 12px 16px 6px; font-size: 11px; letter-spacing: .16em; color: var(--muted); font-weight: 700; }
.pf-cell { display: flex; align-items: center; gap: 12px; width: 100%; padding: 13px 16px; border-bottom: 1px solid var(--line); font-size: 14px; color: var(--text); text-align: left; }
.pf-cell:last-child { border-bottom: 0; }
.pf-cell:active { background: #f1f5f9; }
.pf-cell-ico { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; text-align: center; font-style: normal; font-size: 17px; color: var(--primary); flex-shrink: 0; }
.pf-cell-ico-qr { display: inline-flex; align-items: center; justify-content: center; }
.pf-cell-promo .pf-cell-ico { color: #b8860b; }
.pf-cell-t { flex: 1; min-width: 0; }
.pf-cell-extra { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40%; }
.pf-cell-arrow { font-size: 18px; color: var(--muted); flex-shrink: 0; }
.pf-cell-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #ef4444; color: #fff; font-size: 11px; line-height: 18px; text-align: center; flex-shrink: 0; }
.pf-cell.has-badge .pf-cell-arrow { display: none; }
.pf-cell-muted { color: var(--muted); font-size: 13px; }
.pf-error { margin-top: 14px; border-color: #fecaca; background: #fef2f2; }
</style>
