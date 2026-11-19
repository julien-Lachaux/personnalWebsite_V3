import { type Sql, type TransactionSql } from 'postgres';

import { type LogFn } from './migrations-runner.js';

/** `[table dépendante, colonne de clé étrangère vers table.id]`. */
type Dependent = readonly [string, string];

/** Table de contenu seedée, avec sa table de traductions, ses liaisons éventuelles et leur clé. */
export type SeededEntity = {
  table: string;
  /** Table de traductions (chaque entité en a une) : contrôle `fr` et convergence. */
  translations: Dependent;
  /** Autres tables dépendantes (liaisons compétences) : convergence seule. */
  links: readonly Dependent[];
} & (
  | { hasSlug: true }
  /** Ligne unique sans slug (`profile`, `ai_overview`) : `label` la nomme dans les messages. */
  | { hasSlug: false; label: string }
);

/** Fragment SQL qui nomme la ligne `p` de l'entité dans les messages : son slug, ou son libellé fixe. */
export function entityLabel(sql: Sql | TransactionSql, entity: SeededEntity) {
  return entity.hasSlug ? sql`p.slug` : sql`${entity.label}`;
}

/** Tables de contenu dont les seeds sont la source de vérité (docs/01). */
export const SEEDED_ENTITIES: readonly SeededEntity[] = [
  {
    table: 'profile',
    translations: ['profile_translations', 'profile_id'],
    links: [],
    hasSlug: false,
    label: 'profil',
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
  {
    table: 'recommendations',
    translations: ['recommendations_translations', 'recommendation_id'],
    links: [],
    hasSlug: true,
  },
  {
    table: 'ai_overview',
    translations: ['ai_overview_translations', 'ai_overview_id'],
    links: [['ai_overview_skills', 'ai_overview_id']],
    hasSlug: false,
    label: 'ai-overview',
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
 * Soft delete (docs/01, décision du 19 nov. 2026) : une entité (ligne parente) retirée des fichiers
 * est marquée `deleted_at = now()`, jamais supprimée ; ses traductions et ses liaisons restent en base
 * et ne sont plus servies. Une entité marquée que les seeds écrivent de nouveau (elle est réapparue
 * dans les fichiers) est remise en service (`deleted_at = null`). Le nettoyage physique est manuel
 * (`db:deleted:list`, `db:deleted:purge`). Une table dont aucune ligne n'est écrite par les seeds
 * (projets, outils, ressources tant qu'ils n'ont pas de seed) n'est pas touchée.
 */
export async function convergeToSeeds(tx: TransactionSql, log: LogFn): Promise<void> {
  for (const entity of SEEDED_ENTITIES) {
    const label = entityLabel(tx, entity);

    const restored = await tx<{ label: string }[]>`
      update ${tx(entity.table)} p set deleted_at = null
      where p.deleted_at is not null and p.xmin = pg_current_xact_id()::xid
      returning ${label}::text as label`;
    if (restored.length > 0) {
      log(
        `${entity.table} : ${restored.length} entité(s) réapparue(s) dans les seeds, remise(s) en service ` +
          `(${restored.map((row) => row.label).join(', ')})`,
      );
    }

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
        update ${tx(entity.table)} p set deleted_at = now()
        where p.deleted_at is null
          and not (p.xmin = pg_current_xact_id()::xid)
          and exists (select 1 from ${tx(entity.table)} q where q.xmin = pg_current_xact_id()::xid)
        returning p.slug`;
      if (absent.length > 0) {
        log(
          `${entity.table} : ${absent.length} entité(s) absente(s) des seeds marquée(s) supprimée(s) ` +
            `(${absent
              .map((row) => row.slug)
              .sort()
              .join(', ')})`,
        );
      }
    }
  }
}

/**
 * Contrôle de fin de seed : chaque ligne publiée et non marquée supprimée a une traduction `fr`, et le profil aussi. Sans
 * traduction `fr`, une ligne publiée disparaîtrait silencieusement de toutes les réponses (la
 * jointure `fr` est interne) : mieux vaut arrêter le déploiement.
 */
export async function assertFrenchTranslations(tx: TransactionSql): Promise<void> {
  const missing: string[] = [];
  for (const entity of SEEDED_ENTITIES) {
    const [translationTable, foreignKey] = entity.translations;
    const rows = await tx<{ label: string }[]>`
      select ${entityLabel(tx, entity)}::text as label
      from ${tx(entity.table)} p
      where ${entity.hasSlug ? tx`p.published` : tx`true`}
        and p.deleted_at is null
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

/**
 * Contrôle de fin de seed : une traduction `en` d'une entité publiée et non marquée supprimée est complète (docs/01,
 * repli de langue par ligne). Elle est servie entière ; un champ nul ou un tableau vide là où la
 * traduction `fr` a une valeur livrerait une entité à trous. Une entité sans ligne `en` n'est pas
 * concernée : l'API sert alors la ligne `fr` entière. Le message liste les champs lacunaires.
 */
export async function assertEnglishTranslations(tx: TransactionSql): Promise<void> {
  const incomplete: string[] = [];
  for (const entity of SEEDED_ENTITIES) {
    const [translationTable, foreignKey] = entity.translations;
    const rows = await tx<{ label: string; fields: string[] }[]>`
      select ${entityLabel(tx, entity)}::text as label,
             array_agg(f.key order by f.key) as fields
      from ${tx(entity.table)} p
      join ${tx(translationTable)} fr on fr.${tx(foreignKey)} = p.id and fr.locale = 'fr'
      join ${tx(translationTable)} en on en.${tx(foreignKey)} = p.id and en.locale = 'en'
      cross join lateral jsonb_each(to_jsonb(fr)) as f(key, value)
      where ${entity.hasSlug ? tx`p.published` : tx`true`}
        and p.deleted_at is null
        and f.value not in ('null'::jsonb, '[]'::jsonb)
        and coalesce(to_jsonb(en) -> f.key, 'null'::jsonb) in ('null'::jsonb, '[]'::jsonb)
      group by p.id
      order by 1`;
    for (const row of rows) {
      incomplete.push(`${entity.table}/${row.label} (${row.fields.join(', ')})`);
    }
  }
  if (incomplete.length > 0) {
    throw new Error(
      `Traduction en incomplète (elle serait servie telle quelle, avec des champs vides) : ` +
        `${incomplete.join(', ')}. Compléter la ligne en ou la retirer (l'API sert alors le fr entier).`,
    );
  }
}
