const { Pool } = require("pg");
require("dotenv").config();

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.rehceuiowcielqtewkgd:Thelegende@007&@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
