import * as fs from 'fs';

let content = fs.readFileSync('src/components/records/RecordTable.tsx', 'utf-8');

// Replace imports
content = content.replace(
    "import { format } from 'date-fns';",
    "import { format } from 'date-fns';\nimport { functions } from '../../lib/firebase';\nimport { httpsCallable } from 'firebase/functions';\nimport { Loader2, RefreshCw } from 'lucide-react';"
);

// Replace rows calculation
const startRows = content.indexOf('const relevantSolves = useMemo(() => {');
const endRows = content.indexOf('const formatDuration = (ms: number) => {');

const replacement = `    const [rows, setRows] = useState<EventRecordRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const targetUid = userId || user?.uid;

    const fetchRecords = async (forceRefresh = false) => {
        if (!targetUid) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const getRecordsData = httpsCallable(functions, 'getRecordsData');
            const result = await getRecordsData({ targetUid, forceRefresh });
            setRows((result.data as any).rows || []);
        } catch (error) {
            console.error('Failed to fetch records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [targetUid]);

    `;

content = content.substring(0, startRows) + replacement + content.substring(endRows);

fs.writeFileSync('src/components/records/RecordTable.tsx', content);
