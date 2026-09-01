export default async function handler(req: any, res: any) {
    const { userId, name, color, code } = req.query || {};

    let profileName = (name && typeof name === 'string') ? name.trim() : '';
    let profileColor = (color && typeof color === 'string') ? color : '#3b82f6';
    let profileCode = (code && typeof code === 'string') ? code.replace('#', '').trim() : '';

    // If userId provided and name/code not already in query, try fetching from Firestore REST API
    if (userId && (!profileName || !profileCode)) {
        try {
            const firebaseProjectId = 'cutter-cubing-timer'; // Project ID from firebase config
            const cleanId = String(userId).replace('#', '').trim();
            
            // Try fetching by direct document ID (Auth UID)
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${encodeURIComponent(cleanId)}`;
            const response = await fetch(firestoreUrl);
            if (response.ok) {
                const doc = await response.json();
                if (doc && doc.fields) {
                    profileName = doc.fields.username?.stringValue || 'CubingUser';
                    profileColor = doc.fields.color?.stringValue || '#3b82f6';
                    profileCode = doc.fields.shortId?.stringValue || '';
                }
            }
        } catch {
            // Gracefully fall back to defaults
        }
    }

    const displayName = profileName || 'Cubing Community Profile';
    const displayCode = profileCode ? `#${profileCode}` : '';
    const title = displayCode ? `${displayName} (${displayCode}) • Cube Online` : `${displayName} • Cube Online`;
    const description = `View speedcubing personal records, goal progress, and community solves on Cube Online.`;

    // Dynamic OG image URL
    const ogParams = new URLSearchParams();
    if (displayName) ogParams.set('name', displayName);
    if (profileColor) ogParams.set('color', profileColor);
    if (displayCode) ogParams.set('code', displayCode);

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'cubeonline.org';
    const protocol = (req.headers['x-forwarded-proto'] === 'http') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const ogImageUrl = `${baseUrl}/api/og?${ogParams.toString()}`;
    const targetUrl = `${baseUrl}/social${userId ? `/${encodeURIComponent(userId)}` : ''}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Icons -->
  <link rel="icon" type="image/png" sizes="48x48" href="${baseUrl}/favicon.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="${baseUrl}/apple-touch-icon.png" />
  <meta name="theme-color" content="${escapeHtml(profileColor)}" />

  <!-- Open Graph / iMessage / Facebook -->
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Cube Online" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:url" content="${escapeHtml(targetUrl)}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />

  <!-- Redirect real browser visitors to the SPA route immediately -->
  <script>
    window.location.replace(${JSON.stringify(targetUrl)});
  </script>
</head>
<body style="background-color: #0f1117; color: #ffffff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <p>Loading profile... <a href="${escapeHtml(targetUrl)}" style="color: #38bdf8;">Click here if not redirected</a>.</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.status(200).send(html);
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
