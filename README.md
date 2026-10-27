# Training SFL

PWA d'entraînement (U15) : séance du jour, liste des séances, bibliothèque d'exercices, minuteur guidé et import PowerPoint.
Pensée pour l'iPhone 14 (390 × 844), elle s'adapte aux autres écrans : petits iPhone, et colonne centrée sur ordinateur.

## Développer

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # génère dist/
npm run preview   # sert dist/ pour tester la PWA
```

## Installer sur iPhone

1. Mettez le contenu de `dist/` en ligne en HTTPS (Netlify Drop, GitHub Pages, Vercel…). Les chemins sont relatifs, donc un sous-dossier fonctionne.
2. Ouvrez l'adresse dans **Safari**, puis Partager → **Sur l'écran d'accueil**.
3. L'app s'ouvre en plein écran sous le nom « Training SFL ». Elle fonctionne hors connexion : séances et schémas sont mis en cache.

## Données

- `public/seances.json` : séances d'origine. Les schémas sont dans `public/schemas/`.
- Les séances importées depuis un `.pptx` sont gardées dans le stockage local du téléphone (clé `training-sfl-imports`).
- Chaque séance peut être modifiée (date, thème, ateliers retirés ou réordonnés) ou supprimée depuis son écran. Ces changements sont gardés sur le téléphone (clé `training-sfl-edits`) ; `seances.json` reste intact.
- Chronos d'un exercice : sur la fiche de l'exercice, « Modifier les chronos » (répétitions, durée, récupération). « Valeurs d'origine » revient au calcul automatique.
- Sonnerie de fin de chrono : bouton cloche dans l'écran du minuteur (son, volume, bips 3-2-1). Réglage gardé sur le téléphone (clé `training-sfl-settings`).
