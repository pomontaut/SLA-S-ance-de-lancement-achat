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
[Supabase](https://supabase.com) (Postgres hébergé). Accès réservé aux comptes
`@induni.ch` (connexion requise), avec des droits par onglet configurables par
un administrateur — voir « Authentification et droits d'accès » ci-dessous.

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

## Authentification et droits d'accès

L'app est protégée par Supabase Auth (e-mail/mot de passe, comptes `@induni.ch`
uniquement). Chaque compte a une ligne dans la table `profiles`, créée
automatiquement à l'inscription, avec un droit booléen par onglet/sous-onglet
(tous à `false` par défaut) — voir [`src/data/permissions.ts`](src/data/permissions.ts)
pour le mapping onglet ↔ colonne.

- **Premier démarrage** : si vous créez le projet Supabase depuis zéro,
  `schema.sql` inclut déjà la table `profiles` et ses policies. Sur un projet
  existant, exécutez plutôt [`supabase/migration_auth_profiles.sql`](supabase/migration_auth_profiles.sql)
  (additif, ne touche à aucune donnée existante).
- **Compte administrateur permanent** : `pomontaut@induni.ch` est toujours
  administrateur (voit tout, accède à l'écran Administration), même si sa
  ligne `profiles` est mal configurée — même principe que ESHOP-INDUNI.
- **Nouveaux comptes** : inscription libre depuis l'écran de connexion,
  restreinte aux adresses `@induni.ch`. Un nouveau compte ne voit **aucun**
  onglet tant qu'un administrateur ne lui a pas coché les droits voulus dans
  l'onglet « Administration ».
- Les tables `dossiers`/`lots`/`checklist_items`/`evaluations`/
  `evaluations_formulaire` exigent désormais un compte connecté (n'importe
  lequel) — la visibilité fine par onglet est gérée côté app, pas en RLS
  ligne par ligne.

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
