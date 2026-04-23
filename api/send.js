export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, toName, subject, body, fromName, fromEmail, apiKey, attachments } = req.body;

  if (!to || !subject || !body || !apiKey) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const emailData = {
      sender: { name: fromName || 'Job Applicant', email: fromEmail || 'hr@eshaqjob.store' },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: body.replace(/\n/g, '<br>'),
      textContent: body,
    };

    if (attachments && attachments.length > 0) {
      emailData.attachment = attachments.map(a => ({
        content: a.content,
        name: a.name,
      }));
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Brevo API error' });
    }

    return res.status(200).json({ success: true, messageId: data.messageId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
