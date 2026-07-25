import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString = process.env.MYSQL_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("MYSQL_URL must be set to connect to MySQL");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
