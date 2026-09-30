-- Migration additive : ajoute toute colonne manquante sur les tables existantes (dossiers,
-- lots, checklist_items, evaluations) sans jamais rien supprimer ni écraser de données —
-- comble le décalage entre schema.sql (à jour) et une base créée avec une version plus
-- ancienne du schéma (ex. erreur "Could not find the 'fournisseur_choisi' column").
-- Chaque instruction est idempotente (IF NOT EXISTS) : sans danger à rejouer plusieurs fois.
-- À exécuter dans le SQL Editor de Supabase (SQL Editor > New query > Run).

alter table dossiers add column if not exists numero_chantier text not null default '';
alter table dossiers add column if not exists adresse text not null default '';
alter table dossiers add column if not exists client text not null default '';
alter table dossiers add column if not exists fiche jsonb not null default '{}';
alter table dossiers add column if not exists created_at timestamptz not null default now();
alter table dossiers add column if not exists updated_at timestamptz not null default now();

alter table lots add column if not exists position integer not null default 0;
alter table lots add column if not exists priorite text not null default '';
alter table lots add column if not exists cfc_code text not null default '';
alter table lots add column if not exists famille_lot text not null default '';
alter table lots add column if not exists description_technique text not null default '';
alter table lots add column if not exists acheteur text not null default '';
alter table lots add column if not exists resp_travaux text not null default '';
alter table lots add column if not exists type_achat text not null default '';
alter table lots add column if not exists mise_en_concurrence text not null default '';
alter table lots add column if not exists fournisseur_impose text not null default '';
alter table lots add column if not exists fournisseurs_a_consulter text not null default '';
alter table lots add column if not exists fournisseur_choisi text not null default '';
alter table lots add column if not exists budget_ctx numeric;
alter table lots add column if not exists budget_achat_be numeric;
alter table lots add column if not exists deduction_pct numeric;
alter table lots add column if not exists montant_commande numeric;
alter table lots add column if not exists quantite numeric;
alter table lots add column if not exists unite text not null default '';
alter table lots add column if not exists date_remise_besoin_ctx date;
alter table lots add column if not exists preparation_dossier date;
alter table lots add column if not exists lancement_consultation date;
alter table lots add column if not exists retour_offres date;
alter table lots add column if not exists choix_fournisseur date;
alter table lots add column if not exists date_commande date;
alter table lots add column if not exists premiere_livraison date;
alter table lots add column if not exists derniere_livraison date;
alter table lots add column if not exists documents_plans_necessaires text not null default '';
alter table lots add column if not exists statut text not null default '';
alter table lots add column if not exists prochaine_action text not null default '';
alter table lots add column if not exists remarques_lien text not null default '';

alter table checklist_items add column if not exists position integer not null default 0;
alter table checklist_items add column if not exists categorie text not null default '';
alter table checklist_items add column if not exists document text not null default '';
alter table checklist_items add column if not exists requis text not null default 'Oui';
alter table checklist_items add column if not exists statut text not null default 'À confirmer';
alter table checklist_items add column if not exists version_date text not null default '';
alter table checklist_items add column if not exists responsable text not null default '';
alter table checklist_items add column if not exists echeance text not null default '';
alter table checklist_items add column if not exists lien_remarque text not null default '';

alter table evaluations add column if not exists fournisseur_nom text not null default '';
alter table evaluations add column if not exists date_evaluation date;
alter table evaluations add column if not exists evaluateur text not null default '';
alter table evaluations add column if not exists critere_qualite numeric;
alter table evaluations add column if not exists critere_delais numeric;
alter table evaluations add column if not exists critere_budget numeric;
alter table evaluations add column if not exists critere_communication numeric;
alter table evaluations add column if not exists critere_documentation numeric;
alter table evaluations add column if not exists critere_securite numeric;
alter table evaluations add column if not exists critere_sav numeric;
alter table evaluations add column if not exists recommandation text not null default '';
alter table evaluations add column if not exists commentaire text not null default '';
alter table evaluations add column if not exists statut text not null default 'Brouillon';

