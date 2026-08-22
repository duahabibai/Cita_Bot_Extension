const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldMenu = `const getMainMenu = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "gen token" }],
      [{ text: "token history" }, { text: "user list" }],
      [{ text: "Data & Autofill" }, { text: "Launch Cloud Browser" }],
    ],
    resize_keyboard: true,
  },
});`;

const newMenu = `const getMainMenu = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "Data & Autofill" }, { text: "Launch Cloud Browser" }],
    ],
    resize_keyboard: true,
  },
});`;

code = code.replace(oldMenu, newMenu);
fs.writeFileSync('server.ts', code);
