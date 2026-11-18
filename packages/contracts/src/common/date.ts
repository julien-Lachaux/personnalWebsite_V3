import { z } from 'zod';

/** Date calendaire sans heure ni fuseau, au format `YYYY-MM-DD` (colonne SQL `date`). */
export const IsoDateSchema = z.iso.date().meta({
  id: 'IsoDate',
  description: 'Date calendaire `YYYY-MM-DD` (ISO 8601), sans heure ni fuseau.',
  examples: ['2026-01-01'],
});

export type IsoDate = z.infer<typeof IsoDateSchema>;
