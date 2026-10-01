-- Migration additive : authentification (Supabase Auth) + profils avec droits d'accès par onglet.
-- Ne touche à aucune donnée existante — ajoute une nouvelle table `profiles` liée à `auth.users`
-- et resserre les policies des tables existantes (qui étaient ouvertes à tout le monde, y compris
-- sans connexion) pour exiger désormais un compte connecté.
-- À exécuter dans le SQL Editor de Supabase (SQL Editor > New query > Run).

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  is_admin boolean not null default false,
  -- Un droit par onglet/sous-onglet de l'app — voir src/data/permissions.ts pour le mapping.
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

-- Compte admin permanent : reste administrateur même si sa ligne `profiles` est mal configurée ou
-- absente (même filet de sécurité que PERMANENT_ADMIN_EMAILS côté ESHOP-INDUNI).
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

-- Crée automatiquement une ligne `profiles` (sans aucun droit) à la création d'un compte —
-- un administrateur doit ensuite cocher les onglets voulus dans l'écran "Administration".
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

alter table profiles enable row level security;

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  using (auth.uid() = id or is_admin(auth.uid()));

drop policy if exists "profiles_update_admin_only" on profiles;
create policy "profiles_update_admin_only" on profiles for update
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- Rattrapage pour les comptes déjà créés AVANT l'existence de cette table (le trigger
-- on_auth_user_created ne déclenche que sur les nouvelles inscriptions) : sans cette ligne, un
-- compte plus ancien n'a aucune ligne `profiles` tant qu'il ne se réinscrit pas.
insert into public.profiles (id, email)
select id, email from auth.users
where id not in (select id from public.profiles);

-- Resserre l'accès aux tables existantes : connexion requise (n'importe quel compte), au lieu
-- d'un accès totalement libre. La visibilité fine par onglet/profil est gérée côté app (React),
-- pas ligne par ligne ici — cf. la demande initiale ("rendre les onglets visibles ou non").
-- Chaque bloc est protégé par to_regclass() : si une de ces tables n'existe pas encore sur votre
-- projet (ex. jamais utilisé "Suivi HA"), il est simplement ignoré au lieu de faire échouer tout
-- le script (Supabase exécute ce script en une seule transaction : une erreur annule tout).
do $$
begin
  if to_regclass('public.dossiers') is not null then
    execute 'drop policy if exists "dossiers_all" on dossiers';
    execute $policy$create policy "dossiers_authenticated" on dossiers for all
      using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated')$policy$;
  end if;

  if to_regclass('public.lots') is not null then
    execute 'drop policy if exists "lots_all" on lots';
    execute $policy$create policy "lots_authenticated" on lots for all
      using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated')$policy$;
  end if;

  if to_regclass('public.checklist_items') is not null then
    execute 'drop policy if exists "checklist_items_all" on checklist_items';
    execute $policy$create policy "checklist_items_authenticated" on checklist_items for all
      using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated')$policy$;
  end if;

  if to_regclass('public.evaluations') is not null then
    execute 'drop policy if exists "evaluations_all" on evaluations';
    execute $policy$create policy "evaluations_authenticated" on evaluations for all
      using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated')$policy$;
  end if;

  if to_regclass('public.evaluations_formulaire') is not null then
    execute 'drop policy if exists "evaluations_formulaire_all" on evaluations_formulaire';
    execute $policy$create policy "evaluations_formulaire_authenticated" on evaluations_formulaire for all
      using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated')$policy$;
  end if;
end $$;

-- Après avoir exécuté ce script : Authentication > Providers > Email doit être activé (c'est le
-- cas par défaut) et Authentication > Settings > "Confirm email" décidera si un nouveau compte
-- doit confirmer son adresse avant de se connecter. Les nouveaux comptes créés (inscription libre
-- dans l'app, restreinte aux adresses @induni.ch) n'ont AUCUN droit par défaut : un administrateur
-- doit leur cocher les onglets voulus dans "Administration" une fois leur compte créé.
