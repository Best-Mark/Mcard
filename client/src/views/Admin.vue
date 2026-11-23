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
        <div>M<em>Card</em><small>管理控制台 · v{{ updateInfo.current || '—' }}</small></div>
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
                <td>¥{{ (p.price_cents / 100).toFixed(2) }}</td><td>{{ p.duration_days }} 天</td>
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
                <td>{{ c.views }}</td><td>{{ c.expires_at || '-' }}</td>
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
                  <select v-if="optionsFor(f.key)" v-model="cfg[f.key]" class="select">
                    <option v-for="op in optionsFor(f.key)" :key="op[0]" :value="op[0]">{{ op[1] }}</option>
                  </select>
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
          <div class="panel-head stand-alone"><h2>版本更新</h2><span class="small muted">检查 / 自动更新</span></div>
          <div class="card panel">
            <div class="ver-grid">
              <div><span>当前版本</span><b>v{{ updateInfo.current || '-' }}</b></div>
              <div><span>最新版本</span><b :class="{ hot: checkResult?.hasUpdate }">{{ checkResult ? 'v' + checkResult.latest : '未检查' }}</b></div>
              <div><span>检查时间</span><b class="small">{{ fmtTime(updateInfo.config?.lastCheck) }}</b></div>
              <div><span>任务状态</span><b class="small">{{ updateInfo.busy ? '更新中…' : '空闲' }}</b></div>
            </div>
            <div class="btn-row" style="margin-top:14px">
              <button class="btn btn-primary" :disabled="updBusy" @click="checkUpdate">{{ updBusy ? '处理中…' : '检查更新' }}</button>
              <button v-if="checkResult?.hasUpdate" class="btn btn-ok" :disabled="updBusy" @click="applyOpen = true">立即更新</button>
              <span v-if="checkResult && !checkResult.hasUpdate" class="badge ok">已是最新版本</span>
              <span v-if="checkResult?.stale" class="badge warn">网络不可用 · 缓存结果</span>
            </div>
            <p class="small muted" style="margin-top:12px">更新来源：GitHub Release（无 Release 时读取远端仓库 package.json 的 version）。更新会拉取代码、按变更重建前端并按需重启服务。</p>
          </div>

          <div v-if="checkResult" class="card panel" style="margin-top:14px">
            <div class="panel-head inner"><h3>更新说明</h3><span class="small muted">来源 {{ checkResult.source }}</span></div>
            <pre class="notes">{{ checkResult.notes || '无更新说明' }}</pre>
            <a v-if="checkResult.url" :href="checkResult.url" target="_blank" class="small" style="color:var(--primary)">查看发布页 ↗</a>
          </div>

          <div class="card panel config-card" style="margin-top:14px">
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

          <div v-if="updateInfo.config?.lastResult" class="card panel" style="margin-top:14px">
            <div class="panel-head inner"><h3>最近一次记录</h3></div>
            <pre class="notes">{{ JSON.stringify(updateInfo.config.lastResult, null, 2) }}</pre>
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
          <div class="field"><label>有效天数</label><input v-model.number="pkgForm.duration_days" class="input" type="number" min="1" /></div>
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
  yuan: ['M12 2v20', 'M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6']
}
const ic = n => ICONS[n] || ICONS.overview

const menus = [
  { k: 'overview', t: '数据概览', i: 'overview', group: 'main' }, { k: 'packages', t: '时段套餐', i: 'package', group: 'main' },
  { k: 'cards', t: '名片管理', i: 'card', group: 'main' }, { k: 'orders', t: '订单管理', i: 'order', group: 'main' },
  { k: 'users', t: '用户管理', i: 'users', group: 'main' }, { k: 'config', t: '配置中心', i: 'config', group: 'sys' },
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
const cardQ = ref(''); const cardStatus = ref(''); const orderStatus = ref('')
const pkgModal = ref(false); const pkgForm = ref({}); const pkgFeatures = ref('')
const updateInfo = ref({}); const checkResult = ref(null); const updCfg = ref({})
const updBusy = ref(false); const applyOpen = ref(false); const sideOpen = ref(false)
const now = ref(new Date()); const shown = ref({ users: 0, cards: 0, activeCards: 0, paidOrders: 0, revenueCents: 0, todayViews: 0 })
let clockTimer = 0; let kpiRaf = 0

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
  miniapp: { i: 'phone', desc: '微信 / 支付宝 / 抖音小程序的应用标识与密钥。' }
}
const OPTIONS = {
  pay_mode: [['mock', 'mock · 模拟支付'], ['wechat', 'wechat · 微信支付']],
  sms_enabled: [['false', '停用'], ['true', '启用']],
  sms_provider: [['aliyun', '阿里云短信']]
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
    }
    if (k === 'update') await loadUpdate()
  } catch (e) { showToast(e.message, 'error') } finally { loading.value = false }
}
async function loadCards() { cards.value = (await api.get('/api/admin/cards', { params: { q: cardQ.value, status: cardStatus.value } })).data.data }
async function loadOrders() { orders.value = (await api.get('/api/admin/orders', { params: { status: orderStatus.value } })).data.data }

onMounted(() => {
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  if (logged.value) loadTab('overview')
})
onBeforeUnmount(() => { clearInterval(clockTimer); cancelAnimationFrame(kpiRaf) })

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
async function loadUpdate() {
  const d = await api.get('/api/admin/update/status')
  updateInfo.value = d.data
  updCfg.value = { ...d.data.config }
  if (d.data.config?.lastResult?.kind === 'check') checkResult.value = d.data.config.lastResult
}
async function checkUpdate() {
  if (updBusy.value) return
  updBusy.value = true
  try {
    checkResult.value = await api.post('/api/admin/update/check')
    showToast(checkResult.value.stale ? '远端不可用，已显示上次检查结果' : (checkResult.value.hasUpdate ? `发现新版本 v${checkResult.value.latest}` : '已是最新版本'), checkResult.value.stale ? 'error' : 'success')
    await loadUpdate()
  } catch (e) { showToast(e.message, 'error') } finally { updBusy.value = false }
}
async function applyUpdate() {
  if (updBusy.value) return
  updBusy.value = true
  try {
    const r = await api.post('/api/admin/update/apply')
    showToast(r.updated ? '更新完成' : (r.message || '无需更新'), 'success')
    applyOpen.value = false
    await loadUpdate()
    if (r.restartRequired) showToast(r.restartScheduled ? '服务端变更已更新，正在自动重启' : '服务端已更新，请手动重启 Node 进程', 'success')
  } catch (e) { showToast(e.message, 'error') } finally { updBusy.value = false }
}
async function saveUpdateConfig() {
  if (updBusy.value) return
  updBusy.value = true
  try { await api.put('/api/admin/update/config', updCfg.value); showToast('更新设置已保存', 'success'); await loadUpdate() }
  catch (e) { showToast(e.message, 'error') } finally { updBusy.value = false }
}
</script>

<style scoped>
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
.cfg-actions { display: flex; align-items: center; gap: 14px; justify-content: flex-end; padding-top: 16px; margin-top: 6px; border-top: 1px solid var(--line); }
.sms-test { margin-top: 18px; padding-top: 6px; border-top: 1px dashed var(--line); }
.sms-row { display: flex; gap: 10px; max-width: 520px; }
.config-card { max-width: 640px; }
@media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } .config-layout { grid-template-columns: 1fr; } .config-nav { position: static; display: flex; overflow-x: auto; } .config-nav button { min-width: 150px; } .cfg-bar { display: none; } }
@media (max-width: 640px) { .cfg-fields { grid-template-columns: 1fr; } .clock, .who-text { display: none; } .menu-toggle { display: grid; } .side { position: fixed; left: 0; transform: translateX(-100%); transition: transform .22s; } .side.open { transform: translateX(0); } .side-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); z-index: 55; } .main-body { padding: 16px 14px 50px; } .hero-badge { display: none; } }
</style>
