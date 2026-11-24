// 名片搜索：轻量中文智能分词 + 相关度评分（零外部依赖）。
// 设计目标：输「设计 财税」「北京 设计」能拆词命中，不再要求整句连续出现；
// 命中越多词、整句命中越靠前。词典复用 market.js 的行业/城市（参数唯一真相源），
// 另加搜索高频业务词仅用于「切词粒度」，不参与任何业务判定。

const { INDUSTRIES, CITIES } = require('./market')

// 行业标签拆词：「互联网 / 科技」→ 互联网、科技；复用行业标签，不另建清单
const INDUSTRY_WORDS = (Array.isArray(INDUSTRIES) ? INDUSTRIES : [])
  .flatMap(i => String(i?.label || '').split(/[\/、，,]/).map(s => s.trim()).filter(Boolean))
const CITY_WORDS = (Array.isArray(CITIES) ? CITIES : []).map(c => c?.name).filter(Boolean)

// 搜索高频词：只决定「切在哪里」，不是行业/城市的第二定义处
const COMMON_WORDS = [
  '设计', '财税', '财税咨询', '科技', '互联网', '人工智能', '软件', '硬件', '智能硬件',
  '制造', '工业', '零售', '电商', '教育', '培训', '医疗', '健康', '地产', '建筑',
  '物流', '供应链', '文化', '传媒', '商务', '服务', '咨询', '餐饮', '酒店',
  '律师', '法律', '会计', '审计', '装修', '摄影', '开发', '工程师', '产品',
  '运营', '市场', '销售', '金融', '投资', '保险', '银行', '新能源', '环保',
  '农业', '旅游', '健身', '美容', '公司', '企业', '工作室', '创始人',
  '经理', '总监', '顾问', '专家', '合作', '批发', '采购', '工厂', '加工'
]

// 长词优先，正向最大匹配
const DICT = Array.from(new Set([...INDUSTRY_WORDS, ...CITY_WORDS, ...COMMON_WORDS]))
  .filter(w => w && w.length >= 2)
  .sort((a, b) => b.length - a.length)
const MAX_WORD = DICT.reduce((m, w) => Math.max(m, w.length), 0)

const CJK = /[\u4e00-\u9fa5]/
const WORD_CHAR = /[\u4e00-\u9fa5a-zA-Z0-9]/
const LATIN_NUM = /[a-z0-9]/

// 中文分词：词典最大匹配优先，未命中用二元切分兜底；英文/数字整词保留。
// 返回去重的词数组（小写归一）。空输入/纯符号返回 []。
function tokenize(input) {
  const text = String(input || '').trim().toLowerCase()
  if (!text) return []
  const tokens = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (!WORD_CHAR.test(ch)) { i++; continue } // 标点/空格作分隔符
    if (LATIN_NUM.test(ch)) {
      let j = i + 1
      while (j < text.length && LATIN_NUM.test(text[j])) j++
      tokens.push(text.slice(i, j))
      i = j
      continue
    }
    let matched = ''
    const maxLen = Math.min(MAX_WORD, text.length - i)
    for (let len = maxLen; len >= 2; len--) {
      const cand = text.slice(i, i + len)
      if (DICT.includes(cand)) { matched = cand; break }
    }
    if (matched) { tokens.push(matched); i += matched.length; continue }
    // 词典未命中：能组成二字词就切二字，边界保留单字
    if (i + 1 < text.length && CJK.test(text[i + 1])) {
      tokens.push(text.slice(i, i + 2))
      i += 2
    } else {
      tokens.push(ch)
      i++
    }
  }
  return Array.from(new Set(tokens)).filter(Boolean)
}

// 相关度评分：整句命中权重最高；每命中一个词加分；多词全中额外加权。
// 返回 0 表示完全不命中（调用方过滤掉）。
function score(query, tokens, text) {
  if (!tokens || !tokens.length) return 0
  const hay = String(text || '').toLowerCase()
  if (!hay) return 0
  const q = String(query || '').trim().toLowerCase()
  let s = 0
  let hit = 0
  if (q && hay.includes(q)) s += 100
  for (const t of tokens) {
    if (hay.includes(t)) { hit++; s += t.length >= 2 ? 10 : 3 }
  }
  if (tokens.length > 1 && hit === tokens.length) s += 20
  return s
}

module.exports = { tokenize, score }
