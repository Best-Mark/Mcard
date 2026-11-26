// 全面邀请唯一真相源（H5）：任何分享出口都用 withInvite() 处理链接，自动带上当前用户的邀请码。
// 后端只认推广员：/api/promo/my-code 对非推广员返回空码，所以「分享即邀请、仅推广员计入」天然成立。
// 铁律：① invite 参数名全端统一（后端 bindInvite 收 invite）；② 已带码的链接不覆盖（防转发时把上游码洗掉）；
// ③ 取码失败静默降级为不带码，绝不阻塞分享主流程；④ 每次登录/码变化要刷新缓存（clearInviteCache）。
import api from '../api'

let inviteCode = null       // null=未取；''=确认无码（非推广员/未登录）
let fetching = null

export function clearInviteCache() { inviteCode = null; fetching = null }

export async function loadMyInviteCode() {
  if (inviteCode !== null) return inviteCode
  if (fetching) return fetching
  fetching = (async () => {
    try {
      // X-Silent-Auth：取码失败静默降级为空码（调用方有 catch），401 拦截器看到该头不跳登录页。
      // 本接口在每页分享兜底链路都会被匿名调用，绝不能因为 401 把访客踢去登录（2026-11-26 实锤）。
      const { data } = await api.get('/api/promo/my-code', { headers: { 'X-Silent-Auth': '1' } })
      inviteCode = String(data?.data?.inviteCode || '')
    } catch { inviteCode = '' } // 未登录/非推广员/网络异常一律空码，不打扰用户
    finally { fetching = null }
    return inviteCode
  })()
  return fetching
}

// 给分享链接拼上当前用户邀请码；异步取码完成前先返回原链（不阻塞分享），
// 取到后由调用方在下次配置分享时自动生效（wx-share 每次路由都重设卡片）。
export async function withInviteAsync(raw) {
  const code = await loadMyInviteCode()
  return withInvite(raw, code)
}

export function withInvite(raw, code = inviteCode) {
  const url = String(raw || '')
  if (!code || !url) return url
  try {
    const u = new URL(url, window.location.origin)
    if (u.searchParams.has('invite')) return url // 已带码（含上游转发）不覆盖
    u.searchParams.set('invite', code)
    return u.toString()
  } catch { return url }
}

// 供 wx-share 同步使用：命中缓存直接拼；未命中返回原链并异步预热，下次分享即带码。
export function withInviteCached(raw) {
  if (inviteCode === null) { loadMyInviteCode().catch(() => {}) }
  return withInvite(raw)
}
