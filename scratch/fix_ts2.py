import re

with open('src/pages/Logs.tsx', 'r') as f:
    content = f.read()

# Add missing imports
if "httpsCallable" not in content:
    content = "import { httpsCallable } from 'firebase/functions';\nimport { functions } from '../lib/firebase';\n" + content

if "userStats" not in content:
    content = content.replace("const { solves, updateSolve, deleteSolve } = useSolves();", "const { solves, updateSolve, deleteSolve, userStats } = useSolves();")

# Unused imports
content = content.replace("import {\n    ComposedChart,\n    Line,\n    Scatter,\n    XAxis,\n    YAxis,\n    CartesianGrid,\n    Tooltip,\n    ResponsiveContainer\n} from 'recharts';", "")

# Unused vars
content = content.replace("const [isLoadingCharts, setIsLoadingCharts] = useState(false);", "")
content = content.replace("setIsLoadingCharts(true);", "")
content = content.replace("if (isMounted) setIsLoadingCharts(false);", "")
content = content.replace("function formatDuration(ms: number)", "// function formatDuration(ms: number)")

with open('src/pages/Logs.tsx', 'w') as f:
    f.write(content)
