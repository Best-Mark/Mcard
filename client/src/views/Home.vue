<template>
  <div>
    <header class="topbar">
      <div class="brand">M<em>Card</em></div>
      <div class="spacer"></div>
      <router-link to="/me">我的名片</router-link>
      <router-link to="/admin" class="btn btn-sm btn-ghost">管理后台</router-link>
    </header>

    <section class="hero">
      <div class="container">
        <div class="pill">数字名片 · 一扫即存 · 永久有效</div>
        <h1>一张名片，<br><span>走遍所有社交场。</span></h1>
        <p class="sub">二维码终身不变，资料随时更新。电话、微信、地址一键保存进通讯录，还能直接导出印刷级实体名片版式。</p>
        <div class="btn-row hero-actions">
          <router-link to="/me" class="btn btn-primary btn-lg">免费创建名片 →</router-link>
          <router-link to="/market" class="btn btn-ghost btn-lg">逛名片集市 ⌖</router-link>
        </div>
        <div class="hero-card">
          <div class="mini-cover"></div>
          <div class="mini-body">
            <div class="mini-avatar">李</div>
            <b>李知远</b><span>品牌顾问 · 远见设计</span>
            <div class="mini-tags"><i>扫码存通讯录</i><i>地图导航</i><i>实体名片下载</i></div>
          </div>
        </div>
      </div>
    </section>

    <section id="features" class="container page">
      <div class="section-title">为每一次交换而生 <small>把名片做成真正的入口</small></div>
      <div class="features">
        <div v-for="f in features" :key="f.t" class="card card-pad feature">
          <div class="feature-ico">{{ f.i }}</div>
          <b>{{ f.t }}</b>
          <p>{{ f.d }}</p>
        </div>
      </div>

      <div class="section-title">三步开始</div>
      <div class="steps card card-pad">
        <div><b>01</b><span>注册并填写资料</span></div>
        <div><b>02</b><span>开通时段套餐</span></div>
        <div><b>03</b><span>分享二维码 / 下载印刷</span></div>
      </div>
      <p class="center small muted" style="margin-top:28px">{{ siteConfig.site_name }} · {{ siteConfig.site_desc }}</p>
    </section>
  </div>
</template>

<script setup>
import { siteConfig } from '../store'
const features = [
  { i: '◎', t: '稳定二维码', d: '链接一次生成、终身不变；改头像改职位改地址，二维码图案始终如一，印在实体名片上也不会作废。' },
  { i: '◉', t: '一键存通讯录', d: '标准 vCard 文件，iPhone、安卓、微信、Outlook 都能导入，告别手输号码。' },
  { i: '⌖', t: '地址直接导航', d: '高德、百度、腾讯、Apple、Google 地图一键唤起，客户按图索骥。' },
  { i: '▤', t: '实体名片版式', d: '90×54mm 标准尺寸、3mm 出血与安全线，SVG / 300dpi PNG 直接交付印厂。' },
  { i: '⇄', t: '双向交换名片', d: '扫对方二维码即可互换电子名片，交换记录自动留存，商务社交不漏人。' },
  { i: '▥', t: '模板 × 主题自由搭配', d: '经典、极简、黑金、活力四套展示模板，叠加多款配色主题，排版与气质都由你定，编辑时实时预览。' }
]
</script>

<style scoped>
.hero { background: radial-gradient(1200px 500px at 20% -10%, #dbeafe, transparent), linear-gradient(180deg,#f8fbff,#fff); padding: 66px 0 30px; }
.hero .container { text-align: center; }
.pill { display: inline-block; padding: 6px 14px; border-radius: 999px; background: #e0e7ff; color: #3730a3; font-size: 12px; font-weight: 700; }
h1 { font-size: clamp(34px, 7vw, 62px); line-height: 1.14; letter-spacing: -2px; margin: 20px 0 14px; }
h1 span { background: linear-gradient(120deg,#2563eb,#7c3aed); -webkit-background-clip: text; background-clip: text; color: transparent; }
.sub { max-width: 620px; margin: 0 auto; color: var(--muted); font-size: 15px; }
.hero-actions { justify-content: center; margin: 26px 0 40px; }
.hero-card { width: min(100%, 420px); margin: 0 auto; border-radius: 22px; overflow: hidden; background: #fff; box-shadow: 0 24px 70px rgba(30,58,138,.18); text-align: left; border: 1px solid var(--line); }
.mini-cover { height: 96px; background: linear-gradient(135deg,#17357c,#2563eb 55%,#38bdf8); }
.mini-body { padding: 0 20px 22px; position: relative; }
.mini-avatar { width: 62px; height: 62px; border-radius: 50%; background: #fff; color: #2563eb; display: grid; place-items: center; font-size: 24px; font-weight: 800; border: 4px solid #fff; margin-top: -32px; box-shadow: 0 4px 12px rgba(0,0,0,.1); }
.mini-body b { display: block; font-size: 19px; margin-top: 8px; }
.mini-body > span { color: var(--muted); font-size: 12px; }
.mini-tags { display: flex; gap: 6px; margin-top: 14px; flex-wrap: wrap; }
.mini-tags i { font-style: normal; font-size: 11px; background: #eff6ff; color: #1d4ed8; padding: 4px 9px; border-radius: 999px; }
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.feature b { display: block; margin: 10px 0 6px; }
.feature p { color: var(--muted); font-size: 12px; }
.feature-ico { width: 38px; height: 38px; border-radius: 11px; background: #eff6ff; color: var(--primary); display: grid; place-items: center; font-size: 20px; }
.steps { display: flex; gap: 20px; flex-wrap: wrap; }
.steps div { flex: 1; min-width: 160px; display: flex; align-items: center; gap: 12px; }
.steps b { font-size: 26px; color: var(--primary); opacity: .35; }
</style>
