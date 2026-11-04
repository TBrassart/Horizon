/* Horizon — données de mortalité.
   Source prioritaire : Eurostat demo_mlifetable (qx + espérance de vie).
   Le jeu synthétique reste un secours de démonstration clairement signalé. */
(() => {
  "use strict";
  const CACHE_KEY = "horizon_public_mortality_v2";
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/";
  const OFFICIAL_YEAR_CANDIDATES = [2024, 2023, 2022, 2021, 2020];

  const FALLBACK = {
    source: "JEU SYNTHÉTIQUE DE DÉMONSTRATION — aucune valeur officielle",
    sourceType: "synthetic",
    year: null,
    ages: Array.from({length: 101}, (_, age) => age),
    mx: {
      M: Array.from({length: 101}, (_, age) => Math.min(.75, .00015 * Math.exp(age * .085))),
      F: Array.from({length: 101}, (_, age) => Math.min(.75, .00010 * Math.exp(age * .085)))
    },
    causes: {
      M: {cardiovascular:.32,cancer:.30,respiratory:.10,accident:.08,suicide:.025,other:.175},
      F: {cardiovascular:.34,cancer:.29,respiratory:.11,accident:.045,suicide:.012,other:.203}
    }
  };
  FALLBACK.mx.T = FALLBACK.mx.M.map((value, age) => (value + FALLBACK.mx.F[age]) / 2);
  FALLBACK.causes.T = Object.fromEntries(
    Object.keys(FALLBACK.causes.M).map(key => [key, (FALLBACK.causes.M[key] + FALLBACK.causes.F[key]) / 2])
  );

  function getCache(key) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && cached.key === key && Date.now() - cached.saved < CACHE_TTL) return cached.data;
    } catch {}
    return null;
  }
  function setCache(key, data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({key, saved:Date.now(), data})); } catch {}
  }

  async function fetchJSON(url) {
    const response = await fetch(url, {headers:{Accept:"application/json"}});
    if (!response.ok) throw new Error(`Eurostat HTTP ${response.status}`);
    return response.json();
  }

  function queryEurostat(dataset, params) {
    const query = new URLSearchParams({format:"JSON", lang:"EN", ...params});
    return fetchJSON(`${EUROSTAT}${dataset}?${query.toString()}`);
  }

  function categoryEntries(json, dimensionId) {
    const category = json?.dimension?.[dimensionId]?.category;
    if (!category) throw new Error(`Dimension ${dimensionId} absente du JSON-stat`);
    const index = category.index || {};
    if (Array.isArray(index)) return index.map((code, position) => [code, position]);
    return Object.entries(index).map(([code, position]) => [code, Number(position)]);
  }

  function jsonStatValue(json, positions) {
    const ids = json.id || [];
    const sizes = json.size || [];
    if (!ids.length || ids.length !== sizes.length) throw new Error("Structure JSON-stat invalide");
    let flatIndex = 0;
    for (let i = 0; i < ids.length; i++) {
      let stride = 1;
      for (let j = i + 1; j < sizes.length; j++) stride *= sizes[j];
      flatIndex += positions[ids[i]] * stride;
    }
    const values = json.value;
    if (Array.isArray(values)) return values[flatIndex] ?? null;
    return values?.[String(flatIndex)] ?? null;
  }

  function readAgeSeries(json) {
    const ids = json.id || [];
    if (!ids.includes("age")) throw new Error("Dimension d'âge absente");
    const ageDimension = ids.indexOf("age");
    const sizes = json.size || [];
    ids.forEach((id, index) => {
      if (id !== "age" && sizes[index] !== 1) {
        throw new Error(`La dimension ${id} n'est pas filtrée sur une seule valeur`);
      }
    });
    const categories = categoryEntries(json, "age");
    const positions = {};
    ids.forEach(id => { positions[id] = 0; });
    const series = Array(96).fill(null);
    for (const [code, position] of categories) {
      let age = null;
      if (code === "Y_LT1") age = 0;
      else if (code === "Y_GE95") age = 95;
      else {
        const match = /^Y(\d+)$/.exec(code);
        if (match) age = Number(match[1]);
      }
      if (age === null || age > 95) continue;
      positions.age = position;
      const raw = jsonStatValue(json, positions);
      if (raw !== null && Number.isFinite(Number(raw))) series[age] = Number(raw);
    }
    return series;
  }

  async function fetchIndicator(country, sex, year, indicator) {
    return queryEurostat("demo_mlifetable", {
      freq:"A", geo:country, sex, indic_de:indicator, time:String(year)
    });
  }

  function validateQx(series) {
    // Eurostat's national life-table method uses single-year qx through age 94,
    // then an open-ended 95+ interval. The open interval is not an annual qx.
    for (let age = 0; age <= 94; age++) {
      const value = series[age];
      if (value === null || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`Quotient de mortalité manquant ou invalide à l'âge ${age}`);
      }
    }
    series[95] = 1; // terminal open interval, per Eurostat life-table methodology
    return series;
  }

  async function loadOfficial(country, sex) {
    if (!/^[A-Z0-9_]+$/.test(country)) throw new Error("Code pays invalide");
    if (!["F", "M", "T"].includes(sex)) throw new Error("Référence statistique indisponible");
    let lastError = null;

    for (const year of OFFICIAL_YEAR_CANDIDATES) {
      try {
        const [qxJson, exJson] = await Promise.all([
          fetchIndicator(country, sex, year, "PROBDEATH"),
          fetchIndicator(country, sex, year, "LIFEXP")
        ]);
        const qx = validateQx(readAgeSeries(qxJson));
        const ex = readAgeSeries(exJson);
        if (ex.slice(0, 95).some(value => value === null || !Number.isFinite(value) || value < 0)) {
          throw new Error("Espérance de vie par âge incomplète");
        }
        return {
          source: `Eurostat — demo_mlifetable — ${year} — PROBDEATH et LIFEXP`,
          sourceType: "official",
          country, sex, year, qx: {[sex]:qx}, ex: {[sex]:ex},
          ages: Array.from({length:96}, (_, age) => age),
          causes: FALLBACK.causes
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Aucune année de référence disponible");
  }

  async function loadData(country, sex) {
    const key = `${country}|${sex}`;
    const cached = getCache(key);
    if (cached) return {...cached, cache:true};

    try {
      const official = await loadOfficial(country, sex);
      setCache(key, official);
      return official;
    } catch (error) {
      // Never relabel synthetic data as official. The UI displays a persistent warning.
      return {
        ...structuredClone(FALLBACK), country, sex,
        source: `${FALLBACK.source}. Données Eurostat indisponibles : ${error.message}`,
        sourceType: "synthetic"
      };
    }
  }

  window.HorizonData = {loadData, FALLBACK, queryEurostat};
})();