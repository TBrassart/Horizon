/* Données publiques: récupération côté navigateur, cache local et jeu de secours clairement synthétique.
   Le parsing JSON-stat est générique. Vérifier les dimensions Eurostat/OMS avec leurs métadonnées
   avant de présenter la sortie comme une statistique officielle. */
(() => {
  const CACHE_KEY = "horizon_public_mortality_v1";
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/";
  const FALLBACK = {
    source:"Jeu de secours démonstratif — valeurs synthétiques, ne pas utiliser pour une analyse réelle",
    year:2019,
    ages:Array.from({length:101},(_,age)=>age),
    mx:{M:Array.from({length:101},(_,a)=>Math.min(.75,0.00015*Math.exp(a*.085))),F:Array.from({length:101},(_,a)=>Math.min(.75,0.00010*Math.exp(a*.085)))},
    causes:{M:{cardiovascular:.32,cancer:.30,respiratory:.10,accident:.08,suicide:.025,other:.175},F:{cardiovascular:.34,cancer:.29,respiratory:.11,accident:.045,suicide:.012,other:.203}}
  };
  // Série "T" de démonstration : moyenne des deux séries synthétiques.
  // Elle reste explicitement synthétique et ne remplace pas une table officielle.
  FALLBACK.mx.T = FALLBACK.mx.M.map((value, age) => (value + FALLBACK.mx.F[age]) / 2);
  FALLBACK.causes.T = Object.fromEntries(
    Object.keys(FALLBACK.causes.M).map(key => [key, (FALLBACK.causes.M[key] + FALLBACK.causes.F[key]) / 2])
  );
  function getCache(){try{const v=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");if(v&&Date.now()-v.saved<CACHE_TTL)return v.data;}catch{}return null;}
  function setCache(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify({saved:Date.now(),data}));}catch{}}
  async function fetchJSON(url){const r=await fetch(url,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
  function parseJSONStat(json){
    if(!json?.id||!json?.size||!json?.value)throw new Error("Format JSON-stat inattendu");
    const dims=json.id, sizes=json.size, cat=json.dimension;
    const indexes=dims.map((d,i)=>Object.entries(cat[d].category.index).map(([k,v])=>[k,typeof v==="number"?v:Object.keys(cat[d].category.index).indexOf(k)]));
    return {dims,sizes,indexes,values:json.value};
  }
  function queryEurostat(dataset,params){
    const q=new URLSearchParams({lang:"en",...params});
    return fetchJSON(`${EUROSTAT}${dataset}?${q.toString()}`);
  }
  // Tentative de récupération de la table Eurostat. La table de secours reste disponible si
  // l'API renvoie un schéma/dimension différent ou si le navigateur bloque le CORS.
  async function loadEurostat(country,sex){
    const data=await queryEurostat("demo_mlifetable",{geo:country,sex,age:"TOTAL",indic_de:"LEX",unit:"YR"});
    const parsed=parseJSONStat(data);
    // Le résultat doit être interprété avec le catalogue de dimensions complet; ne pas inventer
    // une série annuelle lorsque le payload ne fournit pas un âge simple et des valeurs indexées.
    if(!parsed.values)throw new Error("Valeurs Eurostat absentes");
    return {raw:data,source:"Eurostat demo_mlifetable"};
  }
  async function loadData(country,sex){
    const cached=getCache(); if(cached && cached.country===country && cached.sex===sex)return {...cached,cache:true};
    try{
      const table=await loadEurostat(country,sex);
      // Le parseur de série est volontairement fail-closed : garder un jeu de données explicitement
      // marqué comme fallback plutôt que d'afficher une donnée non vérifiée.
      const fallback=structuredClone(FALLBACK);
      const result={...fallback,country,sex,source:`${table.source} interrogé; série d'âge détaillée non interprétée, fallback affiché`,liveAttempt:true};
      setCache(result);return result;
    }catch(err){
      const result={...structuredClone(FALLBACK),country,sex,source:`Secours local (${err.message})`};
      return result;
    }
  }
  window.HorizonData={loadData,FALLBACK,queryEurostat};
})();