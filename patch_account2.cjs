const fs = require('fs');
let code = fs.readFileSync('src/pages/Account.tsx', 'utf8');

if (!code.includes('isMobile = useIsMobile()')) {
    code = code.replace(
        'const { user, loading, updateProfile, signOut, signInWithGoogle } = useAuth();',
        'const { user, loading, updateProfile, signOut, signInWithGoogle } = useAuth();\n    const isMobile = useIsMobile();'
    );
}

code = code.replace(
    '{ label: "Timer Settings", id: "timer", content: <TimerSettingsTab /> },\\n                                        { label: "Danger Zone", id: "danger", content: <DangerZoneTab /> },',
    '...(isMobile ? [] : [{ label: "Timer Settings", id: "timer", content: <TimerSettingsTab /> }]),\\n                                        ...(isMobile ? [] : [{ label: "Danger Zone", id: "danger", content: <DangerZoneTab /> }]),'
);

// Actually string replacing with \n is risky again, I'll use regex:
code = code.replace(
    /\{\s*label:\s*"Timer Settings",\s*id:\s*"timer",\s*content:\s*<TimerSettingsTab\s*\/>\s*\},/g,
    '...(isMobile ? [] : [{ label: "Timer Settings", id: "timer", content: <TimerSettingsTab /> }]),'
);
code = code.replace(
    /\{\s*label:\s*"Danger Zone",\s*id:\s*"danger",\s*content:\s*<DangerZoneTab\s*\/>\s*\},/g,
    '...(isMobile ? [] : [{ label: "Danger Zone", id: "danger", content: <DangerZoneTab /> }]),'
);

fs.writeFileSync('src/pages/Account.tsx', code);
