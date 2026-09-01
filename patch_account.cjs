const fs = require('fs');
let code = fs.readFileSync('src/pages/Account.tsx', 'utf8');

if (!code.includes('useIsMobile')) {
    code = code.replace(
        "import { useState, useRef, useEffect } from 'react';",
        "import { useState, useRef, useEffect } from 'react';\nimport { useIsMobile } from '../utils/useIsMobile';"
    );
}

// In Account:
code = code.replace(
    'const { user, loading, updateProfile, signOut, signInWithGoogle } = useAuth();',
    'const { user, loading, updateProfile, signOut, signInWithGoogle } = useAuth();\n    const isMobile = useIsMobile();'
);

code = code.replace(
    /const TABS = \[\s*\{ label: "Profile", id: "profile", content: <ProfileTab \/> \},\s*\{ label: "Preferences", id: "preferences", content: <PreferencesTab \/> \},\s*\{ label: "Timer Settings", id: "timer", content: <TimerSettingsTab \/> \},\s*\{ label: "Danger Zone", id: "danger", content: <DangerZoneTab \/> \},\s*\];/,
    'const TABS = [\n                                        { label: "Profile", id: "profile", content: <ProfileTab /> },\n                                        { label: "Preferences", id: "preferences", content: <PreferencesTab /> },\n                                        ...(isMobile ? [] : [{ label: "Timer Settings", id: "timer", content: <TimerSettingsTab /> }]),\n                                        ...(isMobile ? [] : [{ label: "Danger Zone", id: "danger", content: <DangerZoneTab /> }]),\n                                    ];'
);

fs.writeFileSync('src/pages/Account.tsx', code);
