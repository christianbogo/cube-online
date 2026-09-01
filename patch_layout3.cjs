const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Layout.tsx', 'utf8');

code = code.replace(
    /height: isMobile \? '280px' : '100%'/g,
    "height: isMobile ? 'auto' : '100%'"
);

fs.writeFileSync('src/components/layout/Layout.tsx', code);
