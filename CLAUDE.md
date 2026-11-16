# SLA — Séance de lancement achats / Dashboard Évaluation Fournisseur (Induni & Cie SA)

App React + Vite + Supabase (Auth + Postgres) hébergée sur Railway (projet `beneficial-curiosity`/`SLA-S-ance-de-lancement-achat`).
Propriétaire : Pierre-Olivier Montaut (français, direct). Réponses en français, courtes.

## Déploiement
- Railway suit la branche **`claude/dossier-seance-lancement-achat-i3mela`** (déploiement auto au push). Il n'y a PAS de branche `main`.
- Avant de pousser : `NODE_OPTIONS=--max-old-space-size=6000 npx tsc --noEmit -p .` (tsc sans cette option manque de mémoire à cause des gros JSON).
- Les scripts SQL de `supabase/` ne sont PAS appliqués automatiquement : le propriétaire les lance à la main (Supabase > SQL Editor).
  En attente : `alter table evaluations_formulaire add column if not exists entite text not null default ''; notify pgrst, 'reload schema';`

## Analyse de la dépense (règles décidées avec le propriétaire)
- La dépense = **charges d'achat du plan comptable** (compte débit du journal COFI) : classes 3 et 4 hors 400 (salaires) ;
  **immobilisations 15x gardées, entité DEPOT** ; tout le reste retiré (créanciers 200, impôt à la source, AVS, prévoyance, transitoires, 52x internes, 6xx/7xx, escomptes).
- Année de rattachement = année de la **Date COFI** (`anneeComptable`). 2026 = janv.–sept. (« partielle », `anneesPartielles`).
- Les JSON `src/data/depensesFournisseurs.json` / `depensesGlobal.json` sont GÉNÉRÉS : ne pas les éditer à la main.
  Régénérer avec `script/appliquer_plan_comptable_depense.py` à partir des JSON d'origine (commit `7e8f070`) + journaux (voir README).
  Journaux fournis : compilé 2025, bruts INDUNI/CONSORTIUM 2023, 2024, 2026 (clé `--aff`).
- Chantiers : nom + entité OFFICIELS dans `script/chantiers_references.json` (GC, BAT GE, BAT VD, BAT GE TRANSFO RENO, EG GE, EG VD, EG VS ; captures des dossiers virtuels).
  **BAT GE et TRANSFO RENO sont dissociés** (BAT VD TRANSFO RENO : pas encore de chantiers). Nouveau chantier : l'ajouter là, régénérer,
  puis `python3 script/generer_chantiers.py` (liste du formulaire, `src/data/chantiers.json`).
- Documents consortium sans chantier : rattachés par leur division (`script/chantiers_consortium.json`) ; division inconnue = entité AUTRES.
- 105 chantiers sans nom restants (liste dans `chantiers_sans_nom.csv` : codes internes 100/130/215/230/231, EG GE 52xxx, EG VD 42xxx…) : le propriétaire doit fournir leurs noms. Référentiel : 442 chantiers (BAT GE 110, BAT VD 136, GC 119, EG VS 23…). Conflit à trancher : 35605 = « Esplanade des Vernets » (1re liste) ou « Renaturation La Plaine » (2e liste).

## Formulaire d'évaluation (`FormulaireEvaluationTab.tsx`)
- Champ **Entité** : GC, BAT GE, BAT VD, BAT GE TRANSFO RENO, BAT VD TRANSFO RENO, EG VD, EG GE, EG VS (colonne `entite`).
- PAS de menu « Chantier (liste) » (retiré à la demande du propriétaire) : champs N° chantier et Nom avec auto-complétion (datalist) sur tous les chantiers ; saisir un n° remplit le nom et inversement (entité aussi).
- Après un enregistrement on garde entité, n° et nom du chantier (et évaluateur) ; bouton **Réinitialiser** = tout remettre à zéro.

## Onglets
- **Suivi BFA** : onglet vide (admin seulement) en attendant les instructions du propriétaire.
- **Chantiers** (sous-onglet du Dashboard, droit `canViewDepense`) : dépense par chantier (mois, année) et par fournisseur (année, trimestre).

## Dashboard évaluation — Vue d'ensemble (`OverviewHeader.tsx`, maquette papier du propriétaire)
- En-tête « Dashboard évaluation <année> » (titre centré) : 4 tuiles de même taille (fournisseurs évalués, nombre d'évaluations, moyenne globale, périmètre évalué en CHF) ; chacune avec « <année-1> : … » dessous ET l'évolution signée (+/−, vert/rouge) à côté du chiffre. Boutons de secteurs tous de même taille.
  L'année = fin de période (`anneeMax`) ; par défaut la dernière année (2025) ; tuiles calculées à filtres identiques hors période.
- Secteurs en boutons multi-sélection : GC, BAT GE (y c. TRANSFO RENO), BAT VD, « EG GE / EG VD » (UN seul secteur `EG GE/VD` dans l'historique d'évaluation : non séparable), EG VS.
- « Par année » : boutons 2017→2025 (2020 inclus : il y a des données) + « Période de … à … » ; « Par fournisseur » (recherche) ; « Par type » (menu déroulant). Note/CFC dans « Filtres avancés ».
- **« Moyenne par critère » masquée** sauf si un type OU un fournisseur est filtré (onglet « Par secteur » inchangé).
