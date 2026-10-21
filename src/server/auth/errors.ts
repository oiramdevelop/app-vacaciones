export class ForbiddenError extends Error {
  constructor() {
    super("No autorizado");
    this.name = "ForbiddenError";
  }
}
