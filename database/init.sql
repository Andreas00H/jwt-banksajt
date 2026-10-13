-- Körs automatiskt första gången MySQL-containern startar.
-- (Backend skapar också tabellerna om de saknas, så båda vägarna fungerar.)

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  -- bara bcrypt-hashar, aldrig lösenord i klartext
  password_hash VARCHAR(255) NOT NULL
) AUTO_INCREMENT = 101;

CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  type ENUM('deposit', 'withdrawal') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX transactions_account_created (account_id, created_at)
);
