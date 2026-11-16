-- Migration additive : ajoute la colonne « entite » (GC, BAT GE, BAT VD, EG VD, EG GE, EG VS) au
-- Formulaire d'évaluation. À exécuter une fois dans Supabase (SQL Editor > New query > Run).
-- Ne supprime aucune donnée ; les évaluations déjà saisies gardent une entité vide.

alter table evaluations_formulaire add column if not exists entite text not null default '';

notify pgrst, 'reload schema';
