/**
 * Erreur métier de base. Le domaine ne connaît ni HTTP ni Nest : c'est la couche
 * `infrastructure/http` qui traduit ces erreurs en réponses problem+json.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
