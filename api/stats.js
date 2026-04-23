export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { messageId } = req.body;
  const apiKey = process.env.BREVO_KEY || '';

  try {
    // Get email events for this messageId
    const response = await fetch(
      `https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodeURIComponent(messageId)}&limit=10`,
      {
        headers: {
          'api-key': apiKey,
          'accept': 'application/json',
        },
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });

    const events = data.events || [];
    const delivered = events.some(e => e.event === 'delivered');
    const opened = events.some(e => e.event === 'opened');
    const clicked = events.some(e => e.event === 'clicks');
    const bounced = events.some(e => e.event === 'hardBounces' || e.event === 'softBounces');

    return res.status(200).json({ delivered, opened, clicked, bounced, events });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
