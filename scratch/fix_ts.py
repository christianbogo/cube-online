import re

with open('src/pages/Logs.tsx', 'r') as f:
    content = f.read()

# Add missing imports
if "httpsCallable" not in content:
    content = content.replace("import { db } from '../lib/firebase';", "import { db, functions } from '../lib/firebase';\nimport { httpsCallable } from 'firebase/functions';")

if "userStats" not in content:
    content = content.replace("const { solves, updateSolve, deleteSolve } = useSolves();", "const { solves, updateSolve, deleteSolve, userStats } = useSolves();")

# Remove unused detectOutliers if present
content = content.replace("import { detectOutliers } from '../utils/analysis';", "")

# Add anomalyReason to Solve type in SolvesContext (or just cast)
# The error was: Property 'anomalyReason' does not exist on type 'Solve'.
content = content.replace("s.anomalyReason", "(s as any).anomalyReason")
content = content.replace("solve.anomalyReason", "(solve as any).anomalyReason")

with open('src/pages/Logs.tsx', 'w') as f:
    f.write(content)

