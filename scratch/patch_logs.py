import re

with open('src/pages/Logs.tsx', 'r') as f:
    content = f.read()

# 1. We replace anomalySolves
anomaly_pattern = re.compile(
    r'// -- Anomalies \(Excluding already approved anomalies permanently\) --.*?'
    r'\}, \[filteredSolves\]\);',
    re.DOTALL
)

anomaly_replacement = """// -- Anomalies (Excluding already approved anomalies permanently) --
    // Handled by chartDataState"""
content = anomaly_pattern.sub(anomaly_replacement, content, count=1)


# 2. We replace chartData, displayedChartData, boxPlotStats
chart_pattern = re.compile(
    r'// -- Prepare Data for Charts --\n    const chartData = useMemo\(\(\) => \{.*?'
    r'const boxPlotStats = useMemo\(\(\) => \{.*?\n    \}, \[filteredSolves\]\);',
    re.DOTALL
)

chart_replacement = """// -- Prepare Data for Charts --
    const [chartDataState, setChartDataState] = useState<{ displayedChartData: any[], boxPlotStats: any | null, anomalies: Solve[] }>({ displayedChartData: [], boxPlotStats: null, anomalies: [] });
    const [isLoadingCharts, setIsLoadingCharts] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function loadChartData() {
            if (!user) return;
            setIsLoadingCharts(true);
            try {
                const getChartDataFn = httpsCallable(functions, 'getChartData');
                const result = await getChartDataFn({ scrambleType: settings.scrambleType });
                if (isMounted && result.data) {
                    const data = result.data as any;
                    setChartDataState({
                        displayedChartData: data.chartData || [],
                        boxPlotStats: data.boxPlotStats || null,
                        anomalies: data.anomalies || []
                    });
                }
            } catch (err) {
                console.error("Error fetching chart data", err);
            } finally {
                if (isMounted) setIsLoadingCharts(false);
            }
        }
        loadChartData();
        return () => { isMounted = false; };
    }, [user, settings.scrambleType]);

    const anomalySolves = chartDataState.anomalies;
    const displayedChartData = chartDataState.displayedChartData;
    const boxPlotStats = chartDataState.boxPlotStats;
"""
content = chart_pattern.sub(chart_replacement, content, count=1)

# Change ActivityCalendar to take dailySolvesCount
pattern2 = re.compile(r'<ActivityCalendar solves=\{filteredSolves\} />')
content = pattern2.sub(r'<ActivityCalendar dailySolvesCount={userStats?.dailySolvesCount} />', content)

# Update ActivityCalendar definition
pattern3 = re.compile(
    r'function ActivityCalendar\(\{ solves \}: \{ solves: Solve\[\] \}\) \{.*?'
    r'        const daysInMonth = eachDayOfInterval\(\{ start: monthStart, end: monthEnd \}\);',
    re.DOTALL
)

replacement3 = """function ActivityCalendar({ dailySolvesCount }: { dailySolvesCount?: Record<string, number> }) {
    const [currentAnchorDate, setCurrentAnchorDate] = useState<Date>(() => startOfDay(new Date()));

    const daySolvesMap = useMemo(() => {
        return dailySolvesCount || {};
    }, [dailySolvesCount]);

    const handlePrev = () => setCurrentAnchorDate(prev => subMonths(prev, 1));
    const handleNext = () => setCurrentAnchorDate(prev => addMonths(prev, 1));
    const handleToday = () => setCurrentAnchorDate(startOfDay(new Date()));
    const headerTitle = useMemo(() => format(currentAnchorDate, 'MMMM yyyy'), [currentAnchorDate]);

    const renderMonthGrid = (monthDate: Date) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });"""
content = pattern3.sub(replacement3, content)

# Update render logic inside ActivityCalendar
pattern4 = re.compile(
    r'const dateKey = format\(d, \'yyyy-MM-dd\'\);\n.*?'
    r'const isToday = isSameDay\(d, new Date\(\)\);\n.*?'
    r'const totalPracticeTime = daySolves\.reduce\(\(acc, s\) => \{.*?\}, 0\);',
    re.DOTALL
)

replacement4 = """const dateKey = format(d, 'yyyy-MM-dd');
                        const count = daySolvesMap[dateKey] || 0;
                        const isToday = isSameDay(d, new Date());"""
content = pattern4.sub(replacement4, content)

with open('src/pages/Logs.tsx', 'w') as f:
    f.write(content)
