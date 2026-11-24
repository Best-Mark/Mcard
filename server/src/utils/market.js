// 名片集市元数据 —— 行业类目与内置城市坐标的唯一真相源。
// 前端通过 GET /api/cards/market/meta 拉取，不各自硬编码。
// 坐标采用 WGS84 近似的 GCJ-02 城市中心点，仅用于「按城市选点/距离粗排」，
// 真正精确定位由客户端 navigator.geolocation / uni.getLocation 提供。
// py = 城市名拼音首字母缩写（如北京=BJ、哈尔滨=HEB），供城市选择弹层的 A-Z 快捷索引使用。

const INDUSTRIES = [
  { key: 'tech', label: '互联网 / 科技', icon: '◎' },
  { key: 'finance', label: '金融 / 投资', icon: '◈' },
  { key: 'manufacture', label: '制造 / 工业', icon: '⚙' },
  { key: 'retail', label: '零售 / 电商', icon: '◉' },
  { key: 'education', label: '教育 / 培训', icon: '✎' },
  { key: 'medical', label: '医疗 / 健康', icon: '✚' },
  { key: 'realestate', label: '地产 / 建筑', icon: '▤' },
  { key: 'logistics', label: '物流 / 供应链', icon: '⇄' },
  { key: 'culture', label: '文化 / 传媒 / 设计', icon: '✦' },
  { key: 'service', label: '商务服务 / 咨询', icon: '◇' },
  { key: 'food', label: '餐饮 / 酒店', icon: '♨' },
  { key: 'other', label: '其他', icon: '·' }
]

const INDUSTRY_KEYS = INDUSTRIES.map(i => i.key)
const isIndustry = k => INDUSTRY_KEYS.includes(k)
const normalizeIndustry = k => (isIndustry(k) ? k : '')

// 常用城市中心坐标（lat, lng）。仅市级（直辖市/地级市），不含省/区县；不在列表内可用精确定位。
const CITIES = [
  { name: '北京', py: 'BJ', lat: 39.9042, lng: 116.4074 },
  { name: '上海', py: 'SH', lat: 31.2304, lng: 121.4737 },
  { name: '广州', py: 'GZ', lat: 23.1291, lng: 113.2644 },
  { name: '深圳', py: 'SZ', lat: 22.5431, lng: 114.0579 },
  { name: '杭州', py: 'HZ', lat: 30.2741, lng: 120.1551 },
  { name: '成都', py: 'CD', lat: 30.5728, lng: 104.0668 },
  { name: '重庆', py: 'CQ', lat: 29.5630, lng: 106.5516 },
  { name: '武汉', py: 'WH', lat: 30.5928, lng: 114.3055 },
  { name: '西安', py: 'XA', lat: 34.3416, lng: 108.9398 },
  { name: '南京', py: 'NJ', lat: 32.0603, lng: 118.7969 },
  { name: '苏州', py: 'SZ', lat: 31.2989, lng: 120.5853 },
  { name: '天津', py: 'TJ', lat: 39.3434, lng: 117.3616 },
  { name: '长沙', py: 'CS', lat: 28.2282, lng: 112.9388 },
  { name: '郑州', py: 'ZZ', lat: 34.7466, lng: 113.6254 },
  { name: '青岛', py: 'QD', lat: 36.0671, lng: 120.3826 },
  { name: '厦门', py: 'XM', lat: 24.4798, lng: 118.0894 },
  { name: '福州', py: 'FZ', lat: 26.0745, lng: 119.2965 },
  { name: '济南', py: 'JN', lat: 36.6512, lng: 117.1201 },
  { name: '合肥', py: 'HF', lat: 31.8206, lng: 117.2272 },
  { name: '昆明', py: 'KM', lat: 25.0389, lng: 102.7183 },
  { name: '大连', py: 'DL', lat: 38.9140, lng: 121.6147 },
  { name: '沈阳', py: 'SY', lat: 41.8057, lng: 123.4315 },
  { name: '宁波', py: 'NB', lat: 29.8683, lng: 121.5440 },
  { name: '东莞', py: 'DG', lat: 23.0207, lng: 113.7518 },
  { name: '佛山', py: 'FS', lat: 23.0218, lng: 113.1214 },
  { name: '南宁', py: 'NN', lat: 22.8170, lng: 108.3665 },
  { name: '贵阳', py: 'GY', lat: 26.6470, lng: 106.6302 },
  { name: '海口', py: 'HK', lat: 20.0442, lng: 110.1999 },
  { name: '无锡', py: 'WX', lat: 31.4912, lng: 120.3119 },
  { name: '温州', py: 'WZ', lat: 28.0037, lng: 120.6994 },
  { name: '三亚', py: 'SY', lat: 18.2528, lng: 109.5119 },
  { name: '濮阳', py: 'PY', lat: 35.7619, lng: 115.0292 },
  { name: '哈尔滨', py: 'HEB', lat: 45.8038, lng: 126.5350 }
]

// 热门城市标签顺序（唯一真相源，前端横向标签栏按此渲染；首位由前端用当前定位城市替换）
// 坐标从 CITIES 取，不在 CITIES 的通过 geo 字典/地理编码兜底
const HOT_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '重庆', '南京', '厦门', '三亚']

// 城市名 → {lat,lng}（先精确匹配，再模糊匹配），供「选城市即设坐标原点」使用
function cityCoords(name) {
  if (!name) return null
  const n = String(name).trim()
  const exact = CITIES.find(c => c.name === n)
  if (exact) return { lat: exact.lat, lng: exact.lng }
  const fuzzy = CITIES.find(c => c.name.includes(n) || n.includes(c.name))
  return fuzzy ? { lat: fuzzy.lat, lng: fuzzy.lng } : null
}

// Haversine 距离（公里）
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

module.exports = { INDUSTRIES, INDUSTRY_KEYS, CITIES, HOT_CITIES, cityCoords, isIndustry, normalizeIndustry, distanceKm }
