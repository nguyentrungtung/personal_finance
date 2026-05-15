export class BusinessRuleError extends Error {
  readonly statusCode = 422;
  readonly code: string;

  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION') {
    super(message);
    this.name = 'BusinessRuleError';
    this.code = code;
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';

  constructor(resource: string, id?: number | string) {
    super(id !== undefined ? `${resource} with id ${id} not found` : `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class AuthError extends Error {
  readonly statusCode = 401;
  readonly code: string;

  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
