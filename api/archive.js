const KV_URL = process.env.KV_REST_API_URL || 'https://actual-sturgeon-92843.upstash.io';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || 'gQAAAAAAAWqrAAIgcDFhMDI0NWJkYTZkOWU0YWZiYmNiYzEzM2Y0ZjUyYjc3OQ';

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const d = await r.json();
  if (!d.result) return null;
  try { return JSON.parse(d.result); } catch { return null; }
}

async function kvSet(key, value) {
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value))
  });
  return r.ok;
}

async function kvDel(key) {
  await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
}

const ARCHIVE_KEY = 'wazifatna_archive_v2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET
    if (req.method === 'GET') {
      const data = await kvGet(ARCHIVE_KEY);
      return res.status(200).json(Array.isArray(data) ? data : []);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
      const { action, entry, index } = body || {};

      // إضافة جلسة
      if (action === 'add') {
        if (!entry) return res.status(400).json({ error: 'no entry' });
        const current = await kvGet(ARCHIVE_KEY) || [];
        current.unshift(entry);
        if (current.length > 20) current.pop();
        await kvSet(ARCHIVE_KEY, current);
        return res.status(200).json({ ok: true, count: current.length });
      }

      // حذف جلسة
      if (action === 'delete') {
        const current = await kvGet(ARCHIVE_KEY) || [];
        if (index >= 0 && index < current.length) current.splice(index, 1);
        await kvSet(ARCHIVE_KEY, current);
        return res.status(200).json({ ok: true });
      }

      // مسح الكل
      if (action === 'clear') {
        await kvDel(ARCHIVE_KEY);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'invalid action' });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('archive error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
