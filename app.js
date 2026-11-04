/* Horizon MVP — questionnaire progressif et calcul de référence non ajusté.
   Les réponses de santé restent dans la page et ne modifient pas le calcul de mortalité. */
(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const form = $("#profile-form");
  const steps = $$(".step");
  const next = $("#next"), prev = $("#prev"), submit = $("#calculate");
  let current = 0, profile = null, activeData = null;
  let survivalChart = null, mortalityChart = null, causesChart = null, rows = [];
  const causeNames = {
    cardiovascular: "Cardiovasculaire", cancer: "Cancers", respiratory: "Respiratoire",
    accident: "Accidents", suicide: "Suicides", other: "Autres causes"
  };
  const colors = ["#4779b8", "#dc8052", "#70a879", "#a6aeb8", "#8c79b8", "#d4b55b"];
  const fmt = (x, d = 1) => Number(x).toLocaleString("fr-FR", {maximumFractionDigits:d, minimumFractionDigits:d});
  const optionalNumber = value => value === "" || value == null ? null : Number(value);

  function showStep(n) {
    current = n;
    steps.forEach((step, i) => {
      step.classList.toggle("active", i === n);
      step.setAttribute("aria-hidden", String(i !== n));
    });
    $("#step-count").textContent = `Étape ${n + 1} / ${steps.length}`;
    prev.disabled = n === 0;
    next.hidden = n === steps.length - 1;
    submit.hidden = n !== steps.length - 1;
    $("#form-error").hidden = true;
  }

  function validateStep() {
    const active = steps[current];
    const required = [...active.querySelectorAll("[required]")];
    for (const field of required) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    if (current === 0) {
      const age = Number(form.elements.age.value);
      if (!Number.isInteger(age) || age < 18 || age > 94) {
        form.elements.age.setCustomValidity("L'âge doit être un nombre entier compris entre 18 et 94 ans.");
        form.elements.age.reportValidity();
        form.elements.age.setCustomValidity("");
        return false;
      }
    }
    return true;
  }

  next.addEventListener("click", () => {
    if (validateStep()) showStep(Math.min(current + 1, steps.length - 1));
  });
  prev.addEventListener("click", () => showStep(Math.max(current - 1, 0)));

  function updateConditionals() {
    const smoking = form.elements.smoking.value;
    $$("[data-show-when]").forEach(label => {
      const [name, values] = label.dataset.showWhen.split(":");
      const visible = name === "smoking" && values.split(",").includes(smoking);
      label.hidden = !visible;
      const input = label.querySelector("input");
      if (input) {
        if (!visible) input.value = "";
        input.disabled = !visible;
      }
    });
  }
  form.elements.smoking.addEventListener("change", updateConditionals);

  ["sleep_quality", "diet_quality", "stress_level"].forEach(name => {
    const input = form.elements[name];
    const output = $(`#${name.replaceAll("_", "-")}-value`);
    const render = () => { output.textContent = `${input.value}/10`; };
    input.addEventListener("input", () => { input.dataset.answered = "true"; render(); });
    render();
  });

  function collect() {
    const f = new FormData(form);
    const height = optionalNumber(f.get("height"));
    const weight = optionalNumber(f.get("weight"));
    const smokingStatus = f.get("smoking") ?? "";
    return {
      age: Number(f.get("age")),
      sex: f.get("sex"),
      country: f.get("country"),
      smoking_status: smokingStatus,
      cigarettes_per_day: optionalNumber(f.get("cigarettes")),
      smoking_duration_years: optionalNumber(f.get("smoking_years")),
      quit_duration_years: optionalNumber(f.get("quit_years")),
      alcohol_units_week: optionalNumber(f.get("alcohol_units_week")),
      activity_minutes_week: optionalNumber(f.get("activity_minutes_week")),
      sitting_hours_day: optionalNumber(f.get("sitting_hours_day")),
      sleep_hours: optionalNumber(f.get("sleep_hours")),
      height_cm: height,
      weight_kg: weight,
      bmi: height && weight ? weight / ((height / 100) ** 2) : null,
      diabetes: f.get("diabetes") ?? "",
      hypertension: f.get("hypertension") ?? "",
      cholesterol: f.get("cholesterol") ?? "",
      cardiovascular_disease: f.get("cardiovascular_disease") ?? "",
      respiratory_disease: f.get("respiratory_disease") ?? "",
      kidney_disease: f.get("kidney_disease") ?? "",
      cancer_history: f.get("cancer_history") ?? "",
      family_cardiovascular_history: f.get("family_cardiovascular_history") ?? "",
      sleep_quality: form.elements.sleep_quality.dataset.answered === "true" ? Number(f.get("sleep_quality")) : null,
      diet_quality: form.elements.diet_quality.dataset.answered === "true" ? Number(f.get("diet_quality")) : null,
      stress_level: form.elements.stress_level.dataset.answered === "true" ? Number(f.get("stress_level")) : null
    };
  }

  function makeBaseline(data, sex) {
    if (data.qx?.[sex]) {
      const qx = data.qx[sex];
      return Array.from({length: 101}, (_, age) => age <= 95 ? Number(qx[age] ?? 1) : 1);
    }
    const mx = data.mx?.[sex] || data.mx?.T || data.mx?.M;
    if (!mx) throw new Error("Table de mortalité indisponible pour cette référence.");
    return Array.from({length: 101}, (_, age) => 1 - Math.exp(-Math.max(0, Math.min(.9, Number(mx[age]) || 0))));
  }

  function causeMix(sex, data) {
    const base = data.causes?.[sex] || data.causes?.T || data.causes?.M;
    const keys = Object.keys(causeNames);
    const weights = keys.map(key => Math.max(0, Number(base?.[key]) || 0));
    const total = weights.reduce((a, b) => a + b, 0);
    if (!total) return Object.fromEntries(keys.map(key => [key, 1 / keys.length]));
    return Object.fromEntries(keys.map((key, i) => [key, weights[i] / total]));
  }

  function calculateReference(p, data) {
    const baseline = makeBaseline(data, p.sex);
    const mix = causeMix(p.sex, data);
    const resultRows = [];
    const maxAge = data.sourceType === "official" ? 94 : 100;
    if (data.sourceType === "official" && p.age >= 95) {
      throw new Error("La table Eurostat utilise un intervalle ouvert 95+ ; cette version ne calcule pas encore un profil à partir de 95 ans.");
    }
    let survival = 1, weightedDeathAge = 0, deathMass = 0, median = null;

    for (let age = p.age; age <= maxAge; age++) {
      const q = baseline[age];
      const fromToday = survival * q;
      const shares = {...mix};
      resultRows.push({age, survival, q, fromToday, shares, total: q});
      weightedDeathAge += age * fromToday;
      deathMass += fromToday;
      if (median === null && survival >= .5 && survival * (1 - q) < .5) median = age;
      survival *= (1 - q);
    }
    if (data.sourceType === "official" && median === null && survival >= .5) median = "95+";

    const riskAt = years => {
      if (p.age + years > maxAge + 1) return null;
      let s = 1;
      for (let age = p.age; age < p.age + years; age++) s *= 1 - resultRows[age - p.age].q;
      return 1 - s;
    };
    const remaining = data.sourceType === "official"
      ? Number(data.ex?.[p.sex]?.[p.age])
      : resultRows.reduce((sum, row) => sum + row.survival, 0);
    const meanAge = data.sourceType === "official"
      ? null
      : (deathMass > 0 ? weightedDeathAge / deathMass : p.age);
    return {rows: resultRows, remaining, meanAge, median, risk1: riskAt(1), risk5: riskAt(5), risk10: riskAt(10), mix};
  }

  function chartOptions(title, max) {
    return {
      responsive: true, maintainAspectRatio: true,
      interaction: {mode: "index", intersect: false},
      plugins: {
        legend: {labels: {boxWidth: 10, usePointStyle: true}},
        tooltip: {callbacks: {label: c => `${c.dataset.label}: ${fmt(c.raw, 3)} %`}}
      },
      scales: {
        x: {title: {display: true, text: "Âge"}},
        y: {beginAtZero: true, suggestedMax: max, title: {display: true, text: title},
          ticks: {callback: value => `${value}%`}}
      }
    };
  }

  function makeCharts() {
    if (typeof Chart === "undefined") throw new Error("La bibliothèque graphique Chart.js n'a pas pu être chargée.");
    const labels = rows.map(row => row.age);
    const survivalLabels = [...labels];
    const survivalValues = rows.map(row => row.survival * 100);
    if (activeData?.sourceType === "official" && rows.length) {
      const last = rows[rows.length - 1];
      survivalLabels.push(95);
      survivalValues.push(last.survival * (1 - last.q) * 100);
    }
    [survivalChart, mortalityChart, causesChart].forEach(chart => chart?.destroy());
    survivalChart = new Chart($("#survival-chart"), {
      type: "line",
      data: {labels: survivalLabels, datasets: [
        {label: "Référence statistique", data: survivalValues,
          borderColor: "#2463a6", backgroundColor: "#2463a615", fill: true, pointRadius: 0, tension: .2}
      ]},
      options: chartOptions("Probabilité de survie (%)", 100)
    });

    const ageStart = Number($("#mortality-age").value);
    mortalityChart = new Chart($("#mortality-chart"), {
      type: "line",
      data: {labels: rows.filter(row => row.age >= ageStart).map(row => row.age),
        datasets: [
          {label: "q(a) — décès conditionnel annuel", data: rows.filter(row => row.age >= ageStart).map(row => row.q * 100),
            borderColor: "#dc8052", pointRadius: 0},
          {label: "Décès rapportés à aujourd'hui", data: rows.filter(row => row.age >= ageStart).map(row => row.fromToday * 100),
            borderColor: "#4779b8", pointRadius: 0}
        ]},
      options: chartOptions("Probabilité (%)")
    });
    updateCauses(Number($("#cause-age").value));
  }

  function updateCauses(age) {
    const row = rows.find(item => item.age === age) || rows[0];
    const keys = Object.keys(causeNames);
    $("#cause-age-label").textContent = `${row.age} ans`;
    causesChart?.destroy();
    causesChart = new Chart($("#causes-chart"), {
      type: "bar",
      data: {labels: keys.map(key => causeNames[key]),
        datasets: [{label: "Part illustrative parmi les décès (%)",
          data: keys.map(key => row.shares[key] * 100), backgroundColor: colors, borderWidth: 0}]},
      options: {...chartOptions("Part (%)", 100), indexAxis: "y",
        scales: {x: {beginAtZero: true, max: 100, title: {display: true, text: "Part illustrative (%)"},
          ticks: {callback: value => `${value}%`}}, y: {}}}
    });
    $("#cause-warning").textContent =
      "Répartition illustrative du jeu de secours synthétique ; elle ne représente pas les causes de décès officielles de votre pays.";
  }

  function renderProfile(p) {
    const smokingLabels = {"": "non renseigné", unknown: "je ne sais pas", declined: "refus de réponse",
      never: "jamais fumé", former: "ancien fumeur", occasional: "fumeur occasionnel", current: "fumeur quotidien"};
    const bmi = p.bmi == null ? "non renseigné" : `${fmt(p.bmi, 1)} kg/m²`;
    const yesCount = ["diabetes", "hypertension", "cholesterol", "cardiovascular_disease",
      "respiratory_disease", "kidney_disease", "cancer_history"].filter(key => p[key] === "YES").length;
    $("#profile-summary").innerHTML =
      `<strong>Profil enregistré</strong><p>${p.age} ans · ${p.sex === "F" ? "référence femmes" : p.sex === "M" ? "référence hommes" : "référence ensemble"} · ${$("#country").selectedOptions[0].textContent}</p>` +
      `<p>Tabac : ${smokingLabels[p.smoking_status]} · IMC : ${bmi} · Diagnostics déclarés : ${yesCount}</p>` +
      `<p class="hint">Vos réponses détaillées ne sont pas envoyées à Horizon. Le pays et la référence statistique servent uniquement à interroger Eurostat. Les autres réponses ne modifient pas encore le calcul.</p>`;
  }

  function fillResults(out, data) {
    activeData = data;
    $("#life-years").textContent = Number.isFinite(out.remaining) ? fmt(out.remaining, 1) : "Indisponible";
    $("#life-years-note").textContent = data.sourceType === "official"
      ? "Eurostat · espérance de vie à l'âge exact"
      : "Approximation synthétique, tronquée à 100 ans";
    $("#mean-age").textContent = out.meanAge == null ? "Non calculable" : `${fmt(out.meanAge, 1)} ans`;
    $("#mean-age-metric").hidden = data.sourceType === "official";
    $("#median-age").textContent = out.median === null ? "Non atteinte" : out.median === "95+" ? "95 ans ou plus" : `${out.median} ans`;
    $("#risk-1").textContent = out.risk1 == null ? "Indisponible" : `${fmt(out.risk1 * 100, 2)} %`;
    $("#risk-5").textContent = out.risk5 == null ? "Indisponible" : `${fmt(out.risk5 * 100, 2)} %`;
    $("#risk-10").textContent = out.risk10 == null ? "Indisponible" : `${fmt(out.risk10 * 100, 2)} %`;
    $("#data-status").textContent = data.source || "Source non précisée";
    const isSynthetic = /synthétique|secours|fallback|non interprétée/i.test(data.source || "");
    $("#data-warning").textContent = isSynthetic
      ? "Attention : les données actuellement utilisées sont un jeu de secours synthétique. Les chiffres affichés servent uniquement à vérifier le fonctionnement de l'application ; ils ne sont pas des estimations officielles et ne doivent pas être interprétés comme votre risque réel."
      : `Source des données : ${data.source}. Les probabilités toutes causes et l'espérance de vie proviennent de la table officielle. Les parts par cause restent illustratives et synthétiques ; les réponses de santé ne modifient pas le calcul.`;
    renderProfile(profile);
    $("#mortality-age").value = profile.age;
    $("#mortality-age").min = profile.age;
    $("#mortality-age").max = rows[rows.length - 1].age;
    $("#cause-age").min = profile.age;
    $("#cause-age").max = data.sourceType === "official" ? 94 : 100;
    $("#cause-age").value = Math.max(profile.age, Math.min(60, 100));
    fillTable();
    makeCharts();
    $("#results").hidden = false;
    $("#results").scrollIntoView({behavior: "smooth"});
  }

  function fillTable() {
    $("#results-table").innerHTML = rows.map(row => {
      const top = Object.entries(row.shares).sort((a, b) => b[1] - a[1])[0];
      return `<tr><td>${row.age}</td><td>${fmt(row.survival * 100, 2)} %</td>` +
        `<td>${fmt(row.q * 100, 3)} %</td><td>${fmt(row.fromToday * 100, 3)} %</td>` +
        `<td>${causeNames[top[0]]}</td></tr>`;
    }).join("");
  }

  function downloadCSV() {
    const header = ["age", "survie_pct", "deces_conditionnel_annuel_pct", "deces_depuis_aujourdhui_pct",
      ...Object.keys(causeNames).map(key => `part_cause_${key}_pct`)];
    const lines = [header.join(";"), ...rows.map(row =>
      [row.age, row.survival * 100, row.q * 100, row.fromToday * 100,
        ...Object.keys(causeNames).map(key => row.shares[key] * 100)]
        .map(value => String(value).replace(".", ",")).join(";"))];
    const blob = new Blob(["\ufeff" + lines.join("\n")], {type: "text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "horizon-reference-statistique.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  $("#edit-profile").addEventListener("click", () => {
    $("#results").hidden = true;
    $("#questionnaire").scrollIntoView({behavior: "smooth"});
    showStep(0);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!validateStep()) return;
    profile = collect();
    $("#calculate").disabled = true;
    $("#form-error").hidden = true;
    $("#data-status").textContent = "Préparation de la référence…";
    try {
      const data = await window.HorizonData.loadData(profile.country, profile.sex);
      const output = calculateReference(profile, data);
      rows = output.rows;
      fillResults(output, data);
    } catch (error) {
      console.error(error);
      $("#form-error").textContent = `Impossible de préparer le résultat : ${error.message}`;
      $("#form-error").hidden = false;
    } finally {
      $("#calculate").disabled = false;
    }
  });

  $("#cause-age").addEventListener("input", event => { if (rows.length) updateCauses(Number(event.target.value)); });
  $("#mortality-age").addEventListener("change", () => {
    if (!rows.length) return;
    const min = profile.age, max = rows[rows.length - 1].age;
    const value = Math.min(max, Math.max(min, Number($("#mortality-age").value) || min));
    $("#mortality-age").value = value;
    makeCharts();
  });
  $("#download-csv").addEventListener("click", downloadCSV);

  $("#data-status").textContent = "Données publiques · questionnaire local";
  updateConditionals();
  showStep(0);
})();