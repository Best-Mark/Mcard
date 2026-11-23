<script>
export default {
  onLaunch() {
    // 正式部署把 utils/request.js 的 API_BASE 改成线上域名
  },
  onShareAppMessage() {
    return { title: 'MCard 电子名片 · 一扫即存', path: '/pages/index/index' }
  }
}
</script>

<style>
page {
  background: #f5f7fb;
  color: #162033;
  font-size: 28rpx;
}
</style>
