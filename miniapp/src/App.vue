<script>
export default {
  onLaunch() {
    // 域名不写死：发布构建前通过 VITE_API_BASE 注入线上域名（见 utils/request.js）
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
