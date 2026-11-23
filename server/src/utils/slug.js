const db = require('../db')
const { slugId } = require('./id')

const RESERVED = new Set(['admin', 'api', 'login', 'me', 'c', 'assets', 'manifest', 'icon'])

function normalizeSlug(input) {
  return String(input || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function available(slug, exceptId) {
  if (!slug || slug.length < 3 || slug.length > 32 || RESERVED.has(slug)) return false
  const row = db.prepare('SELECT id FROM cards WHERE slug = ?').get(slug)
  return !row || row.id === exceptId
}

function makeSlug(preferred) {
  const norm = normalizeSlug(preferred)
  if (norm && available(norm)) return norm
  let s = slugId()
  while (!available(s)) s = slugId()
  return s
}

module.exports = { normalizeSlug, available, makeSlug }
