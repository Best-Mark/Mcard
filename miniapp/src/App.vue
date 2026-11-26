<script>
import { prefetchShareCard, getShareCardTitle, getShareCardImage, saveInvite, loadMyInvite, withInvite } from './utils/request'

function captureInvite(options) {
  const q = options?.query || {}
  const code = q.invite || q.invite_code || q.ref
  if (code) saveInvite(code)
}

export default {
  onLaunch(options) {
    // 邀请归因零丢失：冷启动带邀请参数（分享链接 / 扫码进入）先落地，登录后统一回传绑定
    captureInvite(options)
    // 域名不写死：发布构建前通过 VITE_API_BASE 注入线上域名（见 utils/request.js）
    // 预取分享素材池：onLaunch 异步拉取，不阻塞启动；失败静默回落内置文案（对齐 MShop）
    prefetchShareCard()
    // 全面邀请：预热当前推广员邀请码，分享回调是同步的，提前存本地缓存才能带上码
    loadMyInvite().catch(() => {})
  },
  onShow(options) {
    // 热启动从后台/分享链接回来同样捕获邀请码
    captureInvite(options)
  },
  // 全局分享兜底：未单独配 onShareAppMessage 的页面用素材池随机标题/缩略图，避免裸链接
  onShareAppMessage() {
    // 全面邀请：分享自动带当前推广员邀请码（非推广员无码，原样返回）
    const card = { title: getShareCardTitle(), path: withInvite('/pages/index/index') }
    const imageUrl = getShareCardImage()
    if (imageUrl) card.imageUrl = imageUrl
    return card
  },
  onShareTimeline() {
    const card = { title: getShareCardTitle() }
    // 朋友圈分享 query 只接受参数串（无前导 ?）
    const withCode = withInvite('/pages/index/index')
    const qi = withCode.indexOf('?')
    if (qi >= 0) card.query = withCode.slice(qi + 1)
    const imageUrl = getShareCardImage()
    if (imageUrl) card.imageUrl = imageUrl
    return card
  }
}
</script>

<style>
page {
  background: #f7f2e7;
  color: #2b2118;
  font-size: 28rpx;
}
</style>
