import "dotenv/config";

/** URL de la BD de pruebas. Por defecto, la de desarrollo cambiando el nombre de la base a `<nombre>_test`. */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) return assertIsTestDb(explicit);

  const dev = process.env.DATABASE_URL;
  if (!dev) throw new Error("Define DATABASE_URL o TEST_DATABASE_URL para ejecutar los tests de integración");
  const url = new URL(dev);
  url.pathname = `/${url.pathname.replace(/^\//, "")}_test`;
  return assertIsTestDb(url.toString());
}

/** Salvaguarda: los tests vacían todas las tablas, así que sólo se permiten bases cuyo nombre acaba en `_test`. */
export function assertIsTestDb(connectionString: string): string {
  const dbName = new URL(connectionString).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(`Por seguridad, la BD de tests debe terminar en "_test" (recibido: "${dbName}")`);
  }
  return connectionString;
}
