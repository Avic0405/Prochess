-- Multi-wallet active wallet migration
-- Removes userId @unique from Wallet, adds isActive flag,
-- adds @@unique([userId, currency]), adds currency to Transaction

-- Step 1: Create new Wallet table (no userId @unique, adds isActive)
CREATE TABLE "new_Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "lockedBalance" DECIMAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "new_Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 2: Copy existing wallets; set isActive = true for all (each user had exactly one)
INSERT INTO "new_Wallet" ("id", "userId", "balance", "lockedBalance", "currency", "isActive", "createdAt", "updatedAt")
SELECT "id", "userId", "balance", "lockedBalance", "currency", 1, "createdAt", "updatedAt" FROM "Wallet";

-- Step 3: Drop old table
DROP TABLE "Wallet";

-- Step 4: Rename
ALTER TABLE "new_Wallet" RENAME TO "Wallet";

-- Step 5: Add (userId, currency) unique constraint — one wallet per currency per user
CREATE UNIQUE INDEX "Wallet_userId_currency_key" ON "Wallet"("userId", "currency");

-- Step 6: Regular index on userId
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- Step 7: Index on (userId, isActive) for fast active-wallet lookups
CREATE INDEX "Wallet_userId_isActive_idx" ON "Wallet"("userId", "isActive");

-- Step 8: Add currency column to Transaction (nullable, retroactively null for old rows)
ALTER TABLE "Transaction" ADD COLUMN "currency" TEXT;
