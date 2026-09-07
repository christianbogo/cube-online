import re

with open('functions/src/index.ts', 'r') as f:
    content = f.read()

import_statement = "import { detectOutliers } from './utils/analysis';\n"
if 'detectOutliers' not in content:
    content = content.replace("import * as admin from 'firebase-admin';", "import * as admin from 'firebase-admin';\n" + import_statement)

replacement = """export const getChartData = functions.https.onCall(async (data: any, context: any) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    const userId = context.auth.uid;
    const { scrambleType, limit } = data;
    
    if (!scrambleType) {
        throw new functions.https.HttpsError('invalid-argument', 'scrambleType is required');
    }
    
    let query = db.collection('solves')
        .where('userId', '==', userId)
        .where('scrambleType', '==', scrambleType)
        .orderBy('date', 'desc');
        
    if (limit && typeof limit === 'number') {
        query = query.limit(limit);
    }
    
    const solvesSnap = await query.get();
    let allSolves = solvesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    
    // Reverse to get chronological order
    allSolves.reverse();
    
    // Calculate anomalies (must be before downsampling, using full set)
    const anomalies = allSolves.filter((s: any) => {
        if (s.anomalyApproved) return false;
        const { isOutlier } = detectOutliers(s, allSolves);
        return isOutlier;
    });

    // Process all solves for box plot (valid only)
    const validTimes: number[] = [];
    for (const s of allSolves) {
        if (s.penalty === 'DNF' || s.inspectionPenalty === 'DNF') continue;
        let t = s.time;
        if (s.penalty === '+2') t += 2000;
        if (s.inspectionPenalty === '+2') t += 2000;
        validTimes.push(t);
    }
    
    validTimes.sort((a, b) => a - b);
    
    let boxPlotStats = null;
    if (validTimes.length > 0) {
        const min = validTimes[0];
        const max = validTimes[validTimes.length - 1];
        
        const median = (arr: number[]) => {
            if (arr.length === 0) return 0;
            const mid = Math.floor(arr.length / 2);
            return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
        };
        
        const q2 = median(validTimes);
        const lowerHalf = validTimes.slice(0, Math.floor(validTimes.length / 2));
        const upperHalf = validTimes.slice(Math.ceil(validTimes.length / 2));
        
        const q1 = lowerHalf.length > 0 ? median(lowerHalf) : min;
        const q3 = upperHalf.length > 0 ? median(upperHalf) : max;
        
        boxPlotStats = { min, q1, median: q2, q3, max };
    }
    
    // Downsample if > 300
    const TARGET_POINTS = 300;
    let chartSolves: { solve: any, index: number }[] = [];
    
    if (allSolves.length <= TARGET_POINTS) {
        chartSolves = allSolves.map((s, i) => ({ solve: s, index: i }));
    } else {
        const step = (allSolves.length - 1) / (TARGET_POINTS - 1);
        for (let i = 0; i < TARGET_POINTS; i++) {
            const index = Math.round(i * step);
            chartSolves.push({ solve: allSolves[index], index });
        }
        if (chartSolves[chartSolves.length - 1].index !== allSolves.length - 1) {
            chartSolves[chartSolves.length - 1] = { solve: allSolves[allSolves.length - 1], index: allSolves.length - 1 };
        }
    }
    
    const chartData = chartSolves.map(({ solve, index }) => {
        const isDnf = solve.penalty === 'DNF' || solve.inspectionPenalty === 'DNF';
        let time = null;
        if (!isDnf) {
            time = solve.time;
            if (solve.penalty === '+2') time += 2000;
            if (solve.inspectionPenalty === '+2') time += 2000;
        }
        
        let ao5 = null;
        if (index >= 4) {
            const ao5Solves = allSolves.slice(index - 4, index + 1);
            ao5 = calculateAverage(ao5Solves, 5);
        }
        
        return {
            id: solve.id,
            date: solve.date,
            time,
            ao5,
            solve
        };
    });
    
    return { chartData, boxPlotStats, anomalies };
});"""

pattern = re.compile(r'export const getChartData = functions\.https\.onCall\(.*?return \{ chartData, boxPlotStats \};\n\}\);', re.DOTALL)
content = pattern.sub(replacement, content)

with open('functions/src/index.ts', 'w') as f:
    f.write(content)

print('Patched index.ts')
