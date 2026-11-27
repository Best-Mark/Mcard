// H5 宣传页官方模板（唯一真相源）：/api/h5/templates 下发，前端「从模板新建」直接套用。
// 结构 = h5_pages.schema 同构：{ accent, transition?, pages: [{ blocks: [...] }] }，块类型白名单见 routes/h5.js BLOCK_TYPES。
// 2026-11-27 路线④扩充：11 套（原 5 + 新 6：零售/教育/家居/招聘/婚礼/顾问），新模板各带一处新能力演示点
// （stagger 错落 / showcase 展播 / form 留资 / music 背景音乐 / transition 切换动效 / 文字对齐字号）。
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
  },
  // ---- 2026-11-27 路线④ 模板扩充：以下新模板用上 stagger 错落 / showcase 展播 / form 留资 /
  //      music 背景音乐 / transition 切换动效 / 文字对齐字号等新能力，各带一处演示点 ----
  {
    key: 'retail', name: '零售带货', industry: '零售', accent: '#b45309', theme: 'classic',
    desc: '主推单品 + 实拍种草，出单快',
    pages: [
      P(
        B('cover', { title: '好物上新 · 闭眼入不出错', subtitle: 'XX优选 · 只卖自己也用的东西', cover: '' }),
        B('text', { heading: '为什么值得买', body: '选品我们只认三条：自己在用、复购率高、售后不扯皮。每件都实拍实测，收到货和看到的一样。', align: 'left', size: 'md' })
      ),
      P(
        B('hero', { image: '', title: '本月主推', desc: '这款是回购榜第一名，库存不多，喜欢的直接微信找我拿现货。' }),
        B('gallery', { images: ['', '', '', ''], layout: 'stagger' })
      ),
      P(
        B('buttons', { items: [{ label: '微信下单', action: 'wechat', value: '' }, { label: '电话咨询', action: 'tel', value: '' }] }),
        B('contact', { showMobile: true, showWechat: true, showAddress: false }),
        B('endcard')
      )
    ]
  },
  {
    key: 'course', name: '教育培训', industry: '教育', accent: '#17357c', theme: 'classic',
    desc: '课程亮点 + 预约试听留资，招生素材',
    transition: 'fade',
    pages: [
      P(
        B('cover', { title: '把钱花在学习上，永远不亏', subtitle: 'XX教育 · 用心教好每个孩子', cover: '' }),
        B('text', { heading: '我们的教学理念', body: '不搞题海战术，先找到孩子卡在哪里，再一对一把洞补上。每周一份学习反馈，家长心里有数。', align: 'center', size: 'md' })
      ),
      P(
        B('text', { heading: '课程体系', body: '小学 / 初中 / 高中 全科辅导\n一对一 · 小班课 · 暑期特训\n免费试听一节，觉得合适再报名', align: 'left', size: 'sm' }),
        B('gallery', { images: ['', '', ''], layout: 'grid' })
      ),
      P(
        B('form', { heading: '预约试听', desc: '留下电话，课程顾问 1 小时内联系您', showName: true, showPhone: true, showMessage: true, buttonText: '提交预约', successText: '已收到，顾问马上联系您' }),
        B('endcard')
      )
    ]
  },
  {
    key: 'home', name: '家居装修', industry: '家居', accent: '#0f766e', theme: 'vanna',
    desc: '案例实拍错落排布，设计感立现',
    pages: [
      P(
        B('cover', { title: '把房子，装成家的样子', subtitle: 'XX装饰 · 设计施工一体', cover: '' }),
        B('text', { heading: '关于我们', body: '本地老牌装修团队，自有工人不转包，材料清单透明可查。装修完不是结束，五年质保随叫随到。', align: 'left', size: 'md' })
      ),
      P(
        B('text', { heading: '案例实拍', body: '现代简约 / 原木自然 / 新中式，总有一款是你要的家。', align: 'center', size: 'sm' }),
        B('gallery', { images: ['', '', '', ''], layout: 'stagger' })
      ),
      P(
        B('map', { lat: null, lng: null, label: 'XX市XX区XX路XX号（材料展厅）' }),
        B('buttons', { items: [{ label: '免费预约量房', action: 'tel', value: '' }] }),
        B('endcard')
      )
    ]
  },
  {
    key: 'team', name: '招聘招募', industry: '企业', accent: '#7c2d92', theme: 'classic',
    desc: '团队文化 + 岗位招募，简历留资',
    transition: 'fade',
    pages: [
      P(
        B('cover', { title: '找一群靠谱的人，做一件长期的事', subtitle: 'XX公司 · 招聘', cover: '' }),
        B('text', { heading: '我们是谁', body: '一群较真的年轻人，做的事不算酷，但对得起每一个客户。不卷加班，只卷结果。', align: 'center', size: 'lg' })
      ),
      P(
        B('text', { heading: '福利待遇', body: '五险一金 + 年度体检\n双休 / 弹性工时 / 年度旅游\n导师带教，不放养新人', align: 'left', size: 'md' }),
        B('hero', { image: '', title: '团队氛围', desc: '扁平沟通，有事当面说；下午茶常驻，猫狗偶尔串门。' })
      ),
      P(
        B('form', { heading: '投递简历', desc: '想应聘哪个岗位？留言告诉我们', showName: true, showPhone: true, showMessage: true, buttonText: '投递', successText: '收到！HR 会尽快联系你' }),
        B('endcard')
      )
    ]
  },
  {
    key: 'wedding', name: '婚礼摄影', industry: '婚庆', accent: '#be185d', theme: 'vanna',
    desc: '浪漫大图自动展播 + 背景音乐，仪式感拉满',
    transition: 'slide',
    pages: [
      P(
        B('cover', { title: '这一天，值得被好好记录', subtitle: 'XX婚礼摄影 · 记录有温度的瞬间', cover: '' }),
        B('text', { heading: '我们眼里的婚礼', body: '不是摆拍比剪刀手，而是妈妈别过头去擦眼泪的那一刻。我们只拍真实发生的事。', align: 'center', size: 'md' })
      ),
      P(
        // 展播图片自动取自公司相册（source=card）：在名片里传一次，这里自动轮播
        B('gallery', { images: [], layout: 'showcase', source: 'card' }),
        B('text', { heading: '档期有限', body: '周末与节假日档期通常提前两三个月约满，心动的新人建议先来聊聊。', align: 'center', size: 'sm' })
      ),
      P(
        B('buttons', { items: [{ label: '咨询档期', action: 'wechat', value: '' }] }),
        // 背景音乐块：填上音频链接即自动生效（公开页右下 ♪ 可控）
        B('music', { url: '', autoplay: true }),
        B('endcard')
      )
    ]
  },
  {
    key: 'advisor', name: '个人顾问', industry: '通用', accent: '#a62b2b', theme: 'tang',
    desc: '个人专业形象 + 一对一咨询，信任感强',
    transition: 'flip',
    pages: [
      P(
        B('cover', { title: '让专业的人，帮你做对决定', subtitle: 'XX · 资深顾问', cover: '' }),
        B('text', { heading: '一句话介绍我', body: '深耕行业十二年，帮 300+ 客户做过关键决策。你的问题，大概率我都遇到过。', align: 'center', size: 'lg' })
      ),
      P(
        B('text', { heading: '我能帮你什么', body: '一对一深度咨询，先把问题拆清楚，再给能落地的方案。不卖焦虑，不推没用的东西。', align: 'left', size: 'md' }),
        B('gallery', { images: ['', '', ''], layout: 'grid' })
      ),
      P(
        B('buttons', { items: [{ label: '电话咨询', action: 'tel', value: '' }, { label: '加微信详聊', action: 'wechat', value: '' }] }),
        B('contact', { showMobile: true, showWechat: true, showAddress: false }),
        B('endcard')
      )
    ]
  }
]

function getTemplate(key) { return TEMPLATES.find(t => t.key === key) || null }

module.exports = { TEMPLATES, getTemplate }
