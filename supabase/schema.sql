-- Schéma SLA — Séance de lancement achats (v2 : Fiche chantier / Checklist documents / Suivi HA)
-- À exécuter dans l'éditeur SQL de votre projet Supabase (SQL Editor > New query > Run).
--
-- ATTENTION : ce script recrée les tables depuis zéro (drop + create). Si vous avez déjà
-- créé des dossiers de test avec l'ancienne version, ils seront supprimés.

create extension if not exists "pgcrypto";

drop table if exists lots cascade;
drop table if exists checklist_items cascade;
drop table if exists dossiers cascade;

create table dossiers (
  id uuid primary key default gen_random_uuid(),
  numero_chantier text not null default '',
  adresse text not null default '',
  client text not null default '',
  fiche jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lots (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  position integer not null default 0,
  priorite text not null default '',
  cfc_code text not null default '',
  famille_lot text not null default '',
  description_technique text not null default '',
  acheteur text not null default '',
  resp_travaux text not null default '',
  type_achat text not null default '',
  mise_en_concurrence text not null default '',
  fournisseur_impose text not null default '',
  fournisseurs_a_consulter text not null default '',
  fournisseur_choisi text not null default '',
  budget_ctx numeric,
  budget_achat_be numeric,
  deduction_pct numeric,
  montant_commande numeric,
  quantite numeric,
  unite text not null default '',
  date_remise_besoin_ctx date,
  preparation_dossier date,
  lancement_consultation date,
  retour_offres date,
  choix_fournisseur date,
  date_commande date,
  premiere_livraison date,
  derniere_livraison date,
  documents_plans_necessaires text not null default '',
  statut text not null default '',
  prochaine_action text not null default '',
  remarques_lien text not null default ''
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers(id) on delete cascade,
  position integer not null default 0,
  categorie text not null default '',
  document text not null default '',
  requis text not null default 'Oui',
  statut text not null default 'À confirmer',
  version_date text not null default '',
  responsable text not null default '',
  echeance text not null default '',
  lien_remarque text not null default ''
);

create table evaluations (
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

create index lots_dossier_id_idx on lots(dossier_id);
create index checklist_items_dossier_id_idx on checklist_items(dossier_id);
create index evaluations_dossier_id_idx on evaluations(dossier_id);
create index evaluations_fournisseur_nom_idx on evaluations(fournisseur_nom);

-- Accès ouvert via la clé "anon" : outil interne, pas d'authentification.
-- Si l'accès doit être restreint à l'avenir, remplacer ces policies par des règles liées à auth.uid().
alter table dossiers enable row level security;
alter table lots enable row level security;
alter table checklist_items enable row level security;
alter table evaluations enable row level security;

create policy "dossiers_all" on dossiers for all using (true) with check (true);
create policy "lots_all" on lots for all using (true) with check (true);
create policy "checklist_items_all" on checklist_items for all using (true) with check (true);
create policy "evaluations_all" on evaluations for all using (true) with check (true);
