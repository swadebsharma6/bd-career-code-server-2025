const fs = require('fs');
const key = fs.readFileSync('./bd-career-code-2025-firebase-admin-key.json', 'utf8' );
const base64 = Buffer.from(key).toString('base64');

console.log(base64)