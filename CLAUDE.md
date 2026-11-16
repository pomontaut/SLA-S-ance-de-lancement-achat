# SLA — Séance de lancement achats / Dashboard Évaluation Fournisseur (Induni & Cie SA)

App React + Vite + Supabase (Auth + Postgres) hébergée sur Railway (projet `beneficial-curiosity`/`SLA-S-ance-de-lancement-achat`).
Propriétaire : Pierre-Olivier Montaut (français, direct). Réponses en français, courtes.

## Déploiement
- Railway suit la branche **`claude/dossier-seance-lancement-achat-i3mela`** (déploiement auto au push). Il n'y a PAS de branche `main`.
- Avant de pousser : `NODE_OPTIONS=--max-old-space-size=6000 npx tsc --noEmit -p .` (tsc sans cette option manque de mémoire à cause des gros JSON).
- Les scripts SQL de `supabase/` ne sont PAS appliqués automatiquement : le propriétaire les lance à la main (Supabase > SQL Editor).
  En attente : `alter table evaluations_formulaire add column if not exists entite text not null default ''; notify pgrst, 'reload schema';`

## Analyse de la dépense (règles décidées avec le propriétaire)
- **TOUS les montants de dépense sont HT (hors TVA)** — décision du propriétaire, y compris payé / en retard / en attente. Les journaux sont TTC : le script retire la TVA (`convertir_ht` dans `appliquer_plan_comptable_depense.py` : montant + ligne d'impôt préalable des exports bruts ; sinon montant / (1 + taux) pour le journal compilé 2025). La TVA du document est gardée dans `doc.tva`. Seules les exclusions d'origine du tooltip « Dépense totale » restent TTC. Le seuil 10'000 CHF du formulaire d'évaluation s'applique donc au CA HT.
- La dépense = **charges d'achat du plan comptable** (compte débit du journal COFI) : classes 3 et 4 hors 400 (salaires) ;
  **immobilisations 15x gardées, entité DEPOT** ; tout le reste retiré (créanciers 200, impôt à la source, AVS, prévoyance, transitoires, 52x internes, 6xx/7xx, escomptes).
- Année de rattachement = année de la **Date COFI** (`anneeComptable`). 2026 = janv.–sept. (« partielle », `anneesPartielles`).
- Les JSON `public/data/depensesFournisseurs.json` (47 Mo, **servi et chargé par fetch, JAMAIS importé dans le code** : l'embarquer fait dépasser la mémoire du build Railway) et `src/data/depensesGlobal.json` sont GÉNÉRÉS : ne pas les éditer à la main.
- Le build Railway est `tsc -b && vite build` : ne pas réimporter de gros JSON (> quelques Mo) dans `src/`.
  Régénérer avec `script/appliquer_plan_comptable_depense.py` à partir des JSON d'origine (commit `7e8f070`) + journaux (voir README).
  Journaux fournis : compilé 2025, bruts INDUNI/CONSORTIUM 2023, 2024, 2026 (clé `--aff`).
- Chantiers : nom + entité OFFICIELS dans `script/chantiers_references.json` (GC, BAT GE, BAT VD, BAT GE TRANSFO RENO, EG GE, EG VD, EG VS ; captures des dossiers virtuels).
  **BAT GE et TRANSFO RENO sont dissociés** (BAT VD TRANSFO RENO : pas encore de chantiers). Nouveau chantier : l'ajouter là, régénérer,
  puis `python3 script/generer_chantiers.py` (liste du formulaire, `src/data/chantiers.json`).
- Documents consortium sans chantier : rattachés par leur division (`script/chantiers_consortium.json`) ; division inconnue = entité AUTRES.
- 105 chantiers sans nom restants (liste dans `chantiers_sans_nom.csv` : codes internes 100/130/215/230/231, EG GE 52xxx, EG VD 42xxx…) : le propriétaire doit fournir leurs noms. Référentiel : 442 chantiers (BAT GE 110, BAT VD 136, GC 119, EG VS 23…). Conflit à trancher : 35605 = « Esplanade des Vernets » (1re liste) ou « Renaturation La Plaine » (2e liste).

## Fournisseurs : numéros multiples et exclusions
- **TROIS fournisseurs ont DEUX numéros (codes) fournisseur chacun, à garder ensemble** (fusion validée par le propriétaire ; `fournisseurAliasesDepense.json`, `"fusionner": true` ; l'autre numéro est gardé dans `nfrAlias` de la fiche) :
  1. **HGC** : `230977` « HG COMMERCIALE » (jusqu'à début 2026) + `106535292` « HGC HANDEL AG » (depuis 2026) → fiche 230977.
  2. **SINEF** : `441135527` « SINEF SA » + `411135527` « SINEF » → fiche 441135527.
  3. **Romande Energie** : `109492986` « ROMANDE ENERGI 4 » + `198271` « Romande Energie SA » → fiche 109492986.
  Si un fournisseur change de numéro, l'ajouter dans ce fichier avec `"fusionner": true`.
- Les AUTRES groupes d'alias du fichier (28) NE sont PAS fusionnés dans les données existantes (seulement pour les nouveaux documents) : validation du propriétaire requise avant.
- `fournisseurExclusionsDepense.json` doit rester COMPLET (11 nfr dont INEG Management 637079, AVS des entrepreneurs 331915, État de Vaud Emploi 10249, AFC 11733) : sinon un nouvel import les compte comme dépense.

## Format des nombres
- Séparateur de milliers = apostrophe (137'782'841), décimale = virgule : `src/lib/format.ts` (importé dans `main.tsx`) remplace l'espace fine de `toLocaleString('fr-CH')` par « ' ». Toujours utiliser `toLocaleString('fr-CH', …)` pour afficher un nombre.

## Formulaire d'évaluation (`FormulaireEvaluationTab.tsx`)
- Champ **Entité** : GC, BAT GE, BAT VD, BAT GE TRANSFO RENO, BAT VD TRANSFO RENO, EG VD, EG GE, EG VS (colonne `entite`).
- PAS de menu « Chantier (liste) » (retiré à la demande du propriétaire) : champs N° chantier et Nom avec auto-complétion (datalist) sur tous les chantiers ; saisir un n° remplit le nom et inversement (entité aussi).
- Après un enregistrement on garde entité, n° et nom du chantier (et évaluateur) ; bouton **Réinitialiser** = tout remettre à zéro.
- **Série d'évaluations par chantier** (idée du propriétaire) : dès qu'un chantier connu est saisi, la liste de ses fournisseurs s'affiche (nom, nb de factures, CA net toutes années, panier moyen — `src/data/chantierDepense.ts`) avec une **coche automatique pour ceux ≥ 10'000 CHF** (`SEUIL_EVALUATION_CHF`, modifiable à la main). « Valider la sélection » → le 1er fournisseur s'affiche dans le formulaire (famille proposée d'après sa famille d'achat), « Enregistrer et suivant → » enregistre et passe au suivant (« Passer ce fournisseur » sans enregistrer), jusqu'au message **« Vous avez terminé l'évaluation fournisseur pour ce chantier. »**. Badge « déjà évalué » si une évaluation existe pour ce chantier + fournisseur. **Période d'analyse** du CA : année en cours par défaut (janv.–déc.), réglable de mois/année à mois/année (+ « Année précédente », « Toutes années ») ; la coche automatique ≥ 10'000 CHF s'applique au CA de la période. **Ajout d'un fournisseur à la main** (annuaire ou nom libre, ex. consortium) : ligne « ajouté à la main », cochée d'office. Le mode manuel (bouton « Choisir… ») reste disponible.

## Navigation et droits (titre « Dashboard Achats »)
- Sections du haut (`SECTIONS` dans `src/data/permissions.ts`, une section est visible si au moins une sous-section l'est) :
  **Évaluation** (Vue d'ensemble, Par secteur, Comparaison par secteur, Blacklist, Zoom fournisseur évaluation, Formulaire d'évaluation) ;
  **Analyse Dépense** (Analyse de la dépense, Analyse chantier, Consortium, Zoom fournisseur) ; **Suivi BFA** (vide, en attendant les instructions) ; **Administration** (admin seulement).
- Un droit par sous-section (`profiles.can_view_*`). Administration (`AdminUsersTab`) : case par section (tout/rien/partiel) + case par sous-section + « Tout cocher / décocher » ; fonctionnalités en pause dans un bloc replié.
- Nouveaux droits (zoom évaluation, chantiers, zoom fournisseur, BFA) = colonnes ajoutées par `supabase/migration_permissions_sections.sql` (À LANCER à la main). Tant qu'elle n'est pas lancée : repli sur l'ancien droit (zoom évaluation ← vue d'ensemble ; chantier et zoom fournisseur ← analyse de la dépense ; BFA ← admin seulement). L'Edge Function `admin-users` (liste `PERMISSION_FIELDS`) est à redéployer pour que la création de compte prenne ces droits.
- Un clic sur un nom de fournisseur ouvre le zoom complet seulement avec le droit « Zoom fournisseur », sinon le zoom évaluation.
- **Analyse chantier** (`ChantiersTab.tsx` + `DepenseCharts.tsx`) : filtres entité / chantier / année / fournisseur — le filtre chantier est le MÊME que dans le formulaire d'évaluation (champs « N° chantier » et « Nom du chantier » liés, avec auto-complétion ; choisir un chantier règle aussi l'entité) ;
  sections : par mois et par année (+ ligne « % par mois » sur les ANNÉES PLEINES seulement, 2026 exclu), par fournisseur (année ou trimestre, avec % de l'année/du trimestre),
  Pareto, Top 20, typologie de fournisseurs (famille d'achat), par chantier (année en cours par défaut). Graphiques SVG ; **chaque tableau a un bouton « ⬇ Excel »** (`src/lib/exportExcel.ts`, lib `xlsx`, chargée à la demande).
  Entités affichées via `entiteLabel` (DG = « Direction Générale », DEPOT = « Dépôt », AUTRES = « Autres »).

## Analyse de la dépense (`DepenseTab.tsx`) : filtres, camemberts, Excel
- Les filtres Entité ET Année s'appliquent à TOUTES les sections (par année, par entité, par famille, par chantier, tranches de factures, Top 20, groupes), recalculées depuis les documents (`entrees`).
- « Dépense par entité » masquée quand une entité est choisie ; « Dépense par année » masquée quand une année est choisie ; « Top 20 groupes » masqué quand une entité est choisie (les fournisseurs de chaque groupe sont écrits en tout petit sous son nom).
- **Camemberts en mode Pareto** (`Camembert` dans `DepenseCharts.tsx`) : éléments jusqu'à 80 % du total, le reste regroupé en « Autres (n) » ; pas de regroupement pour les tranches de factures. Bouton « ⬇ Excel » sur chaque tableau.
- Histogramme mensuel (Analyse chantier) : cliquer une barre, une année de la légende ou une ligne du tableau zoome sur cette année ; recliquer ou « Toutes les années » revient.

## Dashboard évaluation — Vue d'ensemble (`OverviewHeader.tsx`, maquette papier du propriétaire)
- En-tête « Dashboard évaluation <année> » (titre centré) : 4 tuiles de même taille (fournisseurs évalués, nombre d'évaluations, moyenne globale, périmètre évalué en CHF) ; chacune avec « <année-1> : … » dessous ET l'évolution signée (+/−, vert/rouge) à côté du chiffre. Boutons de secteurs tous de même taille.
  L'année = fin de période (`anneeMax`) ; par défaut la dernière année (2025) ; tuiles calculées à filtres identiques hors période.
- Secteurs en boutons multi-sélection : GC, BAT GE (y c. TRANSFO RENO), BAT VD, « EG GE / EG VD » (UN seul secteur `EG GE/VD` dans l'historique d'évaluation : non séparable), EG VS.
- « Par année » : boutons 2017→2025 (2020 inclus : il y a des données) + « Période de … à … » ; « Par fournisseur » (recherche) ; « Par type » (menu déroulant). Note/CFC dans « Filtres avancés ».
- **« Moyenne par critère » masquée** sauf si un type OU un fournisseur est filtré (onglet « Par secteur » inchangé).
