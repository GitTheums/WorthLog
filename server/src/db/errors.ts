export class DatabaseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
  }
}

export class CategoryNotFoundError extends DatabaseError {
  constructor(categoryId: string) {
    super('CATEGORY_NOT_FOUND', `Category ${categoryId} was not found`);
    this.name = 'CategoryNotFoundError';
  }
}

export class SnapshotNotFoundError extends DatabaseError {
  constructor(identifier: string) {
    super('SNAPSHOT_NOT_FOUND', `Snapshot ${identifier} was not found`);
    this.name = 'SnapshotNotFoundError';
  }
}

export class UniqueConstraintError extends DatabaseError {
  constructor(message: string) {
    super('UNIQUE_CONSTRAINT', message);
    this.name = 'UniqueConstraintError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}
