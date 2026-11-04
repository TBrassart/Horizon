# Horizon — version 0.2 · Base de mortalité Eurostat

## Changements

- Le questionnaire progressif validé est conservé.
- `data.js` interroge désormais `demo_mlifetable` via l'API officielle Eurostat.
- Récupération des indicateurs `PROBDEATH` (quotient de décès) et `LIFEXP` (espérance de vie à l'âge exact).
- Recherche de la dernière année disponible parmi 2024, 2023, 2022, 2021 et 2020.
- Validation stricte des dimensions JSON-stat et des valeurs par âge.
- Cache navigateur versionné, durée 30 jours.
- Secours synthétique conservé uniquement en cas d'échec réseau/données, avec avertissement visible.
- Sélection géographique limitée aux pays européens proposés par Eurostat.
- Limitation du calcul officiel aux âges 18–94 : l'intervalle 95+ est ouvert dans la table.
- Risques à 1, 5 et 10 ans indisponibles si l'horizon dépasse la plage de quotients annuels.
- Espérance de vie restante lue directement dans `LIFEXP`.
- Répartition par cause toujours explicitement illustrative et synthétique.
- Les facteurs de santé et de mode de vie ne modifient pas le calcul.

## Contrôles effectués

- `node --check app.js`
- `node --check data.js`
- `node tests/data-smoke.test.js`
- Vérification des identifiants HTML et des sélecteurs JavaScript.
- Vérification de la présence des trois étapes du questionnaire.

## Contrôle restant

Le test automatique utilise une réponse JSON-stat simulée hors ligne. L'appel réseau réel à l'API Eurostat doit encore être vérifié depuis un navigateur hébergé. Il faudra aussi comparer les résultats français à l'INSEE avant toute diffusion comme outil statistique fiable.

## Sources

- Eurostat `demo_mlifetable`: https://ec.europa.eu/eurostat/databrowser/product/view/demo_mlifetable
- API Eurostat: https://ec.europa.eu/eurostat/en/web/user-guides/data-browser/api-data-access/api-getting-started/api
- Méthodologie Eurostat: https://ec.europa.eu/eurostat/cache/metadata/Annexes/demo_mor_esms_an_Annex_-_Eurostat_from2014.pdf
- INSEE: https://www.insee.fr/fr/statistiques/8999019
