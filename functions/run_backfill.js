const admin = require('firebase-admin');
const { calculateAverage } = require('./lib/index.js'); // Wait, calculateAverage isn't exported.
// Let's just write a script that fetches all users, fetches their solves, and calculates the stats.
