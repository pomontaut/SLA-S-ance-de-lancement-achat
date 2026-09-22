-- Migration additive : ajoute la table du "Formulaire d'évaluation" sans toucher aux tables
-- existantes (dossiers, lots, checklist_items, evaluations). À exécuter une fois dans l'éditeur
-- SQL de votre projet Supabase (SQL Editor > New query > Run) sur un projet déjà en place —
-- contrairement à schema.sql, ce script NE supprime AUCUNE donnée existante.
--
-- Si vous créez le projet Supabase depuis zéro, schema.sql (à jour) suffit et inclut déjà cette
-- table : ce fichier n'est utile que pour mettre à jour un projet existant sans le réinitialiser.

create table if not exists evaluations_formulaire (
  id uuid primary key default gen_random_uuid(),
  famille text not null default '',
  fournisseur_id bigint,
  fournisseur_nom text not null default '',
  numero_chantier text not null default '',
  nom_chantier text not null default '',
  criteres jsonb not null default '{}',
  moyenne numeric,
  remarques text not null default '',
  evaluateur text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists evaluations_formulaire_fournisseur_nom_idx on evaluations_formulaire(fournisseur_nom);
create index if not exists evaluations_formulaire_created_at_idx on evaluations_formulaire(created_at);

alter table evaluations_formulaire enable row level security;

drop policy if exists "evaluations_formulaire_all" on evaluations_formulaire;
create policy "evaluations_formulaire_all" on evaluations_formulaire for all using (true) with check (true);
