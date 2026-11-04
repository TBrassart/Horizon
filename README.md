# Horizon — estimateur statistique de mortalité

Prototype statique en HTML, CSS et JavaScript. Le questionnaire et les calculs restent côté navigateur. Aucun serveur applicatif ni stockage serveur n'est utilisé.

## Fichiers
- `index.html` : structure, questionnaire, résultats et méthode/limites
- `style.css` : interface responsive
- `app.js` : questionnaire, moteur simplifié, Chart.js et export CSV
- `data.js` : tentative d'accès Eurostat, cache localStorage et secours de démonstration
- `risques.json` : hypothèses de risques relatifs et références à approfondir

## Lancer en local
Ne pas ouvrir directement `index.html` en `file://`, car les requêtes `fetch` peuvent être bloquées. Utilisez un serveur statique, par exemple :

```bash
python -m http.server 8000
```

Puis ouvrez `http://localhost:8000`.

## Déploiement
Déposez le dossier dans un dépôt GitHub et activez GitHub Pages (Settings → Pages → Deploy from branch). Netlify et Vercel peuvent également servir le dossier sans configuration backend.

## Important : état des données
Ce dépôt est un premier jet technique, **pas un outil médical et pas encore un estimateur validé**. `data.js` tente une requête à Eurostat, mais refuse de traiter des dimensions JSON-stat qu'il n'a pas validées. Il bascule alors sur un jeu synthétique clairement identifié. Les parts de causes du jeu de secours sont illustratives. Elles ne doivent pas être publiées comme des statistiques officielles.

Avant de communiquer des résultats réels :
1. vérifier les dimensions exactes et les unités Eurostat dans les métadonnées ;
2. construire et tester un parseur JSON-stat robuste ;
3. relier une table de mortalité à des causes de décès observées avec dénominateurs compatibles ;
4. établir les coefficients RR avec sources précises, stratification âge/sexe et incertitudes ;
5. réaliser une validation actuarielle indépendante et une revue de sécurité/confidentialité.

## Confidentialité
Les réponses du formulaire sont conservées dans la mémoire de la page uniquement. `localStorage` ne stocke que les données statistiques de cache. Les appels aux API publiques et au CDN peuvent néanmoins transmettre les informations techniques usuelles de requête (adresse IP, user-agent, etc.). Chart.js et les polices sont chargés via CDN dans ce premier jet.
