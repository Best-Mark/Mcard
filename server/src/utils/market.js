// 名片集市元数据 —— 行业类目与内置城市坐标的唯一真相源。
// 前端通过 GET /api/cards/market/meta 拉取，不各自硬编码。
// 坐标采用 WGS84 近似的 GCJ-02 城市中心点，仅用于「按城市选点/距离粗排」，
// 真正精确定位由客户端 navigator.geolocation / uni.getLocation 提供。

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

// 常用城市中心坐标（lat, lng）。列表克制，覆盖主要商务城市；不在列表内可用精确定位。
const CITIES = [
  { name: '北京', lat: 39.9042, lng: 116.4074 },
  { name: '上海', lat: 31.2304, lng: 121.4737 },
  { name: '广州', lat: 23.1291, lng: 113.2644 },
  { name: '深圳', lat: 22.5431, lng: 114.0579 },
  { name: '杭州', lat: 30.2741, lng: 120.1551 },
  { name: '成都', lat: 30.5728, lng: 104.0668 },
  { name: '重庆', lat: 29.5630, lng: 106.5516 },
  { name: '武汉', lat: 30.5928, lng: 114.3055 },
  { name: '西安', lat: 34.3416, lng: 108.9398 },
  { name: '南京', lat: 32.0603, lng: 118.7969 },
  { name: '苏州', lat: 31.2989, lng: 120.5853 },
  { name: '天津', lat: 39.3434, lng: 117.3616 },
  { name: '长沙', lat: 28.2282, lng: 112.9388 },
  { name: '郑州', lat: 34.7466, lng: 113.6254 },
  { name: '青岛', lat: 36.0671, lng: 120.3826 },
  { name: '厦门', lat: 24.4798, lng: 118.0894 },
  { name: '福州', lat: 26.0745, lng: 119.2965 },
  { name: '济南', lat: 36.6512, lng: 117.1201 },
  { name: '合肥', lat: 31.8206, lng: 117.2272 },
  { name: '昆明', lat: 25.0389, lng: 102.7183 },
  { name: '大连', lat: 38.9140, lng: 121.6147 },
  { name: '沈阳', lat: 41.8057, lng: 123.4315 },
  { name: '宁波', lat: 29.8683, lng: 121.5440 },
  { name: '东莞', lat: 23.0207, lng: 113.7518 },
  { name: '佛山', lat: 23.0218, lng: 113.1214 },
  { name: '南宁', lat: 22.8170, lng: 108.3665 },
  { name: '贵阳', lat: 26.6470, lng: 106.6302 },
  { name: '海口', lat: 20.0442, lng: 110.1999 },
  { name: '无锡', lat: 31.4912, lng: 120.3119 },
  { name: '温州', lat: 28.0037, lng: 120.6994 }
]

// Haversine 距离（公里）
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

module.exports = { INDUSTRIES, INDUSTRY_KEYS, CITIES, isIndustry, normalizeIndustry, distanceKm }
