import re

with open('functions/src/index.ts', 'r') as f:
    content = f.read()

pattern = re.compile(
    r'const anomalies = allSolves\.filter\(\(s: any\) => \{\n'
    r'        if \(s\.anomalyApproved\) return false;\n'
    r'        const \{ isOutlier \} = detectOutliers\(s, allSolves\);\n'
    r'        return isOutlier;\n'
    r'    \}\);'
)

replacement = """const anomalies = allSolves.map((s: any) => {
        if (s.anomalyApproved) return null;
        const { isOutlier, reason } = detectOutliers(s, allSolves);
        if (isOutlier) {
            return { ...s, anomalyReason: reason };
        }
        return null;
    }).filter((s: any) => s !== null);"""

content = pattern.sub(replacement, content)

with open('functions/src/index.ts', 'w') as f:
    f.write(content)
