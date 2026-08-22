const fs = require('fs');
let db = JSON.parse(fs.readFileSync('fastmode_db.json', 'utf8'));
console.log("Provinces:", db.provinces.length);
console.log("Offices keys:", Object.keys(db.offices).length);
console.log("Tramites keys:", Object.keys(db.tramites).length);
