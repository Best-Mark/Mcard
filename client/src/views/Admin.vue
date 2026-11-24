<template>
  <!-- 后台登录 -->
  <div v-if="!logged" class="login-page">
    <div class="login-bg"><ParticleField color="#8fd0ff" line="rgba(143,208,255,.26)" :density="1.3" /></div>
    <div class="login-card card">
      <div class="login-logo">M</div>
      <div class="brand">M<em>Card</em> <small>管理后台</small></div>
      <h2>欢迎回来</h2>
      <p class="small muted">使用管理员账号登录运营控制台</p>
      <div class="field"><label>账号（手机号）</label><input v-model.trim="phone" class="input" placeholder="管理员手机号" @keyup.enter="login" /></div>
      <div class="field"><label>密码</label><input v-model="password" class="input" type="password" placeholder="登录密码" @keyup.enter="login" /></div>
      <button class="btn btn-primary btn-block btn-lg" :disabled="busy" @click="login">{{ busy ? '登录中…' : '登录后台' }}</button>
      <p class="small muted login-tip">初始账号 admin / admin123456，部署后请立即修改</p>
      <router-link to="/" class="small muted login-back">← 返回前台</router-link>
    </div>
  </div>

  <!-- 后台主体 -->
  <div v-else class="admin-layout">
    <div v-if="sideOpen" class="side-overlay" @click="sideOpen = false"></div>
    <aside class="side" :class="{ open: sideOpen }">
      <div class="side-brand">
        <span class="side-logo">M</span>
        <div>M<em>Card</em><small>管理控制台 · v{{ updateInfo.current || '—' }}{{ updateInfo.commit ? ' #' + updateInfo.commit : '' }}</small></div>
      </div>
      <div class="side-label">工作台</div>
      <button v-for="m in mainMenus" :key="m.k" :class="{ on: tab === m.k }" @click="switchTab(m.k)">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in ic(m.i)" :key="i" :d="d" /></svg>
        <span>{{ m.t }}</span>
      </button>
      <div class="side-label">系统</div>
      <button v-for="m in sysMenus" :key="m.k" :class="{ on: tab === m.k }" @click="switchTab(m.k)">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in ic(m.i)" :key="i" :d="d" /></svg>
        <span>{{ m.t }}</span>
      </button>
      <div class="side-foot">
        <router-link to="/" target="_blank"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in ic('external')" :key="i" :d="d" /></svg><span>查看前台</span></router-link>
        <button @click="logout"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in ic('logout')" :key="i" :d="d" /></svg><span>退出登录</span></button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <button class="icon-btn menu-toggle" title="菜单" @click="sideOpen = !sideOpen">
          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <div class="crumb">管理后台 <span>/</span> <b>{{ currentTitle }}</b></div>
        <div class="spacer"></div>
        <span class="clock">{{ clockText }}</span>
        <button class="icon-btn" :disabled="loading" title="刷新当前页" @click="loadTab(tab)">
          <svg class="ico" :class="{ spin: loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
        </button>
        <div class="who">
          <span class="avatar">{{ (adminAuth.user?.phone || 'AD').slice(-2) }}</span>
          <span class="who-text"><b>{{ adminAuth.user?.nickname || '管理员' }}</b><small>{{ adminAuth.user?.phone }}</small></span>
        </div>
      </header>

      <div class="main-body">
        <!-- 数据概览 -->
        <section v-if="tab === 'overview'">
          <div class="hero">
            <ParticleField color="#bfe3ff" line="rgba(191,227,255,.22)" :density="1.15" />
            <div class="hero-content">
              <span class="hero-tag"><i></i> LIVE · 实时数据</span>
              <h1>运营总览</h1>
              <p>注册、名片、订单与访问动态，一屏掌控</p>
              <div class="hero-meta">
                <span>累计收入 <b>¥{{ ((stats.revenueCents || 0) / 100).toFixed(2) }}</b></span>
                <span>今日浏览 <b>{{ stats.todayViews || 0 }}</b></span>
                <span>开通率 <b>{{ activeRate }}%</b></span>
              </div>
            </div>
            <div class="hero-badge">MCARD<br />ANALYTICS</div>
          </div>

          <div class="kpi-grid">
            <div v-for="k in kpis" :key="k.label" class="kpi card" :class="'tone-' + k.tone">
              <span class="kpi-ico"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in ic(k.i)" :key="i" :d="d" /></svg></span>
              <b class="kpi-val">{{ k.val }}</b>
              <span class="kpi-label">{{ k.label }}</span>
              <small class="kpi-sub">{{ k.sub }}</small>
            </div>
          </div>

          <div class="chart-row">
            <div class="card panel chart-panel">
              <div class="panel-head"><h3>访问趋势</h3><span class="small muted">近 {{ trendPoints.length }} 天 · 共 {{ trendTotal }} 次浏览</span></div>
              <div v-if="trendPoints.length" class="chart-wrap">
                <svg viewBox="0 0 600 150" preserveAspectRatio="none" class="line-chart">
                  <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity=".30" /><stop offset="100%" stop-color="#3b82f6" stop-opacity="0" /></linearGradient></defs>
                  <path d="M0 38 H600 M0 75 H600 M0 112 H600" stroke="#eef2f7" stroke-width="1" fill="none" />
                  <path :d="trendArea" fill="url(#trendFill)" />
                  <polyline :points="trendLine" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                  <circle v-for="p in trendPoints" :key="p.day" :cx="p.x" :cy="p.y" r="2.6" fill="#fff" stroke="#3b82f6" stroke-width="1.8" vector-effect="non-scaling-stroke" />
                </svg>
                <div class="chart-labels"><span v-for="p in trendLabels" :key="p.day">{{ p.day }}</span></div>
              </div>
              <div v-else class="empty">暂无浏览数据</div>
            </div>

            <div class="card panel status-panel">
              <div class="panel-head"><h3>名片状态</h3><span class="small muted">共 {{ stats.cards || 0 }} 张</span></div>
              <div class="status-body">
                <div class="donut" :style="{ background: `conic-gradient(#10b981 0 ${activeRate}%, #e8edf4 ${activeRate}% 100%)` }">
                  <div class="donut-hole"><b>{{ activeRate }}%</b><small>开通率</small></div>
                </div>
                <div class="status-list">
                  <div><span class="dot green"></span><span>已开通</span><b>{{ stats.activeCards || 0 }}</b></div>
                  <div><span class="dot gray"></span><span>草稿 / 过期 / 停用</span><b>{{ (stats.cards || 0) - (stats.activeCards || 0) }}</b></div>
                  <div><span class="dot blue"></span><span>已支付订单</span><b>{{ stats.paidOrders || 0 }}</b></div>
                </div>
              </div>
            </div>
          </div>

          <div class="two-col">
            <div class="card panel">
              <div class="panel-head"><h3>最近订单</h3><button class="link" @click="switchTab('orders')">全部订单 →</button></div>
              <div class="table-wrap"><table><thead><tr><th>订单号</th><th>用户</th><th>套餐</th><th>金额</th><th>状态</th></tr></thead>
                <tbody><tr v-for="o in stats.recentOrders || []" :key="o.id">
                  <td class="mono">{{ o.order_no }}</td><td>{{ o.phone }}</td><td>{{ o.package_name }}</td>
                  <td>¥{{ (o.amount_cents / 100).toFixed(2) }}</td>
                  <td><span class="badge" :class="o.status === 'paid' ? 'ok' : 'warn'">{{ o.status }}</span></td>
                </tr></tbody></table></div>
              <div v-if="!(stats.recentOrders || []).length" class="empty">暂无订单</div>
            </div>
            <div class="card panel">
              <div class="panel-head"><h3>最近名片</h3><button class="link" @click="switchTab('cards')">全部名片 →</button></div>
              <div class="table-wrap"><table><thead><tr><th>短码</th><th>姓名</th><th>公司</th><th>状态</th><th>浏览</th></tr></thead>
                <tbody><tr v-for="c in stats.recentCards || []" :key="c.id">
                  <td><router-link :to="`/c/${c.slug}`" target="_blank" class="mono">{{ c.slug }}</router-link></td>
                  <td>{{ c.name }}</td><td>{{ c.company }}</td>
                  <td><span class="badge" :class="c.status === 'active' ? 'ok' : 'off'">{{ c.status }}</span></td><td>{{ c.views }}</td>
                </tr></tbody></table></div>
              <div v-if="!(stats.recentCards || []).length" class="empty">暂无名片</div>
            </div>
          </div>
        </section>

        <!-- 时段套餐 -->
        <section v-if="tab === 'packages'">
          <div class="panel-head stand-alone"><h2>时段套餐</h2><button class="btn btn-primary btn-sm" @click="openPkg()">+ 新建套餐</button></div>
          <div class="card panel">
            <div class="table-wrap"><table><thead><tr><th>名称</th><th>价格</th><th>天数</th><th>权益</th><th>排序</th><th>状态</th><th>操作</th></tr></thead>
              <tbody><tr v-for="p in packages" :key="p.id">
                <td><b>{{ p.name }}</b><div class="small muted">{{ p.description }}</div></td>
                <td>¥{{ (p.price_cents / 100).toFixed(2) }}</td><td>{{ p.duration_days === 0 ? '终身' : p.duration_days + ' 天' }}</td>
                <td class="small muted">{{ (p.features || []).join(' / ') }}</td><td>{{ p.sort }}</td>
                <td><span class="badge" :class="p.enabled ? 'ok' : 'off'">{{ p.enabled ? '上架' : '下架' }}</span></td>
                <td><button class="btn btn-sm btn-ghost" :disabled="busy" @click="openPkg(p)">编辑</button>
                    <button class="btn btn-sm btn-danger" :disabled="busy" @click="delPkg(p)">删除</button></td>
              </tr></tbody></table></div>
            <div v-if="!packages.length" class="empty">还没有套餐，点击右上角新建</div>
          </div>
        </section>

        <!-- 名片 -->
        <section v-if="tab === 'cards'">
          <div class="panel-head stand-alone"><h2>名片管理</h2><span class="small muted">共 {{ cards.length }} 张</span></div>
          <div class="card panel">
            <div class="filter-row"><input v-model.trim="cardQ" class="input" placeholder="搜索姓名 / 公司 / 短码 / 手机号" @keyup.enter="loadCards" />
              <select v-model="cardStatus" class="select" @change="loadCards"><option value="">全部状态</option><option value="active">已开通</option><option value="draft">草稿</option><option value="expired">已过期</option><option value="disabled">已停用</option></select>
              <button class="btn btn-primary" :disabled="loading" @click="loadCards">搜索</button></div>
            <div class="table-wrap"><table><thead><tr><th>短码</th><th>姓名</th><th>公司</th><th>用户</th><th>状态</th><th>浏览</th><th>到期</th><th>操作</th></tr></thead>
              <tbody><tr v-for="c in cards" :key="c.id">
                <td><router-link :to="`/c/${c.slug}`" target="_blank" class="mono">{{ c.slug }}</router-link></td>
                <td>{{ c.name }}</td><td>{{ c.company }}</td><td>{{ c.user_phone }}</td>
                <td><span class="badge" :class="c.status === 'active' ? 'ok' : 'off'">{{ c.status }}</span></td>
                <td>{{ c.views }}</td><td>{{ c.expires_at || '终身' }}</td>
                <td><button class="btn btn-sm btn-ghost" :disabled="busy" @click="setCardStatus(c, 'disabled')">停用</button>
                    <button class="btn btn-sm btn-ok" :disabled="busy" @click="setCardStatus(c, 'active')">启用</button></td>
              </tr></tbody></table></div>
            <div v-if="!cards.length" class="empty">没有符合条件的名片</div>
          </div>
        </section>

        <!-- 订单 -->
        <section v-if="tab === 'orders'">
          <div class="panel-head stand-alone"><h2>订单管理</h2><span class="small muted">共 {{ orders.length }} 笔</span></div>
          <div class="card panel">
            <div class="filter-row"><select v-model="orderStatus" class="select" @change="loadOrders"><option value="">全部状态</option><option value="pending">待支付</option><option value="paid">已支付</option><option value="cancelled">已取消</option></select>
              <button class="btn btn-primary" :disabled="loading" @click="loadOrders">筛选</button></div>
            <div class="table-wrap"><table><thead><tr><th>订单号</th><th>用户</th><th>套餐</th><th>金额</th><th>状态</th><th>支付单号</th><th>时间</th><th>操作</th></tr></thead>
              <tbody><tr v-for="o in orders" :key="o.id">
                <td class="mono">{{ o.order_no }}</td><td>{{ o.user_phone }}</td><td>{{ o.package_name }}</td>
                <td>¥{{ (o.amount_cents / 100).toFixed(2) }}</td>
                <td><span class="badge" :class="o.status === 'paid' ? 'ok' : 'warn'">{{ o.status }}</span></td>
                <td class="small muted">{{ o.pay_no || '-' }}</td><td>{{ o.created_at }}</td>
                <td><button v-if="o.status !== 'paid'" class="btn btn-sm btn-primary" :disabled="busy" @click="markPaid(o)">标记已支付</button></td>
              </tr></tbody></table></div>
            <div v-if="!orders.length" class="empty">没有符合条件的订单</div>
          </div>
        </section>

        <!-- 用户 -->
        <section v-if="tab === 'users'">
          <div class="panel-head stand-alone"><h2>用户管理</h2><span class="small muted">共 {{ users.length }} 位</span></div>
          <div class="card panel">
            <div class="table-wrap"><table><thead><tr><th>手机号</th><th>昵称</th><th>角色</th><th>名片数</th><th>已付订单</th><th>状态</th><th>操作</th></tr></thead>
              <tbody><tr v-for="u in users" :key="u.id">
                <td>{{ u.phone }}</td><td>{{ u.nickname }}</td><td>{{ u.role }}</td><td>{{ u.card_count }}</td><td>{{ u.paid_orders }}</td>
                <td><span class="badge" :class="u.status === 'active' ? 'ok' : 'off'">{{ u.status }}</span></td>
                <td><button class="btn btn-sm btn-ghost" :disabled="busy || u.role === 'super_admin'" @click="setUserStatus(u)">{{ u.status === 'active' ? '停用' : '启用' }}</button></td>
              </tr></tbody></table></div>
            <div v-if="!users.length" class="empty">暂无用户</div>
          </div>
        </section>

        <!-- 定位管理：行政区划 -->
        <section v-if="tab === 'regions'" class="region-section">
          <div class="panel-head stand-alone"><h2>定位管理</h2><span class="small muted">省 / 市 / 区 / 街道四级行政区划 · 高德 Key 在「配置中心 → 定位与地图」设置</span></div>
          <div class="panel card">
            <div class="region-toolbar">
              <div class="region-filters">
                <select v-model="regionLevel" class="select" @change="loadRegions">
                  <option :value="0">全部层级</option>
                  <option :value="1">省 / 直辖市</option>
                  <option :value="2">城市</option>
                  <option :value="3">区 / 县</option>
                  <option :value="4">街道 / 乡镇</option>
                </select>
                <button class="btn btn-sm" :disabled="regionBusy" @click="loadRegions">刷新</button>
              </div>
              <button class="btn btn-sm btn-primary" :disabled="regionBusy" @click="newRegion">+ 新增区域</button>
            </div>

            <div class="region-form" v-if="regionForm.code || regionEditing">
              <div class="field"><label>区域编码</label><input v-model="regionForm.code" class="input" :disabled="regionEditing" placeholder="如 P上海|浦东" /></div>
              <div class="field"><label>父级编码</label><input v-model="regionForm.parent_code" class="input" placeholder="省级留空；子级填父级 code" /></div>
              <div class="field"><label>名称</label><input v-model="regionForm.name" class="input" placeholder="如 浦东" /></div>
              <div class="field"><label>层级</label>
                <select v-model.number="regionForm.level" class="select">
                  <option :value="1">省/直辖市</option><option :value="2">城市</option><option :value="3">区/县</option><option :value="4">街道/乡镇</option>
                </select>
              </div>
              <div class="field"><label>排序</label><input v-model.number="regionForm.sort" class="input" type="number" /></div>
              <div class="field"><label>启用</label><select v-model="regionForm.enabled" class="select"><option :value="true">启用</option><option :value="false">停用</option></select></div>
              <div class="region-form-actions">
                <button class="btn btn-sm btn-primary" :disabled="regionBusy" @click="saveRegion">{{ regionEditing ? '保存修改' : '新增' }}</button>
                <button class="btn btn-sm btn-ghost" @click="regionForm = { code:'', parent_code:'', name:'', level:1, sort:0, enabled:true }; regionEditing = false">取消</button>
              </div>
            </div>

            <div class="table-wrap"><table><thead><tr><th>编码</th><th>名称</th><th>层级</th><th>父级编码</th><th>排序</th><th>状态</th><th>操作</th></tr></thead>
              <tbody><tr v-for="r in regions" :key="r.code">
                <td class="mono small">{{ r.code }}</td><td>{{ r.name }}</td><td>{{ LEVEL_NAMES[r.level] || r.level }}</td>
                <td class="mono small">{{ r.parent_code || '—' }}</td><td>{{ r.sort }}</td>
                <td><span class="badge" :class="r.enabled ? 'ok' : 'off'">{{ r.enabled ? '启用' : '停用' }}</span></td>
                <td><button class="btn btn-sm btn-ghost" :disabled="regionBusy" @click="editRegion(r)">编辑</button>
                    <button class="btn btn-sm btn-ghost" :disabled="regionBusy" @click="deleteRegion(r)">删除</button></td>
              </tr></tbody></table></div>
            <div v-if="!regions.length && !regionBusy" class="empty">暂无区域数据</div>
            <p class="small muted" style="margin-top:10px">共 {{ regions.length }} 条。级联编码用「|」连接父级（如 <span class="mono">P上海|浦东</span>）。删除某区域会级联删除其下级。</p>
          </div>
        </section>

        <!-- 对象存储 OSS -->
        <section v-if="tab === 'oss'" class="oss-section">
          <div class="panel-head stand-alone"><h2>对象存储</h2><span class="small muted">多项目共用一个 Bucket 时，靠「项目路径前缀」隔离目录</span></div>
          <div class="panel card">
            <div class="oss-status">
              <div class="oss-status-item"><span class="small muted">当前状态</span><b><span class="badge" :class="ossStatus.enabled ? 'ok' : 'off'">{{ ossStatus.enabled ? '云存储已启用' : '本地存储' }}</span></b></div>
              <div class="oss-status-item"><span class="small muted">存储方式</span><b>{{ ossStatus.provider }}</b></div>
              <div class="oss-status-item"><span class="small muted">项目路径</span><b class="mono">{{ ossStatus.pathPrefix || '—' }}/uploads/</b></div>
              <div class="oss-status-item"><span class="small muted">Bucket</span><b class="mono">{{ ossStatus.bucket || '—' }}</b></div>
              <div class="oss-status-item"><span class="small muted">地域</span><b>{{ ossStatus.region || '—' }}</b></div>
              <div class="oss-actions">
                <button class="btn btn-sm" :disabled="ossBusy" @click="loadOss">刷新</button>
                <button class="btn btn-sm btn-primary" :disabled="ossBusy" @click="testOss">{{ ossBusy ? '检测中…' : '连通性自检' }}</button>
                <button class="btn btn-sm btn-ghost" :disabled="ossBusy" @click="goOssConfig">去配置</button>
              </div>
            </div>
            <p class="small muted" style="margin:12px 0;padding:10px 12px;background:var(--bg-page,#f8fafc);border-radius:8px">
              上传的图片会自动同步到云存储（失败自动回落本地，不影响使用）。配置在「配置中心 → 对象存储 OSS」；<b>项目路径前缀</b>决定本项目文件落在 Bucket 的哪个目录，改前缀后旧对象不会迁移。密钥只写不读，留空即沿用已保存值。
            </p>

            <!-- 存量图片同步：保存 OSS 配置后自动触发，也可手动启动/停止；服务端单例，刷新不丢 -->
            <div class="oss-migrate">
              <div class="oss-migrate-head">
                <b>存量图片同步</b>
                <span class="small muted" v-if="migrate.ossPrefer">✅ OSS 优先已激活（图片走 CDN，本地保留兜底）</span>
                <span class="small muted" v-else>⏳ 尚未全量同步，图片仍走本地</span>
              </div>
              <p class="small muted" style="margin:6px 0 10px">
                保存 OSS 配置后会自动把服务器 uploads/ 里已有图片上传到云端，并把数据库里的图片地址换成 OSS 链接。已上传的自动跳过，中断后可从断点继续；全部成功且 0 失败才切换为 OSS 优先。
              </p>
              <div class="oss-migrate-actions">
                <button class="btn btn-sm btn-primary" :disabled="ossMigrateBusy || migrate.running || !ossStatus.enabled" @click="runMigrate">
                  {{ migrate.running ? '同步中…' : (migrate.total ? '继续 / 重新同步' : '开始同步') }}
                </button>
                <button v-if="migrate.running" class="btn btn-sm" @click="stopMigrate">停止</button>
                <span v-if="!ossStatus.enabled" class="small muted">需先启用 OSS 配置</span>
              </div>
              <div v-if="migrate.total" class="oss-migrate-progress">
                <div class="oss-bar"><i :style="{ width: migratePct + '%' }"></i></div>
                <div class="small muted" style="margin-top:6px">
                  {{ migrate.running ? '同步中' : (migrate.failed ? '已停止/完成' : '同步完成') }}：
                  {{ migrate.done + migrate.skipped }} / {{ migrate.total }}
                  （上传 {{ migrate.done }} · 跳过 {{ migrate.skipped }} · 失败 {{ migrate.failed }}<span v-if="migrate.backfilled"> · 回填 {{ migrate.backfilled }} 条地址</span>）
                  <span v-if="migrate.running">，可随时停止，下次续跑</span>
                </div>
                <div v-if="migrate.lastError" class="small" style="color:#c0392b;margin-top:4px;word-break:break-all">最近失败：{{ migrate.lastError }}</div>
              </div>
            </div>

            <div class="oss-files-head">
              <b>云端文件 <span class="small muted">({{ ossFilteredFiles.length }})</span></b>
              <input v-model="ossFilter" class="input" placeholder="筛选文件名" />
            </div>
            <div v-if="!ossStatus.enabled" class="empty small">云存储未启用：新上传的文件保存在本地。要启用请先在配置中心填写 OSS 参数。</div>
            <div v-else-if="!ossFiles.length && !ossBusy" class="empty small">项目路径下暂无对象（上传图片后会自动出现在这里）</div>
            <div v-else class="table-wrap"><table><thead><tr><th>文件名</th><th>对象 key</th><th>大小</th><th>更新时间</th><th>操作</th></tr></thead>
              <tbody><tr v-for="f in ossFilteredFiles" :key="f.key">
                <td><a :href="f.url" target="_blank" rel="noopener">{{ f.name }}</a></td>
                <td class="mono small">{{ f.key }}</td>
                <td>{{ fmtSize(f.size) }}</td>
                <td class="small muted">{{ f.lastModified }}</td>
                <td><a class="btn btn-sm btn-ghost" :href="f.url" target="_blank" rel="noopener">查看</a>
                    <button class="btn btn-sm btn-ghost" :disabled="ossBusy" @click="deleteOssFile(f)">删除</button></td>
              </tr></tbody></table></div>
          </div>
        </section>

        <!-- 配置中心 -->
        <section v-if="tab === 'config'" class="config-section">
          <div class="panel-head stand-alone"><h2>配置中心</h2><span class="small muted">分组管理 · 保存后立即生效</span></div>
          <div class="config-layout">
            <aside class="config-nav card">
              <button v-for="g in cfgGroups" :key="g.key" :class="{ on: g.key === activeGroup }" @click="activeGroup = g.key">
                <span class="cfg-ico"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in ic(groupMeta(g.key).i)" :key="i" :d="d" /></svg></span>
                <span class="cfg-text"><b>{{ g.label }}</b><small>{{ groupDone(g) }}/{{ (g.fields || []).length }} 项已配置</small></span>
                <span class="cfg-bar"><i :style="{ width: (groupDone(g) / Math.max(1, (g.fields || []).length) * 100) + '%' }"></i></span>
              </button>
              <div class="cfg-nav-foot">参数由服务端统一下发<br />密钥类只写不读 · 不留明文</div>
            </aside>

            <div class="config-main card panel" v-if="currentGroup">
              <div class="panel-head inner"><h3>{{ currentGroup.label }}</h3><span class="small muted">{{ groupMeta(activeGroup).desc }}</span></div>
              <div class="cfg-fields">
                <div class="field" v-for="f in currentGroup.fields" :key="f.key">
                  <label>
                    {{ f.label }}
                    <span v-if="f.type === 'secret' && cfg[f.key + '_fp']" class="badge ok small">已配置 · 指纹 {{ cfg[f.key + '_fp'] }}</span>
                    <button v-if="f.type === 'secret'" class="eye" :title="revealed[f.key] ? '隐藏' : '显示'" @click="revealed[f.key] = !revealed[f.key]">
                      <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path :d="revealed[f.key] ? ICONS.eyeOff[0] : ICONS.eye[0]" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  </label>
                  <!-- OSS 地域：按 provider 出常用地域下拉，存量自定义值自动落「其它」手输（对齐 MShop） -->
                  <div v-if="f.key === 'oss_region'" class="cfg-region">
                    <select v-model="ossRegionPick" class="select">
                      <option value="" disabled>请选择地域</option>
                      <option v-for="r in ossRegionOptions" :key="r.v" :value="r.v">{{ r.label }}</option>
                      <option value="__custom__">其它（手动输入）</option>
                    </select>
                    <input v-if="ossRegionPick === '__custom__'" v-model="cfg.oss_region" class="input" placeholder="如 oss-cn-xulin / ap-xxx" />
                  </div>
                  <select v-else-if="optionsFor(f.key)" v-model="cfg[f.key]" class="select">
                    <option v-for="op in optionsFor(f.key)" :key="op[0]" :value="op[0]">{{ op[1] }}</option>
                  </select>
                  <div v-else-if="f.type === 'hidden'" class="cfg-static">{{ cfg[f.key] ? cfg[f.key] : '未上传' }}</div>
                  <div v-else-if="f.type === 'file'" class="cfg-file">
                    <label class="cfg-file-btn">
                      <input type="file" accept=".txt,text/plain" @change="onVerifyFileChosen($event)" />
                      {{ cfg.wechat_oauth_verify_name ? '重新选择文件' : '选择 MP_verify_xxx.txt' }}
                    </label>
                    <span class="small muted">{{ cfg.wechat_oauth_verify_name ? '已载入：' + cfg.wechat_oauth_verify_name + '（点保存后生效）' : '从微信公众平台下载后直接上传，无需填写路径或内容' }}</span>
                  </div>
                  <textarea v-else-if="f.large" v-model="cfg[f.key]" class="textarea" rows="5" :placeholder="f.type === 'secret' ? (cfg[f.key] ? '留空则不修改已保存的密钥' : '粘贴 PEM 全文') : ''"></textarea>
                  <input v-else v-model="cfg[f.key]" class="input" :type="f.type === 'secret' && !revealed[f.key] ? 'password' : 'text'"
                         :placeholder="f.type === 'secret' ? (cfg[f.key] ? '•••••• 已配置，留空不改' : '未配置') : ''" />
                </div>
              </div>

              <div v-if="activeGroup === 'sms'" class="sms-test">
                <div class="panel-head inner"><h3>测试发送</h3><span class="small muted">验证短信配置是否正确</span></div>
                <div class="sms-row"><input v-model="smsPhone" class="input" placeholder="接收测试码的手机号" />
                  <button class="btn btn-primary" :disabled="smsBusy" @click="testSms">{{ smsBusy ? '发送中…' : '发送测试码' }}</button></div>
              </div>

              <div class="cfg-actions">
                <span class="small muted">保存仅影响当前分组，其他分组不受影响</span>
                <button class="btn btn-primary" :disabled="busy" @click="saveGroup">{{ busy ? '保存中…' : '保存「' + currentGroup.label + '」' }}</button>
              </div>
            </div>
          </div>
        </section>

        <!-- 版本更新 -->
        <section v-if="tab === 'update'">
          <div class="panel-head stand-alone"><h2>版本更新</h2><span class="small muted">检查版本 · 自动更新 · 服务管理</span></div>

          <!-- 状态总览：版本对比 + 状态标识 + 操作 -->
          <div class="upd-overview card">
            <div class="upd-overview-main">
              <div class="upd-ver">
                <span class="upd-ver-label">当前运行</span>
                <div class="upd-ver-num">v{{ updateInfo.current || '—' }}</div>
                <div class="upd-ver-hash mono">#{{ updateInfo.runningCommit || updateInfo.commit || '—' }}</div>
              </div>
              <div class="upd-ver-arrow">→</div>
              <div class="upd-ver">
                <span class="upd-ver-label">最新版本</span>
                <div class="upd-ver-num" :class="{ 'is-new': checkResult?.hasUpdate }">{{ checkResult ? 'v' + checkResult.latest : '—' }}</div>
                <div class="upd-ver-hash mono">{{ checkResult?.remoteCommit ? '#' + checkResult.remoteCommit : '未检查' }}</div>
              </div>
              <div class="upd-status">
                <span v-if="updateInfo.needsRestart" class="upd-pill warn">需重启生效</span>
                <span v-else-if="checkResult?.hasUpdate" class="upd-pill new">发现新版本</span>
                <span v-else-if="checkResult" class="upd-pill ok">已是最新版本</span>
                <span v-else class="upd-pill idle">未检查</span>
                <div class="upd-status-meta">
                  <span>检查于 {{ fmtTime(updateInfo.config?.lastCheck) }}</span>
                  <span>任务 {{ updateInfo.busy ? '执行中…' : '空闲' }}</span>
                </div>
              </div>
            </div>

            <div class="upd-ops">
              <div class="upd-ops-btns">
                <button class="btn btn-primary" :disabled="updBusy || restartBusy" @click="checkUpdate">{{ updBusy ? '检查中…' : '检查更新' }}</button>
                <button v-if="checkResult?.hasUpdate" class="btn btn-ok" :disabled="updBusy || restartBusy" @click="applyOpen = true">立即更新</button>
                <button v-if="updateInfo.needsRestart" class="btn btn-warn" :disabled="restartBusy || updBusy" @click="restartService">{{ restartBusy ? '重启中…' : '重启服务使新代码生效' }}</button>
              </div>
              <div class="upd-ops-note small muted">更新来源 GitHub Release · 拉取代码后按需重建前端并重启服务</div>
            </div>
          </div>

          <!-- 状态提示条 -->
          <div v-if="updateInfo.needsRestart" class="upd-notice warn">
            <div class="upd-notice-ico">!</div>
            <div><b>代码已更新，但运行中的服务还是旧版本</b><span>运行进程 #{{ updateInfo.runningCommit }} → 磁盘代码 #{{ updateInfo.commit }}。git 拉取不会重载已启动的进程，需重启后才能生效。</span></div>
          </div>
          <div v-else-if="checkResult?.hasUpdate" class="upd-notice info">
            <div class="upd-notice-ico">↓</div>
            <div><b>发现新版本 v{{ checkResult.latest }}</b><span>点击「立即更新」拉取代码、重建前端并按需重启服务。</span></div>
          </div>
          <div v-if="checkResult?.stale" class="upd-notice info">
            <div class="upd-notice-ico">i</div>
            <div><b>网络不可用，显示上次检查结果</b><span>{{ checkResult.error || '远端暂不可达，结果来自本地缓存。' }}</span></div>
          </div>

          <!-- 进度 -->
          <div v-if="progressVisible" class="upd-progress">
            <div class="upd-progress-head"><b>{{ progress.step }}</b><span class="small muted">{{ progress.pct }}%</span></div>
            <div class="upd-progress-track"><i :style="{ width: Math.max(2, progress.pct) + '%' }"></i></div>
            <p v-if="progress.detail" class="small muted" style="margin-top:8px">{{ progress.detail }}</p>
            <p v-if="progress.error" class="small" style="margin-top:8px;color:#b91c1c">{{ progress.error }}</p>
          </div>

          <!-- 详情：左侧记录 / 右侧设置 -->
          <div class="upd-cols">
            <div class="upd-col">
              <div v-if="checkResult" class="card panel upd-card">
                <div class="panel-head inner"><h3>更新说明</h3><span class="small muted">来源 {{ checkResult.source }}</span></div>
                <pre class="upd-notes">{{ checkResult.notes || '无更新说明' }}</pre>
                <a v-if="checkResult.url" :href="checkResult.url" target="_blank" class="small" style="color:var(--primary)">查看发布页 ↗</a>
              </div>
              <div v-if="updateInfo.config?.lastResult" class="card panel upd-card">
                <div class="panel-head inner"><h3>最近一次记录</h3></div>
                <pre class="upd-notes">{{ JSON.stringify(updateInfo.config.lastResult, null, 2) }}</pre>
              </div>
              <div v-if="!checkResult && !updateInfo.config?.lastResult" class="card panel upd-card">
                <div class="upd-empty">还没有检查记录，点击「检查更新」开始</div>
              </div>
            </div>
            <div class="upd-col">
              <div class="card panel upd-card">
                <div class="panel-head inner"><h3>自动更新设置</h3></div>
                <div class="field"><label>GitHub 仓库（所有者/仓库名）</label><input v-model="updCfg.repo" class="input" /></div>
                <div class="field"><label>分支</label><input v-model="updCfg.branch" class="input" /></div>
                <div class="grid2">
                  <label class="check"><input type="checkbox" v-model="updCfg.autoCheck" /> 定时自动检查</label>
                  <label class="check"><input type="checkbox" v-model="updCfg.autoApply" /> 发现新版本自动更新</label>
                </div>
                <div class="field" style="margin-top:12px"><label>检查间隔（小时，1–720）</label><input v-model.number="updCfg.intervalHours" class="input" type="number" min="1" max="720" /></div>
                <div class="hint warm" style="margin-bottom:12px">自动更新会直接拉取代码并重启服务，建议先开启「自动检查」确认稳定后再打开自动更新。</div>
                <button class="btn btn-primary" :disabled="updBusy" @click="saveUpdateConfig">保存设置</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <div v-if="applyOpen" class="modal-mask" @click.self="applyOpen = false">
      <div class="modal">
        <h3>确认立即更新？</h3>
        <p>将从 {{ updCfg.repo }} / {{ updCfg.branch }} 拉取代码；如有前后端变更会自动重建。服务端变更会触发进程重启，期间接口短暂不可用。</p>
        <div class="btn-row" style="justify-content:flex-end">
          <button class="btn btn-ghost" @click="applyOpen = false">取消</button>
          <button class="btn btn-primary" :disabled="updBusy" @click="applyUpdate">{{ updBusy ? '更新中…' : '确认更新' }}</button>
        </div>
      </div>
    </div>

    <div v-if="pkgModal" class="modal-mask" @click.self="pkgModal = false">
      <div class="modal">
        <h3>{{ pkgForm.id ? '编辑套餐' : '新建套餐' }}</h3>
        <div class="grid2">
          <div class="field"><label>名称</label><input v-model="pkgForm.name" class="input" /></div>
          <div class="field"><label>价格（元）</label><input v-model.number="pkgPrice" class="input" type="number" min="0" step="0.01" /></div>
          <div class="field"><label>有效天数（填 0 表示终身套餐）</label><input v-model.number="pkgForm.duration_days" class="input" type="number" min="0" /></div>
          <div class="field"><label>排序</label><input v-model.number="pkgForm.sort" class="input" type="number" /></div>
        </div>
        <div class="field"><label>说明</label><input v-model="pkgForm.description" class="input" /></div>
        <div class="field"><label>权益（逗号分隔）</label><input v-model="pkgFeatures" class="input" /></div>
        <label class="check"><input type="checkbox" v-model="pkgForm.enabled" /> 上架销售</label>
        <div class="btn-row" style="justify-content:flex-end;margin-top:16px">
          <button class="btn btn-ghost" @click="pkgModal = false">取消</button>
          <button class="btn btn-primary" :disabled="busy" @click="savePkg">{{ busy ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import api from '../api'
import ParticleField from '../components/ParticleField.vue'
import { adminAuth, setAdminAuth, adminLogout, showToast } from '../store'

const ICONS = {
  overview: ['M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z'],
  package: ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.3 7 12 12l8.7-5', 'M12 22V12'],
  card: ['M2 5h20v14H2z', 'M2 10h20', 'M6 15h6'],
  order: ['M6 2h12v20l-3-2-3 2-3-2-3 2z', 'M9 8h6', 'M9 12h6'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  config: ['M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3', 'M1 14h6M9 8h6M17 16h6'],
  update: ['M21 2v6h-6', 'M3 12a9 9 0 0 1 15-6.7L21 8', 'M3 22v-6h6', 'M21 12a9 9 0 0 1-15 6.7L3 16'],
  external: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14 21 3'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  mail: ['M4 4h16v16H4z', 'M4 6l8 6 8-6'],
  phone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2.1z'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'],
  eyeOff: ['M17.9 17.9A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9', 'M9.9 4.2A10 10 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2', 'M1 1l22 22'],
  trend: ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  check: ['M20 6 9 17l-5-5'],
  wechat: ['M9 4C5.1 4 2 6.5 2 9.6c0 1.8 1 3.5 2.6 4.6L4 17l2.6-1.3c.8.2 1.6.4 2.4.4h.4a5 5 0 0 1-.2-1.3c0-3 3-5.5 6.7-5.5h.5C15.6 6.3 12.6 4 9 4ZM6.5 8.4a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4.6 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z', 'M22 13.7c0-2.5-2.5-4.6-5.6-4.6s-5.6 2-5.6 4.6 2.5 4.6 5.6 4.6c.7 0 1.3-.1 1.9-.3l1.8.9-.5-1.6c1.5-.9 2.4-2.1 2.4-3.6Zm-7.5-1.2a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Zm3.7 0a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Z'],
  yuan: ['M12 2v20', 'M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6'],
  location: ['M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z', 'M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  cloud: ['M18 10h-1.3A7 7 0 1 0 6 16.7V18a2 2 0 0 0 2 2h10a4 4 0 0 0 0-10z']
}
const ic = n => ICONS[n] || ICONS.overview

const menus = [
  { k: 'overview', t: '数据概览', i: 'overview', group: 'main' }, { k: 'packages', t: '时段套餐', i: 'package', group: 'main' },
  { k: 'cards', t: '名片管理', i: 'card', group: 'main' }, { k: 'orders', t: '订单管理', i: 'order', group: 'main' },
  { k: 'users', t: '用户管理', i: 'users', group: 'main' }, { k: 'config', t: '配置中心', i: 'config', group: 'sys' },
  { k: 'regions', t: '定位管理', i: 'location', group: 'sys' },
  { k: 'oss', t: '对象存储', i: 'cloud', group: 'sys' },
  { k: 'update', t: '版本更新', i: 'update', group: 'sys' }
]
const mainMenus = menus.filter(m => m.group === 'main')
const sysMenus = menus.filter(m => m.group === 'sys')
const logged = computed(() => !!adminAuth.token)
const currentTitle = computed(() => menus.find(m => m.k === tab.value)?.t || '')

const phone = ref(''); const password = ref(''); const busy = ref(false); const loading = ref(false)
const tab = ref('overview'); const stats = ref({}); const packages = ref([]); const cards = ref([])
const orders = ref([]); const users = ref([]); const cfg = ref({}); const cfgGroups = ref([])
const activeGroup = ref('site'); const revealed = ref({})
const smsPhone = ref(''); const smsBusy = ref(false)
const regions = ref([]); const regionLevel = ref(0); const regionBusy = ref(false)
const regionForm = ref({ code: '', parent_code: '', name: '', level: 1, sort: 0, enabled: true }); const regionEditing = ref(false)
const ossStatus = ref({ enabled: false, provider: 'local', pathPrefix: '', bucket: '', region: '', customDomain: '' })
const ossFiles = ref([]); const ossBusy = ref(false); const ossFilter = ref('')
// OSS 地域下拉（服务端 services/oss.js 是唯一真相源，此处只渲染）
const ossRegions = ref({ aliyun: [], tencent: [] })
const ossRegionPick = ref('')
const ossRegionOptions = computed(() => ossRegions.value[cfg.value.oss_provider === 'tencent' || cfg.value.oss_provider === 'cos' ? 'tencent' : 'aliyun'] || [])
// 存量同步进度（服务端单例任务，进页面/切 tab 刷新一次，运行中轮询）
const migrate = ref({ running: false, total: 0, done: 0, failed: 0, skipped: 0, lastError: '', ossPrefer: false, syncedAt: null, backfilled: 0 })
const ossMigrateBusy = ref(false)
let migrateTimer = null
const migratePct = computed(() => migrate.value.total ? Math.round(((migrate.value.done + migrate.value.skipped) / migrate.value.total) * 100) : 0)
const cardQ = ref(''); const cardStatus = ref(''); const orderStatus = ref('')
const pkgModal = ref(false); const pkgForm = ref({}); const pkgFeatures = ref('')
const updateInfo = ref({}); const checkResult = ref(null); const updCfg = ref({})
const updBusy = ref(false); const applyOpen = ref(false); const sideOpen = ref(false); const restartBusy = ref(false)
const progress = ref({ kind: '', step: '', pct: 0, detail: '', done: false, error: '' })
const progressVisible = computed(() => updBusy.value || (progress.value.kind && !progress.value.done))
const now = ref(new Date()); const shown = ref({ users: 0, cards: 0, activeCards: 0, paidOrders: 0, revenueCents: 0, todayViews: 0 })
let clockTimer = 0; let kpiRaf = 0; let pollTimer = 0

const fmtTime = v => v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '从未检查'
const clockText = computed(() => now.value.toLocaleTimeString('zh-CN', { hour12: false }) + ' · ' + now.value.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' }))
const pkgPrice = computed({ get: () => (pkgForm.value.price_cents || 0) / 100, set: v => { pkgForm.value.price_cents = Math.round(Number(v) * 100) } })

function animateKpi(next) {
  const from = { ...shown.value }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { shown.value = { ...next }; return }
  cancelAnimationFrame(kpiRaf)
  const start = performance.now(); const dur = 700
  const tick = t => {
    const p = Math.min(1, (t - start) / dur); const e = 1 - Math.pow(1 - p, 3)
    const o = {}
    for (const k of Object.keys(from)) o[k] = Math.round((from[k] || 0) + ((next[k] || 0) - (from[k] || 0)) * e)
    shown.value = o
    if (p < 1) kpiRaf = requestAnimationFrame(tick)
  }
  kpiRaf = requestAnimationFrame(tick)
}

const nf = v => Number(v || 0).toLocaleString('zh-CN')
const kpis = computed(() => [
  { label: '注册用户', val: nf(shown.value.users), i: 'users', tone: 'blue', sub: '平台累计账号' },
  { label: '名片总数', val: nf(shown.value.cards), i: 'card', tone: 'violet', sub: '全部名片' },
  { label: '已开通名片', val: nf(shown.value.activeCards), i: 'check', tone: 'green', sub: '正在展示' },
  { label: '已支付订单', val: nf(shown.value.paidOrders), i: 'order', tone: 'amber', sub: '成交订单' },
  { label: '累计收入', val: '¥' + (shown.value.revenueCents / 100).toFixed(2), i: 'yuan', tone: 'rose', sub: '实收金额' },
  { label: '今日浏览', val: nf(shown.value.todayViews), i: 'trend', tone: 'cyan', sub: '今日访问' }
])
const activeRate = computed(() => { const t = Number(stats.value.cards) || 0; const a = Number(stats.value.activeCards) || 0; return t ? Math.round(a / t * 100) : 0 })

const trendPoints = computed(() => {
  const rows = [...(stats.value.trend || [])].reverse().slice(-14)
  const max = Math.max(1, ...rows.map(r => Number(r.n) || 0))
  return rows.map((r, i) => ({
    day: String(r.day || '').slice(5),
    n: Number(r.n) || 0,
    x: 10 + (i * 580) / Math.max(1, rows.length - 1),
    y: 140 - ((Number(r.n) || 0) / max) * 122
  }))
})
const trendTotal = computed(() => trendPoints.value.reduce((s, p) => s + p.n, 0))
const trendLine = computed(() => trendPoints.value.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const trendArea = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return ''
  const line = pts.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return `M ${pts[0].x.toFixed(1)} 150 ${line} L ${pts[pts.length - 1].x.toFixed(1)} 150 Z`
})
const trendLabels = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return []
  const mid = Math.floor((pts.length - 1) / 2)
  return [pts[0], ...(mid > 0 && mid < pts.length - 1 ? [pts[mid]] : []), ...(pts.length > 1 ? [pts[pts.length - 1]] : [])]
})

const GROUP_META = {
  site: { i: 'home', desc: '站点名称、公告与联系方式，展示在前台公开配置中。' },
  payment: { i: 'card', desc: '微信支付商户参数。密钥类只写不读，留空即沿用已保存值。' },
  sms: { i: 'mail', desc: '阿里云短信平台参数，用于验证码发送，保存后可测试。' },
  miniapp: { i: 'phone', desc: '微信 / 支付宝 / 抖音小程序的应用标识与密钥。' },
  wechat_oauth: { i: 'wechat', desc: '公众号网页授权：H5 在微信里免密登录并获取昵称头像。' },
  map: { i: 'location', desc: '高德地图 Key（IP 定位/逆地理/地理编码），未配置时自动降级到免费 API 与城市中心坐标。' },
  oss: { i: 'cloud', desc: '对象存储：local 本地 / aliyun 阿里云 OSS / tencent 腾讯云 COS。密钥只写不读，留空沿用已保存值；项目路径前缀用于多项目共用一个 Bucket 时隔离目录。' }
}
const OPTIONS = {
  pay_mode: [['mock', 'mock · 模拟支付'], ['wechat', 'wechat · 微信支付']],
  sms_enabled: [['false', '停用'], ['true', '启用']],
  sms_provider: [['aliyun', '阿里云短信']],
  wechat_oauth_enabled: [['false', '停用'], ['true', '启用']],
  wechat_oauth_bind_phone: [['true', '必须绑定手机号'], ['false', '直接建号（无手机号）']],
  wechat_oauth_scope: [['snsapi_userinfo', 'snsapi_userinfo · 取昵称头像']],
  map_provider: [['amap', '高德地图'], ['osm', 'OpenStreetMap（免费兜底）']],
  oss_provider: [['local', 'local · 本地存储'], ['aliyun', 'aliyun · 阿里云 OSS'], ['tencent', 'tencent · 腾讯云 COS']]
}
const groupMeta = k => GROUP_META[k] || { i: 'config', desc: '保存后立即生效。' }
const optionsFor = k => OPTIONS[k] || null
const groupDone = g => (g.fields || []).filter(f => String(cfg.value[f.type === 'secret' ? f.key + '_fp' : f.key] || '') !== '').length
const currentGroup = computed(() => cfgGroups.value.find(g => g.key === activeGroup.value) || cfgGroups.value[0] || null)

async function login() {
  if (busy.value) return
  busy.value = true
  try {
    const { data } = await api.post('/api/admin/login', { phone: phone.value, password: password.value })
    setAdminAuth(data.data.token, data.data.user)
    showToast('登录成功', 'success'); loadTab('overview')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
function logout() { adminLogout(); tab.value = 'overview' }
// ---------- 定位管理：行政区划 CRUD ----------
const LEVEL_NAMES = { 1: '省/直辖市', 2: '城市', 3: '区/县', 4: '街道/乡镇' }
async function loadRegions() {
  if (regionBusy.value) return
  regionBusy.value = true
  try {
    const params = regionLevel.value ? { level: regionLevel.value } : {}
    regions.value = (await api.get('/api/geo/admin/regions', { params })).data.data.regions || []
  } catch (e) { showToast(e.message, 'error') } finally { regionBusy.value = false }
}
function editRegion(r) { regionEditing.value = true; regionForm.value = { code: r.code, parent_code: r.parent_code, name: r.name, level: r.level, sort: r.sort, enabled: !!r.enabled } }
function newRegion() { regionEditing.value = false; regionForm.value = { code: '', parent_code: '', name: '', level: regionLevel.value || 1, sort: 0, enabled: true } }
async function saveRegion() {
  if (regionBusy.value) return
  const f = regionForm.value
  if (!f.code || !f.name) return showToast('编码与名称必填', 'error')
  regionBusy.value = true
  try {
    if (regionEditing.value) await api.put(`/api/geo/admin/regions/${encodeURIComponent(f.code)}`, f)
    else await api.post('/api/geo/admin/regions', f)
    showToast('已保存', 'success')
    await loadRegions()
  } catch (e) { showToast(e.message, 'error') } finally { regionBusy.value = false }
}
async function deleteRegion(r) {
  if (regionBusy.value) return
  if (!window.confirm(`删除「${r.name}」及其所有下级？`)) return
  regionBusy.value = true
  try {
    await api.delete(`/api/geo/admin/regions/${encodeURIComponent(r.code)}`)
    showToast('已删除', 'success')
    await loadRegions()
  } catch (e) { showToast(e.message, 'error') } finally { regionBusy.value = false }
}

// ---------- 对象存储 OSS 管理 ----------
const ossFilteredFiles = computed(() => {
  const q = ossFilter.value.trim().toLowerCase()
  if (!q) return ossFiles.value
  return ossFiles.value.filter(f => (f.name || '').toLowerCase().includes(q) || (f.key || '').toLowerCase().includes(q))
})
function fmtSize(n) { const b = Number(n) || 0; return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB' }
async function goOssConfig() {
  // 先切到配置中心并等 groups 加载完，再定位到 oss 分组
  // （loadTab('config') 会在未命中时把 activeGroup 重置为第一个分组，必须在它之后再设）
  sideOpen.value = false
  tab.value = 'config'
  await loadTab('config')
  activeGroup.value = 'oss'
}
async function loadOss() {
  if (ossBusy.value) return
  ossBusy.value = true
  try {
    const s = (await api.get('/api/admin/oss/status')).data.data
    ossStatus.value = s
    if (s.enabled) ossFiles.value = (await api.get('/api/admin/oss/files')).data.data.files || []
    else ossFiles.value = []
  } catch (e) { showToast(e.message, 'error') } finally { ossBusy.value = false }
  refreshMigrate() // 进 OSS 页签顺带恢复同步进度（服务端单例，刷新不丢）
}

// 地域列表从服务端拉（唯一真相源），只拉一次
async function loadOssRegions() {
  try {
    const d = (await api.get('/api/admin/oss/regions')).data.data
    ossRegions.value = d.regions || { aliyun: [], tencent: [] }
    syncRegionPick()
  } catch (e) { /* 地域列表失败不阻塞配置保存，回落手输 */ }
}
function regionValues() {
  const list = ossRegionOptions.value.map(r => r.v)
  return [...list, ...(ossRegions.value.aliyun || []).map(r => r.v), ...(ossRegions.value.tencent || []).map(r => r.v)]
}
// 下拉选中值 ↔ region 双向：选列表项写入 region；存量 region 不在列表自动落「其它」
watch(ossRegionPick, v => { if (v && v !== '__custom__') cfg.value.oss_region = v })
function syncRegionPick() {
  const cur = String(cfg.value.oss_region || '')
  if (!cur) { ossRegionPick.value = ''; return }
  ossRegionPick.value = regionValues().includes(cur) ? cur : '__custom__'
}
watch(() => cfg.value.oss_region, v => {
  if (v && v !== '__custom__' && regionValues().length && !regionValues().includes(v)) ossRegionPick.value = '__custom__'
})

// ===== 存量同步 =====
async function refreshMigrate() {
  try {
    const d = (await api.get('/api/admin/oss/migrate/progress')).data.data
    migrate.value = d
    if (!d.running && migrateTimer) { clearInterval(migrateTimer); migrateTimer = null }
  } catch (e) { /* 进度查询失败静默，不打断页面 */ }
}
async function runMigrate() {
  if (ossMigrateBusy.value || migrate.value.running) return
  ossMigrateBusy.value = true
  try {
    const d = (await api.post('/api/admin/oss/migrate/start', {})).data.data
    if (d.alreadyRunning) showToast('同步已在进行中', 'success')
    else showToast(d.total ? `已启动，共 ${d.total} 个文件` : '已启动，本地无存量文件', 'success')
    if (!migrateTimer) migrateTimer = setInterval(refreshMigrate, 1500)
    refreshMigrate()
  } catch (e) { showToast(e.message, 'error') } finally { ossMigrateBusy.value = false }
}
async function stopMigrate() {
  try { await api.post('/api/admin/oss/migrate/stop', {}); showToast('已请求停止，正在收尾当前批次'); refreshMigrate() }
  catch (e) { showToast(e.message, 'error') }
}
async function testOss() {
  if (ossBusy.value) return
  ossBusy.value = true
  try {
    const d = (await api.post('/api/admin/oss/test', {})).data.data
    showToast(`连接成功 · 项目路径 ${d.pathPrefix} · ${d.count} 个对象`, 'success')
    await loadOss()
  } catch (e) { showToast(e.message, 'error') } finally { ossBusy.value = false }
}
async function deleteOssFile(f) {
  if (ossBusy.value) return
  if (!window.confirm(`删除云端文件「${f.name}」？此操作不可恢复。`)) return
  ossBusy.value = true
  try {
    await api.delete('/api/admin/oss/files', { data: { key: f.key } })
    showToast('已删除', 'success')
    await loadOss()
  } catch (e) { showToast(e.message, 'error') } finally { ossBusy.value = false }
}

function switchTab(k) { if (tab.value === k && sideOpen.value) { sideOpen.value = false; return } tab.value = k; sideOpen.value = false; loadTab(k) }

async function loadTab(k) {
  if (loading.value) return
  loading.value = true
  try {
    if (k === 'overview') {
      const s = (await api.get('/api/admin/overview')).data.data
      stats.value = s
      animateKpi({ users: s.users || 0, cards: s.cards || 0, activeCards: s.activeCards || 0, paidOrders: s.paidOrders || 0, revenueCents: s.revenueCents || 0, todayViews: s.todayViews || 0 })
    }
    if (k === 'packages') packages.value = (await api.get('/api/admin/packages')).data.data
    if (k === 'cards') await loadCards()
    if (k === 'orders') await loadOrders()
    if (k === 'users') users.value = (await api.get('/api/admin/users')).data.data
    if (k === 'config') {
      const d = (await api.get('/api/admin/config')).data.data
      cfg.value = d.values || {}
      cfgGroups.value = Object.entries(d.groups || {}).map(([key, g]) => ({ key, ...g }))
      if (cfgGroups.value.length && !cfgGroups.value.some(g => g.key === activeGroup.value)) activeGroup.value = cfgGroups.value[0].key
      // 地域下拉：独立于配置加载链，失败也不阻塞配置显示（MShop 教训：链尾请求失败=功能永远不出）
      loadOssRegions()
    }
    if (k === 'regions') await loadRegions()
    if (k === 'oss') await loadOss()
    if (k === 'update') await loadUpdate()
  } catch (e) { showToast(e.message, 'error') } finally { loading.value = false }
}
async function loadCards() { cards.value = (await api.get('/api/admin/cards', { params: { q: cardQ.value, status: cardStatus.value } })).data.data }
async function loadOrders() { orders.value = (await api.get('/api/admin/orders', { params: { status: orderStatus.value } })).data.data }

onMounted(() => {
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  if (logged.value) {
    loadTab('overview')
    api.get('/api/admin/update/status').then(r => { const d = r.data.data; updateInfo.value = d; updCfg.value = { ...(d.config || {}) } }).catch(() => {})
  }
})
onBeforeUnmount(() => { clearInterval(clockTimer); clearInterval(pollTimer); clearInterval(migrateTimer); cancelAnimationFrame(kpiRaf) })

function openPkg(p) {
  pkgForm.value = p ? { ...p } : { name: '', price_cents: 1900, duration_days: 30, features: [], sort: 0, enabled: true }
  pkgFeatures.value = (pkgForm.value.features || []).join(', ')
  pkgModal.value = true
}
async function savePkg() {
  if (busy.value) return
  busy.value = true
  try {
    const payload = { ...pkgForm.value, features: pkgFeatures.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) }
    if (payload.id) await api.put(`/api/admin/packages/${payload.id}`, payload)
    else await api.post('/api/admin/packages', payload)
    showToast('套餐已保存', 'success'); pkgModal.value = false; loadTab('packages')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
async function delPkg(p) {
  if (busy.value) return
  if (!confirm(`确定删除/下架「${p.name}」？`)) return
  busy.value = true
  try { await api.delete(`/api/admin/packages/${p.id}`); loadTab('packages'); showToast('已处理', 'success') }
  catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
async function setCardStatus(c, status) {
  if (busy.value) return
  busy.value = true
  try { await api.put(`/api/admin/cards/${c.id}/status`, { status }); await loadCards(); showToast('状态已更新', 'success') }
  catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
async function markPaid(o) {
  if (busy.value) return
  busy.value = true
  try { await api.post(`/api/orders/${o.id}/mark-paid`); await loadOrders(); showToast('已标记支付，名片已开通', 'success') }
  catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
async function setUserStatus(u) {
  if (busy.value) return
  busy.value = true
  try { await api.put(`/api/admin/users/${u.id}/status`, { status: u.status === 'active' ? 0 : 1 }); await loadTab('users'); showToast('已更新', 'success') }
  catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
function onVerifyFileChosen(e) {
  const input = e.target
  const file = input.files && input.files[0]
  input.value = ''
  if (!file) return
  if (!/^MP_verify_[A-Za-z0-9_-]{1,64}\.txt$/.test(file.name)) {
    showToast('请选择微信提供的 MP_verify_xxx.txt 校验文件', 'error')
    return
  }
  if (file.size > 64 * 1024) {
    showToast('校验文件不能超过 64KB', 'error')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const content = String(reader.result || '').replace(/\s+/g, '')
    if (!content) { showToast('校验文件内容为空，请确认文件内容', 'error'); return }
    cfg.value.wechat_oauth_verify_name = file.name
    cfg.value.wechat_oauth_verify_content = content
    showToast('已读取校验文件，点保存后生效', 'success')
  }
  reader.onerror = () => showToast('读取文件失败，请重试', 'error')
  reader.readAsText(file)
}

async function saveGroup() {
  if (busy.value || !currentGroup.value) return
  busy.value = true
  try {
    const payload = {}
    for (const f of currentGroup.value.fields || []) payload[f.key] = cfg.value[f.key] ?? ''
    await api.put('/api/admin/config', payload)
    showToast(`「${currentGroup.value.label}」已保存，即时生效`, 'success')
    await loadTab('config')
  } catch (e) { showToast(e.message, 'error') } finally { busy.value = false }
}
async function testSms() {
  if (smsBusy.value) return
  if (!smsPhone.value) return showToast('请填写测试手机号', 'error')
  smsBusy.value = true
  try { await api.post('/api/admin/sms/test', { phone: smsPhone.value }); showToast('测试码已发送', 'success') }
  catch (e) { showToast(e.message, 'error') } finally { smsBusy.value = false }
}
// 更新完成后 lastResult 变成 kind='apply'，原来的 check 缓存会停留在「发现新版本」。
// 用「运行中的 commit == 检查到的远端 commit」自愈纠正，避免用户误以为还有新版。
function reconcileCheckResult(d) {
  const r = d?.config?.lastResult
  if (r?.kind === 'check') checkResult.value = r
  else if (checkResult.value && r?.kind === 'apply' && r.updated === false && r.hasUpdate === false) {
    checkResult.value = { ...checkResult.value, hasUpdate: false }
  } else if (checkResult.value && d?.runningCommit && checkResult.value.remoteCommit && d.runningCommit === checkResult.value.remoteCommit) {
    checkResult.value = { ...checkResult.value, hasUpdate: false }
  }
}

async function loadUpdate() {
  const d = (await api.get('/api/admin/update/status')).data.data
  updateInfo.value = d
  updCfg.value = { ...(d.config || {}) }
  if (d.progress) progress.value = d.progress
  reconcileCheckResult(d)
}

// 轮询：异步任务在后端跑，前端每 1s 拉一次进度；重启导致短暂断连时继续重试，不误判失败
function startPolling(kind, onDone) {
  clearInterval(pollTimer)
  let misses = 0
  let doneCalled = false
  const tick = async () => {
    try {
      misses = 0
      const d = (await api.get('/api/admin/update/status')).data.data
      updateInfo.value = d
      if (d.progress) progress.value = d.progress
      reconcileCheckResult(d)
      if (d.progress && d.progress.done) {
        if (doneCalled) return
        doneCalled = true
        clearInterval(pollTimer)
        updBusy.value = false
        onDone(d.progress)
        // 完成后刷新版本/检查时间（apply 重启场景稍等再拉，避免又撞上重启窗口）
        setTimeout(() => loadUpdate().catch(() => {}), kind === 'apply' ? 3500 : 200)
      }
    } catch (e) {
      misses++
      // 重启窗口期接口 502/超时属预期，连续 30 次（30s）才判定为失联
      if (misses >= 30) {
        clearInterval(pollTimer)
        updBusy.value = false
        progress.value = { ...progress.value, done: true, error: '更新服务失联，请稍后刷新页面查看结果' }
      }
    }
  }
  pollTimer = setInterval(tick, 1000)
  tick()
}

async function checkUpdate() {
  if (updBusy.value) return
  updBusy.value = true
  progress.value = { kind: 'check', step: '正在启动检查…', pct: 2, detail: '', done: false, error: '' }
  try {
    await api.post('/api/admin/update/check') // 立即返回，不再等后端跑完
    startPolling('check', p => {
      if (p.error) showToast(`检查失败：${p.error}`, 'error')
      else if (checkResult.value?.stale) showToast('远端不可用，已显示上次检查结果', 'error')
      else showToast(checkResult.value?.hasUpdate ? `发现新版本 v${checkResult.value.latest}` : '已是最新版本', 'success')
    })
  } catch (e) { updBusy.value = false; showToast(e.message, 'error') }
}
async function applyUpdate() {
  if (updBusy.value) return
  applyOpen.value = false
  updBusy.value = true
  progress.value = { kind: 'apply', step: '正在启动更新…', pct: 2, detail: '', done: false, error: '' }
  try {
    await api.post('/api/admin/update/apply')
    startPolling('apply', p => {
      if (p.error) showToast(`更新失败：${p.error}`, 'error')
      else {
        // apply 成功即已追上远端：立刻清掉「发现新版本」缓存，不等重启后的 3.5s 轮询
        if (checkResult.value) checkResult.value = { ...checkResult.value, hasUpdate: false }
        showToast('更新完成', 'success')
      }
    })
  } catch (e) { updBusy.value = false; showToast(e.message, 'error') }
}
async function restartService() {
  if (restartBusy.value || updBusy.value) return
  restartBusy.value = true
  try {
    await api.post('/api/admin/update/restart')
    showToast('正在重启服务，页面会短暂断连…', 'success')
    // 重启后重新拉状态：needsRestart 消失即生效；断连期重试
    let retried = 0
    const recheck = setInterval(async () => {
      try {
        const d = (await api.get('/api/admin/update/status')).data.data
        updateInfo.value = d
        if (!d.needsRestart) {
          clearInterval(recheck); restartBusy.value = false
          showToast('服务已重启，新代码已生效', 'success')
        }
      } catch (e) {
        if (++retried > 30) { clearInterval(recheck); restartBusy.value = false; showToast('重启超时，请刷新页面确认', 'error') }
      }
    }, 1500)
  } catch (e) { restartBusy.value = false; showToast(e.message, 'error') }
}
async function saveUpdateConfig() {
  if (updBusy.value) return
  updBusy.value = true
  try { await api.put('/api/admin/update/config', updCfg.value); showToast('更新设置已保存', 'success'); await loadUpdate() }
  catch (e) { showToast(e.message, 'error') } finally { updBusy.value = false }
}
</script>

<style scoped>
/* 版本更新页 */
.upd-overview { padding: 0; overflow: hidden; }
.upd-overview-main { display: flex; align-items: center; gap: 20px; padding: 22px 24px; background: linear-gradient(120deg, #12224a, #1d3f8c 60%, #2563eb); color: #fff; flex-wrap: wrap; }
.upd-ver { min-width: 130px; }
.upd-ver-label { font-size: 11px; letter-spacing: 1px; color: #bfdbfe; }
.upd-ver-num { font-size: 30px; font-weight: 800; letter-spacing: -.8px; margin: 4px 0 2px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.upd-ver-num.is-new { color: #fbbf24; }
.upd-ver-hash { font-size: 11px; color: #93c5fd; }
.upd-ver-arrow { font-size: 26px; color: #60a5fa; opacity: .7; padding: 0 2px; }
.upd-status { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.upd-pill { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid transparent; }
.upd-pill.ok { background: rgba(74,222,128,.16); color: #86efac; border-color: rgba(74,222,128,.35); }
.upd-pill.new { background: rgba(251,191,36,.16); color: #fcd34d; border-color: rgba(251,191,36,.4); }
.upd-pill.warn { background: rgba(251,146,60,.18); color: #fdba74; border-color: rgba(251,146,60,.4); }
.upd-pill.idle { background: rgba(255,255,255,.12); color: #dbeafe; border-color: rgba(255,255,255,.2); }
.upd-status-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 11px; color: #bfdbfe; }
.upd-ops { display: flex; align-items: center; gap: 16px; padding: 16px 24px; flex-wrap: wrap; }
.upd-ops-btns { display: flex; gap: 10px; flex-wrap: wrap; }
.upd-ops-note { flex: 1; min-width: 220px; text-align: right; }

.upd-notice { display: flex; align-items: flex-start; gap: 12px; margin-top: 14px; padding: 13px 16px; border-radius: 12px; }
.upd-notice.warn { background: #fff7ed; border: 1px solid #fed7aa; }
.upd-notice.info { background: #eff6ff; border: 1px solid #dbeafe; }
.upd-notice-ico { width: 24px; height: 24px; flex: 0 0 24px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 13px; color: #fff; }
.upd-notice.warn .upd-notice-ico { background: #ea580c; }
.upd-notice.info .upd-notice-ico { background: #2563eb; }
.upd-notice > div:last-child { display: flex; flex-direction: column; gap: 3px; }
.upd-notice b { font-size: 13px; }
.upd-notice.warn b { color: #c2410c; }
.upd-notice.info b { color: #1e40af; }
.upd-notice span { font-size: 12px; color: var(--muted); line-height: 1.5; }

.upd-progress { margin-top: 14px; padding: 14px 16px; border-radius: 12px; background: #f8fafc; border: 1px solid var(--line); }
.upd-progress-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; }
.upd-progress-track { height: 8px; border-radius: 6px; background: #e2e8f0; overflow: hidden; }
.upd-progress-track i { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, #60a5fa, #2563eb); transition: width .5s ease; }

.upd-cols { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: 14px; margin-top: 14px; align-items: start; }
.upd-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.upd-card { margin: 0; }
.upd-notes { margin: 0; padding: 12px 14px; background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; font-size: 12px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--text); }
.upd-empty { padding: 36px 16px; text-align: center; color: var(--muted); font-size: 13px; }
@media (max-width: 900px) { .upd-cols { grid-template-columns: 1fr; } .upd-status { margin-left: 0; align-items: flex-start; } .upd-status-meta { align-items: flex-start; } .upd-ops-note { text-align: left; } }

/* 登录 */
.login-page { min-height: 100vh; display: grid; place-items: center; padding: 20px; position: relative; overflow: hidden; background: radial-gradient(900px 500px at 20% 10%, #1e3a8a, transparent 60%), linear-gradient(135deg, #0b1224, #131e3a 60%, #0f172a); }
.login-bg { position: absolute; inset: 0; opacity: .8; }
.login-card { position: relative; width: min(100%, 410px); padding: 32px; box-shadow: 0 24px 70px rgba(0,0,0,.35); border: 0; }
.login-logo { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #60a5fa, #4338ca); color: #fff; display: grid; place-items: center; font-size: 26px; font-weight: 800; box-shadow: 0 8px 20px rgba(59,130,246,.35); }
.brand { font-size: 20px; font-weight: 800; margin-top: 14px; }
.brand em { color: var(--primary); font-style: normal; }
.brand small { font-size: 12px; font-weight: 500; color: var(--muted); }
.login-card h2 { margin: 18px 0 2px; font-size: 24px; }
.login-tip { text-align: center; margin-top: 14px; }
.login-back { display: block; text-align: center; margin-top: 8px; }

/* 布局 */
.admin-layout { display: flex; min-height: 100vh; }
.side { width: 224px; flex: 0 0 224px; background: linear-gradient(180deg, #0f172a, #111c33); color: #cbd5e1; padding: 18px 12px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; z-index: 60; }
.side-brand { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 800; color: #fff; padding: 4px 8px 22px; }
.side-logo { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #60a5fa, #4338ca); display: grid; place-items: center; font-size: 19px; }
.side-brand em { color: #60a5fa; font-style: normal; }
.side-brand small { display: block; font-size: 10px; color: #64748b; font-weight: 400; }
.side-label { font-size: 10px; letter-spacing: 1px; color: #475569; padding: 12px 12px 6px; text-transform: uppercase; }
.side button, .side-foot a, .side-foot button { display: flex; align-items: center; gap: 11px; width: 100%; text-align: left; padding: 10px 12px; border-radius: 9px; font-size: 13px; color: #cbd5e1; transition: .18s; }
.side button:hover, .side-foot a:hover, .side-foot button:hover { background: #1e293b; color: #fff; }
.side button.on { background: linear-gradient(135deg, #2563eb, #4338ca); color: #fff; font-weight: 700; box-shadow: 0 6px 16px rgba(37,99,235,.28); }
.side-foot { margin-top: auto; border-top: 1px solid #1e293b; padding-top: 12px; display: flex; flex-direction: column; gap: 2px; }
.side-foot a, .side-foot button { color: #94a3b8; font-size: 12px; }
.ico { width: 17px; height: 17px; flex: 0 0 17px; }
.main { flex: 1; min-width: 0; }
.topbar { position: sticky; top: 0; z-index: 50; height: 60px; display: flex; align-items: center; gap: 12px; padding: 0 22px; background: rgba(255,255,255,.9); backdrop-filter: blur(14px); border-bottom: 1px solid var(--line); }
.topbar .spacer { flex: 1; }
.crumb { color: var(--muted); font-size: 13px; }
.crumb span { margin: 0 7px; color: #cbd5e1; }
.crumb b { color: var(--text); }
.clock { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.icon-btn { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; color: var(--muted); }
.icon-btn:hover { background: #f1f5f9; color: var(--primary); }
.icon-btn:disabled { opacity: .5; cursor: not-allowed; }
.menu-toggle { display: none; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.who { display: flex; align-items: center; gap: 9px; padding-left: 12px; border-left: 1px solid var(--line); }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #dbeafe, #e0e7ff); color: #4338ca; display: grid; place-items: center; font-size: 11px; font-weight: 800; }
.who-text b, .who-text small { display: block; line-height: 1.3; }
.who-text b { font-size: 12px; }
.who-text small { font-size: 10px; color: var(--muted); }
.main-body { padding: 20px 22px 60px; }

/* 概览 */
.hero { position: relative; overflow: hidden; border-radius: 18px; padding: 26px 30px; min-height: 168px; color: #fff; background: linear-gradient(120deg, #12224a, #1d3f8c 55%, #2563eb); box-shadow: 0 12px 34px rgba(30,58,138,.22); }
.hero-content { position: relative; z-index: 1; }
.hero-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; letter-spacing: 1.2px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.2); }
.hero-tag i { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px #4ade80; }
.hero h1 { font-size: 27px; margin: 10px 0 4px; letter-spacing: -.5px; }
.hero p { font-size: 12px; color: #bfdbfe; }
.hero-meta { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 16px; font-size: 11px; color: #bfdbfe; }
.hero-meta b { display: block; font-size: 18px; color: #fff; font-variant-numeric: tabular-nums; }
.hero-badge { position: absolute; right: 30px; top: 26px; text-align: right; font-size: 10px; letter-spacing: 2px; line-height: 1.5; color: rgba(255,255,255,.35); font-weight: 800; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 12px; margin-top: 16px; }
.kpi { position: relative; padding: 16px 16px 14px; overflow: hidden; }
.kpi::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--tone); }
.kpi-ico { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--tone-bg); color: var(--tone); }
.kpi-val { display: block; font-size: 23px; margin: 10px 0 2px; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
.kpi-label { font-size: 12px; color: var(--muted); }
.kpi-sub { display: block; font-size: 10px; color: #94a3b8; margin-top: 3px; }
.tone-blue { --tone: #3b82f6; --tone-bg: #eff6ff; }
.tone-violet { --tone: #8b5cf6; --tone-bg: #f5f3ff; }
.tone-green { --tone: #10b981; --tone-bg: #ecfdf5; }
.tone-amber { --tone: #f59e0b; --tone-bg: #fffbeb; }
.tone-rose { --tone: #f43f5e; --tone-bg: #fff1f2; }
.tone-cyan { --tone: #06b6d4; --tone-bg: #ecfeff; }
.chart-row { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(260px, 1fr); gap: 14px; margin-top: 14px; }
.panel { padding: 16px 18px; }
.panel-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.panel-head.inner { padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.panel-head h2 { font-size: 16px; }
.panel-head h3 { font-size: 14px; }
.panel-head .small { margin-left: auto; }
.panel-head.stand-alone { margin: 0 0 12px; }
.link { margin-left: auto; color: var(--primary); font-size: 12px; }
.chart-wrap { height: 168px; }
.line-chart { width: 100%; height: 140px; overflow: visible; }
.chart-labels { display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-top: 4px; }
.status-body { display: flex; align-items: center; gap: 22px; padding: 8px 0; }
.donut { width: 116px; height: 116px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 116px; }
.donut-hole { width: 80px; height: 80px; border-radius: 50%; background: #fff; display: grid; place-items: center; text-align: center; }
.donut-hole b { font-size: 20px; }
.donut-hole small { font-size: 10px; color: var(--muted); }
.status-list { flex: 1; display: flex; flex-direction: column; gap: 12px; font-size: 12px; }
.status-list > div { display: flex; align-items: center; gap: 8px; }
.status-list b { margin-left: auto; font-size: 14px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.green { background: #10b981; } .dot.gray { background: #cbd5e1; } .dot.blue { background: #3b82f6; }
.two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; margin-top: 14px; }
.two-col .table-wrap { margin: 0 -6px; }

/* 表格页 */
.filter-row { display: flex; gap: 10px; margin-bottom: 14px; max-width: 720px; }
.filter-row .input { flex: 1; }
.filter-row .select { width: 170px; }

/* 对象存储 */
.oss-section { max-width: 1100px; }
.oss-status { display: flex; flex-wrap: wrap; gap: 16px 28px; align-items: flex-start; }
.oss-status-item { display: flex; flex-direction: column; gap: 4px; min-width: 120px; }
.oss-status-item b { font-size: 14px; }
.oss-status-item .mono { font-size: 12px; }
.oss-actions { display: flex; gap: 8px; margin-left: auto; align-items: center; }
/* 存量同步面板 */
.oss-migrate { padding: 14px; margin-bottom: 16px; background: var(--bg-page, #f8fafc); border: 1px solid var(--line); border-radius: 10px; }
.oss-migrate-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.oss-migrate-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.oss-bar { height: 8px; border-radius: 4px; background: rgba(0,0,0,.08); overflow: hidden; }
.oss-bar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--primary, #2563eb), #4e9a8f); transition: width .4s; }
.cfg-region { display: flex; flex-direction: column; gap: 6px; }
.oss-files-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 16px 0 10px; }
.oss-files-head .input { width: 240px; }

/* 定位管理 */
.region-section { max-width: 1100px; }
.region-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.region-filters { display: flex; gap: 8px; }
.region-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; padding: 14px; margin-bottom: 14px; background: var(--bg-page, #f8fafc); border-radius: 10px; border: 1px solid var(--line); }
.region-form .field label { font-size: 12px; }
.region-form-actions { display: flex; gap: 8px; align-items: flex-end; }
.mono { font-family: ui-monospace, Menlo, Consolas, monospace; }

/* 配置中心 */
.config-section { max-width: 1100px; }
.config-layout { display: grid; grid-template-columns: 232px minmax(0, 1fr); gap: 14px; align-items: start; }
.config-nav { padding: 8px; position: sticky; top: 78px; }
.config-nav button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 10px; border-radius: 10px; text-align: left; flex-wrap: wrap; }
.config-nav button:hover { background: #f8fafc; }
.config-nav button.on { background: #eff6ff; }
.cfg-ico { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; background: #f1f5f9; color: #64748b; }
.config-nav button.on .cfg-ico { background: #2563eb; color: #fff; }
.cfg-text { flex: 1; min-width: 0; }
.cfg-text b, .cfg-text small { display: block; }
.cfg-text b { font-size: 13px; }
.cfg-text small { font-size: 10px; color: var(--muted); }
.cfg-bar { flex: 0 0 100%; height: 3px; border-radius: 3px; background: #eef2f7; overflow: hidden; margin-top: 6px; }
.cfg-bar i { display: block; height: 100%; background: linear-gradient(90deg, #60a5fa, #2563eb); border-radius: 3px; }
.cfg-nav-foot { font-size: 10px; line-height: 1.6; color: #94a3b8; padding: 12px 10px 4px; border-top: 1px solid var(--line); margin-top: 8px; }
.config-main { min-height: 420px; }
.cfg-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; padding-top: 16px; }
.cfg-fields .field label { display: flex; align-items: center; gap: 8px; }
.eye { margin-left: auto; color: var(--muted); display: grid; place-items: center; }
.eye:hover { color: var(--primary); }
.eye .ico { width: 15px; height: 15px; }
.cfg-static { display: flex; align-items: center; min-height: 38px; padding: 8px 12px; border: 1px dashed var(--line); border-radius: 8px; background: #f8fafc; color: var(--muted); font-size: 13px; word-break: break-all; }
.cfg-file { display: flex; flex-direction: column; gap: 6px; }
.cfg-file-btn { display: inline-flex; align-items: center; justify-content: center; width: fit-content; padding: 8px 14px; border: 1px solid var(--primary); border-radius: 8px; color: var(--primary); font-size: 13px; cursor: pointer; }
.cfg-file-btn:hover { background: rgba(59,130,246,.06); }
.cfg-file-btn input { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
.cfg-actions { display: flex; align-items: center; gap: 14px; justify-content: flex-end; padding-top: 16px; margin-top: 6px; border-top: 1px solid var(--line); }
.sms-test { margin-top: 18px; padding-top: 6px; border-top: 1px dashed var(--line); }
.sms-row { display: flex; gap: 10px; max-width: 520px; }
.config-card { max-width: 640px; }
@media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } .config-layout { grid-template-columns: 1fr; } .config-nav { position: static; display: flex; overflow-x: auto; } .config-nav button { min-width: 150px; } .cfg-bar { display: none; } }
@media (max-width: 640px) { .cfg-fields { grid-template-columns: 1fr; } .clock, .who-text { display: none; } .menu-toggle { display: grid; } .side { position: fixed; left: 0; transform: translateX(-100%); transition: transform .22s; } .side.open { transform: translateX(0); } .side-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); z-index: 55; } .main-body { padding: 16px 14px 50px; } .hero-badge { display: none; } }
</style>
