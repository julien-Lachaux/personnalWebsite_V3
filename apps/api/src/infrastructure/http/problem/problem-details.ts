import { HttpException } from '@nestjs/common';
import { type ProblemDetails } from '@siteperso/contracts';

import { EntityNotFoundError } from '../../../domain/index.js';

/** Titres RFC 9110 des statuts que l'API peut produire. */
const STATUS_TITLES: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  503: 'Service Unavailable',
};

const INTERNAL_ERROR_DETAIL = 'Une erreur interne est survenue.';

export function titleFor(status: number): string {
  return STATUS_TITLES[status] ?? 'Error';
}

/** Erreur Fastify (parsing du corps, en-têtes…) : porte un `statusCode` numérique. */
function statusCodeOf(exception: unknown): number | undefined {
  if (typeof exception === 'object' && exception !== null && 'statusCode' in exception) {
    const code = exception.statusCode;
    if (typeof code === 'number' && code >= 400 && code <= 599) {
      return code;
    }
  }
  return undefined;
}

/** Extrait le message lisible d'une réponse d'HttpException (chaîne ou objet Nest). */
function detailOf(exception: HttpException): string | undefined {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response === 'object' && 'message' in response) {
    const message = response.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === 'string').join(' ');
    }
  }
  return undefined;
}

/**
 * Traduit toute exception en corps RFC 9457. Une HttpException est levée volontairement par
 * le code HTTP : son message est public (501 « pas encore implémenté », 503 « base
 * injoignable »…). Toute autre erreur est inattendue : détail générique, aucune fuite de
 * message ni de pile d'appels, journalisation à part.
 */
export function toProblemDetails(exception: unknown, instance: string): ProblemDetails {
  if (exception instanceof HttpException) {
    return problem(exception.getStatus(), detailOf(exception), instance);
  }
  if (exception instanceof EntityNotFoundError) {
    return problem(404, exception.message, instance);
  }
  const fastifyStatus = statusCodeOf(exception);
  if (fastifyStatus !== undefined && fastifyStatus < 500) {
    return problem(fastifyStatus, (exception as Error).message, instance);
  }
  return problem(500, INTERNAL_ERROR_DETAIL, instance);
}

function problem(status: number, detail: string | undefined, instance: string): ProblemDetails {
  return {
    type: 'about:blank',
    title: titleFor(status),
    status,
    ...(detail !== undefined ? { detail } : {}),
    instance,
  };
}
