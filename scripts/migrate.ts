/* Applies migrations and syncs the exercise library. Usage: npm run db:migrate */
import { bootstrap } from "../src/server/db/bootstrap";

bootstrap()
  .then(() => {
    console.log("Database migrated and exercise library synced.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
