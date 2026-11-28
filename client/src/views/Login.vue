<template>
  <div class="login-page">
    <header class="login-top"><router-link to="/" class="brand">M<em>Card</em></router-link></header>

    <div class="login-content">
      <div class="login-brand">
        <div class="brand-badge"><span>M</span></div>
        <h1>欢迎使用 MCard</h1>
        <p>一张永不失效的二维码，让客户一键存下你的名片</p>
      </div>

      <!-- 微信内：授权登录作为唯一主入口，手机号折叠为次要方式 -->
      <div v-if="wxEnabled && isWechat && !showPassword" class="wx-primary-wrap">
        <button class="wx-primary-btn" :disabled="wxBusy" @click="startWxLogin">
          <AppIcon name="wechat" class="wx-ico" :size="22" />
          {{ wxBusy ? '正在唤起微信…' : '微信一键登录' }}
        </button>
        <button class="switch-link" @click="showPassword = true">使用手机号登录</button>
      </div>

      <template v-if="bindTicket">
        <div class="panel">
          <h2 class="panel-title">绑定手机号</h2>
          <p class="panel-desc">微信授权成功，绑定手机号后即可完成登录；此手机号将作为账号凭证。</p>
          <div v-if="wxNickname" class="wx-user">
            <span class="wx-avatar"><img v-if="wxAvatar" :src="wxAvatar" alt="" /><template v-else>微</template></span>
            <span>{{ wxNickname }}</span><span class="badge ok">已授权</span>
          </div>
          <div class="field"><label>手机号</label><input v-model.trim="phone" class="input" inputmode="numeric" maxlength="11" placeholder="11 位手机号" /></div>
          <div class="field"><label>设置密码（至少 6 位）</label><input v-model.trim="password" class="input" type="password" placeholder="已有账号请填原密码" @keyup.enter="submitBind" /></div>
          <button class="btn btn-primary btn-block primary-submit" :disabled="busy" @click="submitBind">{{ busy ? '请稍候…' : '确认绑定并登录' }}</button>
          <button class="switch-link" style="margin-top:12px" @click="cancelBind">取消，用其他方式登录</button>
        </div>
      </template>

      <template v-else-if="showPassword || !(wxEnabled && isWechat)">
        <div class="tabs">
          <button :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
          <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
        </div>
        <div class="panel">
          <div v-if="errMsg" class="hint warm" style="margin-bottom:14px">{{ errMsg }}</div>
          <div class="field"><label>手机号</label><input v-model.trim="phone" class="input" inputmode="numeric" maxlength="11" placeholder="11 位手机号" /></div>
          <div class="field"><label>密码</label><input v-model.trim="password" class="input" type="password" placeholder="至少 6 位" @keyup.enter="submit" /></div>
          <div v-if="mode === 'register'" class="field"><label>昵称（选填）</label><input v-model.trim="nickname" class="input" placeholder="账户显示名称（与名片姓名无关）" /></div>
          <button class="btn btn-primary btn-block primary-submit" :disabled="busy" @click="submit">{{ busy ? '请稍候…' : (mode === 'login' ? '登录' : '注册并登录') }}</button>
          <button v-if="wxEnabled && isWechat" class="switch-link" style="margin-top:12px" @click="showPassword = false">返回微信一键登录</button>
        </div>

        <div v-if="wxEnabled && !isWechat" class="oauth-block">
          <div class="oauth-divider"><span>其他方式登录</span></div>
          <div class="oauth-list">
            <button class="oauth-item" :disabled="qrBusy" @click="startQrLogin">
              <span class="oauth-badge wechat"><AppIcon name="wechat" class="oauth-glyph" :size="20" /></span>
              <span class="oauth-name">微信扫码</span>
            </button>
          </div>
        </div>
      </template>

      <p class="agree">登录即表示你同意按平台规则使用名片服务</p>
      <router-link to="/" class="back-home">返回首页</router-link>
    </div>

    <!-- 浏览器微信扫码登录弹层：状态机 + 四角托架 + 过期自动刷新 -->
    <div v-if="qrModal" class="modal-mask" @click.self="closeQrLogin">
      <div class="qr-modal">
        <button class="qr-close" aria-label="关闭" @click="closeQrLogin">✕</button>
        <h3>微信扫码登录</h3>
        <p class="qr-sub">{{ qrTip }}</p>

        <div class="qr-frame" :class="{ scanning: qrStatus === 'scanned', done: qrStatus === 'done', expired: qrStatus === 'expired', failed: qrStatus === 'failed' }">
          <img v-if="qrImage" :src="qrImage" alt="微信登录二维码" />
          <div v-else class="qr-loading">二维码生成中…</div>
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <div v-if="qrStatus === 'expired'" class="qr-overlay" @click="refreshQr">
            <b>二维码已过期</b><span>点击刷新</span>
          </div>
          <div v-if="qrStatus === 'failed'" class="qr-overlay" @click="refreshQr">
            <b>登录未完成</b><span>点击重新扫码</span>
          </div>
          <div v-if="qrStatus === 'done'" class="qr-overlay ok"><b>✓</b><span>登录成功</span></div>
        </div>

        <p class="qr-foot">
          <span v-if="qrStatus === 'pending'" class="pulse-dot"></span>
          {{ qrStatus === 'pending' ? '等待扫码 · 剩余 ' + qrCountdown + 's' : qrStatus === 'scanned' ? '已扫描，请在手机上确认' : qrStatus === 'done' ? '正在进入…' : qrStatus === 'failed' ? qrTip : '请重新打开扫码登录' }}
        </p>
        <button v-if="qrStatus === 'expired' || qrStatus === 'failed'" class="btn btn-primary btn-block" @click="refreshQr">刷新二维码</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { setAuth, showToast, siteConfig, bindPendingInvite } from '../store'
import AppIcon from '../components/AppIcon.vue'

const route = useRoute(); const router = useRouter()
const mode = ref('login'); const phone = ref(''); const password = ref(''); const nickname = ref(''); const busy = ref(false)
const wxBusy = ref(false); const showPassword = ref(false)
const wxEnabled = computed(() => !!siteConfig.wechat_login_enabled)
const bindTicket = ref(''); const wxNickname = ref(''); const wxAvatar = ref(''); const errMsg = ref('')
const isWechat = /MicroMessenger/i.test(navigator.userAgent)

const qrModal = ref(false); const qrImage = ref(''); const qrBusy = ref(false)
const qrStatus = ref('pending'); const qrTip = ref('请使用手机微信扫一扫'); const qrCountdown = ref(300)
let qrPollTimer = null; let qrTickTimer = null; let qrExpiresAt = 0

const ERR_TEXT = {
  state: '授权状态校验失败，请重新发起登录',
  denied: '你取消了微信授权',
  disabled: '账号已被停用，请联系管理员',
  oauth: '微信授权失败，请稍后重试或改用手机号登录',
  expired: '微信授权已过期，请重新发起登录',
  snapshot: '微信授权未完成（当前仅浏览快照），请重新点击微信登录并允许获取头像昵称'
}
const QR_FAIL_TEXT = {
  cancelled: '你已取消本次扫码登录，请重新扫码',
  state: '授权状态校验失败，请重新扫码',
  denied: '你取消了微信授权，请重新扫码',
  disabled: '账号已被停用，请联系管理员',
  oauth: '微信授权失败，请重新扫码',
  expired: '登录会话已过期，请重新扫码'
}

onMounted(() => {
  // 邀请归因：任何来源带 ?invite=码 都落地保存（全路径兼容 invite/invite_code/ref），登录成功后统一回传绑定。
  const inv = route.query.invite || route.query.invite_code || route.query.ref
  if (inv) localStorage.setItem('mcard_invite', String(inv).slice(0, 20))
  const err = route.query.err
  if (err) errMsg.value = ERR_TEXT[err] || '微信登录失败，请重试'
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const ticket = hash.get('bind')
  if (ticket) {
    let expired = false
    try {
      const payload = JSON.parse(atob(ticket.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      expired = !!payload.exp && Date.now() >= payload.exp * 1000
    } catch { expired = true }
    if (expired) errMsg.value = '微信绑定凭证已过期，请重新发起微信登录'
    else {
      bindTicket.value = ticket
      wxNickname.value = hash.get('nickname') || ''
      wxAvatar.value = hash.get('avatar') || ''
    }
    router.replace({ path: route.path, query: route.query })
  }
})

// 所有登录方式统一收口：先建登录态，再把落地的邀请码回传绑定（失败不阻断登录）。
async function afterLogin(token, user) {
  setAuth(token, user)
  await bindPendingInvite(api)
}

let wxJumpTimer = null
async function startWxLogin() {
  if (wxBusy.value || busy.value) return
  wxBusy.value = true
  errMsg.value = ''
  try {
    const { data } = await api.get('/api/auth/wechat/url', { params: { redirect: route.query.redirect || '' } })
    if (!data?.data?.url) throw new Error('未获取到微信授权地址')
    clearTimeout(wxJumpTimer)
    wxJumpTimer = setTimeout(() => {
      if (wxBusy.value) { wxBusy.value = false; showToast('授权页打开较慢，请再点一次重试', 'error') }
    }, 8000)
    location.href = data.data.url
  } catch (e) { showToast(e.message, 'error'); wxBusy.value = false }
}
onBeforeUnmount(() => { clearTimeout(wxJumpTimer); stopQrPoll() })

function stopQrPoll() {
  if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null }
  if (qrTickTimer) { clearInterval(qrTickTimer); qrTickTimer = null }
}
function closeQrLogin() {
  if (qrBusy.value && qrStatus.value !== 'expired') return
  stopQrPoll()
  qrModal.value = false
  qrImage.value = ''
}
async function startQrLogin() {
  if (qrBusy.value || busy.value) return
  qrBusy.value = true
  errMsg.value = ''
  qrModal.value = true
  qrStatus.value = 'pending'
  qrTip.value = '请使用手机微信扫一扫'
  qrImage.value = ''
  try {
    const { data } = await api.post('/api/auth/wechat/qr-session')
    const sid = data?.data?.sid
    if (!sid) throw new Error('未获取到登录会话')
    qrImage.value = `/api/auth/wechat/qr-image?sid=${encodeURIComponent(sid)}`
    qrExpiresAt = Date.now() + (Number(data.data.ttl) || 300) * 1000
    qrCountdown.value = Number(data.data.ttl) || 300
    stopQrPoll()
    qrPollTimer = setInterval(() => pollQrStatus(sid), 2000)
    qrTickTimer = setInterval(() => {
      const left = Math.max(0, Math.ceil((qrExpiresAt - Date.now()) / 1000))
      qrCountdown.value = left
      // 手机已扫但迟迟未确认也要能超时，不能永远停在「请在手机上确认」
      if (left <= 0 && (qrStatus.value === 'pending' || qrStatus.value === 'scanned')) { qrStatus.value = 'expired'; qrTip.value = '二维码已过期'; stopQrPoll() }
    }, 1000)
  } catch (e) {
    qrModal.value = false
    showToast(e.message, 'error')
  } finally { qrBusy.value = false }
}
function refreshQr() { startQrLogin() }
async function pollQrStatus(sid) {
  // 关键：scanned 不是终态，必须继续轮询，否则拿不到手机确认后的 done
  if (qrBusy.value || !qrModal.value || !['pending', 'scanned'].includes(qrStatus.value)) return
  let pollFailed = false
  try {
    const { data } = await api.get('/api/auth/wechat/qr-status', { params: { sid } })
    const s = data?.data || {}
    if (s.status === 'done') {
      stopQrPoll()
      qrStatus.value = 'done'
      qrBusy.value = true
      qrTip.value = '登录成功，正在进入…'
      await afterLogin(s.token, s.user)
      await router.replace(route.query.redirect || '/me')
      showToast('微信扫码登录成功', 'success')
    } else if (s.status === 'failed') {
      stopQrPoll(); qrStatus.value = 'failed'
      qrTip.value = QR_FAIL_TEXT[s.reason] || '登录已取消或失败，请重新扫码'
    } else if (s.status === 'expired') {
      stopQrPoll(); qrStatus.value = 'expired'; qrTip.value = '二维码已过期'
    } else if (s.status === 'scanned') {
      qrStatus.value = 'scanned'
      qrTip.value = '已扫描，请在手机上确认'
    }
  } catch (e) {
    // 网络抖动不打断轮询；连续失败则给出可操作提示，避免静默卡住
    pollFailed = true
    qrTip.value = '网络异常，正在重试…'
  }
  if (!pollFailed && qrStatus.value === 'scanned') qrTip.value = '已扫描，请在手机上确认'
}

async function submit() {
  if (!/^1\d{10}$/.test(phone.value)) return showToast('请输入 11 位手机号', 'error')
  if (password.value.length < 6) return showToast('密码至少 6 位', 'error')
  busy.value = true
  try {
    const url = mode.value === 'login' ? '/api/auth/login' : '/api/auth/register'
    const invite = localStorage.getItem('mcard_invite') || ''
    const payload = { phone: phone.value, password: password.value, nickname: nickname.value }
    if (mode.value === 'register' && invite) payload.invite = invite
    const { data } = await api.post(url, payload)
    await afterLogin(data.data.token, data.data.user)
    showToast('登录成功', 'success')
    router.replace(route.query.redirect || '/me')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
async function submitBind() {
  if (busy.value) return
  if (!/^1\d{10}$/.test(phone.value)) return showToast('请输入 11 位手机号', 'error')
  if (password.value.length < 6) return showToast('密码至少 6 位', 'error')
  busy.value = true
  try {
    const { data } = await api.post('/api/auth/wechat/bind', { phone: phone.value, password: password.value, ticket: bindTicket.value })
    await afterLogin(data.data.token, data.data.user)
    showToast('绑定成功，已登录', 'success')
    router.replace(route.query.redirect || '/me')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
function cancelBind() { bindTicket.value = ''; wxNickname.value = ''; wxAvatar.value = ''; phone.value = ''; password.value = '' }
</script>

<style scoped>
.login-page { min-height: 100vh; background: var(--bg); padding-bottom: 40px; }
.login-top { height: calc(56px + var(--safe-top)); display: flex; align-items: center; padding: var(--safe-top) 16px 0; }
.login-top .brand { font-weight: 800; letter-spacing: -.4px; font-size: 17px; }
.login-top .brand em { color: var(--primary); font-style: normal; }
.login-content { width: min(100% - 32px, 400px); margin: 0 auto; padding-top: 24px; }

.login-brand { text-align: center; margin-bottom: 24px; }
.brand-badge { width: 68px; height: 68px; margin: 0 auto 14px; border-radius: 20px; background: linear-gradient(135deg,#2563eb,#4338ca); box-shadow: 0 10px 24px rgba(37,99,235,.28); display: grid; place-items: center; }
.brand-badge span { font-size: 34px; font-weight: 800; color: #fff; letter-spacing: -2px; }
.login-brand h1 { font-size: 21px; font-weight: 800; letter-spacing: -.3px; }
.login-brand p { font-size: 12px; color: var(--muted); margin-top: 6px; }

.wx-primary-wrap { text-align: center; }
.wx-primary-btn { width: 100%; height: 48px; border-radius: 12px; background: #07c160; color: #fff; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 6px 16px rgba(7,193,96,.24); transition: .15s; }
.wx-primary-btn:active { opacity: .88; transform: scale(.99); }
.wx-primary-btn:disabled { opacity: .6; }
.wx-ico { width: 21px; height: 21px; }
.switch-link { display: block; margin: 16px auto 0; color: var(--muted); font-size: 13px; text-decoration: underline; text-underline-offset: 3px; }

.tabs { display: flex; justify-content: center; gap: 40px; margin-bottom: 16px; }
.tabs button { padding: 8px 4px; font-size: 15px; color: var(--muted); border-bottom: 2px solid transparent; }
.tabs button.active { color: var(--primary); font-weight: 700; border-bottom-color: var(--primary); }
.panel { background: var(--card); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 18px; }
.panel-title { font-size: 17px; font-weight: 700; }
.panel-desc { font-size: 12px; color: var(--muted); margin: 4px 0 16px; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.primary-submit { height: 46px; font-size: 15px; }
.wx-user { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: #f0fdf4; margin-bottom: 16px; font-size: 13px; }
.wx-avatar { width: 34px; height: 34px; border-radius: 50%; overflow: hidden; background: #07c160; color: #fff; display: grid; place-items: center; font-weight: 700; }
.wx-avatar :deep(img) { width: 100%; height: 100%; object-fit: cover; }

.oauth-block { margin-top: 22px; }
.oauth-divider { display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: 12px; }
.oauth-divider::before, .oauth-divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }
.oauth-list { display: flex; justify-content: center; gap: 24px; margin-top: 18px; }
.oauth-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.oauth-badge { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; color: #fff; transition: .15s; }
.oauth-badge.wechat { background: #07c160; box-shadow: 0 4px 12px rgba(7,193,96,.22); }
.oauth-item:active .oauth-badge { transform: scale(.92); }
.oauth-glyph { width: 27px; height: 27px; }
.oauth-name { font-size: 12px; color: var(--muted); }

.agree { text-align: center; font-size: 11px; color: var(--muted); line-height: 1.8; margin-top: 24px; }
.agree a { color: var(--primary); }
.back-home { display: block; text-align: center; font-size: 12px; color: var(--muted); margin-top: 12px; text-decoration: underline; text-underline-offset: 3px; }

.modal-mask { position: fixed; inset: 0; z-index: 200; background: rgba(15,23,42,.55); display: grid; place-items: center; padding: 20px; }
.qr-modal { position: relative; width: min(100%, 340px); background: #fff; border-radius: 18px; padding: 26px 22px 22px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,.28); }
.qr-close { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; border-radius: 50%; background: #f1f5f9; color: var(--muted); font-size: 13px; }
.qr-modal h3 { font-size: 17px; font-weight: 700; }
.qr-sub { font-size: 12px; color: var(--muted); margin: 6px 0 18px; }
.qr-frame { position: relative; width: 216px; height: 216px; margin: 0 auto; padding: 12px; }
.qr-frame img { width: 100%; height: 100%; }
.qr-frame.scanning img, .qr-frame.done img, .qr-frame.failed img { filter: blur(3px) grayscale(.6); opacity: .6; }
.qr-loading { width: 100%; height: 100%; display: grid; place-items: center; color: var(--muted); font-size: 12px; background: #f8fafc; }
.corner { position: absolute; width: 22px; height: 22px; border-color: #07c160; border-style: solid; border-width: 0; }
.corner.tl { top: 0; left: 0; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 10px; }
.corner.tr { top: 0; right: 0; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 10px; }
.corner.bl { bottom: 0; left: 0; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 10px; }
.corner.br { bottom: 0; right: 0; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 10px; }
.qr-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; background: rgba(255,255,255,.88); border-radius: 8px; cursor: pointer; }
.qr-overlay b { font-size: 15px; }
.qr-overlay span { font-size: 12px; color: var(--primary); }
.qr-overlay.ok b { font-size: 40px; color: #07c160; }
.qr-overlay.failed b { color: var(--danger); }
.qr-foot { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: var(--muted); margin: 16px 0 0; }
.pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: #07c160; animation: pulse 1.4s infinite; }
@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
.qr-modal .btn { margin-top: 16px; }
</style>
