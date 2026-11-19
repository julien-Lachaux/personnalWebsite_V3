/** Arguments de `db:deleted:purge`. */
export interface PurgeArguments {
  /** Âge minimal, en jours, du marquage `deleted_at` (0 : toutes les entités marquées). */
  olderThanDays: number;
  /** Confirmation explicite (`--confirm`) : sans elle, la commande ne fait que simuler. */
  confirm: boolean;
}

const OLDER_THAN = '--older-than';

function parseDays(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`${OLDER_THAN} attend un nombre entier de jours (0 ou plus).`);
  }
  return Number(value);
}

/**
 * Lit `--older-than <jours>` (ou `--older-than=<jours>`, obligatoire) et `--confirm` (facultatif).
 * Le séparateur `--` que pnpm peut transmettre est ignoré ; tout autre argument est refusé.
 */
export function parsePurgeArguments(argv: readonly string[]): PurgeArguments {
  let olderThanDays: number | undefined;
  let confirm = false;
  const remaining = [...argv];
  while (remaining.length > 0) {
    const argument = remaining.shift()!;
    if (argument === '--') {
      continue;
    }
    if (argument === '--confirm') {
      confirm = true;
    } else if (argument === OLDER_THAN) {
      olderThanDays = parseDays(remaining.shift());
    } else if (argument.startsWith(`${OLDER_THAN}=`)) {
      olderThanDays = parseDays(argument.slice(OLDER_THAN.length + 1));
    } else {
      throw new Error(`Argument inconnu : ${argument}`);
    }
  }
  if (olderThanDays === undefined) {
    throw new Error(`${OLDER_THAN} <jours> est obligatoire (ex. : --older-than 30).`);
  }
  return { olderThanDays, confirm };
}
