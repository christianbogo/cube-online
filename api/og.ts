export default function handler(req: any, res: any) {
    const { name, color, code } = req.query || {};

    const profileName = (name && typeof name === 'string') ? escapeXml(name.trim()) : 'Cube Online';
    const profileColor = (color && typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)) ? color : '#f05224';
    const rawCode = (code && typeof code === 'string') ? code.replace('#', '').trim() : '';
    const profileCode = rawCode ? `#${escapeXml(rawCode)}` : '';

    const isProfile = !!rawCode || (name && name !== 'Cube Online');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGlow" cx="25%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1c2130" />
      <stop offset="50%" stop-color="#0f1117" />
      <stop offset="100%" stop-color="#080a0e" />
    </radialGradient>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGlow)" />

  <!-- Subtle grid lines -->
  <g opacity="0.04" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="105" x2="1200" y2="105" />
    <line x1="0" y1="210" x2="1200" y2="210" />
    <line x1="0" y1="315" x2="1200" y2="315" />
    <line x1="0" y1="420" x2="1200" y2="420" />
    <line x1="0" y1="525" x2="1200" y2="525" />
    <line x1="200" y1="0" x2="200" y2="630" />
    <line x1="400" y1="0" x2="400" y2="630" />
    <line x1="600" y1="0" x2="600" y2="630" />
    <line x1="800" y1="0" x2="800" y2="630" />
    <line x1="1000" y1="0" x2="1000" y2="630" />
  </g>

  <!-- Brand Header Bar -->
  <g transform="translate(100, 70)">
    <!-- Small Brand Logo (36x36) -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="10" height="10" rx="2.5" fill="#64748b" />
      <rect x="13" y="0" width="10" height="10" rx="2.5" fill="#64748b" />
      <rect x="26" y="0" width="10" height="10" rx="2.5" fill="#64748b" />
      <rect x="0" y="13" width="10" height="10" rx="2.5" fill="#64748b" />
      <rect x="13" y="13" width="10" height="10" rx="2.5" fill="#f05224" />
      <rect x="26" y="13" width="10" height="10" rx="2.5" fill="#64748b" />
      <rect x="0" y="26" width="10" height="10" rx="2.5" fill="#64748b" />
      <rect x="13" y="26" width="10" height="10" rx="2.5" fill="#64748b" />
      <rect x="26" y="26" width="10" height="10" rx="2.5" fill="#64748b" />
    </g>

    <text x="50" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff" letter-spacing="-0.5">
      Cube Online
    </text>

    <rect x="190" y="4" width="140" height="28" rx="14" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.15" stroke-width="1" />
    <text x="260" y="22" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="1">
      ${isProfile ? 'COMMUNITY PROFILE' : 'SPEEDCUBING'}
    </text>
  </g>

  ${isProfile ? `
  <!-- USER PROFILE CARD VIEW -->
  <g transform="translate(100, 170)">
    <!-- Main Floating Card Container -->
    <rect width="1000" height="370" rx="24" fill="#151822" fill-opacity="0.8" stroke="#2d3448" stroke-width="1.5" filter="url(#cardShadow)" />

    <g transform="translate(60, 60)">
      <!-- Large User Avatar with Color Swatch -->
      <g filter="url(#cardShadow)">
        <rect width="150" height="150" rx="28" fill="${profileColor}" />
      </g>

      <!-- Profile Information -->
      <g transform="translate(190, 20)">
        <!-- Name -->
        <text x="0" y="45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="54" font-weight="800" fill="#ffffff" letter-spacing="-1">
          ${profileName}
        </text>

        <!-- Chips row: Short Code & Community badge -->
        <g transform="translate(0, 75)">
          ${profileCode ? `
          <g transform="translate(0, 0)">
            <rect width="140" height="38" rx="10" fill="#202534" stroke="#374158" stroke-width="1.5" />
            <text x="70" y="24" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="18" font-weight="700" fill="#38bdf8">
              ${profileCode}
            </text>
          </g>
          ` : ''}

          <g transform="translate(${profileCode ? 155 : 0}, 0)">
            <rect width="180" height="38" rx="10" fill="${profileColor}22" stroke="${profileColor}55" stroke-width="1.5" />
            <circle cx="20" cy="19" r="4" fill="${profileColor}" />
            <text x="100" y="24" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff">
              Cuber Profile
            </text>
          </g>
        </g>

        <!-- Bottom descriptor -->
        <text x="0" y="155" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18" font-weight="500" fill="#94a3b8">
          Personal Records  •  Goal Progress  •  Solves &amp; Stats
        </text>
      </g>
    </g>

    <!-- Card Footer -->
    <g transform="translate(60, 310)">
      <line x1="0" y1="0" x2="880" y2="0" stroke="#2d3448" stroke-width="1" />
      <text x="0" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="600" fill="#64748b">
        View full records and stats on <tspan fill="#38bdf8">cubeonline.org</tspan>
      </text>
    </g>
  </g>
  ` : `
  <!-- DEFAULT SITE CARD VIEW -->
  <g transform="translate(100, 180)">
    <!-- 3x3 Cube Logo (180x180) -->
    <g transform="translate(40, 20)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="56" height="56" rx="12" fill="#64748b" />
      <rect x="68" y="0" width="56" height="56" rx="12" fill="#64748b" />
      <rect x="136" y="0" width="56" height="56" rx="12" fill="#64748b" />

      <rect x="0" y="68" width="56" height="56" rx="12" fill="#64748b" />
      <rect x="68" y="68" width="56" height="56" rx="12" fill="#f05224" />
      <rect x="136" y="68" width="56" height="56" rx="12" fill="#64748b" />

      <rect x="0" y="136" width="56" height="56" rx="12" fill="#64748b" />
      <rect x="68" y="136" width="56" height="56" rx="12" fill="#64748b" />
      <rect x="136" y="136" width="56" height="56" rx="12" fill="#64748b" />
    </g>

    <!-- Typography -->
    <g transform="translate(280, 25)">
      <text x="0" y="65" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="70" font-weight="800" fill="#ffffff" letter-spacing="-1.5">
        Cube Online
      </text>
      <text x="0" y="125" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="#94a3b8">
        The modern speedcubing timer &amp; community
      </text>
      <text x="0" y="175" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="#64748b">
        Real-time Cloud Sync  •  Personal Records  •  Community Solves  •  Goals
      </text>
    </g>
  </g>
  `}
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.status(200).send(svg);
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
