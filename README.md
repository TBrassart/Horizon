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

- Les réponses du questionnaire restent dans la mémoire de la page et ne sont pas envoyées à un serveur.
- Les réponses de mode de vie et de santé sont recueillies pour constituer le profil, mais **ne modifient pas le calcul de mortalité**.
- Le calcul actuel utilise encore le jeu de secours synthétique de `data.js`. La tentative Eurostat ne fournit pas encore une série détaillée d'âge interprétée et validée.
- Les risques à 1, 5 et 10 ans sont donc des résultats de démonstration sur données synthétiques, **pas des estimations officielles ni des risques individuels**.
- Les répartitions par cause sont illustratives et ne sont pas des statistiques officielles.
- `risques.json` conserve les anciens coefficients exploratoires, mais ils ne sont plus appliqués par le calcul du MVP.

Avant toute diffusion de résultats comme statistiques réelles, il faut intégrer et valider des tables officielles par âge, pays et référence statistique, puis effectuer des tests actuariels indépendants.

## Fichiers

- `index.html` : structure et questionnaire.
- `style.css` : interface responsive.
- `app.js` : navigation, collecte locale, calcul de référence, graphiques et export CSV.
- `data.js` : tentative Eurostat, cache navigateur et secours synthétique.
- `risques.json` : anciens coefficients exploratoires conservés à titre documentaire ; non utilisés par le MVP.

## Déploiement

Le dossier peut être publié avec GitHub Pages ou tout autre hébergement statique HTTPS. Aucun backend n'est nécessaire.

## Confidentialité

Les réponses du formulaire ne sont ni envoyées ni sauvegardées automatiquement. Le cache local ne concerne que les données statistiques. Les appels à l'API publique et aux CDN peuvent transmettre les informations techniques habituelles de connexion (adresse IP, user-agent).
