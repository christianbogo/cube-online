const fs = require('fs');
let code = fs.readFileSync('src/components/ui/KeybindTooltip.tsx', 'utf8');

if (!code.includes('useIsMobile')) {
    code = code.replace(
        "import { useState, useEffect, useCallback, useRef } from 'react';",
        "import { useState, useEffect, useCallback, useRef } from 'react';\nimport { useIsMobile } from '../../utils/useIsMobile';"
    );
}

// In KeybindTooltip:
code = code.replace(
    'const location = useLocation();',
    'const location = useLocation();\n    const isMobile = useIsMobile();'
);

code = code.replace(
    'if (!currentTip || isDisabled) return null;',
    'if (!currentTip || isDisabled || isMobile) return null;'
);

fs.writeFileSync('src/components/ui/KeybindTooltip.tsx', code);
