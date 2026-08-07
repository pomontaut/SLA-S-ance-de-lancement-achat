-- Migration additive : ajoute l'évaluation fournisseur sans toucher aux données existantes.
-- À exécuter dans le SQL Editor de Supabase si votre base contient déjà des dossiers.

alter table lots add column if not exists fournisseur_choisi text not null default '';

create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  lot_id uuid references lots(id) on delete set null,
  fournisseur_nom text not null default '',
  date_evaluation date,
  evaluateur text not null default '',
  critere_qualite numeric,
  critere_delais numeric,
  critere_budget numeric,
  critere_communication numeric,
  critere_documentation numeric,
  critere_securite numeric,
  critere_sav numeric,
  recommandation text not null default '',
  commentaire text not null default '',
  statut text not null default 'Brouillon'
);

create index if not exists evaluations_dossier_id_idx on evaluations(dossier_id);
create index if not exists evaluations_fournisseur_nom_idx on evaluations(fournisseur_nom);

alter table evaluations enable row level security;

drop policy if exists "evaluations_all" on evaluations;
create policy "evaluations_all" on evaluations for all using (true) with check (true);
