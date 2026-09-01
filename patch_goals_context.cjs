const fs = require('fs');
let code = fs.readFileSync('src/contexts/GoalsContext.tsx', 'utf8');

if (!code.includes('useIsMobile')) {
    code = code.replace(
        "import { useSolves } from './SolvesContext';",
        "import { useSolves } from './SolvesContext';\nimport { useIsMobile } from '../utils/useIsMobile';"
    );
}

// In GoalsProvider:
code = code.replace(
    'const location = useLocation();',
    'const location = useLocation();\n    const isMobile = useIsMobile();'
);

// When rendering recentlyEarnedGoal:
code = code.replace(
    '{recentlyEarnedGoal && (',
    '{recentlyEarnedGoal && !isMobile && ('
);

fs.writeFileSync('src/contexts/GoalsContext.tsx', code);
