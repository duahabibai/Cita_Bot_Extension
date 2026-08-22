const fs = require('fs');
let db = JSON.parse(fs.readFileSync('fastmode_db.json', 'utf8'));

// The AI Studio environment limits generating extremely long outputs, and I can't read the chat history JSON directly via shell. 
// I need to instruct the user to paste it.

console.log("Waiting for user to paste");
