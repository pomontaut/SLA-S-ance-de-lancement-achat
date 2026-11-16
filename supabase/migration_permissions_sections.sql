-- Migration additive : droits d'accès par section ET sous-section (Dashboard Achats) + colonne « Entité » du formulaire.
-- À exécuter dans Supabase (SQL Editor > New query > Run). Ne supprime rien, relançable sans risque :
-- chaque colonne n'est ajoutée (et initialisée) qu'une seule fois, les accès déjà réglés ne sont jamais écrasés.
-- Comptes existants : zoom évaluation = vue d'ensemble ; analyse chantier, zoom fournisseur et paiement =
-- analyse de la dépense (dont synthèse et analyse fournisseurs) ; Suivi BFA = aucun accès (sauf administrateur).

-- 1) Colonne « Entité » du formulaire d'évaluation
alter table evaluations_formulaire add column if not exists entite text not null default '';

-- 2) Droits par sous-section
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_zoom_evaluation') then
    alter table profiles add column can_view_zoom_evaluation boolean not null default false;
    update profiles set can_view_zoom_evaluation = can_view_overview;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_chantiers') then
    alter table profiles add column can_view_chantiers boolean not null default false;
    update profiles set can_view_chantiers = can_view_depense;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_zoom_fournisseur') then
    alter table profiles add column can_view_zoom_fournisseur boolean not null default false;
    update profiles set can_view_zoom_fournisseur = can_view_depense;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_bfa') then
    alter table profiles add column can_view_bfa boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_synthese') then
    alter table profiles add column can_view_synthese boolean not null default false;
    update profiles set can_view_synthese = can_view_depense;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_analyse_fournisseurs') then
    alter table profiles add column can_view_analyse_fournisseurs boolean not null default false;
    update profiles set can_view_analyse_fournisseurs = can_view_depense;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_paiement') then
    alter table profiles add column can_view_paiement boolean not null default false;
    update profiles set can_view_paiement = can_view_depense;
  end if;
end $$;

notify pgrst, 'reload schema';
