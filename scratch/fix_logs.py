import re

with open('src/pages/Logs.tsx', 'r') as f:
    content = f.read()

content = content.replace("                    })}                        );\n                    })}", "                    })}")

with open('src/pages/Logs.tsx', 'w') as f:
    f.write(content)
