import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, redirectUri } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Missing code' });
    }

    try {
        const tokenRes = await fetch('https://www.worldcubeassociation.org/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: process.env.VITE_WCA_CLIENT_ID,
                client_secret: process.env.WCA_CLIENT_SECRET,
                code,
                redirect_uri: redirectUri
            })
        });

        const tokenData: any = await tokenRes.json();
        if (tokenData.error) {
            console.error('WCA Token Error:', tokenData);
            return res.status(400).json(tokenData);
        }

        const meRes = await fetch('https://www.worldcubeassociation.org/api/v0/me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const meData = await meRes.json();
        return res.status(200).json(meData);
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
