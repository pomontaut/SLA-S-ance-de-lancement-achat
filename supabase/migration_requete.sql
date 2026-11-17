-- Migration additive : droit « Requête » (Analyse Dépense > 🔎 Requête). Relançable sans risque.
-- Comptes existants : même accès que « Analyse fournisseurs ».
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_requete') then
    alter table profiles add column can_view_requete boolean not null default false;
    update profiles set can_view_requete = can_view_analyse_fournisseurs;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Droit « Analyse contrat » (Analyse Dépense > 📑 Analyse contrat). Même repli : accès d'« Analyse fournisseurs ».
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'can_view_contrats') then
    alter table profiles add column can_view_contrats boolean not null default false;
    update profiles set can_view_contrats = can_view_analyse_fournisseurs;
  end if;
end $$;

notify pgrst, 'reload schema';
