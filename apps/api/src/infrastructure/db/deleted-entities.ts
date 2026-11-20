import { type LogFn, openSingleConnection } from './migrations-runner.js';
import { entityLabel, SEEDED_ENTITIES } from './seeds-convergence.js';

/** Entité marquée supprimée (`deleted_at` non nul), en attente d'un nettoyage physique. */
export interface DeletedEntity {
  table: string;
  /** Slug de l'entité (`profil` pour le profil, `ai-overview` pour la section IA : ils n'en ont pas). */
  label: string;
  deletedAt: Date;
}

export interface ListDeletedOptions {
  databaseUrl: string;
  log: LogFn;
}

export interface PurgeDeletedOptions extends ListDeletedOptions {
  /** Ne supprime que les entités marquées depuis plus de ce nombre de jours (0 : toutes). */
  olderThanDays: number;
  /** `false` : simulation, rien n'est supprimé. */
  confirm: boolean;
}

/**
 * Tables dans l'ordre de suppression : les groupes de compétences en dernier, car `skills.group_id`
 * est `on delete restrict` (les compétences marquées doivent partir avant leur groupe).
 */
const PURGE_ORDER: readonly (typeof SEEDED_ENTITIES)[number][] = [
  ...SEEDED_ENTITIES.filter((entity) => entity.table !== 'skill_groups'),
  ...SEEDED_ENTITIES.filter((entity) => entity.table === 'skill_groups'),
];

/** Variable qui acquitte une purge en production (docs/deploiement.md). */
const PRODUCTION_ACKNOWLEDGEMENT = 'ALLOW_PRODUCTION_PURGE';

/**
 * Liste les entités marquées supprimées (`db:deleted:list`), par table puis par date, avec leur date
 * de marquage. Lecture seule.
 */
export async function listDeletedEntities(options: ListDeletedOptions): Promise<DeletedEntity[]> {
  const sql = openSingleConnection(options.databaseUrl);
  try {
    const entities: DeletedEntity[] = [];
    for (const entity of SEEDED_ENTITIES) {
      const rows = await sql<{ label: string; deleted_at: Date }[]>`
        select ${entityLabel(sql, entity)}::text as label, p.deleted_at
        from ${sql(entity.table)} p
        where p.deleted_at is not null
        order by p.deleted_at, 1`;
      entities.push(
        ...rows.map((row) => ({
          table: entity.table,
          label: row.label,
          deletedAt: row.deleted_at,
        })),
      );
    }
    if (entities.length === 0) {
      options.log('Aucune entité marquée supprimée.');
    } else {
      options.log(`${entities.length} entité(s) marquée(s) supprimée(s) :`);
      for (const entity of entities) {
        options.log(
          `  ${entity.table} : ${entity.label} (supprimée le ${entity.deletedAt.toISOString()})`,
        );
      }
    }
    return entities;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Supprime physiquement les entités marquées depuis plus de `olderThanDays` jours (`db:deleted:purge`),
 * traductions et liaisons comprises (`on delete cascade`), dans une seule transaction : tout ou rien.
 * Sans `confirm`, simule : liste ce qui serait supprimé et ne supprime rien. Avec `confirm`, refusé en
 * production tant que `ALLOW_PRODUCTION_PURGE=yes` n'est pas posé. Renvoie le nombre d'entités
 * supprimées (0 en simulation).
 */
export async function purgeDeletedEntities(options: PurgeDeletedOptions): Promise<number> {
  const days = options.olderThanDays;
  if (!Number.isInteger(days) || days < 0) {
    throw new Error(`Le nombre de jours doit être un entier positif ou nul (reçu : ${days}).`);
  }
  if (
    options.confirm &&
    process.env['NODE_ENV'] === 'production' &&
    process.env[PRODUCTION_ACKNOWLEDGEMENT] !== 'yes'
  ) {
    throw new Error(
      `db:deleted:purge est refusé en production (NODE_ENV=production) sans acquittement : ` +
        `poser ${PRODUCTION_ACKNOWLEDGEMENT}=yes pour le confirmer.`,
    );
  }

  const sql = openSingleConnection(options.databaseUrl);
  try {
    const purged = await sql
      .begin(async (tx) => {
        const lines: string[] = [];
        let total = 0;
        for (const entity of PURGE_ORDER) {
          const where = tx`deleted_at is not null and deleted_at < now() - make_interval(days => ${days})`;
          const rows = options.confirm
            ? await tx<{ label: string }[]>`
                delete from ${tx(entity.table)} p where ${where}
                returning ${entityLabel(tx, entity)}::text as label`
            : await tx<{ label: string }[]>`
                select ${entityLabel(tx, entity)}::text as label
                from ${tx(entity.table)} p where ${where}`;
          if (rows.length > 0) {
            total += rows.length;
            const verb = options.confirm ? 'supprimée(s)' : 'à supprimer';
            lines.push(
              `${entity.table} : ${rows.length} entité(s) ${verb} (${rows
                .map((row) => row.label)
                .sort()
                .join(', ')})`,
            );
          }
        }
        return { lines, total };
      })
      .catch((error: Error) => {
        throw new Error(`Purge annulée (rien n'a été supprimé) : ${error.message}`, {
          cause: error,
        });
      });

    if (purged.total === 0) {
      options.log(`Aucune entité marquée supprimée depuis plus de ${days} jour(s).`);
      return 0;
    }
    for (const line of purged.lines) {
      options.log(line);
    }
    if (!options.confirm) {
      options.log(
        `Simulation : ${purged.total} entité(s) seraient supprimées physiquement. ` +
          'Relancer avec --confirm pour les supprimer.',
      );
      return 0;
    }
    return purged.total;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
