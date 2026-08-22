const fs = require('fs');

const db = {
  "provinces": [
    { "text": "A Coruña", "value": "/icpplus/citar?p=15&locale=es" },
    { "text": "Albacete", "value": "/icpplus/citar?p=2&locale=es" },
    { "text": "Alicante", "value": "/icpco/citar?p=3&locale=es" },
    { "text": "Almería", "value": "/icpplus/citar?p=4&locale=es" },
    { "text": "Araba", "value": "/icpplus/citar?p=1&locale=es" },
    { "text": "Asturias", "value": "/icpplus/citar?p=33&locale=es" },
    { "text": "Ávila", "value": "/icpplus/citar?p=5&locale=es" },
    { "text": "Badajoz", "value": "/icpplus/citar?p=6&locale=es" },
    { "text": "Barcelona", "value": "/icpplustieb/citar?p=8&locale=es" },
    { "text": "Bizkaia", "value": "/icpplus/citar?p=48&locale=es" },
    { "text": "Burgos", "value": "/icpplus/citar?p=9&locale=es" },
    { "text": "Cáceres", "value": "/icpplus/citar?p=10&locale=es" },
    { "text": "Cádiz", "value": "/icpplus/citar?p=11&locale=es" },
    { "text": "Cantabria", "value": "/icpplus/citar?p=39&locale=es" },
    { "text": "Castellón", "value": "/icpplus/citar?p=12&locale=es" },
    { "text": "Ceuta", "value": "/icpplus/citar?p=51&locale=es" },
    { "text": "Ciudad Real", "value": "/icpplus/citar?p=13&locale=es" },
    { "text": "Córdoba", "value": "/icpplus/citar?p=14&locale=es" },
    { "text": "Cuenca", "value": "/icpplus/citar?p=16&locale=es" },
    { "text": "Gipuzkoa", "value": "/icpplus/citar?p=20&locale=es" },
    { "text": "Girona", "value": "/icpplus/citar?p=17&locale=es" },
    { "text": "Granada", "value": "/icpplus/citar?p=18&locale=es" },
    { "text": "Guadalajara", "value": "/icpplus/citar?p=19&locale=es" },
    { "text": "Huelva", "value": "/icpplus/citar?p=21&locale=es" },
    { "text": "Huesca", "value": "/icpplus/citar?p=22&locale=es" },
    { "text": "Illes Balears", "value": "/icpplustie/citar?p=7&locale=es" },
    { "text": "Jaén", "value": "/icpplus/citar?p=23&locale=es" },
    { "text": "La Rioja", "value": "/icpplus/citar?p=26&locale=es" },
    { "text": "Las Palmas", "value": "/icpplustie/citar?p=35&locale=es" },
    { "text": "León", "value": "/icpplus/citar?p=24&locale=es" },
    { "text": "Lleida", "value": "/icpplus/citar?p=25&locale=es" },
    { "text": "Lugo", "value": "/icpplus/citar?p=27&locale=es" },
    { "text": "Madrid", "value": "/icpplustiem/citar?p=28&locale=es" },
    { "text": "Málaga", "value": "/icpplustie/citar?p=29&locale=es" },
    { "text": "Melilla", "value": "/icpplus/citar?p=52&locale=es" },
    { "text": "Murcia", "value": "/icpplus/citar?p=30&locale=es" },
    { "text": "Navarra", "value": "/icpplus/citar?p=31&locale=es" },
    { "text": "Ourense", "value": "/icpplus/citar?p=32&locale=es" },
    { "text": "Palencia", "value": "/icpplus/citar?p=34&locale=es" },
    { "text": "Pontevedra", "value": "/icpplus/citar?p=36&locale=es" },
    { "text": "Salamanca", "value": "/icpplus/citar?p=37&locale=es" },
    { "text": "S.Cruz Tenerife", "value": "/icpco/citar?p=38&locale=es" },
    { "text": "Segovia", "value": "/icpplus/citar?p=40&locale=es" },
    { "text": "Sevilla", "value": "/icpplus/citar?p=41&locale=es" },
    { "text": "Soria", "value": "/icpplus/citar?p=42&locale=es" },
    { "text": "Tarragona", "value": "/icpplus/citar?p=43&locale=es" },
    { "text": "Teruel", "value": "/icpplus/citar?p=44&locale=es" },
    { "text": "Toledo", "value": "/icpplus/citar?p=45&locale=es" },
    { "text": "Valencia", "value": "/icpplus/citar?p=46&locale=es" },
    { "text": "Valladolid", "value": "/icpplus/citar?p=47&locale=es" },
    { "text": "Zamora", "value": "/icpplus/citar?p=49&locale=es" },
    { "text": "Zaragoza", "value": "/icpplus/citar?p=50&locale=es" }
  ],
  "offices": {
    "/icpplus/citar?p=2&locale=es": [
      { "text": "Cualquier oficina", "value": "99", "selectId": "sede", "selectName": "sede" },
      { "text": "CNP ALBACETE BPEF", "value": "5", "selectId": "sede", "selectName": "sede" }
    ],
    "/icpplus/citar?p=28&locale=es": [
      { "text": "Cualquier oficina", "value": "99", "selectId": "sede", "selectName": "sede" }
    ]
  },
  "tramites": {
    "/icpplus/citar?p=2&locale=es": [
      { "text": "POLICIA - RECOGIDA DE TARJETA DE IDENTIDAD DE EXTRANJERO (TIE)", "value": "4036", "selectId": "tramiteGrupo[0]", "selectName": "tramiteGrupo[0]" },
      { "text": "POLICIA- EXPEDICIÓN/RENOVACIÓN DE DOCUMENTOS DE SOLICITANTES DE ASILO", "value": "4067", "selectId": "tramiteGrupo[0]", "selectName": "tramiteGrupo[0]" },
      { "text": "POLICIA-CARTA DE INVITACIÓN", "value": "4037", "selectId": "tramiteGrupo[0]", "selectName": "tramiteGrupo[0]" },
      { "text": "POLICIA-CERTIFICADOS Y ASIGNACION NIE (NO COMUNITARIOS)", "value": "4079", "selectId": "tramiteGrupo[0]", "selectName": "tramiteGrupo[0]" },
      { "text": "POLICÍA-TOMA DE HUELLAS (EXPEDICIÓN DE TARJETA) INICIAL, RENOVACIÓN, DUPLICADO Y LEY 14/2013", "value": "4010", "selectId": "tramiteGrupo[0]", "selectName": "tramiteGrupo[0]" }
    ],
    "/icpplus/citar?p=28&locale=es": [
      { "text": "POLICIA - RECOGIDA DE TARJETA DE IDENTIDAD DE EXTRANJERO (TIE)", "value": "4036", "selectId": "tramiteGrupo[0]", "selectName": "tramiteGrupo[0]" },
      { "text": "POLICÍA-TOMA DE HUELLAS (EXPEDICIÓN DE TARJETA)", "value": "4010", "selectId": "tramiteGrupo[0]", "selectName": "tramiteGrupo[0]" }
    ]
  }
};

let existing = {};
try {
  existing = JSON.parse(fs.readFileSync('fastmode_db.json', 'utf8'));
} catch(e) {}

// Merge the user provided data safely without erasing existing
existing.provinces = db.provinces;
if (!existing.tramites) existing.tramites = {};
if (!existing.offices) existing.offices = {};

existing.tramites["/icpplus/citar?p=2&locale=es"] = db.tramites["/icpplus/citar?p=2&locale=es"];
existing.offices["/icpplus/citar?p=2&locale=es"] = db.offices["/icpplus/citar?p=2&locale=es"];
existing.tramites["/icpplustiem/citar?p=28&locale=es"] = db.tramites["/icpplus/citar?p=28&locale=es"];

fs.writeFileSync('fastmode_db.json', JSON.stringify(existing, null, 2));
console.log("Database updated locally for Albacete and Madrid!");
