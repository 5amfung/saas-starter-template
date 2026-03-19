import { createDb } from "@workspace/db"

export const db = createDb(process.env.DATABASE_URL!)
