const KV_URL = process.env.KV_REST_API_URL || 'https://actual-sturgeon-92843.upstash.io';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || 'gQAAAAAAAWqrAAIgcDFhMDI0NWJkYTZkOWU0YWZiYmNiYzEzM2Y0ZjUyYjc3OQ';

const kv = {
  async get(key) {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const d = await r.json();
    return d.result ? JSON.parse(d.result) : null;
  },
  async set(key, value) {
    await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(value))
    });
  },
  async del(key) {
    await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
  },
};

const ARCHIVE_KEY = 'wazifatna_archive';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — جلب كل الأرشيف
    if (req.method === 'GET') {
      const data = await kv.get(ARCHIVE_KEY);
      return res.status(200).json(data || []);
    }

    const { action, entry, index } = req.body || {};

    // إضافة جلسة جديدة للأرشيف
    if (action === 'add') {
      const current = await kv.get(ARCHIVE_KEY) || [];
      current.unshift(entry);
      if (current.length > 20) current.pop(); // احتفظ بآخر 20 جلسة
      await kv.set(ARCHIVE_KEY, current);
      return res.status(200).json({ ok: true });
    }

    // حذف جلسة بالرقم
    if (action === 'delete') {
      const current = await kv.get(ARCHIVE_KEY) || [];
      current.splice(index, 1);
      await kv.set(ARCHIVE_KEY, current);
      return res.status(200).json({ ok: true });
    }

    // تحديث جلسة (إحصائيات)
    if (action === 'update') {
      const current = await kv.get(ARCHIVE_KEY) || [];
      if (current[index]) current[index] = entry;
      await kv.set(ARCHIVE_KEY, current);
      return res.status(200).json({ ok: true });
    }

    // مسح كل الأرشيف
    if (action === 'clear') {
      await kv.del(ARCHIVE_KEY);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
