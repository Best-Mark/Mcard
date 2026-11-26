// 配置中心：所有「运行时可改」参数的定义与唯一真相源。
// 存储于 site_config（DB），.env 仅首次启动种子，不再作为运行时来源。
// 敏感字段只写不读：GET 回掩码 + SHA256 指纹；PUT 收到空/掩码时沿用库中旧值。
const crypto = require('crypto')
const config = require('../config')

// 公开键：匿名接口 /api/public/config 仅下发这些
// share_* 是分享素材池（标题/描述/图片，每行一条），匿名可读——对齐 MShop 的 share_config 白名单口径
const SHARE_KEYS = ['share_title', 'share_desc', 'share_image']
const PUBLIC_KEYS = ['site_name', 'site_logo', 'site_desc', 'contact', 'notice', 'qr_brand', 'miniapp_launch_image', 'icp', 'user_agreement', 'privacy_policy', ...SHARE_KEYS]
// 用户协议 / 隐私政策：微信小程序审核硬性要求——登录前用户可查看并主动勾选同意，内容由后台维护。
// 空值回落内置默认（LEGAL_DEFAULTS），保证任何时刻都有完整可读的协议正文。
const LEGAL_KEYS = ['user_agreement', 'privacy_policy']
// 协议/隐私默认正文：按行分段渲染。后台改写后以 DB 为准；此为兜底与首次可读内容。
const LEGAL_DEFAULTS = {
  user_agreement: [
    '《唐笺·用户协议》',
    '',
    '欢迎您使用「唐笺」电子名片服务。请您在注册或使用本小程序前，仔细阅读并充分理解本协议。当您勾选同意并开始使用，即表示您已接受本协议的全部条款。',
    '',
    '一、服务内容',
    '唐笺为您提供电子名片的创建、展示、分享、交换与管理服务，包括但不限于名片资料编辑、二维码生成、名片夹收藏、通讯录保存、实体名片版式导出等功能。具体服务内容以小程序实际提供的功能为准，我们可能根据运营需要对服务内容进行调整。',
    '',
    '二、账号与资料',
    '您应保证注册资料与名片资料的真实性、准确性与合法性，不得冒用他人身份、不得发布违法违规或侵犯第三方权益的内容。您的账号仅限本人使用，请妥善保管登录凭证，因您保管不善造成的损失由您自行承担。名片展示的姓名、职位、公司、联系方式等信息由您自主填写并对外展示，请自行斟酌公开范围。',
    '',
    '三、用户行为规范',
    '您在使用本服务时应遵守法律法规与公序良俗，不得利用本服务从事任何违法违规活动，包括但不限于发布虚假信息、骚扰他人、发送垃圾内容、侵犯他人隐私或知识产权、干扰服务正常运行等。若发现违规行为，我们有权视情节采取提示、限制功能、暂停或终止服务等措施。',
    '',
    '四、知识产权',
    '本小程序的软件、界面、商标、标识等知识产权归平台所有，未经许可不得擅自使用。您上传的资料（文字、图片、联系方式等）的知识产权归您或合法权利人所有；为实现名片展示、分享等服务目的，您授予我们在必要范围内展示、处理上述内容的许可。',
    '',
    '五、免责声明',
    '您理解并同意，因网络、设备、第三方服务等不可控因素可能导致服务中断或数据丢失，我们将尽合理努力保障服务稳定，但不对因此产生的直接或间接损失承担责任。您通过名片链接或二维码访问的第三方内容，其真实性与合法性由第三方负责。',
    '',
    '六、协议变更',
    '我们可能根据法律法规或业务发展需要修订本协议，修订后的协议将在小程序内公示。若您不同意修订内容，可停止使用并注销账号；继续使用即视为接受修订后的协议。',
    '',
    '七、联系我们',
    '如对本协议有任何疑问，可通过小程序内「联系客服」与我们取得联系。',
    ''
  ].join('\n'),
  privacy_policy: [
    '《唐笺·隐私政策》',
    '',
    '「唐笺」（以下简称"我们"）深知个人信息对您的重要性。我们将依据《中华人民共和国个人信息保护法》《网络安全法》《数据安全法》等法律法规，遵循合法、正当、必要与诚信原则处理您的个人信息。请您在使用本小程序前仔细阅读并理解本政策。',
    '',
    '一、我们收集的信息',
    '为向您提供服务，我们可能收集以下信息：',
    '1. 账号信息：手机号、微信授权信息（如昵称、头像）等，用于注册、登录与身份识别；',
    '2. 名片资料：您主动填写的姓名、职位、公司、联系方式（手机、座机、邮箱、微信、地址等）、头像、公司标识、简介、链接等，用于生成与展示您的电子名片；',
    '3. 设备与日志信息：设备型号、操作系统、网络状态、访问日志、IP 地址等，用于保障服务安全与优化体验；',
    '4. 位置信息：在您主动授权后，获取大致或精准地理位置，用于按距离展示名片集市等基于位置的功能。您可拒绝授权，相关功能将不可用但不影响其它功能；',
    '5. 您保存的他人名片信息：您通过扫码、搜索等方式收藏的名片资料，仅存储于您的账号名下用于名片夹管理。',
    '',
    '二、我们如何使用您的信息',
    '1. 用于账号注册、登录、身份验证与账号安全；',
    '2. 用于创建、展示、分享您的电子名片，生成二维码与名片链接；',
    '3. 用于名片夹、收藏、交换、通讯录保存等名片管理功能；',
    '4. 用于按您设置的展示范围，在名片集市中展示您的名片信息；',
    '5. 用于发送服务通知、订单消息及必要的消息提醒；',
    '6. 用于服务优化、故障排查、安全保障与防范违法违规行为；',
    '7. 用于履行法律法规规定的义务。',
    '',
    '三、我们如何共享、转让、公开披露您的信息',
    '1. 除获取您的明示同意外，我们不会向第三方共享您的个人信息，但以下情形除外：与授权合作伙伴为实现特定服务目的所必需（如短信服务商发送验证码）、根据法律法规或司法行政机关的强制性要求、为维护公共利益或您本人的生命财产安全等；',
    '2. 您在名片中主动填写并选择展示的信息（如姓名、职位、联系方式），会按您的设置向名片访问者展示，请谨慎填写与设置；',
    '3. 未经您的同意，我们不会转让、公开披露您的个人信息，法律法规另有规定的除外。',
    '',
    '四、我们如何存储与保护您的信息',
    '1. 您的个人信息存储于中华人民共和国境内的服务器，法律法规另有规定的除外；',
    '2. 我们采取加密存储、访问控制、安全审计等技术和管理措施保护您的信息安全；',
    '3. 我们将在实现服务目的所必需的期限内保存您的个人信息，法律法规另有规定的从其规定。',
    '',
    '五、您的权利',
    '1. 您有权查阅、复制、更正、补充您的个人信息；',
    '2. 您有权删除您的账号与个人信息，可联系客服申请注销；',
    '3. 您有权撤回授权或关闭个性化展示设置，撤回后相关功能将不可用但不影响此前授权的效力；',
    '4. 您有权获取个人信息副本。',
    '',
    '六、未成年人保护',
    '我们重视对未成年人个人信息的保护。若您为不满 14 周岁的未成年人，请您的监护人阅读本政策并代为作出同意；如发现未成年人个人信息被误收集，我们将依法删除。',
    '',
    '七、本政策的变更',
    '我们可能适时修订本政策，修订内容将在小程序内公示。重大变更将以显著方式提示您，继续使用即视为接受修订后的政策。',
    '',
    '八、联系我们',
    '如您对本政策有任何疑问、意见或建议，或需行使个人信息相关权利，可通过小程序内「联系客服」与我们取得联系。我们将在收到您的请求后 15 个工作日内予以答复。',
    ''
  ].join('\n')
}
// 公开派生键：由后端算好后下发，前端据此决定是否显示微信快捷登录入口（不下发任何 key/secret）
const PUBLIC_DERIVED_KEYS = ['wechat_login_enabled']

// 分组定义：前端按此渲染表单（label/type/敏感标记），键名即 site_config 的 key
const GROUPS = {
  site: {
    label: '站点基础',
    fields: [
      { key: 'site_name', label: '站点名称', type: 'text' },
      // 站点 LOGO：type=image → 后台渲染「上传+裁剪」控件，不再手填路径。
      // 上传走 /api/upload?keepFormat=1（LOGO 给微信分享卡片/og 抓取方读取，必须保留 PNG 不能转 WebP）。
      { key: 'site_logo', label: '站点 LOGO', type: 'image', hint: '点击上传并裁剪（方形 512×512 PNG）；用于登录页/后台侧栏/微信分享缩略图，留空显示默认 M' },
      { key: 'site_desc', label: '站点简介', type: 'text' },
      { key: 'contact', label: '联系方式', type: 'text' },
      { key: 'notice', label: '公告', type: 'textarea' },
      { key: 'qr_brand', label: '二维码水印', type: 'text' },
      // 小程序启动图：配置后小程序启动页直接展示这张图（点击进入），不再显示内置推广页；留空走内置推广页。
      { key: 'miniapp_launch_image', label: '小程序启动图（图片地址，绝对路径 /uploads/... 或完整 URL；留空用内置推广页）', type: 'text' },
      // ICP 备案号：协议页脚合规公示（微信审核要求经营主体/备案公示），留空则页脚不显示该项
      { key: 'icp', label: 'ICP 备案号（如 京ICP备12345678号，协议页脚公示；留空不显示）', type: 'text' }
    ]
  },
  legal: {
    label: '协议与隐私',
    fields: [
      // 微信小程序审核硬要求：登录前须能查看并主动勾选同意《用户协议》《隐私政策》。
      // 正文由后台编辑；留空时用内置默认（LEGAL_DEFAULTS），保证任何时刻都有完整可读正文。
      { key: 'user_agreement', label: '用户协议正文（留空用内置默认模板）', type: 'textarea' },
      { key: 'privacy_policy', label: '隐私政策正文（留空用内置默认模板）', type: 'textarea' }
    ]
  },
  payment: {
    label: '支付参数',
    fields: [
      // 支付模式唯一真相源：mock=本地演示；wechat=仅微信；alipay=仅支付宝；both=两通道按客户端场景自选。
      // 存量库只可能是 mock/wechat，天然兼容；新增通道必须在这里登记，禁止页面另写枚举。
      { key: 'pay_mode', label: '支付模式（mock / wechat / alipay / both）', type: 'text' },
      { key: 'wechat_mch_id', label: '微信商户号 MCH ID', type: 'text' },
      { key: 'wechat_app_id', label: '微信 AppID（公众号/PC 扫码用）', type: 'text' },
      // 密钥类分两种，别混用交互：
      // ① 文件型（商户私钥 apiclient_key.pem / 平台证书 / 支付宝公私钥）：平台确实提供文件下载，
      //    走本地文件选择（FileReader 读原文随分组 PUT，不产生公开上传地址）；accept/maxBytes 前后端共用唯一真相源。
      // ② 字符串型（API v3 密钥）：商户在微信商户平台「账户中心 → API 安全」自行设置的 32 位字符，
      //    微信不提供任何密钥文件、设置后也不再明文展示，只能手工填写/粘贴。旧版误做成「选择密钥文件」
      //    且文案写着「下载 API v3 密钥文本文件」——那个文件根本不存在，纯误导，现改回手工输入框。
      // type 仍是 secret，掩码+指纹机制完全不变。
      { key: 'wechat_api_v3_key', label: 'API v3 密钥', type: 'secret', hint: '商户平台「账户中心 → API 安全」自行设置的 32 位字符串，微信不提供文件下载，请手工填写；设置后仅显示一次，请自行留存' },
      { key: 'wechat_cert_serial_no', label: '商户证书序列号', type: 'text' },
      { key: 'wechat_private_key', label: '商户私钥 PEM', type: 'secret', large: true, upload: true, accept: '.pem,.key,.txt', fileHint: '选择商户 API 私钥文件 apiclient_key.pem', maxBytes: 20000 },
      { key: 'wechat_notify_url', label: '微信支付回调 URL（留空=按当前域名自动生成，禁止写死域名）', type: 'text' },
      // 强制验签：未配置平台证书/公钥时回调一律 401，绝不放行（对齐 MShop 安全口径）。
      { key: 'wechat_platform_cert', label: '微信平台证书/公钥 PEM（回调验签必填）', type: 'secret', large: true, upload: true, accept: '.pem,.crt,.cer,.txt', fileHint: '选择微信支付平台证书或公钥文件', maxBytes: 20000 },
      { key: 'wechat_h5_return_url', label: '微信 H5 支付完成回跳 URL（留空=当前域名 /me/pay/:id）', type: 'text' },
      // 小程序 AppID 复用「小程序参数」分组的 miniapp_wx_appid，不在此重复定义（参数唯一真相源）。
      // 公众号 AppID 复用「微信网页授权」分组的 wechat_oauth_appid，同上。
      { key: 'ali_app_id', label: '支付宝 AppID', type: 'text' },
      { key: 'ali_private_key', label: '支付宝应用私钥 PEM', type: 'secret', large: true, upload: true, accept: '.pem,.key,.txt', fileHint: '选择支付宝应用私钥文件', maxBytes: 20000 },
      { key: 'ali_pub_key', label: '支付宝公钥 PEM（回调验签必填）', type: 'secret', large: true, upload: true, accept: '.pem,.crt,.txt', fileHint: '选择支付宝公钥文件', maxBytes: 20000 },
      { key: 'ali_notify_url', label: '支付宝回调 URL（留空=按当前域名自动生成）', type: 'text' },
      { key: 'ali_return_url', label: '支付宝支付完成回跳 URL（留空=当前域名 /me/pay/:id）', type: 'text' }
    ]
  },
  sms: {
    label: '短信平台',
    fields: [
      { key: 'sms_enabled', label: '启用短信（true / false）', type: 'text' },
      { key: 'sms_provider', label: '服务商（aliyun）', type: 'text' },
      { key: 'sms_access_key_id', label: 'AccessKey ID', type: 'text' },
      { key: 'sms_access_key_secret', label: 'AccessKey Secret', type: 'secret' },
      { key: 'sms_sign_name', label: '短信签名', type: 'text' },
      { key: 'sms_template_code', label: '验证码模板 Code', type: 'text' }
    ]
  },
  miniapp: {
    label: '小程序参数',
    fields: [
      { key: 'miniapp_wx_appid', label: '微信小程序 AppID', type: 'text' },
      { key: 'miniapp_wx_secret', label: '微信小程序 AppSecret', type: 'secret' },
      { key: 'miniapp_ali_appid', label: '支付宝小程序 AppID', type: 'text' },
      { key: 'miniapp_tt_appid', label: '抖音小程序 AppID', type: 'text' }
    ]
  },
  wechat_oauth: {
    label: '微信网页授权',
    fields: [
      { key: 'wechat_oauth_enabled', label: '启用微信快捷登录（true / false）', type: 'text' },
      { key: 'wechat_oauth_appid', label: '公众号 AppID（网页授权用，非小程序）', type: 'text' },
      { key: 'wechat_oauth_secret', label: '公众号 AppSecret', type: 'secret' },
      { key: 'wechat_oauth_scope', label: '授权范围（固定 snsapi_userinfo 以取昵称头像）', type: 'text' },
      { key: 'wechat_oauth_bind_phone', label: '新用户授权后必须绑定手机号（true / false）', type: 'text' },
      // 域名校验文件列表（JSON 数组 [{name,content}]）：公众号网页授权域名、小程序业务域名等
      // 每个场景微信都会给一个独立文件，必须能同时放多个、互不覆盖。
      // 文件名只拦路径穿越，不再强制 MP_verify_ 前缀（微信改名/浏览器加 (1) 后缀仍可用）。
      { key: 'wechat_verify_files', label: '域名校验文件（小程序/公众号配置域名时微信给的 .txt，可一次选多个，上传后自动放到站点根）', type: 'files' }
      // 旧单文件字段 wechat_oauth_verify_name / wechat_oauth_verify_content 已废弃，
      // 仅作存量数据兼容在 wechatOauthConfig() 里读取迁移，不再下发后台表单。
    ]
  },
  map: {
    label: '定位与地图',
    fields: [
      { key: 'amap_key', label: '高德地图 Web 服务 Key（IP 定位/逆地理/地理编码）', type: 'secret' },
      { key: 'map_provider', label: '地图服务商（amap / osm）', type: 'text' },
      { key: 'map_default_city', label: '定位兜底城市（如 上海）', type: 'text' }
    ]
  },
  oss: {
    label: '对象存储 OSS',
    fields: [
      { key: 'oss_provider', label: '存储方式（local / aliyun / tencent）', type: 'text' },
      { key: 'oss_path_prefix', label: '项目路径前缀（多项目共用 Bucket 隔离，如 mcard → 全部落在 mcard/uploads/ 下）', type: 'text' },
      { key: 'oss_region', label: '地域（阿里云 oss-cn-* / 腾讯云 ap-*）', type: 'text' },
      { key: 'oss_bucket', label: 'Bucket 名称', type: 'text' },
      { key: 'oss_access_key', label: 'AccessKey ID（阿里云）/ SecretId（腾讯云）', type: 'secret' },
      { key: 'oss_secret_key', label: 'AccessKey Secret（阿里云）/ SecretKey（腾讯云）', type: 'secret' },
      { key: 'oss_custom_domain', label: '自定义域名（可选，不含协议头与结尾斜杠）', type: 'text' }
    ]
  },
  share: {
    label: '分享素材池',
    fields: [
      { key: 'share_title', label: '分享标题池（每行一条，随机取用）', type: 'textarea', large: true },
      { key: 'share_desc', label: '分享描述池（每行一条，随机取用）', type: 'textarea', large: true },
      { key: 'share_image', label: '分享图片池（每行一个绝对 URL，仅 jpg/png/gif 生效）', type: 'textarea', large: true }
    ]
  },
  promo: {
    label: '推广分销',
    fields: [
      // 开关用 boolean 类型：后台渲染成左右滑动开关（与套餐上架/推广员身份同款交互），不再手输 true/false。
      { key: 'promo_enabled', label: '启用推广分销', type: 'boolean' },
      // 多级分销（2026-11-27）：层级=邀请链向上计佣的层数；一级沿用 promo_order_rate，
      // 二级/三级比例独立可配。showIfLevel：层级不足时后台隐藏该输入框（选 2 才出二级比例）。
      { key: 'promo_levels', label: '分销层级（每笔订单沿邀请链向上计佣的层数）', type: 'text' },
      // 首单奖与消费返佣都是百分比（唯一真相源）：首单奖=被邀请人首次开通套餐时按订单金额额外给，
      // 只发给直接推广员（一生一次）；多级只作用于每单消费返佣。
      // 旧 promo_register_reward_cents（固定金额）已废弃，存量库残留键无害、不再读取也不再下发。
      { key: 'promo_order_rate', label: '一级返佣比例（%，每笔订单给直接推广员，如 10 表示 10%）', type: 'text' },
      { key: 'promo_rate_lv2', label: '二级返佣比例（%，给直接推广员的上级）', type: 'text', showIfLevel: 2 },
      { key: 'promo_rate_lv3', label: '三级返佣比例（%，给二级推广员的上级）', type: 'text', showIfLevel: 3 },
      { key: 'promo_withdraw_min_cents', label: '最低提现额（分）', type: 'text' },
      { key: 'promo_invite_base_url', label: '邀请链接前缀（留空=自动用当前站点域名，如 https://card.example.com）', type: 'text' }
    ]
  },
  notify: {
    label: '消息通知',
    fields: [
      { key: 'notify_favorite_title', label: '被收藏 · 标题', type: 'text' },
      { key: 'notify_favorite_body', label: '被收藏 · 正文（变量 {actorName}）', type: 'text' },
      { key: 'notify_exchange_title', label: '被交换 · 标题', type: 'text' },
      { key: 'notify_exchange_body', label: '被交换 · 正文（变量 {actorName}）', type: 'text' },
      { key: 'notify_view_title', label: '被查看 · 标题', type: 'text' },
      { key: 'notify_view_body', label: '被查看 · 正文（变量 {actorName}、{cardName}）', type: 'text' },
      { key: 'notify_update_title', label: '关注名片更新 · 标题', type: 'text' },
      { key: 'notify_update_body', label: '关注名片更新 · 正文（变量 {cardName}、{summary}）', type: 'text' },
      { key: 'notify_view_enabled', label: '启用「有人查看了我的名片」通知（true / false）', type: 'text' }
    ]
  }
}

// 通知模板默认值（唯一真相源）：留空即回落这批。变量占位符由 notify.js 统一渲染。
const NOTIFY_TEMPLATE_DEFAULTS = {
  notify_favorite_title: '名片动态',
  notify_favorite_body: '{actorName} 收藏了你的名片',
  notify_exchange_title: '名片动态',
  notify_exchange_body: '{actorName} 与你交换了名片',
  notify_view_title: '名片动态',
  notify_view_body: '{actorName} 查看了你的名片',
  notify_update_title: '名片有更新',
  notify_update_body: '你关注的名片「{cardName}」更新了：{summary}',
  notify_view_enabled: 'true'
}
const NOTIFY_KEYS = Object.keys(NOTIFY_TEMPLATE_DEFAULTS)

// 分享素材池默认值（唯一真相源）：后台留空即回落这批，前端与小程序不再各自硬编码文案。
// MCard 场景是电子名片，文案围绕「存通讯录 / 二维码不变」，与 MShop 的「好物」口径区分。
const SHARE_POOL_DEFAULTS = {
  share_title: [
    '一张名片，扫码存进通讯录',
    '资料随时改，二维码终身不变',
    '认识一下，这是我的电子名片',
    '存下联系方式，随时都能找到我',
    '换手机也不怕，名片二维码不变'
  ],
  share_desc: [
    '电话、微信、地址一目了然，扫码即可存入通讯录。',
    '资料随时更新，二维码长期有效，不用换码。',
    '电子名片：一扫即存，再也不会弄丢联系方式。',
    '点开看看，扫一扫就能把我存进手机。',
    '名片信息都在这里，长按或扫码即可保存。'
  ],
  share_image: []
}

const SENSITIVE_KEYS = Object.values(GROUPS).flatMap(g => g.fields).filter(f => f.type === 'secret').map(f => f.key)
const ALL_KEYS = Object.values(GROUPS).flatMap(g => g.fields).map(f => f.key)
const MASK = '••••••••••••'
const fingerprint = v => { try { return crypto.createHash('sha256').update(String(v || '')).digest('hex').slice(0, 12) } catch { return '' } }

// 运行时读取单个配置（DB 优先，缺省回落 config.env 的种子值）
function get(key, fallback = '') {
  const row = require('../db').prepare('SELECT value FROM site_config WHERE key = ?').get(key)
  if (row) { try { return JSON.parse(row.value) ?? fallback } catch { return fallback } }
  return fallback
}

// 读取支付配置对象：DB 优先，DB 无值时用 .env 种子
function payConfig() {
  const fromDb = k => String(get(k, ''))
  return {
    PAY_MODE: fromDb('pay_mode') || config.PAY_MODE || 'mock',
    WECHAT_MCH_ID: fromDb('wechat_mch_id') || config.WECHAT_MCH_ID || '',
    WECHAT_APP_ID: fromDb('wechat_app_id') || config.WECHAT_APP_ID || '',
    WECHAT_API_V3_KEY: fromDb('wechat_api_v3_key') || config.WECHAT_API_V3_KEY || '',
    WECHAT_CERT_SERIAL_NO: fromDb('wechat_cert_serial_no') || config.WECHAT_CERT_SERIAL_NO || '',
    WECHAT_PRIVATE_KEY: fromDb('wechat_private_key') || config.WECHAT_PRIVATE_KEY || '',
    WECHAT_NOTIFY_URL: fromDb('wechat_notify_url') || config.WECHAT_NOTIFY_URL || '',
    WECHAT_PLATFORM_CERT: fromDb('wechat_platform_cert') || config.WECHAT_PLATFORM_CERT || '',
    WECHAT_H5_RETURN_URL: fromDb('wechat_h5_return_url') || '',
    // AppID 复用既有分组，绝不在此另建副本（参数唯一真相源）
    WECHAT_MINI_APP_ID: fromDb('miniapp_wx_appid') || '',
    WECHAT_OA_APP_ID: fromDb('wechat_oauth_appid') || '',
    ALI_APP_ID: fromDb('ali_app_id') || '',
    ALI_PRIVATE_KEY: fromDb('ali_private_key') || '',
    ALI_PUB_KEY: fromDb('ali_pub_key') || '',
    ALI_NOTIFY_URL: fromDb('ali_notify_url') || '',
    ALI_RETURN_URL: fromDb('ali_return_url') || ''
  }
}

// 支付模式判定（唯一真相源）：mock 仅演示；wechat/alipay 单通道；both 双通道自选。
// 未知值一律按 mock 处理（fail-safe：绝不因脏配置把用户带进真实支付）。
function payModeOf(p = payConfig()) {
  const m = String(p.PAY_MODE || '').toLowerCase()
  return ['wechat', 'alipay', 'both'].includes(m) ? m : 'mock'
}
function payChannels(p = payConfig()) {
  const m = payModeOf(p)
  if (m === 'mock') return ['mock']
  if (m === 'wechat') return ['wechat']
  if (m === 'alipay') return ['alipay']
  return ['wechat', 'alipay']
}

// 读取短信配置对象
function smsConfig() {
  const fromDb = k => String(get(k, ''))
  return {
    enabled: fromDb('sms_enabled') === 'true',
    provider: fromDb('sms_provider') || 'aliyun',
    accessKeyId: fromDb('sms_access_key_id') || '',
    accessKeySecret: fromDb('sms_access_key_secret') || '',
    signName: fromDb('sms_sign_name') || '',
    templateCode: fromDb('sms_template_code') || ''
  }
}

// 校验文件列表（唯一真相源）：[{name,content}]。容错解析，脏数据一律当空列表，绝不让坏 JSON 拖垮配置读取。
// 兼容存量：旧的单文件字段 name/content 若还有值，自动并入列表（迁移后不再写回，仅读时兜底）。
function verifyFiles() {
  const out = []
  const seen = new Set()
  const push = (name, content) => {
    const n = String(name || '').trim()
    const c = String(content || '').replace(/\s+/g, '')
    if (!n || !c || seen.has(n)) return
    seen.add(n)
    out.push({ name: n, content: c })
  }
  try {
    const raw = get('wechat_verify_files', '')
    const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw
    if (Array.isArray(arr)) for (const f of arr) if (f && typeof f === 'object') push(f.name, f.content)
  } catch { /* 坏 JSON 忽略 */ }
  // 存量单字段兜底（旧版本上传的文件不会因升级而消失）
  push(get('wechat_oauth_verify_name', ''), get('wechat_oauth_verify_content', ''))
  return out
}

// 读取微信网页授权配置（公众号 OAuth，非小程序）
function wechatOauthConfig() {
  const fromDb = k => String(get(k, ''))
  const files = verifyFiles()
  return {
    enabled: fromDb('wechat_oauth_enabled') === 'true',
    appId: fromDb('wechat_oauth_appid'),
    secret: fromDb('wechat_oauth_secret'),
    scope: 'snsapi_userinfo', // 需求：取昵称头像，固定 userinfo（不接受公开改 scope）
    bindPhone: fromDb('wechat_oauth_bind_phone') !== 'false',
    verifyFiles: files,
    // 兼容旧调用点：保留首份文件名/内容（动态路由旧逻辑与历史字段展示用）
    verifyName: files[0]?.name || '',
    verifyContent: files[0]?.content || ''
  }
}

// 读取定位与地图配置（高德 Key 服务端使用，不下发前端）
function mapConfig() {
  const fromDb = k => String(get(k, ''))
  return {
    amapKey: fromDb('amap_key'),
    provider: fromDb('map_provider') || 'amap',
    defaultCity: fromDb('map_default_city') || '上海'
  }
}

// 推广分销规则（唯一真相源）：层级/各级返佣比例/首单奖比例/提现门槛后台可改，服务端结算时直读。
// 比例都限制 0~100（百分比），提现门槛为非负整数分；脏值一律回落默认，绝不因配置异常给负数或超高返佣。
function promoConfig() {
  // 空值（未种子/后台清空）一律回落默认，不能让 Number('')=0 变成「0% 返佣」。
  const num = (k, def) => {
    const raw = get(k, null)
    if (raw === null || raw === '' || raw === undefined) return def
    const n = Math.round(Number(raw))
    return Number.isFinite(n) && n >= 0 ? n : def
  }
  const rate = (k, def) => {
    const raw = get(k, null)
    return raw === null || raw === '' ? def : (Number.isFinite(Number(raw)) && Number(raw) >= 0 && Number(raw) <= 100 ? Number(raw) : def)
  }
  // 层级钳制 1~3：脏值/超界不放大也不缩没，防「层级 0 = 直发全链」或「层级 99 = 超长链」
  const levels = Math.min(3, Math.max(1, num('promo_levels', 1)))
  return {
    enabled: String(get('promo_enabled', '')) === 'true',
    levels,
    firstOrderRate: rate('promo_first_order_rate', 10),
    orderRate: rate('promo_order_rate', 10),
    rateLv2: rate('promo_rate_lv2', 0),
    rateLv3: rate('promo_rate_lv3', 0),
    withdrawMinCents: num('promo_withdraw_min_cents', 1000),
    inviteBaseUrl: String(get('promo_invite_base_url', '') || '').trim()
  }
}

// 读取 OSS 配置（服务端直读原始密钥，不走 adminView 掩码；pathPrefix 做容错清洗）
// 多项目共用一个 Bucket 时，pathPrefix 是唯一隔离维度，所有对象 key = `${prefix}/uploads/<file>`
function ossConfig() {
  const fromDb = k => String(get(k, ''))
  const cleanDomain = s => String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^\/+|\/+$/g, '')
  const cleanPrefix = s => String(s || '').trim()
    .replace(/^https?:\/\/[^/]+\/?/i, '')
    .replace(/^(uploads\/)+/i, '')
    .replace(/\/?uploads\/?$/i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^A-Za-z0-9_./-]/g, '') // 防路径穿越：只留安全字符
  return {
    provider: (fromDb('oss_provider') || 'local').toLowerCase(),
    pathPrefix: cleanPrefix(fromDb('oss_path_prefix') || 'mcard') || 'mcard',
    region: fromDb('oss_region'),
    bucket: fromDb('oss_bucket'),
    accessKey: fromDb('oss_access_key'),
    secretKey: fromDb('oss_secret_key'),
    customDomain: cleanDomain(fromDb('oss_custom_domain'))
  }
}

// 前端配置是否显示微信快捷登录：开关开启 + AppID/Secret 齐全（AppSecret 从库直读，不下发）
function wechatLoginEnabled() {
  const c = wechatOauthConfig()
  return c.enabled && !!c.appId && !!c.secret
}

// 分享素材池：任意值（JSON 数组字符串 / 换行文本 / 旧单值）→ 清洗后的数组（最多 10 条）。
// 只收字符串条目，避免脏值被 String() 强转成 "[object Object]" 当素材发出去。
function normalizePool(v, fallback = []) {
  let arr = []
  if (Array.isArray(v)) arr = v
  else if (typeof v === 'string' && v.trim()) {
    const s = v.trim()
    if (s.startsWith('[')) { try { const p = JSON.parse(s); if (Array.isArray(p)) arr = p } catch { /* 非 JSON 按换行处理 */ } }
    if (!arr.length) arr = s.split(/[\r\n]+/)
  }
  const clean = arr.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 10)
  return clean.length ? clean : fallback
}

// 分享素材池视图：空值一律回落内置默认池，保证任何页面都有素材可抽
function shareView() {
  const out = {}
  for (const k of SHARE_KEYS) out[k] = normalizePool(get(k, ''), SHARE_POOL_DEFAULTS[k])
  return out
}

// 通知模板视图：空值回落内置默认，notify.js 渲染时统一走这里（唯一真相源）
function notifyView() {
  const out = {}
  for (const k of NOTIFY_KEYS) out[k] = String(get(k, '') || '').trim() || NOTIFY_TEMPLATE_DEFAULTS[k]
  return out
}

// 公开配置：白名单键 + 派生开关（绝不外泄任何 key/secret）
function publicView() {
  const out = {}
  for (const k of PUBLIC_KEYS) out[k] = get(k, '')
  // 协议/隐私：后台未填写时回落内置默认，保证登录前可查看完整正文（微信审核要求）
  for (const k of LEGAL_KEYS) out[k] = String(out[k] || '').trim() || LEGAL_DEFAULTS[k]
  for (const k of PUBLIC_DERIVED_KEYS) {
    if (k === 'wechat_login_enabled') out[k] = wechatLoginEnabled()
  }
  // 分享素材池下发数组；后台未配置时用内置默认池（前端/小程序不再各自硬编码）
  Object.assign(out, shareView())
  return out
}

// 管理端读取：敏感字段回掩码+指纹，其余回明文
function adminView() {
  const db = require('../db')
  const rows = db.prepare('SELECT key, value FROM site_config').all()
  const map = Object.fromEntries(rows.map(r => {
    try { return [r.key, JSON.parse(r.value)] } catch { return [r.key, ''] }
  }))
  const out = {}
  for (const k of ALL_KEYS) out[k] = map[k] ?? ''
  // 协议/隐私所见即所得：空值显示内置默认正文，后台直接改后保存即以 DB 为准
  for (const k of LEGAL_KEYS) out[k] = String(out[k] || '').trim() || LEGAL_DEFAULTS[k]
  for (const k of SENSITIVE_KEYS) {
    const val = String(map[k] || '')
    out[k] = val ? MASK : ''
    out[`${k}_fp`] = val ? fingerprint(val) : ''
  }
  // 分享池配置中心所见即所得：空池展示内置默认文案（C 端实际分享出去的就是这批）
  for (const k of SHARE_KEYS) out[k] = normalizePool(map[k], SHARE_POOL_DEFAULTS[k]).join('\n')
  // 校验文件：把（含旧单字段迁移后的）权威列表回显给后台，避免「后端生效但后台看不见」。
  // 同时把迁移结果自愈写回 DB（幂等），下次起不再依赖兼容读取。
  const vf = verifyFiles()
  const stored = String(map['wechat_verify_files'] || '')
  const normalized = JSON.stringify(vf)
  if (normalized !== '[]' && stored !== normalized) {
    try {
      db.prepare("INSERT INTO site_config (key,value,updated_at) VALUES ('wechat_verify_files',?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .run(normalized)
    } catch (e) { console.warn('[VerifyFile] 迁移回写失败', e.message) }
  }
  out.wechat_verify_files = normalized
  return out
}

// 首次启动种子：仅写入 DB 中不存在的键（敏感键也只种一次，之后以 DB 为准）
function seedDefaults() {
  const db = require('../db')
  const stmt = db.prepare('INSERT OR IGNORE INTO site_config (key, value, updated_at) VALUES (?,?,datetime(\'now\'))')
  const seeds = {
    site_logo: '',
    pay_mode: config.PAY_MODE || 'mock',
    wechat_mch_id: config.WECHAT_MCH_ID || '',
    wechat_app_id: config.WECHAT_APP_ID || '',
    wechat_api_v3_key: config.WECHAT_API_V3_KEY || '',
    wechat_cert_serial_no: config.WECHAT_CERT_SERIAL_NO || '',
    wechat_private_key: config.WECHAT_PRIVATE_KEY || '',
    wechat_notify_url: config.WECHAT_NOTIFY_URL || '',
    wechat_platform_cert: config.WECHAT_PLATFORM_CERT || '',
    wechat_h5_return_url: '',
    ali_app_id: '',
    ali_private_key: '',
    ali_pub_key: '',
    ali_notify_url: '',
    ali_return_url: '',
    sms_enabled: 'false',
    sms_provider: 'aliyun',
    sms_access_key_id: '',
    sms_access_key_secret: '',
    sms_sign_name: '',
    sms_template_code: '',
    miniapp_wx_appid: '',
    miniapp_wx_secret: '',
    miniapp_ali_appid: '',
    miniapp_tt_appid: '',
    wechat_oauth_enabled: 'false',
    wechat_oauth_appid: '',
    wechat_oauth_secret: '',
    wechat_oauth_scope: 'snsapi_userinfo',
    wechat_oauth_bind_phone: 'true',
    wechat_oauth_verify_name: '',
    wechat_oauth_verify_content: '',
    wechat_verify_files: '[]',
    amap_key: '',
    map_provider: 'amap',
    map_default_city: '上海',
    oss_provider: 'local',
    oss_path_prefix: 'mcard',
    oss_region: '',
    oss_bucket: '',
    oss_access_key: '',
    oss_secret_key: '',
    oss_custom_domain: '',
    share_title: SHARE_POOL_DEFAULTS.share_title.join('\n'),
    share_desc: SHARE_POOL_DEFAULTS.share_desc.join('\n'),
    share_image: '',
    promo_enabled: 'false',
    promo_levels: '1',
    promo_first_order_rate: '10',
    promo_order_rate: '10',
    promo_rate_lv2: '0',
    promo_rate_lv3: '0',
    promo_withdraw_min_cents: '1000',
    promo_invite_base_url: '',
    ...NOTIFY_TEMPLATE_DEFAULTS
  }
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(seeds)) stmt.run(k, JSON.stringify(String(v || '')))
  })
  tx()
}

module.exports = { PUBLIC_KEYS, PUBLIC_DERIVED_KEYS, SHARE_KEYS, SHARE_POOL_DEFAULTS, NOTIFY_KEYS, NOTIFY_TEMPLATE_DEFAULTS, GROUPS, SENSITIVE_KEYS, ALL_KEYS, LEGAL_KEYS, LEGAL_DEFAULTS, MASK, fingerprint, get, normalizePool, shareView, notifyView, payConfig, payModeOf, payChannels, smsConfig, wechatOauthConfig, verifyFiles, wechatLoginEnabled, mapConfig, promoConfig, ossConfig, publicView, adminView, seedDefaults }
