import { type TransactionSql } from 'postgres';

import { type LogFn } from './migrations-runner.js';

/** `[table dépendante, colonne de clé étrangère vers table.id]`. */
type Dependent = readonly [string, string];

/** Table de contenu seedée, avec sa table de traductions, ses liaisons éventuelles et leur clé. */
interface SeededEntity {
  table: string;
  /** Table de traductions (chaque entité en a une) : contrôle `fr` et convergence. */
  translations: Dependent;
  /** Autres tables dépendantes (liaisons compétences) : convergence seule. */
  links: readonly Dependent[];
  /** `false` pour `profile` : ligne unique sans slug. */
  hasSlug: boolean;
}

/** Tables de contenu dont les seeds sont la source de vérité (docs/01). */
const SEEDED_ENTITIES: readonly SeededEntity[] = [
  {
    table: 'profile',
    translations: ['profile_translations', 'profile_id'],
    links: [],
    hasSlug: false,
  },
  {
    table: 'social_links',
    translations: ['social_links_translations', 'social_link_id'],
    links: [],
    hasSlug: true,
  },
  {
    table: 'skill_groups',
    translations: ['skill_groups_translations', 'skill_group_id'],
    links: [],
    hasSlug: true,
  },
  { table: 'skills', translations: ['skills_translations', 'skill_id'], links: [], hasSlug: true },
  {
    table: 'experiences',
    translations: ['experiences_translations', 'experience_id'],
    links: [['experience_skills', 'experience_id']],
    hasSlug: true,
  },
  {
    table: 'projects',
    translations: ['projects_translations', 'project_id'],
    links: [['project_skills', 'project_id']],
    hasSlug: true,
  },
  { table: 'tools', translations: ['tools_translations', 'tool_id'], links: [], hasSlug: true },
  {
    table: 'resources',
    translations: ['resources_translations', 'resource_id'],
    links: [],
    hasSlug: true,
  },
  {
    table: 'certifications',
    translations: ['certifications_translations', 'certification_id'],
    links: [],
    hasSlug: true,
  },
  {
    table: 'education',
    translations: ['education_translations', 'education_id'],
    links: [],
    hasSlug: true,
  },
  {
    table: 'languages',
    translations: ['languages_translations', 'language_id'],
    links: [],
    hasSlug: true,
  },
];

/**
 * Fait converger la base vers le contenu des seeds, dans la transaction qui vient de les exécuter.
 *
 * Les seeds sont des `insert … on conflict do update` : chaque ligne qu'ils mentionnent est écrite
 * (nouvelle version de ligne, même sans changement de valeur) par la transaction courante, donc
 * son `xmin` est l'identifiant de cette transaction. Une ligne dépendante (traduction, liaison
 * compétence) d'une entité que les seeds viennent d'écrire, et que les seeds n'ont PAS écrite, a
 * été retirée des fichiers : elle est supprimée. Sans cela, une liaison ou une traduction retirée
 * d'un seed resterait en production indéfiniment.
 *
 * Les entités elles-mêmes (lignes parentes) retirées des fichiers ne sont pas supprimées : leur
 * politique (suppression ou dépublication) reste à trancher ; elles sont seulement signalées.
 * Une table dont aucune ligne n'est écrite par les seeds (projets, outils, ressources tant qu'ils
 * n'ont pas de seed) n'est pas touchée.
 */
export async function convergeToSeeds(tx: TransactionSql, log: LogFn): Promise<void> {
  for (const entity of SEEDED_ENTITIES) {
    for (const [child, foreignKey] of [entity.translations, ...entity.links]) {
      const removed = await tx`
        delete from ${tx(child)} c using ${tx(entity.table)} p
        where c.${tx(foreignKey)} = p.id
          and p.xmin = pg_current_xact_id()::xid
          and not (c.xmin = pg_current_xact_id()::xid)
        returning 1`;
      if (removed.count > 0) {
        log(`${child} : ${removed.count} ligne(s) absente(s) des seeds supprimée(s)`);
      }
    }

    if (entity.hasSlug) {
      const absent = await tx<{ slug: string }[]>`
        select p.slug from ${tx(entity.table)} p
        where not (p.xmin = pg_current_xact_id()::xid)
          and exists (select 1 from ${tx(entity.table)} q where q.xmin = pg_current_xact_id()::xid)
        order by p.slug`;
      if (absent.length > 0) {
        log(
          `ATTENTION ${entity.table} : ${absent.length} ligne(s) absente(s) des seeds, conservée(s) ` +
            `en base (${absent.map((row) => row.slug).join(', ')})`,
        );
      }
    }
  }
}

/**
 * Contrôle de fin de seed : chaque ligne publiée a une traduction `fr`, et le profil aussi. Sans
 * traduction `fr`, une ligne publiée disparaîtrait silencieusement de toutes les réponses (la
 * jointure `fr` est interne) : mieux vaut arrêter le déploiement.
 */
export async function assertFrenchTranslations(tx: TransactionSql): Promise<void> {
  const missing: string[] = [];
  for (const entity of SEEDED_ENTITIES) {
    const [translationTable, foreignKey] = entity.translations;
    const rows = await tx<{ label: string }[]>`
      select ${entity.hasSlug ? tx`p.slug` : tx`'profil'`}::text as label
      from ${tx(entity.table)} p
      where ${entity.hasSlug ? tx`p.published` : tx`true`}
        and not exists (
          select 1 from ${tx(translationTable)} t
          where t.${tx(foreignKey)} = p.id and t.locale = 'fr')
      order by 1`;
    for (const row of rows) {
      missing.push(`${entity.table}/${row.label}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Traduction fr manquante (la ligne disparaîtrait de l'API) : ${missing.join(', ')}.`,
    );
  }
}
