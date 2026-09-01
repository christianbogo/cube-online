import { Resvg } from '@resvg/resvg-js';

export default function handler(req: any, res: any) {
    const { name, color, code, format } = req.query || {};

    const profileName = (name && typeof name === 'string') ? escapeXml(name.trim()) : 'Cube Online';
    const profileColor = (color && typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)) ? color : '#3b82f6';
    const rawCode = (code && typeof code === 'string') ? code.replace('#', '').trim() : '';
    const profileCode = rawCode ? `#${escapeXml(rawCode)}` : '';

    const isProfile = !!rawCode || (name && name !== 'Cube Online');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.08" />
    </filter>
  </defs>

  <!-- Clean White Background -->
  <rect width="1200" height="630" fill="#ffffff" />

  <!-- Subtle grid lines -->
  <g opacity="0.05" stroke="#0f172a" stroke-width="1">
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

  <!-- Top Accent Bar -->
  <rect x="0" y="0" width="1200" height="6" fill="#f05224" />

  <!-- Brand Header Bar -->
  <g transform="translate(100, 60)">
    <!-- Brand Logo (36x36) -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="10" height="10" rx="2.5" fill="#475569" />
      <rect x="13" y="0" width="10" height="10" rx="2.5" fill="#475569" />
      <rect x="26" y="0" width="10" height="10" rx="2.5" fill="#475569" />
      <rect x="0" y="13" width="10" height="10" rx="2.5" fill="#475569" />
      <rect x="13" y="13" width="10" height="10" rx="2.5" fill="#f05224" />
      <rect x="26" y="13" width="10" height="10" rx="2.5" fill="#475569" />
      <rect x="0" y="26" width="10" height="10" rx="2.5" fill="#475569" />
      <rect x="13" y="26" width="10" height="10" rx="2.5" fill="#475569" />
      <rect x="26" y="26" width="10" height="10" rx="2.5" fill="#475569" />
    </g>

    <text x="50" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="#0f172a" letter-spacing="-0.5">
      Cube Online
    </text>

    <rect x="200" y="5" width="160" height="28" rx="14" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
    <text x="280" y="23" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#f05224" letter-spacing="1">
      ${isProfile ? 'COMMUNITY PROFILE' : 'SPEEDCUBING TIMER'}
    </text>
  </g>

  ${isProfile ? `
  <!-- USER PROFILE CARD VIEW (White Background) -->
  <g transform="translate(100, 150)">
    <!-- Main Card Container -->
    <rect width="1000" height="390" rx="24" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" filter="url(#cardShadow)" />

    <g transform="translate(60, 60)">
      <!-- Large User Avatar with Color Swatch -->
      <g filter="url(#cardShadow)">
        <rect width="150" height="150" rx="28" fill="${profileColor}" stroke="#ffffff" stroke-width="4" />
      </g>

      <!-- Profile Information -->
      <g transform="translate(190, 15)">
        <!-- Name -->
        <text x="0" y="48" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="52" font-weight="800" fill="#0f172a" letter-spacing="-1">
          ${profileName}
        </text>

        <!-- Chips row: Short Code & Community badge -->
        <g transform="translate(0, 80)">
          ${profileCode ? `
          <g transform="translate(0, 0)">
            <rect width="140" height="38" rx="10" fill="#f0f9ff" stroke="#bae6fd" stroke-width="1.5" />
            <text x="70" y="24" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="18" font-weight="700" fill="#0284c7">
              ${profileCode}
            </text>
          </g>
          ` : ''}

          <g transform="translate(${profileCode ? 155 : 0}, 0)">
            <rect width="170" height="38" rx="10" fill="${profileColor}15" stroke="${profileColor}40" stroke-width="1.5" />
            <circle cx="20" cy="19" r="4.5" fill="${profileColor}" />
            <text x="96" y="24" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="#0f172a">
              Cuber Profile
            </text>
          </g>
        </g>

        <!-- Descriptor -->
        <text x="0" y="165" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="19" font-weight="500" fill="#475569">
          Personal Records  •  Goal Progress  •  Solves &amp; Stats
        </text>
      </g>
    </g>

    <!-- Card Footer -->
    <g transform="translate(60, 325)">
      <line x1="0" y1="0" x2="880" y2="0" stroke="#e2e8f0" stroke-width="1.5" />
      <text x="0" y="36" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="#64748b">
        View full speedcubing records on <tspan fill="#f05224" font-weight="700">cubeonline.org</tspan>
      </text>
    </g>
  </g>
  ` : `
  <!-- DEFAULT SITE CARD VIEW (White Background) -->
  <g transform="translate(100, 175)">
    <!-- 3x3 Cube Logo (180x180) -->
    <g transform="translate(20, 20)" filter="url(#cardShadow)">
      <rect x="0" y="0" width="56" height="56" rx="12" fill="#475569" />
      <rect x="68" y="0" width="56" height="56" rx="12" fill="#475569" />
      <rect x="136" y="0" width="56" height="56" rx="12" fill="#475569" />

      <rect x="0" y="68" width="56" height="56" rx="12" fill="#475569" />
      <rect x="68" y="68" width="56" height="56" rx="12" fill="#f05224" />
      <rect x="136" y="68" width="56" height="56" rx="12" fill="#475569" />

      <rect x="0" y="136" width="56" height="56" rx="12" fill="#475569" />
      <rect x="68" y="136" width="56" height="56" rx="12" fill="#475569" />
      <rect x="136" y="136" width="56" height="56" rx="12" fill="#475569" />
    </g>

    <!-- Typography -->
    <g transform="translate(270, 25)">
      <text x="0" y="65" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="70" font-weight="800" fill="#0f172a" letter-spacing="-1.5">
        Cube Online
      </text>
      <text x="0" y="125" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="#475569">
        The modern speedcubing timer &amp; community platform
      </text>
      <text x="0" y="175" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="#64748b">
        Real-time Cloud Sync  •  Personal Records  •  Community Solves  •  Goals
      </text>
    </g>
  </g>
  `}
</svg>`;

    if (format === 'svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        return res.status(200).send(svg);
    }

    try {
        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: 1200 },
            font: {
                loadSystemFonts: true,
                defaultFontFamily: 'system-ui'
            }
        });
        const pngBuffer = resvg.render().asPng();

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        return res.status(200).send(pngBuffer);
    } catch {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        return res.status(200).send(svg);
    }
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
