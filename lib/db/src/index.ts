import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const connectionString = process.env.MYSQL_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "MYSQL_URL must be set to a MySQL connection string (mysql://user:password@host:3306/database).",
  );
}

export const pool = mysql.createPool(connectionString);
export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
