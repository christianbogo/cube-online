with open('src/pages/Logs.tsx', 'r') as f:
    content = f.read()

if "import { httpsCallable } from 'firebase/functions';" not in content:
    content = "import { httpsCallable } from 'firebase/functions';\n" + content

if "import { functions } from '../lib/firebase';" not in content:
    content = "import { functions } from '../lib/firebase';\n" + content

content = "import {\n    ComposedChart,\n    Line,\n    Scatter,\n    XAxis,\n    YAxis,\n    CartesianGrid,\n    Tooltip,\n    ResponsiveContainer\n} from 'recharts';\n" + content

with open('src/pages/Logs.tsx', 'w') as f:
    f.write(content)
