const fs = require('fs');
const db = JSON.parse(fs.readFileSync('fastmode_db.json', 'utf8'));

const provVal = "/icpplus/citar?p=2&locale=es";
const tramites = db.tramites[provVal];
console.log("Tramites for Albacete:", tramites ? tramites.length : "UNDEFINED");

const tramitesKeys = Object.keys(db.tramites);
console.log("Total keys in tramites:", tramitesKeys.length);
console.log("Does the exact key exist?", tramitesKeys.includes(provVal));
