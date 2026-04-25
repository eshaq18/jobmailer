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
  async keys(pattern) {
    const r = await fetch(`${KV_URL}/keys/${encodeURIComponent(pattern)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const d = await r.json();
    return d.result || [];
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, name, session } = req.body || {};
  const queryName = req.query?.name;

  try {
    // GET all sessions
    if (req.method === 'GET') {
      const keys = await kv.keys('session:*');
      const sessions = {};
      for (const key of keys) {
        const data = await kv.get(key);
        if (data) sessions[data.name] = data;
      }
      return res.status(200).json(sessions);
    }

    // POST - save session
    if (req.method === 'POST' && action === 'save') {
      await kv.set(`session:${name}`, { ...session, name });
      return res.status(200).json({ ok: true });
    }

    // DELETE - delete session
    if (req.method === 'POST' && action === 'delete') {
      await kv.del(`session:${queryName || name}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
