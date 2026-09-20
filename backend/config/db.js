import dotenv from "dotenv"; // brings in the dotenv package to read .env files
import pg from "pg"; // brings in the "pg" package to talk to PostgreSQL database

dotenv.config(); // loads variables from our .env file into process.env

const { Pool } = pg; // pulls out the Pool class from pg 

// below is code for setting up 
// connection pool to the PostgreSQL database
// using environment variables for configuration.

export const pool = new pg.Pool({
  host: process.env.DB_HOST, 
  port: Number(process.env.DB_PORT) || 5432, 
  database: process.env.DB_NAME, 
  user: process.env.DB_USER, 
  password: String(process.env.DB_PASSWORD || ""),
});

// pool.on('connect', () => { // sets up a listener that runs every time a new connection is successfully made
//   console.log('Connected to PostgreSQL')
// })

pool.on('error', (err) => { // sets up a listener that runs if something goes wrong with the pool/connections
  console.error('PostgreSQL pool error:', err) 
})