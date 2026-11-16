-- Migration additive : droits d'accès par section ET sous-section (Dashboard Achats).
-- Nouvelles sous-sections : Zoom fournisseur évaluation, Analyse chantier, Zoom fournisseur (dépense), Suivi BFA.
-- À exécuter UNE fois dans Supabase (SQL Editor > New query > Run). Ne supprime rien ; les comptes existants
-- gardent l'équivalent de leurs accès actuels (zoom évaluation = vue d'ensemble ; chantier et zoom fournisseur =
-- analyse de la dépense ; Suivi BFA = aucun accès sauf administrateur). Relancer le script est sans effet.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_chantiers'
  ) then
    alter table profiles add column can_view_zoom_evaluation boolean not null default false;
    alter table profiles add column can_view_chantiers boolean not null default false;
    alter table profiles add column can_view_zoom_fournisseur boolean not null default false;
    alter table profiles add column can_view_bfa boolean not null default false;

    update profiles set
      can_view_zoom_evaluation = can_view_overview,
      can_view_chantiers = can_view_depense,
      can_view_zoom_fournisseur = can_view_depense;
  end if;
end $$;

notify pgrst, 'reload schema';
