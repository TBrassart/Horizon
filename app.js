/* Horizon: calcul et interface. Tout le questionnaire reste dans la mémoire de la page. */
(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const form=$("#profile-form"), steps=$$(".step"), next=$("#next"),prev=$("#prev"),submit=$("#calculate");
  let current=0, profile=null, model=null, survivalChart=null,mortalityChart=null,causesChart=null,rows=[];
  const causeNames={cardiovascular:"Cardiovasculaire",cancer:"Cancers",respiratory:"Respiratoire",accident:"Accidents",suicide:"Suicides",other:"Autres causes"};
  const colors=["#4779b8","#dc8052","#70a879","#a6aeb8","#8c79b8","#d4b55b"];
  const fmt=(x,d=1)=>Number(x).toLocaleString("fr-FR",{maximumFractionDigits:d,minimumFractionDigits:d});
  function showStep(n){current=n;steps.forEach((s,i)=>s.classList.toggle("active",i===n));$("#step-count").textContent=`Étape ${n+1} / ${steps.length}`;prev.disabled=n===0;next.hidden=n===steps.length-1;submit.hidden=n!==steps.length-1;}
  next.addEventListener("click",()=>{if(!steps[current].querySelector(":invalid"))showStep(Math.min(current+1,steps.length-1));else steps[current].querySelector(":invalid").reportValidity();});
  prev.addEventListener("click",()=>showStep(Math.max(0,current-1)));
  $("#edit-profile").addEventListener("click",()=>{$("#results").hidden=true;$("#questionnaire").scrollIntoView({behavior:"smooth"});});
  function collect(){
    const f=new FormData(form),age=+f.get("age"),height=+f.get("height"),weight=+f.get("weight");
    return {age,sex:f.get("sex"),country:f.get("country"),bmi:weight/((height/100)**2),smoking:f.get("smoking"),cigarettes:+f.get("cigarettes")||0,alcohol:f.get("alcohol"),activity:f.get("activity"),diet:f.get("diet"),diabetes:f.has("diabetes"),hypertension:f.has("hypertension"),cholesterol:f.has("cholesterol"),history:f.get("history"),family:f.get("family")};
  }
  async function loadRisks(){const r=await fetch("risques.json");if(!r.ok)throw new Error("risques.json inaccessible");return r.json();}
  function riskFactors(p,risks){
    const f=risks.factors, accum={};
    const add=(factor,key)=>{const obj=f[factor]?.[key];if(!obj)return;for(const [cause,rr] of Object.entries(obj)){(accum[cause]??=[]).push(Math.log(rr));}};
    add("smoking",p.smoking);
    add("bmi",p.bmi<18.5?"underweight":p.bmi>=30?"obesity":"normal");
    add("alcohol",p.alcohol);add("activity",p.activity);add("diet",p.diet);
    if(p.diabetes)add("diabetes","yes");if(p.hypertension)add("hypertension","yes");if(p.cholesterol)add("cholesterol","yes");
    add("history",p.history);add("family",p.family);
    const result={};
    for(const cause of Object.keys(causeNames)){
      // Atténuation prudente pour réduire l'accumulation de facteurs corrélés.
      const logs=accum[cause]||[],logRR=logs.reduce((a,b)=>a+b,0)*risks.method.correlationAttenuation;
      result[cause]=Math.max(.55,Math.min(risks.method.maxRR[cause]||2,Math.exp(logRR)));
    }
    return result;
  }
  function makeBaseline(data,sex){
    const mx=data.mx?.[sex]||data.mx.M;
    return Array.from({length:101},(_,a)=>Math.max(0,Math.min(.9,mx[a]||mx[100])));
  }
  function smoothCauseMix(sex,age,data){
    const base=data.causes?.[sex]||data.causes.M, keys=Object.keys(causeNames);
    // Petit lissage pseudo-comptage vers un mélange agrégé : les causes rares aux âges jeunes sont instables.
    const weights=keys.map(k=>Math.max(.001,base[k]||0));
    const sum=weights.reduce((a,b)=>a+b,0);return Object.fromEntries(keys.map((k,i)=>[k,weights[i]/sum]));
  }
  function calculate(p,data,risks){
    const baseline=makeBaseline(data,p.sex),rr=riskFactors(p,risks),mix=smoothCauseMix(p.sex,p.age,data);
    const rows=[];let S=1,weightedDeathAge=0,deathMass=0,median=null;
    for(let a=p.age;a<=100;a++){
      const baseRate=baseline[a],causeRates={};
      for(const c of Object.keys(causeNames))causeRates[c]=baseRate*mix[c]*rr[c];
      const total=Object.values(causeRates).reduce((x,y)=>x+y,0);
      const q=1-Math.exp(-total),fromToday=S*q;
      const shares=Object.fromEntries(Object.keys(causeNames).map(c=>[c,total?causeRates[c]/total:0]));
      rows.push({age:a,survival:S,q,fromToday,shares,total,causeRates});
      weightedDeathAge+=a*fromToday;deathMass+=fromToday;
      if(median===null&&S>=.5&&S*(1-q)<.5)median=a;
      S*=1-q;
    }
    const remaining=rows.reduce((sum,r)=>sum+r.survival,0); // annual life-table approximation
    const meanAge=deathMass>0?weightedDeathAge/deathMass:p.age;
    return {rows,remaining,meanAge,median,rr,mix};
  }
  function makeCharts(){
    const labels=rows.map(r=>r.age);
    if(survivalChart)survivalChart.destroy();if(mortalityChart)mortalityChart.destroy();if(causesChart)causesChart.destroy();
    const baseline=makeBaseline(model.data,profile.sex),baseRows=[];let s=1;
    for(let a=profile.age;a<=100;a++){baseRows.push(s);s*=Math.exp(-baseline[a]);}
    survivalChart=new Chart($("#survival-chart"),{type:"line",data:{labels,datasets:[{label:"Profil ajusté (modèle exploratoire)",data:rows.map(r=>r.survival*100),borderColor:"#2463a6",backgroundColor:"#2463a615",fill:true,pointRadius:0,tension:.2},{label:"Référence population (secours)",data:baseRows.map(x=>x*100),borderColor:"#a5afbb",borderDash:[5,4],pointRadius:0,tension:.2}]},options:chartOptions("Probabilité de survie (%)",100)});
    const ageStart=+$("#mortality-age").value;
    mortalityChart=new Chart($("#mortality-chart"),{type:"line",data:{labels:rows.filter(r=>r.age>=ageStart).map(r=>r.age),datasets:[{label:"q(a) — vivant au début de l'année",data:rows.filter(r=>r.age>=ageStart).map(r=>r.q*100),borderColor:"#dc8052",pointRadius:0},{label:"Décès vu d'aujourd'hui",data:rows.filter(r=>r.age>=ageStart).map(r=>r.fromToday*100),borderColor:"#4779b8",pointRadius:0}]},options:chartOptions("Probabilité (%)")});
    updateCauses(+$("#cause-age").value);
  }
  function chartOptions(title,max){return {responsive:true,maintainAspectRatio:true,interaction:{mode:"index",intersect:false},plugins:{legend:{labels:{boxWidth:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw,3)} %`}}},scales:{x:{title:{display:true,text:"Âge"}},y:{beginAtZero:true,suggestedMax:max,title:{display:true,text:title},ticks:{callback:v=>`${v}%`}}}};}
  function updateCauses(age){
    const row=rows.find(r=>r.age===age)||rows[0],keys=Object.keys(causeNames),values=keys.map(k=>row.shares[k]*100);
    $("#cause-age-label").textContent=`${age} ans`;
    if(causesChart)causesChart.destroy();
    causesChart=new Chart($("#causes-chart"),{type:"bar",data:{labels:keys.map(k=>causeNames[k]),datasets:[{label:"Part parmi les décès (%)",data:values,backgroundColor:colors,borderWidth:0}]},options:{...chartOptions("Part (%)",100),indexAxis:"y",scales:{x:{beginAtZero:true,max:100,title:{display:true,text:"Part parmi les décès (%)"},ticks:{callback:v=>`${v}%`}},y:{}}}});
    $("#cause-warning").textContent="Répartition illustrative basée sur un profil de causes de secours agrégé. Aux jeunes âges et pour les causes rares, les parts peuvent être instables.";
  }
  function fillTable(){
    $("#results-table").innerHTML=rows.map(r=>{const top=Object.entries(r.shares).sort((a,b)=>b[1]-a[1])[0];return `<tr><td>${r.age}</td><td>${fmt(r.survival*100,2)} %</td><td>${fmt(r.q*100,3)} %</td><td>${fmt(r.fromToday*100,3)} %</td><td>${causeNames[top[0]]}</td></tr>`;}).join("");
  }
  function csv(){
    const header=["age","survie_pct","q_conditionnelle_pct","deces_depuis_aujourdhui_pct",...Object.keys(causeNames).map(k=>`cause_${k}_pct`)];
    const lines=[header.join(";"),...rows.map(r=>[r.age,r.survival*100,r.q*100,r.fromToday*100,...Object.keys(causeNames).map(k=>r.shares[k]*100)].map(x=>String(x).replace(".",",")).join(";"))];
    const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="horizon-estimation.csv";a.click();URL.revokeObjectURL(url);
  }
  form.addEventListener("submit",async e=>{
    e.preventDefault();profile=collect();
    if(profile.age<18||profile.age>100){alert("L'âge doit être compris entre 18 et 100 ans.");return;}
    $("#calculate").disabled=true;$("#data-status").textContent="Préparation du modèle…";
    try{
      const [data,risks]=await Promise.all([HorizonData.loadData(profile.country,profile.sex),loadRisks()]);
      model={data,risks};const out=calculate(profile,data,risks);rows=out.rows;
      $("#life-years").textContent=fmt(out.remaining,1);$("#mean-age").textContent=fmt(out.meanAge,1);
      $("#median-age").textContent=out.median===null?"Non atteinte":`${out.median} ans`;
      $("#mortality-age").value=profile.age;$("#mortality-age").min=profile.age;$("#cause-age").min=profile.age;
      $("#results").hidden=false;makeCharts();fillTable();$("#results").scrollIntoView({behavior:"smooth"});
      $("#data-status").textContent=data.source;
    }catch(err){console.error(err);alert("Impossible de charger le modèle. Vérifiez que le site est servi via HTTP(S) et que les fichiers sont présents.");}
    finally{$("#calculate").disabled=false;}
  });
  $("#cause-age").addEventListener("input",e=>{if(rows.length)updateCauses(+e.target.value);});
  $("#mortality-age").addEventListener("change",()=>{if(rows.length)makeCharts();});
  $("#download-csv").addEventListener("click",csv);
  $("#data-status").textContent="Données publiques · cache navigateur";
  showStep(0);
})();