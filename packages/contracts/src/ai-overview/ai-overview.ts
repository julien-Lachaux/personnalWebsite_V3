import { z } from 'zod';

import { SkillSchema } from '../skills/skills.js';

/** Texte affiché, jamais vide. */
const text = (description: string, example: string) =>
  z
    .string()
    .min(1)
    .meta({ description, examples: [example] });

/**
 * Réponse de `GET /ai-overview` : la section « IA » du site, une seule ligne (`ai_overview`, `id = 1`)
 * traduite selon `lang` (repli par ligne : tous les textes viennent de la même ligne de traduction),
 * avec ses compétences liées (étiquettes), triées par `ai_overview_skills.sort_order`.
 */
export const AiOverviewSchema = z
  .strictObject({
    title: text('Titre de la section.', 'L’IA, dans le produit et au quotidien'),
    inProductLabel: text("Intitulé du bloc « l'IA dans le produit ».", 'dans le produit · 2026'),
    inProductItems: z
      .array(z.string().min(1))
      .min(1)
      .meta({
        description: "Usages de l'IA dans le produit, un par entrée (au moins un).",
        examples: [['OCR des factures', 'Remplissage automatique']],
      }),
    dailyLabel: text("Intitulé du bloc « l'IA au quotidien ».", 'au quotidien'),
    dailyText: text("Usage quotidien de l'IA (texte brut).", 'Usage quotidien de l’IA.'),
    skills: z
      .array(SkillSchema)
      .meta({ description: 'Compétences liées (étiquettes), par ordre de tri.' }),
  })
  .meta({
    id: 'AiOverview',
    description: 'Section « IA » du site, traduite selon `lang`, avec ses compétences liées.',
  });

export type AiOverview = z.infer<typeof AiOverviewSchema>;
