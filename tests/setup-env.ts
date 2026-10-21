import { testDatabaseUrl } from "./test-db";

// Debe ejecutarse antes de importar `@/server/db/client`, que lee DATABASE_URL al cargarse.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.APP_TIMEZONE = "Europe/Madrid";
