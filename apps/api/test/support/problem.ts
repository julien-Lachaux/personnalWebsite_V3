import {
  PROBLEM_JSON_CONTENT_TYPE,
  type ProblemDetails,
  ProblemDetailsSchema,
} from '@siteperso/contracts';
import { type LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';

import { validate } from './validate.js';

/** Motifs qui trahiraient une pile d'appels, un chemin de fichier ou un message interne. */
const LEAK_PATTERNS: readonly RegExp[] = [
  /\bat\s+\S+\s+\(.*:\d+:\d+\)/u,
  /\bat\s+\/\S+:\d+/u,
  /\/apps\/api\//u,
  /\/home\//u,
  /node_modules/u,
  /\.(?:ts|js|mjs):\d+/u,
  /"stack"/u,
];

/** Vérifie qu'un corps d'erreur ne contient ni chemin de fichier ni pile. */
export function expectNoLeak(body: string): void {
  for (const pattern of LEAK_PATTERNS) {
    expect(body, `fuite détectée (${pattern.source})`).not.toMatch(pattern);
  }
}

/**
 * Vérifie une réponse d'erreur RFC 9457 : statut, `content-type` problem+json, corps conforme
 * à `ProblemDetailsSchema` (strict), `status` du corps égal au statut HTTP, aucune fuite.
 */
export function expectProblem(response: LightMyRequestResponse, status: number): ProblemDetails {
  expect(response.statusCode).toBe(status);
  expect(response.headers['content-type']).toContain(PROBLEM_JSON_CONTENT_TYPE);
  const problem = validate(ProblemDetailsSchema, response.json());
  expect(problem.status).toBe(status);
  expectNoLeak(response.body);
  return problem;
}
