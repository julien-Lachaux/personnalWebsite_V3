import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { type LoggerService, type LogLevel, MethodNotAllowedException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify';

import { loadEnv } from '../config/env.js';
import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './problem/problem-details.filter.js';
import { sendProblem } from './problem/send-problem.js';

export const GLOBAL_PREFIX = 'api/v1';

/**
 * L'API est en lecture seule : aucune route n'attend de corps. Une limite à 1 Kio fait rejeter en
 * 413 un corps volumineux (y compris sur une route inconnue) avant de le lire en mémoire.
 */
export const MAX_BODY_BYTES = 1024;

/** En-têtes de sécurité des réponses que helmet ne voit pas (erreurs levées avant le routage). */
const FRAMEWORK_ERROR_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
} as const;

/** Méthodes déclarées sur chaque route de l'API (lecture seule) : valeur de l'en-tête `Allow` des 405. */
const ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;

/** Durée maximale de réception d'une requête complète (en-têtes et corps), en ms. */
export const REQUEST_TIMEOUT_MS = 10_000;

export interface CreateAppOptions {
  /** Logger Nest ; `false` pour couper les logs (tests). */
  logger?: LoggerService | LogLevel[] | false;
}

/**
 * Construit l'application Nest/Fastify sans l'écouter : utilisée par `main.ts` (listen)
 * et par les tests e2e (`app.inject`). Toute la configuration transverse est ici.
 */
export async function createApp(options: CreateAppOptions = {}): Promise<NestFastifyApplication> {
  // La configuration est validée avant de construire Fastify : `trustProxy` se fixe à la création.
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: env.TRUST_PROXY,
      bodyLimit: MAX_BODY_BYTES,
      // Délais : une requête qui n'arrive pas en entier (client lent) ou dont le traitement dépasse
      // la limite (base figée) ne retient pas indéfiniment une connexion ; le second donne un 503.
      requestTimeout: REQUEST_TIMEOUT_MS,
      handlerTimeout: env.HANDLER_TIMEOUT_MS,
      // Erreurs que Fastify lève avant le routage (URL à pourcentage invalide…) : elles échappent
      // au filtre Nest et à helmet, d'où ce rendu problem+json et ces en-têtes minimaux.
      frameworkErrors: (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
        sendProblem(error, request, reply, FRAMEWORK_ERROR_HEADERS);
      },
    }),
    { logger: options.logger ?? ['error', 'warn', 'log'] },
  );

  // En-têtes de sécurité (CSP inutile sur une API JSON, le reste reste actif).
  await app.register(helmet, { contentSecurityPolicy: false });

  // Rate limiting global léger par IP (en-têtes x-ratelimit-*, 429 problem+json via le filtre).
  // `global: false` + un hook `onRequest` racine plutôt que l'accroche par route du plugin : le
  // hook s'applique aussi aux routes inconnues (404) et, enregistré avant CORS, aux préflights.
  await app.register(rateLimit, {
    global: false,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    // Un client IPv6 reçoit un préfixe entier (/64) : il ne multiplie pas son quota en changeant
    // d'adresse dans son préfixe. Valeur par défaut du plugin, posée explicitement.
    ipv6Subnet: 64,
  });
  const fastify = app.getHttpAdapter().getInstance();
  const limit = fastify.rateLimit();
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await limit.call(fastify, request, reply);
    } catch (error) {
      // Répondu ici, en problem+json : une erreur propagée à Fastify passerait par le gestionnaire
      // d'erreurs de la route, qui n'est celui de Nest que pour les routes enregistrées après lui
      // (pas le `OPTIONS *` du plugin CORS).
      sendProblem(error, request, reply);
      return reply;
    }
    return undefined;
  });

  // Méthode non déclarée sur une route existante : 405 problem+json avec `Allow` (docs/01), produit
  // par l'API et non par le proxy (parité dev/prod). Une route inconnue reste un 404. Posé en
  // `preHandler` : le 413 (corps trop gros) et le 400 (JSON invalide) restent prioritaires, comme
  // pour le 404 de Nest que ce hook précède sur les routes de l'API.
  fastify.addHook('preHandler', (request, reply, done) => {
    const declared = (ALLOWED_METHODS as readonly string[]).includes(request.method);
    if (declared || fastify.findRoute({ method: 'GET', url: request.url }) === null) {
      done();
      return;
    }
    const allow = ALLOWED_METHODS.join(', ');
    sendProblem(
      new MethodNotAllowedException(
        `Méthode ${request.method} non autorisée sur cette ressource (méthodes admises : ${allow}).`,
      ),
      request,
      reply,
      { allow },
    );
  });

  // CORS restreint au(x) domaine(s) du front, lecture seule. Enregistré ici et non par
  // `app.enableCors()` : le hook de Nest 12 est ajouté avant ceux-ci et répondrait aux préflights
  // avant le rate limiting (qui doit les compter) et helmet.
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    maxAge: 600,
    // Un OPTIONS sans en-têtes de préflight (curl, sonde) répond 204 au lieu d'un 400 text/plain.
    strictPreflight: false,
  });

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  return app;
}
