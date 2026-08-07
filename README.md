# SLA — Séance de lancement achats

Application web pour documenter, lors des séances de passation achat (transition
phase soumission → phase exécution d'un chantier), toutes les informations
nécessaires au lancement des achats et pour en assurer le suivi jusqu'à
livraison. Structure calquée sur le modèle interne « Lancement Achats
Chantier » (Fiche chantier / Checklist documents / Suivi HA).

- **1. Fiche chantier** : identification, interlocuteurs et disponibilités,
  contrat/budget/conditions commerciales, planning et jalons, logistique
  chantier, particularités/risques/urgences — plus des indicateurs (lots
  renseignés, lots urgents, lots à compléter, documents en attente).
- **2. Checklist documents** : liste des documents et données d'entrée
  nécessaires (contrat, budget, plans, rapports, planning, logistique, achats),
  pré-remplie automatiquement à la création d'un dossier, avec statut de
  disponibilité.
- **3. Suivi HA** : une ligne par lot/CFC (priorité, acheteur, responsable
  travaux, budget, quantités, dates de consultation/commande/livraison,
  statut), avec calculs automatiques (budget net cible, écart budget, jours
  avant livraison, alerte de délai, contrôle de complétude) — identiques à la
  logique du fichier Excel de référence.

Les données sont partagées entre tous les participants via une base
[Supabase](https://supabase.com) (Postgres hébergé) — pas de compte/connexion
requis, l'outil est prévu pour un usage interne.

## Stack

React + TypeScript + Vite + Tailwind CSS, client Supabase (`@supabase/supabase-js`).
Aucun backend applicatif : le frontend communique directement avec Supabase via
sa clé publique (`anon key`).

## Installation

```bash
npm install
cp .env.example .env
```

### Configurer Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (gratuit).
2. Dans **SQL Editor**, exécuter le contenu de [`supabase/schema.sql`](supabase/schema.sql)
   pour créer les tables `dossiers`, `checklist_items` et `lots`. Ce script
   supprime puis recrée ces tables (`drop table` + `create table`) : à
   relancer après une mise à jour du schéma, en sachant que ça efface les
   dossiers existants.
3. Dans **Project Settings → API**, copier :
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
4. Renseigner ces deux valeurs dans `.env`.

> Les policies RLS du schéma autorisent tout accès via la clé `anon` (outil
> interne sans authentification). Si l'accès doit être restreint à l'avenir,
> ajouter une authentification Supabase et remplacer les policies par des
> règles basées sur `auth.uid()`.

## Développement

```bash
npm run dev
```

## Build de production

```bash
npm run build
```

Le résultat dans `dist/` est un site statique déployable sur n'importe quel
hébergeur (Vercel, Netlify, GitHub Pages…) — il continuera à parler à Supabase
via les variables d'environnement injectées au build.
