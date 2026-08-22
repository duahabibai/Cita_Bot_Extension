const fs = require('fs');

let db = JSON.parse(fs.readFileSync('fastmode_db.json', 'utf8'));

const allTramites = [
  { text: "POLICÍA - TOMA DE HUELLAS (EXPEDICIÓN DE TARJETA)", value: "4010", selectId: "tramiteGrupo[1]" },
  { text: "POLICIA - RECOGIDA DE TARJETA (TIE)", value: "4036", selectId: "tramiteGrupo[1]" },
  { text: "POLICIA - EXPEDICIÓN/RENOVACIÓN ASILO", value: "4067", selectId: "tramiteGrupo[1]" },
  { text: "POLICIA - SOLICITUD ASILO", value: "4078", selectId: "tramiteGrupo[1]" },
  { text: "POLICIA - ASIGNACIÓN DE NIE", value: "4031", selectId: "tramiteGrupo[1]" },
  { text: "POLICIA - CERTIFICADO DE REGISTRO U.E.", value: "4038", selectId: "tramiteGrupo[1]" },
  { text: "POLICIA - CARTA DE INVITACIÓN", value: "4037", selectId: "tramiteGrupo[1]" },
  { text: "POLICIA - AUTORIZACIÓN DE REGRESO", value: "20", selectId: "tramiteGrupo[1]" },
  { text: "POLICIA - CERTIFICADOS", value: "4049", selectId: "tramiteGrupo[1]" },
  { text: "POLICÍA - TARJETA CONFLICTO UCRANIA", value: "4112", selectId: "tramiteGrupo[1]" },
  { text: "SOLICITUD DE AUTORIZACIONES (EXTRANJERIA)", value: "4", selectId: "tramiteGrupo[0]" },
  { text: "ARRAIGO Y CIRCUNSTANCIAS EXCEPCIONALES", value: "10", selectId: "tramiteGrupo[0]" },
  { text: "REAGRUPACIÓN FAMILIAR", value: "3", selectId: "tramiteGrupo[0]" },
  { text: "ESTANCIA POR ESTUDIOS", value: "4016", selectId: "tramiteGrupo[0]" },
  { text: "RENOVACIONES DE RESIDENCIA", value: "4059", selectId: "tramiteGrupo[0]" },
  { text: "ASILO - PRIMERA CITA (MADRID)", value: "4104", selectId: "tramiteGrupo[1]" }
];

for (const prov of db.provinces) {
    db.tramites[prov.value] = allTramites;
}

fs.writeFileSync('fastmode_db.json', JSON.stringify(db, null, 2));
console.log("Injected unified tramites into all " + Object.keys(db.tramites).length + " provinces!");
