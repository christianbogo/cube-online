export default async function handler(req: any, res: any) {
    const { userId, name, color, code } = req.query || {};

    let profileName = (name && typeof name === 'string') ? name.trim() : '';
    let profileColor = (color && typeof color === 'string') ? color : '#3b82f6';
    let profileCode = (code && typeof code === 'string') ? code.replace('#', '').trim() : '';

    // If userId provided and name/code not already in query, fetch from Firestore REST API
    if (userId && (!profileName || !profileCode)) {
        try {
            const firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID || 'cube-online-1';
            const cleanId = String(userId).replace('#', '').trim();
            
            // 1. Try fetching directly by document ID (Auth UID)
            const firestoreDocUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${encodeURIComponent(cleanId)}`;
            const response = await fetch(firestoreDocUrl);
            if (response.ok) {
                const docData: any = await response.json();
                if (docData && docData.fields) {
                    profileName = docData.fields.username?.stringValue || 'CubingUser';
                    profileColor = docData.fields.color?.stringValue || '#3b82f6';
                    profileCode = docData.fields.shortId?.stringValue || '';
                }
            } else {
                // 2. Query by shortId field using Firestore runQuery REST endpoint
                const queryUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents:runQuery`;
                const queryBody = {
                    structuredQuery: {
                        from: [{ collectionId: 'users' }],
                        where: {
                            fieldFilter: {
                                field: { fieldPath: 'shortId' },
                                op: 'EQUAL',
                                value: { stringValue: cleanId }
                            }
                        },
                        limit: 1
                    }
                };
                const qResponse = await fetch(queryUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(queryBody)
                });
                if (qResponse.ok) {
                    const qResult = await qResponse.json();
                    if (Array.isArray(qResult) && qResult[0]?.document?.fields) {
                        const fields = qResult[0].document.fields;
                        profileName = fields.username?.stringValue || 'CubingUser';
                        profileColor = fields.color?.stringValue || '#3b82f6';
                        profileCode = fields.shortId?.stringValue || cleanId;
                    }
                }
            }
        } catch (err) {
            console.warn("Error fetching user meta from Firestore:", err);
        }
    }

    const displayName = profileName || 'Cube Online';
    const cleanCode = profileCode ? profileCode.replace('#', '').trim() : '';
    // Formatted strictly as "[name]#[code]" for profiles without adding "Cube Online"
    const title = cleanCode ? `${displayName}#${cleanCode}` : (profileName ? displayName : 'Cube Online');
    const description = `View speedcubing personal records, goal progress, and community solves on Cube Online.`;

    // Dynamic OG image URL
    const ogParams = new URLSearchParams();
    if (displayName) ogParams.set('name', displayName);
    if (profileColor) ogParams.set('color', profileColor);
    if (cleanCode) ogParams.set('code', cleanCode);

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
  <meta name="theme-color" content="#ffffff" />

  <!-- Open Graph / iMessage / Facebook -->
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Cube Online" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
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
<body style="background-color: #ffffff; color: #0f172a; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <p>Loading profile... <a href="${escapeHtml(targetUrl)}" style="color: #f05224;">Click here if not redirected</a>.</p>
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
        .replace(/'/g, '&apos;');
}
