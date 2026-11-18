import { DomainError } from './domain-error.js';

/** Une entité demandée n'existe pas (ou n'est pas publiée). Traduite en HTTP 404. */
export class EntityNotFoundError extends DomainError {
  constructor(
    readonly entity: string,
    readonly identifier: string,
  ) {
    super(`${entity} « ${identifier} » introuvable.`);
  }
}
