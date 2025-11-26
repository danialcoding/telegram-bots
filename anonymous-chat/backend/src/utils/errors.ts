export class CustomError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'احراز هویت ناموفق') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'دسترسی غیرمجاز') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'یافت نشد') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}
