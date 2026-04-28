const KV_URL = process.env.KV_REST_API_URL || 'https://actual-sturgeon-92843.upstash.io';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || 'gQAAAAAAAWqrAAIgcDFhMDI0NWJkYTZkOWU0YWZiYmNiYzEzM2Y0ZjUyYjc3OQ';
const ARCHIVE_KEY = 'wazifatna_archive_v3';

async function kvGet() {
  try {
    const r = await fetch(`${KV_URL}/get/${ARCHIVE_KEY}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const d = await r.json();
    console.log('kvGet raw:', JSON.stringify(d).slice(0, 100));
    if (!d.result || d.result === 'nil') return [];
    const parsed = JSON.parse(d.result);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('kvGet error:', e.message);
    return [];
  }
}

async function kvSet(value) {
  try {
    const r = await fetch(`${KV_URL}/set/${ARCHIVE_KEY}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(value))
    });
    const d = await r.json();
    console.log('kvSet result:', JSON.stringify(d));
    return r.ok;
  } catch (e) {
    console.error('kvSet error:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET
    if (req.method === 'GET') {
      const data = await kvGet();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { action, entry, index } = body;
      console.log('action:', action, 'entry keys:', entry ? Object.keys(entry) : 'none');

      if (action === 'add') {
        if (!entry) return res.status(400).json({ error: 'no entry' });
        const current = await kvGet();
        current.unshift({ ...entry, savedAt: new Date().toISOString() });
        if (current.length > 20) current.pop();
        const ok = await kvSet(current);
        return res.status(200).json({ ok, count: current.length });
      }

      if (action === 'delete') {
        const current = await kvGet();
        if (typeof index === 'number' && index >= 0 && index < current.length) {
          current.splice(index, 1);
        }
        await kvSet(current);
        return res.status(200).json({ ok: true });
      }

      if (action === 'clear') {
        await kvSet([]);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'invalid action: ' + action });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('archive handler error:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
}
