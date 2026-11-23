const ok = (res, data, extra = {}) => res.json({ code: 0, data, ...extra })
const fail = (res, status, msg, extra = {}) => res.status(status).json({ code: status, msg, ...extra })

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

module.exports = { ok, fail, wrap }
