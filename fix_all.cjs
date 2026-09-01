const fs = require('fs');

// 1. RecordTable.tsx
let rt = fs.readFileSync('src/components/records/RecordTable.tsx', 'utf8');
if (!rt.includes('import { useIsMobile }')) {
    rt = rt.replace(
        "import { useState, useMemo, useEffect, useRef } from 'react';",
        "import { useState, useMemo, useEffect, useRef } from 'react';\nimport { useIsMobile } from '../../utils/useIsMobile';"
    );
}
// Fix indexing issue
rt = rt.replace(
    'detail={row[metric.key]}',
    'detail={row[metric.key as keyof typeof row] as RecordDetail}'
);
fs.writeFileSync('src/components/records/RecordTable.tsx', rt);

// 2. KeybindTooltip.tsx
let kt = fs.readFileSync('src/components/ui/KeybindTooltip.tsx', 'utf8');
if (!kt.includes('import { useIsMobile }')) {
    kt = kt.replace(
        "import { useState, useEffect, useCallback } from 'react';",
        "import { useState, useEffect, useCallback } from 'react';\nimport { useIsMobile } from '../../utils/useIsMobile';"
    );
}
// Add hook call
if (!kt.includes('const isMobile = useIsMobile();')) {
    kt = kt.replace(
        'const location = useLocation();',
        'const location = useLocation();\n    const isMobile = useIsMobile();'
    );
}
// Use it
if (!kt.includes('isMobile) return null')) {
    kt = kt.replace(
        'if (!currentTip || isDisabled) return null;',
        'if (!currentTip || isDisabled || isMobile) return null;'
    );
}
fs.writeFileSync('src/components/ui/KeybindTooltip.tsx', kt);

// 3. Account.tsx
let ac = fs.readFileSync('src/pages/Account.tsx', 'utf8');
if (!ac.includes('isMobile = useIsMobile()')) {
    ac = ac.replace(
        'const { user, loading, updateProfile, signOut, signInWithGoogle } = useAuth();',
        'const { user, loading, updateProfile, signOut, signInWithGoogle } = useAuth();\n    const isMobile = useIsMobile();'
    );
}
fs.writeFileSync('src/pages/Account.tsx', ac);

