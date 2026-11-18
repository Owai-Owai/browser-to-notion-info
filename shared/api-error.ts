import type { Failure } from "./schema.ts";

export class ApiError extends Error {
  constructor(public status: number, public failure: Failure) { super(failure.message); }
}
