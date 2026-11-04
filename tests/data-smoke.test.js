// Smoke test offline du parseur Eurostat JSON-stat (Node.js, sans dépendance).
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const ageCodes = ["Y_LT1", ...Array.from({length:94}, (_, i) => `Y${i + 1}`), "Y_GE95"];
const qxValues = ageCodes.map((_, age) => age === 95 ? 1 : 0.001 + age * 0.0008);
const exValues = ageCodes.map((_, age) => Math.max(0.1, 82 - age * 0.72));
const ageIndex = Object.fromEntries(ageCodes.map((code, i) => [code, i]));

function fixture(indicator) {
  const values = indicator === "PROBDEATH" ? qxValues : exValues;
  return {
    version: "2.0",
    class: "dataset",
    id: ["freq", "indic_de", "sex", "age", "geo", "time"],
    size: [1, 1, 1, 96, 1, 1],
    dimension: {
      age: {category: {index: ageIndex}},
      freq: {category: {index: {A: 0}}},
      indic_de: {category: {index: {[indicator]: 0}}},
      sex: {category: {index: {F: 0}}},
      geo: {category: {index: {FR: 0}}},
      time: {category: {index: {"2024": 0}}}
    },
    value: values
  };
}

const context = {
  window: {},
  localStorage: {getItem: () => null, setItem: () => {}},
  URLSearchParams,
  structuredClone,
  Date,
  Math,
  Number,
  Array,
  Object,
  Error,
  fetch: async url => {
    const indicator = new URL(url).searchParams.get("indic_de");
    return {ok: true, json: async () => fixture(indicator)};
  }
};

vm.runInNewContext(fs.readFileSync("data.js", "utf8"), context);
(async () => {
  const result = await context.window.HorizonData.loadData("FR", "F");
  assert.equal(result.sourceType, "official");
  assert.equal(result.year, 2024);
  assert.equal(result.qx.F.length, 96);
  assert.equal(result.qx.F[0], qxValues[0]);
  assert.equal(result.qx.F[94], qxValues[94]);
  assert.equal(result.qx.F[95], 1);
  assert.equal(result.ex.F[40], exValues[40]);

  const failingContext = {
    window: {},
    localStorage: {getItem: () => null, setItem: () => {}},
    URLSearchParams, structuredClone, Date, Math, Number, Array, Object, Error,
    fetch: async () => ({ok:false, status:503})
  };
  vm.runInNewContext(fs.readFileSync("data.js", "utf8"), failingContext);
  const fallback = await failingContext.window.HorizonData.loadData("FR", "F");
  assert.equal(fallback.sourceType, "synthetic");
  assert.match(fallback.source, /synthétique/i);
  console.log("OK — parseur JSON-stat, qx, LIFEXP, intervalle ouvert 95+ et fallback explicitement synthétique.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
