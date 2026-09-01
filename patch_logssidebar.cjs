const fs = require('fs');
let code = fs.readFileSync('src/components/layout/LogsSidebar.tsx', 'utf8');

code = code.replace(
    '{/* Grouping Selector */}\\n                <div className="hidden md:flex p-2 items-center justify-center relative group">',
    '{/* Grouping Selector */}\n                <div className="hidden md:flex p-2 items-center justify-center relative group">'
);

code = code.replace(
    '{/* Footer Stats Table */}\\n            <div className="hidden md:flex border-t border-border bg-bg-secondary p-3 flex-col gap-2">',
    '{/* Footer Stats Table */}\n            <div className="hidden md:flex border-t border-border bg-bg-secondary p-3 flex-col gap-2">'
);

fs.writeFileSync('src/components/layout/LogsSidebar.tsx', code);
