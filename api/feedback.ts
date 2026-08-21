const ADMIN_EMAIL = 'christianbcutter@yahoo.com';
const FROM_EMAIL = 'Cube Online <feedback@cubeonline.org>';

export interface FeedbackAttachment {
    filename: string;
    content: string; // base64 string (with or without data URL prefix)
    type?: string;
}

export interface FeedbackRequestBody {
    type: 'bug' | 'feature' | 'improvement' | 'other';
    title: string;
    description: string;
    userEmail?: string;
    userId?: string | null;
    username?: string | null;
    attachments?: FeedbackAttachment[];
}

export default async function handler(req: any, res: any) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.error('RESEND_API_KEY is not configured');
            res.status(500).json({ error: 'Email service not configured.' });
            return;
        }

        const body: FeedbackRequestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { type, title, description, userEmail, userId, username, attachments } = body;

        if (!title || !description) {
            res.status(400).json({ error: 'Title and description are required.' });
            return;
        }

        const typeLabels: Record<string, { label: string; color: string; emoji: string }> = {
            bug: { label: 'Bug Report', color: '#ef4444', emoji: '🐛' },
            feature: { label: 'Feature Request', color: '#a855f7', emoji: '✨' },
            improvement: { label: 'Improvement', color: '#06b6d4', emoji: '🔥' },
            other: { label: 'General Feedback', color: '#64748b', emoji: '💬' }
        };

        const typeInfo = typeLabels[type] || typeLabels.other;
        const formattedDate = new Date().toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'medium',
            timeZone: 'America/Los_Angeles'
        });

        // Format clean Resend attachments
        const resendAttachments = (attachments || []).map((att, idx) => {
            let base64Data = att.content;
            if (base64Data.includes(';base64,')) {
                base64Data = base64Data.split(';base64,')[1];
            }
            return {
                filename: att.filename || `attachment_${idx + 1}.png`,
                content: base64Data
            };
        });

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f1117; color: #e2e8f0; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #181b24; border-radius: 12px; border: 1px solid #2d3343; overflow: hidden; }
    .header { padding: 20px 24px; background-color: #1e2230; border-bottom: 1px solid #2d3343; display: flex; align-items: center; justify-content: space-between; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; background-color: ${typeInfo.color}22; color: ${typeInfo.color}; border: 1px solid ${typeInfo.color}44; }
    .title { font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0; }
    .content { padding: 24px; }
    .description-box { background-color: #0f1117; border: 1px solid #2d3343; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #cbd5e1; white-space: pre-wrap; margin-bottom: 20px; }
    .meta-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px; border-top: 1px solid #2d3343; }
    .meta-table td { padding: 8px 0; color: #94a3b8; }
    .meta-table td.val { color: #f1f5f9; font-weight: 500; text-align: right; }
    .footer { padding: 16px 24px; background-color: #13161f; border-top: 1px solid #2d3343; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-weight: 700; font-size: 15px; color: #ffffff;">Cube Online Feedback</div>
      <div class="badge">${typeInfo.emoji} ${typeInfo.label}</div>
    </div>
    <div class="content">
      <h2 class="title">${escapeHtml(title)}</h2>
      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">Description</div>
      <div class="description-box">${escapeHtml(description)}</div>
      
      <table class="meta-table">
        <tr>
          <td>Submitter Email</td>
          <td class="val">${userEmail ? `<a href="mailto:${escapeHtml(userEmail)}" style="color: #38bdf8;">${escapeHtml(userEmail)}</a>` : 'Not provided'}</td>
        </tr>
        ${username ? `<tr><td>Username</td><td class="val">${escapeHtml(username)}</td></tr>` : ''}
        ${userId ? `<tr><td>User ID</td><td class="val" style="font-family: monospace; font-size: 11px;">${escapeHtml(userId)}</td></tr>` : ''}
        <tr>
          <td>Attachments</td>
          <td class="val">${resendAttachments.length > 0 ? `${resendAttachments.length} file(s) attached` : 'None'}</td>
        </tr>
        <tr>
          <td>Submitted At</td>
          <td class="val">${formattedDate}</td>
        </tr>
      </table>
    </div>
    <div class="footer">
      Sent automatically by Cube Online Dev Portal &bull; <a href="https://cubeonline.org" style="color: #64748b;">cubeonline.org</a>
    </div>
  </div>
</body>
</html>
`;

        const resendPayload: Record<string, any> = {
            from: FROM_EMAIL,
            to: [ADMIN_EMAIL],
            subject: `[Cube Online] ${typeInfo.emoji} ${typeInfo.label}: ${title}`,
            html: htmlContent
        };

        if (userEmail && userEmail.trim()) {
            resendPayload.reply_to = userEmail.trim();
        }

        if (resendAttachments.length > 0) {
            resendPayload.attachments = resendAttachments;
        }

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(resendPayload)
        });

        const resendResult: any = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error('Resend API error:', resendResult);
            res.status(resendResponse.status).json({
                error: resendResult.message || 'Failed to send email via Resend',
                details: resendResult
            });
            return;
        }

        res.status(200).json({
            success: true,
            id: resendResult.id,
            message: 'Feedback submitted and email sent successfully.'
        });
    } catch (err: any) {
        console.error('Unexpected error handling feedback:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
