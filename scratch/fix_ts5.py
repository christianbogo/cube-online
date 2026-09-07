import re

with open('src/pages/Logs.tsx', 'r') as f:
    content = f.read()

content = content.replace("const { solves, updateSolve, deleteSolve } = useSolves();", "const { solves, updateSolve, deleteSolve, userStats } = useSolves();")
content = content.replace("tickFormatter={(val) => {", "tickFormatter={(val: any) => {")
content = content.replace("labelFormatter={(label) => `Solve #${label}`}", "labelFormatter={(label: any) => `Solve #${label}`}")

with open('src/pages/Logs.tsx', 'w') as f:
    f.write(content)
