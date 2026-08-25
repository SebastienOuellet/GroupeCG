export class ExpressError extends Error {
  /**
   * @param {string} message - Message détaillant l'erreur.
   * @param {number} status - Code d'état HTTP associé à l'erreur.
   */
  constructor(message, status) {
    super(message);
    this.message = message;
    this.status = status;
  }
}

export class BadRequestError extends ExpressError {
  constructor(message = "La requête est invalide ou mal formée.") {
    super(message, 400);
  }
}

export class UnauthorizedError extends ExpressError {
  constructor(message = "Authentification requise pour accéder à cette ressource.") {
    super(message, 401);
  }
}

export class ForbiddenError extends ExpressError {
  constructor(message = "Vous n'avez pas les droits d'accès à cette ressource.") {
    super(message, 403);
  }
}

export class NotFoundError extends ExpressError {
  constructor(message = "La ressource demandée n'a pas été trouvée.") {
    super(message, 404);
  }
}

export class ConflictError extends ExpressError {
  constructor(message = "La ressource existe déjà ou est en conflit avec l'état actuel.") {
    super(message, 409);
  }
}

export class InternalServerError extends ExpressError {
  constructor(message = "Une erreur interne est survenue. Veuillez réessayer plus tard.") {
    super(message, 500);
  }
}

export class ServiceUnavailableError extends ExpressError {
  constructor(message = "Le service demandé est temporairement indisponible. Veuillez réessayer plus tard.") {
    super(message, 503);
  }
}
