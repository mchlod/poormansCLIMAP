//
// generateConfig.js
//
// RUN WITH:
//   node generateConfig.js
//
// OUTPUT:
//   ./config.js   (completo, con SMN + SMN-precip + NIME + OASI)
//
// REQUIREMENTS:
//   npm install node-fetch
//

import fs from "fs";
import fetch from "node-fetch";

// ---- URLs dataset OGD ----
const URL_SMN =
  "https://data.geo.admin.ch/ch.meteoschweiz.messnetz-automatisch/messnetz-automatisch_en.json";

const URL_PRECIP =
  "https://data.geo.admin.ch/ch.meteoschweiz.messnetz-precip/messnetz-precip_en.json";

const URL_NIME =
  "https://data.geo.admin.ch/ch.meteoschweiz.messnetz-schnee/messnetz-schnee_en.json";

// ---- IMPORTA OASI DAL TUO config.js ATTUALE ----
// Devo leggere quello esistente e estrarre solo le OASI
let OASI = {};

try {
  const current = fs.readFileSync("./config.js", "utf8");
  const match = current.match(/stations:\s*({[\s\S]*?})\s*,/);

  if (match) {
    const originalStations = eval("(" + match[1] + ")");
    for (const [code, st] of Object.entries(originalStations)) {
      if (!st.dataSource) {
        OASI[code] = { ...st, type: "OASI" };
      }
    }
  }
} catch (err) {
  console.log("⚠️ Nessun config.js precedente trovato, OASI = vuoto");
}

// ---- Parameter Map (uguale al tuo attuale) ----
const parameterMap = {
  tre005d0: { name: "Temperatura aria (5 cm)", unit: "°C" },
  tre200d0: { name: "Temperatura aria (200 cm)", unit: "°C" },
  so0fd0: { name: "Soleggiamento", unit: "min" },
  fu3010d0: { name: "Velocità vento (media 10')", unit: "km/h" },
  fu3010z1: { name: "Velocità raffica max", unit: "km/h" },
  dkl010z0: { name: "Direzione vento (media)", unit: "°" },
  rre150h0: { name: "Pioggia oraria", unit: "mm" },
  rre150d0: { name: "Pioggia giornaliera", unit: "mm" },
  hne920d0: { name: "Altezza neve (NIME)", unit: "cm" },
  // puoi aggiungere qui tutto ciò che serve
};

// ---- Funzione per convertire dataset OGD in forma config.js ----
function buildStationsFromOGD(data, type, dataSource) {
  const out = {};
  for (const st of data.stations) {
    if (!st.abbr_de) continue;

    out[st.abbr_de] = {
      name: st.name_en || st.name_de || st.abbr_de,
      east: st.east,
      north: st.north,
      altitude: st.altitude,
      type,
      dataSource, // "ogd-smn", "ogd-smn-precip", "ogd-nime"
    };
  }
  return out;
}

async function run() {
  console.log("Scarico dataset OGD…");

  const smn = await fetch(URL_SMN).then(r => r.json());
  const precip = await fetch(URL_PRECIP).then(r => r.json());
  const nime = await fetch(URL_NIME).then(r => r.json());

  console.log("Costruisco strutture…");

  const stationsSMN = buildStationsFromOGD(smn, "SMN", "ogd-smn");
  const stationsPRECIP = buildStationsFromOGD(precip, "SMN-precip", "ogd-smn-precip");
  const stationsNIME = buildStationsFromOGD(nime, "NIME", "ogd-nime");

  // MERGE in un unico mega-oggetto
  const stations = {
    ...stationsSMN,
    ...stationsPRECIP,
    ...stationsNIME,
    ...OASI, // aggiungo le OASI del config precedente
  };

  console.log("Salvo config.js…");

  const output = `
// -------------------------------
//  AUTO-GENERATED config.js
//  Generated with: node generateConfig.js
// -------------------------------

const METEO_CONFIG = {
  stations: ${JSON.stringify(stations, null, 2)},
  parameterMap: ${JSON.stringify(parameterMap, null, 2)},
  initializeProj4Defs: function () {
    proj4.defs("EPSG:2056","+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +units=m +no_defs");
    proj4.defs("EPSG:4326","+proj=longlat +datum=WGS84 +no_defs");
  }
};

`;

  fs.writeFileSync("./config.js", output, "utf8");

  console.log("🎉 Fatto! File scritto: config.js");
}

run();
