const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Wait, sandbox doesn't have serviceAccountKey!
// If I bypass sandbox, I can just use firebase CLI!
