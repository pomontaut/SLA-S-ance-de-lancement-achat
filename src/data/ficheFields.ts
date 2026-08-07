export type FicheFieldType = 'text' | 'textarea' | 'date'

export interface FicheField {
  key: string
  label: string
  type: FicheFieldType
}

export interface FicheSection {
  id: string
  title: string
  fields: FicheField[]
}

export const FICHE_SECTIONS: FicheSection[] = [
  {
    id: 'identification',
    title: '1. Identification du chantier',
    fields: [
      { key: 'nomChantier', label: 'Nom du chantier', type: 'text' },
      { key: 'sectionCentre', label: 'Section / centre', type: 'text' },
      { key: 'dateSeance', label: 'Date de la séance', type: 'date' },
      { key: 'adresseRue', label: 'Adresse – rue', type: 'text' },
      { key: 'npa', label: 'NPA', type: 'text' },
      { key: 'villeCanton', label: 'Ville / canton', type: 'text' },
      { key: 'emailChantier', label: 'Email exclusif chantier', type: 'text' },
      { key: 'typeTravaux', label: 'Type / typologie des travaux', type: 'text' },
      { key: 'descriptionSynthetique', label: 'Description synthétique', type: 'textarea' },
      { key: 'maitreOuvrage', label: 'Maître d’ouvrage', type: 'text' },
      { key: 'entrepriseTotaleGenerale', label: 'Entreprise totale / générale', type: 'text' },
      { key: 'architecte', label: 'Architecte', type: 'text' },
      { key: 'ingenieurCivil', label: 'Ingénieur civil', type: 'text' },
      { key: 'autresMandataires', label: 'Autres mandataires', type: 'text' },
      { key: 'referenceEdp', label: 'Référence EDP', type: 'text' },
      { key: 'referenceExe', label: 'Référence EXE / dossier travaux', type: 'text' },
    ],
  },
  {
    id: 'interlocuteurs',
    title: '2. Interlocuteurs et disponibilités',
    fields: [
      { key: 'conducteurTravaux', label: 'Conducteur·trice travaux', type: 'text' },
      { key: 'conducteurContact', label: 'Email / téléphone conducteur', type: 'text' },
      { key: 'responsableExecution', label: 'Responsable exécution', type: 'text' },
      { key: 'responsableExecutionContact', label: 'Email / téléphone resp. exécution', type: 'text' },
      { key: 'contremaitre', label: 'Contremaître', type: 'text' },
      { key: 'contremaitreContact', label: 'Email / téléphone contremaître', type: 'text' },
      { key: 'acheteurProjet', label: 'Acheteur projet', type: 'text' },
      { key: 'acheteurProjetContact', label: 'Email / téléphone acheteur', type: 'text' },
      { key: 'absencesPrevues', label: 'Absences prévues / dates', type: 'text' },
      { key: 'backup', label: 'Back-up', type: 'text' },
      { key: 'personnesAInviter', label: 'Personnes à inviter à la séance', type: 'text' },
      { key: 'autresContacts', label: 'Autres contacts', type: 'text' },
    ],
  },
  {
    id: 'contrat',
    title: '3. Contrat, budget et conditions commerciales',
    fields: [
      { key: 'typeContrat', label: 'Type de contrat', type: 'text' },
      { key: 'montantMarche', label: 'Montant du marché (CHF)', type: 'text' },
      { key: 'prixRevisable', label: 'Prix révisable ?', type: 'text' },
      { key: 'deductionsContractuellesPct', label: 'Déductions contractuelles (%)', type: 'text' },
      { key: 'garantieExecutionPct', label: 'Garantie d’exécution (%)', type: 'text' },
      { key: 'garantieRetenuePct', label: 'Garantie de retenue (%)', type: 'text' },
      { key: 'dureeGarantieAns', label: 'Durée garantie (ans)', type: 'text' },
      { key: 'penalitesConditions', label: 'Pénalités / conditions', type: 'text' },
      { key: 'prixBloques', label: 'Prix bloqués / renchérissement', type: 'text' },
      { key: 'transportInclus', label: 'Transport inclus ?', type: 'text' },
      { key: 'aciersInclus', label: 'Aciers inclus ?', type: 'text' },
      { key: 'conditionsPaiement', label: 'Conditions de paiement', type: 'text' },
      { key: 'entrepriseImposee', label: 'Entreprise / fournisseur imposé', type: 'text' },
      { key: 'miseEnConcurrenceInterdite', label: 'Mise en concurrence interdite ?', type: 'text' },
      { key: 'lotsHorsPerimetre', label: 'Lots hors périmètre INDUNI', type: 'text' },
      { key: 'autresClausesAchats', label: 'Autres clauses achats', type: 'text' },
    ],
  },
  {
    id: 'planning',
    title: '4. Planning et jalons',
    fields: [
      { key: 'demarrageInstallation', label: 'Démarrage installation', type: 'text' },
      { key: 'demarrageTravaux', label: 'Démarrage travaux / GO', type: 'text' },
      { key: 'finTravaux', label: 'Fin des travaux / GO', type: 'text' },
      { key: 'dureeMois', label: 'Durée (mois)', type: 'text' },
      { key: 'plansMisAJourAttendus', label: 'Plans mis à jour attendus', type: 'text' },
      { key: 'dateLimiteConsultations', label: 'Date limite premières consultations', type: 'text' },
      { key: 'dateLimiteCommandes', label: 'Date limite premières commandes', type: 'text' },
      { key: 'jalonsPhases', label: 'Jalons / phases', type: 'text' },
      { key: 'grueMontage', label: 'Grue – montage / disponibilité', type: 'text' },
      { key: 'centraleBetonPlanning', label: 'Centrale à béton', type: 'text' },
      { key: 'phasage', label: 'Phasage à considérer', type: 'text' },
      { key: 'contraintesArret', label: 'Contraintes d’arrêt / horaires', type: 'text' },
    ],
  },
  {
    id: 'logistique',
    title: '5. Logistique chantier',
    fields: [
      { key: 'accesChantier', label: 'Accès chantier', type: 'text' },
      { key: 'restrictionsCamions', label: 'Restrictions camions', type: 'text' },
      { key: 'marcheArriereEssieux', label: 'Marche arrière / essieux dirigeables', type: 'text' },
      { key: 'autorisationLivraison', label: 'Autorisation / créneaux livraison', type: 'text' },
      { key: 'stockage', label: 'Stockage', type: 'text' },
      { key: 'zoneDechargement', label: 'Zone de déchargement', type: 'text' },
      { key: 'moyenLevage', label: 'Moyen de levage disponible', type: 'text' },
      { key: 'grueDechargement', label: 'Grue pour déchargement', type: 'text' },
      { key: 'centraleBeton', label: 'Centrale béton', type: 'text' },
      { key: 'bennesDechets', label: 'Bennes / déchets gérés par', type: 'text' },
      { key: 'doubleFret', label: 'Double fret / retour charge', type: 'text' },
      { key: 'voieFerreeAutre', label: 'Voie ferrée / autre', type: 'text' },
      { key: 'adresseLivraison', label: 'Adresse exacte de livraison', type: 'text' },
      { key: 'contactLivraison', label: 'Contact livraison', type: 'text' },
      { key: 'planInstallationChantier', label: 'Plan d’installation chantier (PIC)', type: 'text' },
      { key: 'autresContraintesLogistiques', label: 'Autres contraintes logistiques', type: 'text' },
    ],
  },
  {
    id: 'particularites',
    title: '6. Particularités, risques et urgences',
    fields: [
      { key: 'urgencesAchats', label: 'Urgences achats', type: 'textarea' },
      { key: 'particularitesTechniques', label: 'Particularités techniques', type: 'textarea' },
      { key: 'risquesEnvironnementaux', label: 'Risques environnementaux / pollution', type: 'textarea' },
      { key: 'traitementsSpecifiques', label: 'Traitements spécifiques', type: 'textarea' },
      { key: 'variantesAChiffrer', label: 'Variantes à chiffrer', type: 'textarea' },
      { key: 'elementsPrefabriques', label: 'Éléments préfabriqués', type: 'textarea' },
      { key: 'interfacesPrestationsTierces', label: 'Interfaces / prestations tierces', type: 'textarea' },
      { key: 'decisionsASeance', label: 'Décisions à prendre en séance', type: 'textarea' },
      { key: 'informationsManquantesBloquantes', label: 'Informations manquantes bloquantes', type: 'textarea' },
      { key: 'actionsAvantLancement', label: 'Actions avant lancement', type: 'text' },
      { key: 'responsableActions', label: 'Responsable des actions', type: 'text' },
      { key: 'echeanceActions', label: 'Échéance', type: 'date' },
    ],
  },
]
