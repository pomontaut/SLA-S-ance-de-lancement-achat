-- Schéma SLA — Séance de lancement achats (v2 : Fiche chantier / Checklist documents / Suivi HA)
-- À exécuter dans l'éditeur SQL de votre projet Supabase (SQL Editor > New query > Run).
--
-- ATTENTION : ce script recrée les tables depuis zéro (drop + create). Si vous avez déjà
-- créé des dossiers de test avec l'ancienne version, ils seront supprimés.

create extension if not exists "pgcrypto";

drop table if exists lots cascade;
drop table if exists checklist_items cascade;
drop table if exists dossiers cascade;
drop table if exists evaluations_formulaire cascade;
drop table if exists profiles cascade;

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

-- Formulaire d'évaluation autonome (famille/critères dynamiques, indépendant d'un dossier/lot
-- précis — voir src/data/formulaireEvaluation.ts pour le jeu de critères par famille).
create table evaluations_formulaire (
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

-- Comptes utilisateurs et droits d'accès par onglet — voir src/data/permissions.ts pour le
-- mapping onglet <-> colonne, et supabase/migration_auth_profiles.sql pour les commentaires
-- détaillés (ce bloc en est la version "installation neuve", contenu identique).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  is_admin boolean not null default false,
  can_view_overview boolean not null default false,
  can_view_secteur boolean not null default false,
  can_view_comparaison boolean not null default false,
  can_view_depense boolean not null default false,
  can_view_consortium boolean not null default false,
  can_view_blacklist boolean not null default false,
  can_view_formulaire boolean not null default false,
  can_view_seance_lancement boolean not null default false,
  can_view_fournisseurs boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select email from auth.users where id = uid) = 'pomontaut@induni.ch'
    or (select p.is_admin from profiles p where p.id = uid),
    false
  );
$$;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create index lots_dossier_id_idx on lots(dossier_id);
create index checklist_items_dossier_id_idx on checklist_items(dossier_id);
create index evaluations_dossier_id_idx on evaluations(dossier_id);
create index evaluations_fournisseur_nom_idx on evaluations(fournisseur_nom);
create index evaluations_formulaire_fournisseur_nom_idx on evaluations_formulaire(fournisseur_nom);
create index evaluations_formulaire_created_at_idx on evaluations_formulaire(created_at);

-- Accès réservé aux comptes connectés (Supabase Auth) — la visibilité fine par onglet/profil est
-- gérée côté app (React) à partir de `profiles`, pas ligne par ligne ici.
alter table dossiers enable row level security;
alter table lots enable row level security;
alter table checklist_items enable row level security;
alter table evaluations enable row level security;
alter table evaluations_formulaire enable row level security;
alter table profiles enable row level security;

create policy "dossiers_authenticated" on dossiers for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "lots_authenticated" on lots for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "checklist_items_authenticated" on checklist_items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evaluations_authenticated" on evaluations for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evaluations_formulaire_authenticated" on evaluations_formulaire for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "profiles_select" on profiles for select
  using (auth.uid() = id or is_admin(auth.uid()));
create policy "profiles_update_admin_only" on profiles for update
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
