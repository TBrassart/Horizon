# Horizon — questionnaire progressif et référence statistique

Application statique HTML/CSS/JavaScript, destinée à présenter des statistiques de mortalité de population à titre pédagogique.

## Lancer en local

Ne pas ouvrir directement `index.html` avec `file://`, car les requêtes `fetch` peuvent être bloquées. Depuis ce dossier :

```bash
python -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Parcours MVP

Le questionnaire comporte trois étapes :

1. **Profil essentiel** : âge, référence statistique (femmes, hommes ou ensemble) et pays.
2. **Mode de vie** : tabac avec questions conditionnelles, alcool, activité physique, sédentarité et sommeil.
3. **Santé** : mesures corporelles facultatives, maladies déclarées, antécédents familiaux et curseurs subjectifs.

Les questions complémentaires sont facultatives. Les états « non renseigné », « je ne sais pas » et « je préfère ne pas répondre » sont distincts pour les questions médicales. Les curseurs subjectifs ne sont considérés comme renseignés que si l'utilisateur les manipule.

## Calcul et limites actuelles

- Les réponses détaillées restent dans la mémoire de la page et ne sont pas envoyées à un serveur Horizon. Le pays et la référence statistique sont transmis à l'API Eurostat pour récupérer la table correspondante ; l'âge et les réponses de mode de vie/santé ne sont pas transmis.
- Les réponses de mode de vie et de santé sont recueillies pour constituer le profil, mais **ne modifient pas le calcul de mortalité**.
- Le moteur tente désormais de récupérer auprès d'Eurostat les probabilités de décès par âge (`PROBDEATH`) et l'espérance de vie par âge (`LIFEXP`) dans `demo_mlifetable`, pour l'année 2024 puis les années antérieures si nécessaire.
- Les données sont interprétées seulement si les séries d'âge requises sont présentes et valides. En cas d'échec, l'application bascule sur le jeu synthétique avec un avertissement explicite.
- La table Eurostat utilise un intervalle ouvert 95+ ; le questionnaire MVP est donc limité à 18–94 ans pour les calculs officiels. Les horizons qui dépassent la plage disponible sont affichés comme indisponibles.
- Les répartitions par cause restent illustratives et synthétiques, même lorsque les probabilités toutes causes proviennent d'Eurostat.
- `risques.json` conserve les anciens coefficients exploratoires, mais ils ne sont plus appliqués par le calcul du MVP.

Avant toute diffusion publique, il reste à effectuer un test réseau réel de l'API pour chaque pays proposé, comparer des profils français avec les tables INSEE et faire valider indépendamment les conventions actuarielles. Les causes de décès ne sont pas encore intégrées.

## Test du parseur

Avec Node.js installé, exécuter :

```bash
node tests/data-smoke.test.js
```

Ce test utilise une réponse JSON-stat simulée hors ligne. Il vérifie le décodage des catégories d'âge, les séries qx/LIFEXP et le traitement de l'intervalle ouvert 95+. Il ne remplace pas un test réseau réel de l'API Eurostat.

## Sources officielles

- [Eurostat — demo_mlifetable](https://ec.europa.eu/eurostat/databrowser/product/view/demo_mlifetable)
- [Documentation de l'API Eurostat](https://ec.europa.eu/eurostat/en/web/user-guides/data-browser/api-data-access/api-getting-started/api)
- [Méthodologie Eurostat des tables de mortalité](https://ec.europa.eu/eurostat/cache/metadata/Annexes/demo_mor_esms_an_Annex_-_Eurostat_from2014.pdf)
- [INSEE — quotients de mortalité et espérance de vie](https://www.insee.fr/fr/statistiques/8999019)

## Fichiers

- `index.html` : structure et questionnaire.
- `style.css` : interface responsive.
- `app.js` : navigation, collecte locale, calcul de référence, graphiques et export CSV.
- `data.js` : récupération Eurostat `PROBDEATH` / `LIFEXP`, validation des séries, cache navigateur et secours synthétique.
- `risques.json` : anciens coefficients exploratoires conservés à titre documentaire ; non utilisés par le MVP.

## Déploiement

Le dossier peut être publié avec GitHub Pages ou tout autre hébergement statique HTTPS. Aucun backend n'est nécessaire.

## Confidentialité

Les réponses du formulaire ne sont ni envoyées ni sauvegardées automatiquement. Le cache local ne concerne que les données statistiques. Les appels à l'API publique et aux CDN peuvent transmettre les informations techniques habituelles de connexion (adresse IP, user-agent).
