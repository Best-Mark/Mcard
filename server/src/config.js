require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const path = require('path')

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  HOST: process.env.HOST || '0.0.0.0',
  // 二维码指向的公开域名，正式部署务必改为 https://your.domain
  BASE_URL: (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  JWT_SECRET: process.env.JWT_SECRET || 'mcard-dev-secret-please-change',
  DATA_DIR,
  DB_FILE: path.join(DATA_DIR, 'mcard.db'),
  UPLOAD_DIR: path.join(DATA_DIR, 'uploads'),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 5),
  // 支付：mock（本地/演示） | wechat（微信支付 V3 Native）
  PAY_MODE: process.env.PAY_MODE || 'mock',
  WECHAT_MCH_ID: process.env.WECHAT_MCH_ID || '',
  WECHAT_APP_ID: process.env.WECHAT_APP_ID || '',
  WECHAT_API_V3_KEY: process.env.WECHAT_API_V3_KEY || '',
  WECHAT_CERT_SERIAL_NO: process.env.WECHAT_CERT_SERIAL_NO || '',
  WECHAT_PRIVATE_KEY: (process.env.WECHAT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  WECHAT_NOTIFY_URL: process.env.WECHAT_NOTIFY_URL || '',
  WECHAT_PLATFORM_CERT: (process.env.WECHAT_PLATFORM_CERT || '').replace(/\\n/g, '\n'),
  ADMIN_INIT_USERNAME: process.env.ADMIN_INIT_USERNAME || 'admin',
  ADMIN_INIT_PASSWORD: process.env.ADMIN_INIT_PASSWORD || 'admin123456'
}
