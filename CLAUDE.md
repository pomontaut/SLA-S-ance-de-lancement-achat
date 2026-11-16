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
- ~190 chantiers (anciens/internes : 100, 130, 215, 230, 62209, 62210, 52102…) n'ont pas de nom : le propriétaire doit fournir leurs noms.

## Formulaire d'évaluation (`FormulaireEvaluationTab.tsx`)
- Champ **Entité** : GC, BAT GE, BAT VD, BAT GE TRANSFO RENO, BAT VD TRANSFO RENO, EG VD, EG GE, EG VS (colonne `entite`).
- Liste déroulante de TOUS les chantiers (« numéro - nom », groupés par entité) ; saisir un n° remplit le nom et inversement (entité aussi).
- Après un enregistrement on garde entité, n° et nom du chantier (et évaluateur) ; bouton **Réinitialiser** = tout remettre à zéro.

## Onglets
- **Suivi BFA** : onglet vide (admin seulement) en attendant les instructions du propriétaire.
- **Chantiers** (sous-onglet du Dashboard, droit `canViewDepense`) : dépense par chantier (mois, année) et par fournisseur (année, trimestre).
