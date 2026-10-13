import mysql from "mysql2/promise";

// Inställningar för databasen. Standardvärdena passar MAMP på Mac
// (port 8889, användare root, lösenord root). På servern sätts egna
// värden i filen backend/.env.
const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 8889),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "root",
};
const databaseName = process.env.DB_NAME ?? "bank";

let pool;

// Hjälpfunktion som gör koden snyggare (samma idé som på lektionen)
export async function query(sql, params = []) {
  const [results] = await pool.execute(sql, params);
  return results;
}

// Kör flera SQL-frågor som EN databastransaktion: antingen lyckas alla,
// eller så ångras alla (rollback). Används så att saldot och historiken
// alltid uppdateras tillsammans.
export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tx = async (sql, params = []) => {
      const [results] = await connection.execute(sql, params);
      return results;
    };
    const result = await work(tx);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Skapar databasen och tabellerna om de inte redan finns
export async function initDatabase() {
  const connection = await mysql.createConnection(config);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
  await connection.end();

  pool = mysql.createPool({ ...config, database: databaseName });

  // Lösenordet sparas bara som bcrypt-hash, aldrig i klartext
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL
    ) AUTO_INCREMENT = 101
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Transaktionshistorik: en rad per lyckad insättning (och senare uttag).
  // Skapas här om den saknas, så att även en databas som redan finns
  // (t.ex. på servern) får tabellen utan att init.sql behöver köras igen.
  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_id INT NOT NULL,
      type ENUM('deposit', 'withdrawal') NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      INDEX transactions_account_created (account_id, created_at)
    )
  `);

  console.log(`Ansluten till databasen "${databaseName}" på ${config.host}:${config.port}`);
}
