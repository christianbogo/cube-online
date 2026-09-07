with open('src/pages/Logs.tsx', 'r') as f:
    content = f.read()
content = content.replace("// function formatDuration(ms: number) {\n    const secs = Math.floor(ms / 1000);\n    const mins = Math.floor(secs / 60);\n    const hrs = Math.floor(mins / 60);\n    if (hrs > 0) return `${hrs}h ${mins % 60}m`;\n    if (mins > 0) return `${mins}m ${secs % 60}s`;\n    return `${secs}s`;\n}", "")
with open('src/pages/Logs.tsx', 'w') as f:
    f.write(content)
