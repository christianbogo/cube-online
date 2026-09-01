const fs = require('fs');
let code = fs.readFileSync('src/components/layout/LogsSidebar.tsx', 'utf8');

code = code.replace(
    /\{\/\* Sub-Header: Full Row Stat Filter Dropdown \*\/\}\s*<div className="px-3 py-2 border-b border-border\/30 bg-bg-secondary\/30 relative flex items-center">/,
    '{/* Sub-Header: Full Row Stat Filter Dropdown */}\n            <div className="hidden md:flex px-3 py-2 border-b border-border/30 bg-bg-secondary/30 relative items-center">'
);

code = code.replace(
    /\{\/\* List Content \*\/\}\s*<div className="flex-1 overflow-y-auto custom-scrollbar relative">/,
    '{/* List Content */}\n            <div className="hidden md:block flex-1 overflow-y-auto custom-scrollbar relative">'
);

fs.writeFileSync('src/components/layout/LogsSidebar.tsx', code);
