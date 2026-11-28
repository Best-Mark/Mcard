// H5 宣传页官方模板（唯一真相源）：/api/h5/templates 下发，前端「从模板新建」直接套用。
// 结构 = h5_pages.schema 同构：{ accent, transition?, pages: [{ blocks: [...] }] }，块类型白名单见 routes/h5.js BLOCK_TYPES。
// 2026-11-27 路线④扩充：11 套（原 5 + 新 6：零售/教育/家居/招聘/婚礼/顾问），新模板各带一处新能力演示点
// （stagger 错落 / showcase 展播 / form 留资 / music 背景音乐 / transition 切换动效 / 文字对齐字号）。
// 2026-11-28 场景扩充（用户「行业挺全，但场景也要丰富」）+9 套：开业/限时特惠/社群团购/宴请请柬/
// 周年庆答谢/招商加盟/新品发布/体验课引流/民宿度假，共 20 套；每套 3 页不超免费页数上限。
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
    transition: 'auto',
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
    transition: 'auto',
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
    transition: 'auto',
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
    transition: 'auto',
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
  },
  // ---- 2026-11-28 场景扩充（用户「行业挺全，但场景也要丰富」）：行业之外的营销/生活场景，
  //      9 套新增（开业/限时特惠/社群团购/宴请请柬/周年庆/招商加盟/新品发布/体验课/民宿），
  //      各 3 页不超免费页数，示例图与音乐按各自气质另行注入 ----
  {
    key: 'opening', name: '开业庆典', industry: '通用', accent: '#d97706', theme: 'tang',
    desc: '开业盛况 + 到店礼，聚人气促进店',
    transition: 'auto',
    pages: [
      P(
        B('cover', { title: '开业大吉 · 全场有礼', subtitle: 'XX店 · X月X日盛大开业', cover: '' }),
        B('text', { heading: '开业三重礼', body: '进店有礼：前 100 名送定制伴手礼\n消费满减：全场满 100 减 30\n抽奖互动：大额代金券等你来抽', align: 'center', size: 'md' })
      ),
      P(
        B('gallery', { images: ['', '', '', ''], layout: 'swipe' }),
        B('text', { heading: '店里有什么', body: '环境实拍先睹为快，开业当天还有舞狮表演和下午茶，带孩子来也不无聊。', align: 'left', size: 'md' })
      ),
      P(
        B('map', { lat: null, lng: null, label: 'XX市XX区XX路XX号（新店）' }),
        B('buttons', { items: [{ label: '电话咨询', action: 'tel', value: '' }, { label: '加微信探店', action: 'wechat', value: '' }] }),
        B('endcard')
      )
    ]
  },
  {
    key: 'flash', name: '限时特惠', industry: '零售', accent: '#dc2626', theme: 'classic',
    desc: '爆款特价 + 库存紧迫感，直接促单',
    transition: 'slide',
    pages: [
      P(
        B('cover', { title: '限时特惠 · 手慢无', subtitle: 'XX优选 · 仅 3 天', cover: '' }),
        B('text', { heading: '为什么便宜', body: '厂家直供清库存，不搞虚假原价。每一件都实拍实测，收到货和看到的一样。卖完即止，不补货。', align: 'center', size: 'md' })
      ),
      P(
        B('hero', { image: '', title: '今日爆款', desc: '回购榜第一名，这批尾单价格比平时低三成，喜欢的直接拍。' }),
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
    key: 'groupbuy', name: '社群团购', industry: '零售', accent: '#15803d', theme: 'vanna',
    desc: '接龙下单 + 售后承诺，私域复购',
    pages: [
      P(
        B('cover', { title: '本周团购 · 产地直发', subtitle: 'XX社群 · 团长甄选', cover: '' }),
        B('text', { heading: '这周团什么', body: '高山沃柑 5 斤装 19.9 元\n智利车厘子 2 斤 89 元\n数量有限，满 30 份截单发货', align: 'center', size: 'md' })
      ),
      P(
        B('gallery', { images: ['', '', ''], layout: 'grid' }),
        B('text', { heading: '团长承诺', body: '坏果包赔，拍照就补发；产地现摘现发，48 小时到手；群里晒单返 2 元红包。', align: 'left', size: 'md' })
      ),
      P(
        B('buttons', { items: [{ label: '微信接龙下单', action: 'wechat', value: '' }, { label: '电话找团长', action: 'tel', value: '' }] }),
        B('endcard')
      )
    ]
  },
  {
    key: 'banquet', name: '宴请请柬', industry: '通用', accent: '#9f1239', theme: 'classic',
    desc: '满月宴/生日宴/寿宴一页请柬，扫码即达',
    transition: 'auto',
    pages: [
      P(
        B('cover', { title: '诚邀您来赴宴', subtitle: 'XX宝宝满月宴 · 恭候光临', cover: '' }),
        B('text', { heading: '宴请详情', body: '时间：X月X日（周X）中午 12:00\n地点：XX酒店 2F 宴会厅\n迎宾：11:30 开始入席', align: 'center', size: 'md' })
      ),
      P(
        B('gallery', { images: ['', '', '', ''], layout: 'swipe' }),
        B('text', { heading: '一点小心意', body: '席间备了茶点和节目，家人们远道而来，请一定吃好喝好。', align: 'center', size: 'md' })
      ),
      P(
        B('map', { lat: null, lng: null, label: 'XX酒店（导航直达）' }),
        B('buttons', { items: [{ label: '电话确认出席', action: 'tel', value: '' }, { label: '微信回执', action: 'wechat', value: '' }] }),
        B('endcard')
      )
    ]
  },
  {
    key: 'anniversary', name: '周年庆答谢', industry: '通用', accent: '#92400e', theme: 'tang',
    desc: '老客专享 + 储值回馈，唤醒复购',
    pages: [
      P(
        B('cover', { title: '五周年 · 谢谢你还在', subtitle: 'XX店 · 老客答谢月', cover: '' }),
        B('text', { heading: '答谢三重礼', body: '到店即领周年礼包，数量有限\n储值满 1000 送 200，当次可用\n老带新，双方各得 50 元代金券', align: 'center', size: 'md' })
      ),
      P(
        B('hero', { image: '', title: '五年来的一些瞬间', desc: '从第一家小店到现在，感谢每一位回头客的照顾。' }),
        B('gallery', { images: ['', '', ''], layout: 'swipe' })
      ),
      P(
        B('buttons', { items: [{ label: '电话预约', action: 'tel', value: '' }] }),
        B('contact', { showMobile: true, showWechat: true, showAddress: true }),
        B('endcard')
      )
    ]
  },
  {
    key: 'franchise', name: '招商加盟', industry: '企业', accent: '#1e40af', theme: 'vanna',
    desc: '加盟政策 + 扶持体系，B 端洽谈留资',
    transition: 'auto',
    pages: [
      P(
        B('cover', { title: '小成本，开一家稳的店', subtitle: 'XX品牌 · 全国招商中', cover: '' }),
        B('text', { heading: '为什么跟着我们做', body: '供应链直供，进货价就是优势；选址、装修、培训、开业全程扶持；区域保护，一区一家。', align: 'center', size: 'md' })
      ),
      P(
        B('gallery', { images: ['', '', '', ''], layout: 'grid' }),
        B('text', { heading: '加盟条件', body: '认同品牌理念，亲自参与经营\n启动资金 15-30 万\n有门面或愿意实地选址', align: 'left', size: 'md' })
      ),
      P(
        B('form', { heading: '预约考察', desc: '留下电话，招商经理 1 个工作日内联系您', showName: true, showPhone: true, showMessage: true, buttonText: '提交预约', successText: '已收到，招商经理马上联系您' }),
        B('endcard')
      )
    ]
  },
  {
    key: 'launch', name: '新品发布', industry: '通用', accent: '#0e7490', theme: 'classic',
    desc: '新品卖点 + 首发权益，制造期待',
    transition: 'slide',
    pages: [
      P(
        B('cover', { title: '新品首发 · 今天见', subtitle: 'XX · 第三代全新升级', cover: '' }),
        B('text', { heading: '升级了什么', body: '续航提升 40%，充电快一倍\n整机轻了 18%，携带无感\n首发限享：赠一年延保', align: 'center', size: 'md' })
      ),
      P(
        B('hero', { image: '', title: '实拍细节', desc: '每一处改动都为了更好用，实拍无滤镜，所见即所得。' }),
        B('gallery', { images: ['', '', ''], layout: 'stagger' })
      ),
      P(
        B('buttons', { items: [{ label: '微信咨询', action: 'wechat', value: '' }, { label: '电话订购', action: 'tel', value: '' }] }),
        B('contact', { showMobile: true, showWechat: true, showAddress: false }),
        B('endcard')
      )
    ]
  },
  {
    key: 'trial', name: '体验课引流', industry: '教育', accent: '#0d9488', theme: 'vanna',
    desc: '免费体验课预约，到店转化（健身/舞蹈/艺培通用）',
    pages: [
      P(
        B('cover', { title: '第一节，免费体验', subtitle: 'XX健身工作室 · 私教体验课', cover: '' }),
        B('text', { heading: '体验课包含', body: '体测：体脂 / 体态 / 运动习惯评估\n训练：40 分钟一对一定制课\n方案：一份属于你的训练计划', align: 'center', size: 'md' })
      ),
      P(
        B('gallery', { images: ['', '', '', ''], layout: 'swipe' }),
        B('text', { heading: '适合谁来', body: '想减脂没方向的、产后恢复的、久坐肩颈腰背不舒服的——第一次来，先从一节体验课开始。', align: 'left', size: 'md' })
      ),
      P(
        B('form', { heading: '预约体验', desc: '留下电话，教练跟你约时间', showName: true, showPhone: true, showMessage: false, buttonText: '提交预约', successText: '已收到，教练马上联系你' }),
        B('endcard')
      )
    ]
  },
  {
    key: 'homestay', name: '民宿度假', industry: '文旅', accent: '#b7791f', theme: 'vanna',
    desc: '房型环境 + 预订方式，度假感拉满',
    transition: 'auto',
    pages: [
      P(
        B('cover', { title: '山里的日子，慢一点', subtitle: 'XX民宿 · XX景区旁', cover: '' }),
        B('text', { heading: '这里有', body: '独栋小院 / 山景大床房 / 亲子套房\n早餐用本地食材现做\n晚上可以烧烤、看星星', align: 'center', size: 'md' })
      ),
      P(
        B('gallery', { images: ['', '', '', ''], layout: 'stagger' }),
        B('text', { heading: '住客说', body: '「推开窗就是山，孩子不想走。」周末和节假日房态紧，建议提前一周订。', align: 'left', size: 'md' })
      ),
      P(
        B('map', { lat: null, lng: null, label: 'XX民宿（导航直达）' }),
        B('buttons', { items: [{ label: '电话订房', action: 'tel', value: '' }, { label: '加微信看房态', action: 'wechat', value: '' }] }),
        B('endcard')
      )
    ]
  }
]

function getTemplate(key) { return TEMPLATES.find(t => t.key === key) || null }

// 模板入场动效注入（2026-11-28 用户定稿「模板要带动效参数，不然没灵气」）：按块类型给基准动效，
// 同页相邻块方向/类型错开（up/left/right/zoom 交替），避免整页齐刷刷一个方向；用户在编辑器里仍可逐块改。
;(() => {
  const byType = { cover: 'zoom', endcard: 'fade', music: 'fade', video: 'zoom', gallery: 'right', hero: 'left', map: 'left', buttons: 'right', contact: 'up', form: 'up' }
  const variety = ['up', 'left', 'right', 'zoom']
  for (const t of TEMPLATES) for (const p of t.pages || []) {
    let i = 0
    for (const b of (p.blocks || [])) {
      if (b.anim) { i++; continue }
      let a = byType[b.type]
      if (!a) { a = variety[i % variety.length]; if (i > 0 && a === p.blocks[i - 1].anim) a = variety[(i + 2) % variety.length] }
      b.anim = a
      i++
    }
  }
})()

// 模板 DEMO 内容注入（2026-11-28 用户定稿「虽然是模板，但最好带上内容……模板带 DEMO 也包括音乐」）：
// 每套模板用专属气质的示例图（client/public/h5demo/{key}-1/-2/-3.svg，各模板不同配色+不同几何构成，
// 2026-11-28 用户反馈「模板不要过于雷同，有些颜色要用图片，这样才能给用户正确引导」——4 张通用图轮换
// 让所有模板长得一样，图上也只是笼统的「示例图片」，用户不知道该放什么图）；
// 非封面页默认深色底改用同气质深色图片底（{key}-bg.svg，无文字不抢正文），顺带示范「页面背景可以换图」。
// 每套模板挂一首站内免版权合成曲（client/public/music/bgm-*.wav，无缝循环），套用即成稿；
// 用户点图即换、音乐块可在编辑器里换链接/删除。图用相对路径——随当前部署域名走，绝不写死域名。
;(() => {
  const demo = (t, kind) => `/h5demo/${t.key}-${kind}.svg`
  const MUSICS = {
    calm: '/music/bgm-calm.wav', soothe: '/music/bgm-soothe.wav', zen: '/music/bgm-zen.wav',
    romantic: '/music/bgm-romantic.wav', light: '/music/bgm-light.wav', warm: '/music/bgm-warm.wav',
    business: '/music/bgm-business.wav', fresh: '/music/bgm-fresh.wav'
  }
  // 曲子按模板气质配（2026-11-28 用户反馈「音乐有些奇怪/太LOW/缺悠扬舒缓」）：8 首各有气质——
  // calm 悠扬 / soothe 空灵 / zen 禅意 / romantic 浪漫 / light 清亮 / warm 温暖 / business 沉稳 / fresh 轻快
  const MUSIC_BY_KEY = {
    company: MUSICS.business, building: MUSICS.business, event: MUSICS.business,
    franchise: MUSICS.business, launch: MUSICS.business, anniversary: MUSICS.business,
    beauty: MUSICS.romantic, wedding: MUSICS.romantic,
    advisor: MUSICS.calm, homestay: MUSICS.calm,
    home: MUSICS.zen,
    restaurant: MUSICS.warm, banquet: MUSICS.warm,
    course: MUSICS.light, groupbuy: MUSICS.light, trial: MUSICS.light,
    retail: MUSICS.fresh, team: MUSICS.fresh, opening: MUSICS.fresh, flash: MUSICS.fresh
  }
  TEMPLATES.forEach((t) => {
    for (const p of t.pages || []) for (const b of (p.blocks || [])) {
      if (b.type === 'cover' && !b.cover) b.cover = demo(t, 1)
      else if (b.type === 'hero' && !b.image) b.image = demo(t, 2)
      else if (b.type === 'gallery' && Array.isArray(b.images)) {
        if (b.source === 'card') continue // showcase 展播取公司相册，不填示例图
        b.images = b.images.map((im, i) => im || demo(t, 2 + (i % 2)))
      }
    }
    // 非封面页：纯色深底 → 同气质深色图片底（封面页有满幅封面图，不需要 bg）
    for (let i = 1; i < (t.pages || []).length; i++) {
      if (!t.pages[i].bg) t.pages[i].bg = { color: '', image: demo(t, 'bg') }
    }
    const music = MUSIC_BY_KEY[t.key]
    if (!music) return
    // 音乐：模板自带 music 块（如婚礼摄影）只补 url；否则挂到「装得下而不产生新画布页」的最后一页——
    // 估高口径与编辑器 pageToEls/组件 EST_H 一致（画布 1334），固定挂倒数第二页会把已近满高的页
    // 挤出一张只有 music 的稀疏页（company 等实测）；顺带把 form/endcard 等偏稀疏的尾页补满。
    if ((t.pages || []).some(p => (p.blocks || []).some(b => b.type === 'music'))) {
      for (const p of t.pages || []) for (const b of (p.blocks || [])) if (b.type === 'music' && !b.url) b.url = music
    } else {
      const EST_H = { gallery: 520, contact: 260, map: 220, buttons: 200, video: 280, form: 620, endcard: 340 }
      const endY = (p) => {
        let y = 60
        for (const b of (p.blocks || [])) {
          if (b.type === 'cover') { y = 930; continue }
          let h
          if (b.type === 'hero') h = 420 + (b.title ? 78 : 0) + (b.desc ? 122 : 0)
          else if (b.type === 'text') {
            const s = String(b.body || '')
            h = (b.heading ? 84 : 0) + (b.body ? Math.round(Math.max(s.split('\n').length, Math.ceil(s.length / 20)) * 26 * 1.8) + 30 : 0)
          } else h = EST_H[b.type] || 240
          y += h + 26
        }
        return y
      }
      const MUSIC_H = 186 // 160 + 26 间距
      let target = null
      for (let i = (t.pages || []).length - 1; i >= 0; i--) {
        if (endY(t.pages[i]) + MUSIC_H <= 1334) { target = t.pages[i]; break }
      }
      if (!target) target = t.pages.reduce((a, b) => (endY(b) < endY(a) ? b : a), t.pages[0]) // 全满时挂最空页
      if (target) target.blocks.push(B('music', { url: music, autoplay: true }))
    }
  })
})()

module.exports = { TEMPLATES, getTemplate }
