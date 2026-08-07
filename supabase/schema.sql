-- Schéma SLA — Séance de lancement achats
-- À exécuter dans l'éditeur SQL de votre projet Supabase (SQL Editor > New query > Run).

create extension if not exists "pgcrypto";

create table if not exists dossiers (
  id uuid primary key default gen_random_uuid(),
  numero_chantier text not null default '',
  adresse text not null default '',
  client text not null default '',
  architecte text not null default '',
  ingenieur text not null default '',
  conducteur_travaux text not null default '',
  contremaitre text not null default '',
  typologie_travaux text not null default '',
  planning_demarrage text not null default '',
  planning_fin text not null default '',
  conditions text not null default '',
  garanties text not null default '',
  deductions_contractuelles text not null default '',
  documents_disposition jsonb not null default '[]',
  particularites jsonb not null default '[]',
  acheteurs jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lots (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  categorie text not null default '',
  designation text not null default '',
  acheteur_initiales text not null default '',
  date_livraison_estimative text not null default '',
  quantite text not null default '',
  budget_pu text not null default '',
  budget_theo numeric,
  remarques text not null default '',
  suivi text not null default 'a_faire',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lots_dossier_id_idx on lots(dossier_id);

-- Accès ouvert via la clé "anon" : outil interne, pas d'authentification.
-- Si l'accès doit être restreint à l'avenir, remplacer ces policies par des règles liées à auth.uid().
alter table dossiers enable row level security;
alter table lots enable row level security;

drop policy if exists "dossiers_all" on dossiers;
create policy "dossiers_all" on dossiers for all using (true) with check (true);

drop policy if exists "lots_all" on lots;
create policy "lots_all" on lots for all using (true) with check (true);
