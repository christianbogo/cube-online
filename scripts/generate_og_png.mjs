import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// 1. Render og-image.png (1200x630, white background, crisp typography)
const ogSvgPath = path.join(publicDir, 'og-image.svg');
const ogSvg = fs.readFileSync(ogSvgPath, 'utf8');
const resvgOg = new Resvg(ogSvg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
        loadSystemFonts: true,
        defaultFontFamily: 'system-ui'
    }
});
const ogPngBuffer = resvgOg.render().asPng();
fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogPngBuffer);
console.log('✓ og-image.png rendered (Size:', ogPngBuffer.length, 'bytes)');

// 2. Render apple-touch-icon.png (180x180, clear transparent background)
const iconSvg = `<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(18, 18)">
    <rect x="0" y="0" width="42" height="42" rx="9" fill="#475569" />
    <rect x="51" y="0" width="42" height="42" rx="9" fill="#475569" />
    <rect x="102" y="0" width="42" height="42" rx="9" fill="#475569" />

    <rect x="0" y="51" width="42" height="42" rx="9" fill="#475569" />
    <rect x="51" y="51" width="42" height="42" rx="9" fill="#f05224" />
    <rect x="102" y="51" width="42" height="42" rx="9" fill="#475569" />

    <rect x="0" y="102" width="42" height="42" rx="9" fill="#475569" />
    <rect x="51" y="102" width="42" height="42" rx="9" fill="#475569" />
    <rect x="102" y="102" width="42" height="42" rx="9" fill="#475569" />
  </g>
</svg>`;
const resvgTouchIcon = new Resvg(iconSvg, { fitTo: { mode: 'width', value: 180 } });
const touchIconBuffer = resvgTouchIcon.render().asPng();
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), touchIconBuffer);
console.log('✓ apple-touch-icon.png rendered (Size:', touchIconBuffer.length, 'bytes)');

// 3. Render favicon.png (48x48, clear transparent background)
const resvgFavicon = new Resvg(iconSvg, { fitTo: { mode: 'width', value: 48 } });
const faviconBuffer = resvgFavicon.render().asPng();
fs.writeFileSync(path.join(publicDir, 'favicon.png'), faviconBuffer);
console.log('✓ favicon.png rendered (Size:', faviconBuffer.length, 'bytes)');
