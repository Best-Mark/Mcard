// 名片集市元数据 —— 行业类目与内置城市坐标的唯一真相源。
// 前端通过 GET /api/cards/market/meta 拉取，不各自硬编码。
// 坐标采用 GCJ-02 城市中心点，仅用于「按城市选点/距离粗排」，
// 真正精确定位由客户端定位提供（Web 端 WGS84 需转 GCJ-02，见 utils/geoCoord.js）。
// 距离算法唯一真相源 = utils/geoCoord.js 的 distanceKm（WGS84 椭球 Vincenty）。
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
  { name: '重庆', py: 'CQ', lat: 29.563, lng: 106.5516 },
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
  { name: '大连', py: 'DL', lat: 38.914, lng: 121.6147 },
  { name: '沈阳', py: 'SY', lat: 41.8057, lng: 123.4315 },
  { name: '宁波', py: 'NB', lat: 29.8683, lng: 121.544 },
  { name: '东莞', py: 'DG', lat: 23.0207, lng: 113.7518 },
  { name: '佛山', py: 'FS', lat: 23.0218, lng: 113.1214 },
  { name: '南宁', py: 'NN', lat: 22.817, lng: 108.3665 },
  { name: '贵阳', py: 'GY', lat: 26.647, lng: 106.6302 },
  { name: '海口', py: 'HK', lat: 20.0442, lng: 110.1999 },
  { name: '无锡', py: 'WX', lat: 31.4912, lng: 120.3119 },
  { name: '温州', py: 'WZ', lat: 28.0037, lng: 120.6994 },
  { name: '三亚', py: 'SY', lat: 18.2528, lng: 109.5119 },
  { name: '濮阳', py: 'PY', lat: 35.7619, lng: 115.0292 },
  { name: '哈尔滨', py: 'HEB', lat: 45.8038, lng: 126.535 },
  { name: '石家庄', py: 'SJZ' },
  { name: '唐山', py: 'TS' },
  { name: '秦皇岛', py: 'QHD' },
  { name: '邯郸', py: 'HD' },
  { name: '保定', py: 'BD' },
  { name: '廊坊', py: 'LF' },
  { name: '沧州', py: 'CZ' },
  { name: '衡水', py: 'HS' },
  { name: '太原', py: 'TY' },
  { name: '大同', py: 'DT' },
  { name: '长治', py: 'CZ' },
  { name: '晋城', py: 'JC' },
  { name: '临汾', py: 'LF' },
  { name: '运城', py: 'YC' },
  { name: '呼和浩特', py: 'HHHT' },
  { name: '包头', py: 'BT' },
  { name: '鄂尔多斯', py: 'EEDS' },
  { name: '赤峰', py: 'CF' },
  { name: '鞍山', py: 'AS' },
  { name: '抚顺', py: 'FS' },
  { name: '锦州', py: 'JZ' },
  { name: '长春', py: 'CC' },
  { name: '延边', py: 'YB' },
  { name: '齐齐哈尔', py: 'QQHE' },
  { name: '大庆', py: 'DQ' },
  { name: '牡丹江', py: 'MDJ' },
  { name: '常州', py: 'CZ' },
  { name: '南通', py: 'NT' },
  { name: '徐州', py: 'XZ' },
  { name: '扬州', py: 'YZ' },
  { name: '盐城', py: 'YC' },
  { name: '嘉兴', py: 'JX' },
  { name: '绍兴', py: 'SX' },
  { name: '金华', py: 'JH' },
  { name: '台州', py: 'TZ' },
  { name: '湖州', py: 'HZ' },
  { name: '芜湖', py: 'WH' },
  { name: '蚌埠', py: 'BB' },
  { name: '马鞍山', py: 'MAS' },
  { name: '安庆', py: 'AQ' },
  { name: '黄山', py: 'HS' },
  { name: '泉州', py: 'QZ' },
  { name: '漳州', py: 'ZZ' },
  { name: '莆田', py: 'PT' },
  { name: '宁德', py: 'ND' },
  { name: '南昌', py: 'NC' },
  { name: '赣州', py: 'GZ' },
  { name: '九江', py: 'JJ' },
  { name: '上饶', py: 'SR' },
  { name: '宜春', py: 'YC' },
  { name: '吉安', py: 'JA' },
  { name: '烟台', py: 'YT' },
  { name: '潍坊', py: 'WF' },
  { name: '淄博', py: 'ZB' },
  { name: '临沂', py: 'LY' },
  { name: '济宁', py: 'JN' },
  { name: '威海', py: 'WH' },
  { name: '洛阳', py: 'LY' },
  { name: '开封', py: 'KF' },
  { name: '南阳', py: 'NY' },
  { name: '许昌', py: 'XC' },
  { name: '新乡', py: 'XX' },
  { name: '焦作', py: 'JZ' },
  { name: '宜昌', py: 'YC' },
  { name: '襄阳', py: 'XY' },
  { name: '荆州', py: 'JZ' },
  { name: '黄石', py: 'HS' },
  { name: '十堰', py: 'SY' },
  { name: '株洲', py: 'ZZ' },
  { name: '湘潭', py: 'XT' },
  { name: '衡阳', py: 'HY' },
  { name: '岳阳', py: 'YY' },
  { name: '常德', py: 'CD' },
  { name: '郴州', py: 'CZ' },
  { name: '珠海', py: 'ZH' },
  { name: '中山', py: 'ZS' },
  { name: '惠州', py: 'HZ' },
  { name: '汕头', py: 'ST' },
  { name: '湛江', py: 'ZJ' },
  { name: '江门', py: 'JM' },
  { name: '柳州', py: 'LZ' },
  { name: '桂林', py: 'GL' },
  { name: '北海', py: 'BH' },
  { name: '玉林', py: 'YL' },
  { name: '儋州', py: 'DZ' },
  { name: '琼海', py: 'QH' },
  { name: '文昌', py: 'WC' },
  { name: '绵阳', py: 'MY' },
  { name: '德阳', py: 'DY' },
  { name: '宜宾', py: 'YB' },
  { name: '泸州', py: 'LZ' },
  { name: '乐山', py: 'LS' },
  { name: '南充', py: 'NC' },
  { name: '遵义', py: 'ZY' },
  { name: '六盘水', py: 'LPS' },
  { name: '安顺', py: 'AS' },
  { name: '毕节', py: 'BJ' },
  { name: '曲靖', py: 'QJ' },
  { name: '大理', py: 'DL' },
  { name: '丽江', py: 'LJ' },
  { name: '玉溪', py: 'YX' },
  { name: '西双版纳', py: 'XSBN' },
  { name: '拉萨', py: 'LS' },
  { name: '日喀则', py: 'RKZ' },
  { name: '林芝', py: 'LZ' },
  { name: '昌都', py: 'CD' },
  { name: '咸阳', py: 'XY' },
  { name: '宝鸡', py: 'BJ' },
  { name: '渭南', py: 'WN' },
  { name: '榆林', py: 'YL' },
  { name: '延安', py: 'YA' },
  { name: '兰州', py: 'LZ' },
  { name: '天水', py: 'TS' },
  { name: '酒泉', py: 'JQ' },
  { name: '张掖', py: 'ZY' },
  { name: '庆阳', py: 'QY' },
  { name: '西宁', py: 'XN' },
  { name: '海东', py: 'HD' },
  { name: '海西', py: 'HX' },
  { name: '海南州', py: 'HNZ' },
  { name: '银川', py: 'YC' },
  { name: '吴忠', py: 'WZ' },
  { name: '石嘴山', py: 'SZS' },
  { name: '固原', py: 'GY' },
  { name: '中卫', py: 'ZW' },
  { name: '乌鲁木齐', py: 'WLMQ' },
  { name: '克拉玛依', py: 'KLMY' },
  { name: '喀什', py: 'KS' },
  { name: '伊犁', py: 'YL' },
  { name: '昌吉', py: 'CJ' },
  { name: '台北', py: 'TB' },
  { name: '高雄', py: 'GX' },
  { name: '台中', py: 'TZ' },
  { name: '台南', py: 'TN' }

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

// 距离算法已收敛到 geoCoord.js（WGS84 椭球 Vincenty，误差远小于原球面 Haversine）；
// 此处保留 re-export，避免调用方（routes/cards.js）改动，也保证只有一处实现。
const { distanceKm, wgs84ToGcj02 } = require('./geoCoord')

// 城市中心点原始值来自公开 WGS84 数据；对外统一下发 GCJ-02，
// 与名片存库坐标（地图选点/高德）一致，避免「选城市 vs 精确定位」两套距离口径。
for (const c of CITIES) {
  if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
    const g = wgs84ToGcj02(c.lat, c.lng)
    c.lat = Number(g.lat.toFixed(6)); c.lng = Number(g.lng.toFixed(6))
  }
}

module.exports = { INDUSTRIES, INDUSTRY_KEYS, CITIES, HOT_CITIES, cityCoords, isIndustry, normalizeIndustry, distanceKm }
