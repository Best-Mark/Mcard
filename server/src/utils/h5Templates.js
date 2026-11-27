// H5 宣传页官方模板（唯一真相源）：/api/h5/templates 下发，前端「从模板新建」直接套用。
// 结构 = h5_pages.schema 同构：{ pages: [{ blocks: [...] }] }，块类型白名单见 routes/h5.js BLOCK_TYPES。
// 图一律空串：渲染层对空图有渐变占位（accent 驱动），用户上传后即替换；文案是「可直接用」的成稿示例，
// 用户改字即可发布——模板质量决定「30 秒出片」体验，改文案时保持口语化、避免营销八股。
const P = (...blocks) => ({ blocks })
const B = (type, fields = {}) => ({ type, ...fields })

const TEMPLATES = [
  {
    key: 'company', name: '企业介绍', industry: '通用', accent: '#a62b2b', theme: 'tang',
    desc: '公司实力与业务一站式呈现，最通用',
    pages: [
      P(
        B('cover', { title: '匠心品质 · 值得信赖', subtitle: 'XXXX有限公司', cover: '' }),
        B('text', { heading: '关于我们', body: '我们深耕行业十余年，专注为客户提供高品质的产品与服务。从方案设计到落地交付，全流程专业团队护航，已服务上千家客户，口碑与实力并存。' })
      ),
      P(
        B('hero', { image: '', title: '核心业务', desc: '围绕客户需求，提供一站式解决方案，省心省力更省成本。' }),
        B('gallery', { images: ['', '', ''], layout: 'grid' })
      ),
      P(
        B('contact', { showMobile: true, showWechat: true, showAddress: true }),
        B('endcard')
      )
    ]
  },
  {
    key: 'restaurant', name: '餐饮门店', industry: '餐饮', accent: '#c2410c', theme: 'tang',
    desc: '招牌菜与环境展示，勾起食欲促到店',
    pages: [
      P(
        B('cover', { title: '本味食材 · 招牌味道', subtitle: 'XX餐厅 欢迎光临', cover: '' }),
        B('text', { heading: '主理人说', body: '每天清晨直采新鲜食材，坚持明厨亮灶现做现出。老火慢炖的汤、现杀现做的鱼，是我们雷打不动的规矩。' })
      ),
      P(
        B('gallery', { images: ['', '', '', ''], layout: 'swipe' }),
        B('hero', { image: '', title: '招牌必点', desc: '回头客最多的三道菜，第一次来不知道点什么？闭眼点它们就对了。' })
      ),
      P(
        B('map', { lat: null, lng: null, label: 'XX市XX区XX路XX号' }),
        B('buttons', { items: [{ label: '电话订座', action: 'tel', value: '' }] }),
        B('endcard')
      )
    ]
  },
  {
    key: 'building', name: '建材工程', industry: '建材', accent: '#0f766e', theme: 'vanna',
    desc: '工程案例说话，适合 B 端获客',
    pages: [
      P(
        B('cover', { title: '专业建材 · 工程直供', subtitle: '厂家直发 · 质保无忧', cover: '' }),
        B('text', { heading: '公司简介', body: '专注建材供应十五年，自有仓储与物流团队，服务过百余个工程项目。主打产品常备现货，支持定制与批量优惠。' })
      ),
      P(
        B('gallery', { images: ['', '', '', ''], layout: 'grid' }),
        B('hero', { image: '', title: '工程案例', desc: '近三年部分合作项目实拍，从小区改造到商业综合体，都有我们的产品。' })
      ),
      P(
        B('buttons', { items: [{ label: '获取报价', action: 'tel', value: '' }, { label: '加微信详聊', action: 'wechat', value: '' }] }),
        B('contact', { showMobile: true, showWechat: true, showAddress: false }),
        B('endcard')
      )
    ]
  },
  {
    key: 'beauty', name: '美业门店', industry: '美业', accent: '#be185d', theme: 'vanna',
    desc: '服务项目与环境呈现，促预约到店',
    pages: [
      P(
        B('cover', { title: '变美，从一次正确的选择开始', subtitle: 'XX美业 · 专注你的美', cover: '' }),
        B('text', { heading: '我们承诺', body: '一对一定制方案，全程无隐形消费；所有技师持证上岗，产品均可验真。环境每天消毒，用具一客一换。' })
      ),
      P(
        B('hero', { image: '', title: '热门项目', desc: '深层清洁补水 / 舒缓 SPA / 问题肌调理，到店先做专业肌肤检测再定方案。' }),
        B('gallery', { images: ['', '', ''], layout: 'swipe' })
      ),
      P(
        B('buttons', { items: [{ label: '立即预约', action: 'tel', value: '' }] }),
        B('contact', { showMobile: true, showWechat: true, showAddress: true }),
        B('endcard')
      )
    ]
  },
  {
    key: 'event', name: '活动邀约', industry: '通用', accent: '#4338ca', theme: 'classic',
    desc: '时间地点议程清晰，扫码即达',
    pages: [
      P(
        B('cover', { title: '诚邀莅临', subtitle: 'XX行业交流会 · 诚邀您的到来', cover: '' }),
        B('text', { heading: '活动亮点', body: '行业大咖实战分享 / 优质资源现场对接 / 同行交流答疑。席位有限，报名从速。' })
      ),
      P(
        B('text', { heading: '时间 · 地点', body: '时间：X月X日（周X）14:00-17:00\n地点：XX酒店 3F 多功能厅\n议程：签到 → 主题分享 → 自由交流 → 合影' }),
        B('map', { lat: null, lng: null, label: 'XX酒店（导航直达）' })
      ),
      P(
        B('buttons', { items: [{ label: '电话确认出席', action: 'tel', value: '' }] }),
        B('endcard')
      )
    ]
  }
]

function getTemplate(key) { return TEMPLATES.find(t => t.key === key) || null }

module.exports = { TEMPLATES, getTemplate }
