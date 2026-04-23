export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, htmlContent, textContent, fromName, fromEmail, attachment } = req.body;

  try {
    const payload = {
      sender: { name: fromName || 'وظيفتنا', email: fromEmail || 'jobs@eshaqjob.store' },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent,
    };
    if (attachment) payload.attachment = attachment;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': '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',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (response.ok) {
      return res.status(200).json({ success: true, messageId: data.messageId });
    } else {
      return res.status(response.status).json({ success: false, error: data });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
