const fs = require('fs');
let lines = fs.readFileSync('src/pages/Social.tsx', 'utf-8').split('\\n');

lines[303] = '    const selectedUser = useMemo(() => {';
// lines[311] is `return found || directUser || null;` (leave it)
lines[383] = lines[383].replace('!directUser', '!selectedUser');
lines[401] = lines[401].replace('!directUser', '!selectedUser');
lines[411] = lines[411].replace('directUser', 'selectedUser');
lines[413] = lines[413].replace('directUser', 'selectedUser');

// Oh wait, my line numbers might be off by 1 because of zero-indexing.
// Let's use string replace safely.
