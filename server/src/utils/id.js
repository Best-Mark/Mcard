const crypto = require('crypto')
const { customAlphabet } = require('nanoid')

const slugId = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 8)
const orderId = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZ', 12)

const orderNo = () => {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `MC${stamp}${orderId()}`
}
const randomHex = (n = 16) => crypto.randomBytes(n).toString('hex')

module.exports = { slugId, orderNo, randomHex }
