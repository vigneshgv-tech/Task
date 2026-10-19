const { Sequelize } = require("sequelize");
require("dotenv").config();

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres.rehceuiowcielqtewkgd:Thelegende@007&@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl:
      process.env.DB_SSL === "true"
        ? { require: true, rejectUnauthorized: false }
        : false,
  },
});

module.exports = { sequelize, Sequelize };
