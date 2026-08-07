# SLA — Séance de lancement achats

Application web pour documenter, lors des séances de passation achat (transition
phase soumission → phase exécution d'un chantier), le contexte du projet et la
grille des lots à acheter.

- **Contexte du chantier** : n° de chantier, adresse, client, architecte/ingénieur,
  interlocuteurs, typologie des travaux, planning, conditions contractuelles,
  garanties, documents à disposition, particularités du projet, légende des
  acheteurs.
- **Grille des achats** : lots à suivre, groupés par catégorie (BPE, armatures,
  préfabriqués, sous-traitance…), avec acheteur, date de livraison estimative,
  quantité, budget PU/théorique, remarques et statut de suivi.

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
   pour créer les tables `dossiers` et `lots`.
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
