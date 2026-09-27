const { Pool } = require('pg')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') });


const requiredEnv = ['DB_USER',  'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'DB_DATABASE']
const missingEnv = requiredEnv.filter((name) => !process.env[name])

if (missingEnv.length) {
  throw new Error(`Brakujące zmienne środowiskowe w backend/.env: ${missingEnv.join(', ')}`)
}

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
});
module.exports = pool;

