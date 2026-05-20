/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "User_email_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "User";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "deptId" TEXT,
    "roleId" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "icon" TEXT,
    "component" TEXT,
    "parentId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'menu',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "menus_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "menus" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "permission" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "login_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "params" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "columns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "columnId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "terminal" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "recommendMode" TEXT NOT NULL,
    "recommendRules" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "columns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "column_novels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "columnId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "column_novels_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "columns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "column_novels_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "novels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "homepage_strategies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "terminal" TEXT NOT NULL,
    "userSegmentId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "homepage_strategies_userSegmentId_fkey" FOREIGN KEY ("userSegmentId") REFERENCES "user_segments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "homepage_strategies_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "homepage_strategy_columns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "homepage_strategy_columns_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "homepage_strategies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "homepage_strategy_columns_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "columns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chineseName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "categories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_categories" ("categoryId", "chineseName", "createdAt", "createdBy", "id", "name", "status", "updatedAt") SELECT "categoryId", "chineseName", "createdAt", "createdBy", "id", "name", "status", "updatedAt" FROM "categories";
DROP TABLE "categories";
ALTER TABLE "new_categories" RENAME TO "categories";
CREATE UNIQUE INDEX "categories_categoryId_key" ON "categories"("categoryId");
CREATE TABLE "new_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "channels_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_channels" ("channelId", "createdAt", "createdBy", "id", "name", "secret", "updatedAt") SELECT "channelId", "createdAt", "createdBy", "id", "name", "secret", "updatedAt" FROM "channels";
DROP TABLE "channels";
ALTER TABLE "new_channels" RENAME TO "channels";
CREATE UNIQUE INDEX "channels_channelId_key" ON "channels"("channelId");
CREATE TABLE "new_chapters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "isChargeable" BOOLEAN NOT NULL DEFAULT true,
    "price" INTEGER,
    "content" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "chapters_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "novels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chapters_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_chapters" ("chapterId", "chapterNumber", "content", "createdAt", "createdBy", "id", "isChargeable", "novelId", "price", "title", "updatedAt") SELECT "chapterId", "chapterNumber", "content", "createdAt", "createdBy", "id", "isChargeable", "novelId", "price", "title", "updatedAt" FROM "chapters";
DROP TABLE "chapters";
ALTER TABLE "new_chapters" RENAME TO "chapters";
CREATE UNIQUE INDEX "chapters_chapterId_key" ON "chapters"("chapterId");
CREATE UNIQUE INDEX "chapters_novelId_chapterNumber_key" ON "chapters"("novelId", "chapterNumber");
CREATE TABLE "new_copyright_companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "copyright_companies_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_copyright_companies" ("companyId", "createdAt", "createdBy", "id", "name", "status", "updatedAt") SELECT "companyId", "createdAt", "createdBy", "id", "name", "status", "updatedAt" FROM "copyright_companies";
DROP TABLE "copyright_companies";
ALTER TABLE "new_copyright_companies" RENAME TO "copyright_companies";
CREATE UNIQUE INDEX "copyright_companies_companyId_key" ON "copyright_companies"("companyId");
CREATE TABLE "new_fb_authorizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenExpiry" DATETIME NOT NULL,
    "adAccounts" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fb_authorizations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_fb_authorizations" ("adAccounts", "createdAt", "createdBy", "id", "tokenExpiry", "updatedAt", "userId") SELECT "adAccounts", "createdAt", "createdBy", "id", "tokenExpiry", "updatedAt", "userId" FROM "fb_authorizations";
DROP TABLE "fb_authorizations";
ALTER TABLE "new_fb_authorizations" RENAME TO "fb_authorizations";
CREATE TABLE "new_landing_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "mediaChannel" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'english',
    "os" TEXT NOT NULL,
    "openChapter" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "landing_pages_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "novels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "landing_pages_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_landing_pages" ("createdAt", "createdBy", "id", "language", "mediaChannel", "name", "novelId", "openChapter", "os", "updatedAt") SELECT "createdAt", "createdBy", "id", "language", "mediaChannel", "name", "novelId", "openChapter", "os", "updatedAt" FROM "landing_pages";
DROP TABLE "landing_pages";
ALTER TABLE "new_landing_pages" RENAME TO "landing_pages";
CREATE TABLE "new_novels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "novelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chineseName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'english',
    "author" TEXT,
    "copyrightCompanyId" TEXT NOT NULL,
    "description" TEXT,
    "authStartTime" DATETIME,
    "authEndTime" DATETIME,
    "coverImage" TEXT NOT NULL,
    "isChargeable" BOOLEAN NOT NULL DEFAULT true,
    "wordCount" INTEGER,
    "views" INTEGER NOT NULL DEFAULT 0,
    "manualViews" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "novels_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "novels_copyrightCompanyId_fkey" FOREIGN KEY ("copyrightCompanyId") REFERENCES "copyright_companies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "novels_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_novels" ("authEndTime", "authStartTime", "author", "categoryId", "chineseName", "copyrightCompanyId", "coverImage", "createdAt", "createdBy", "description", "id", "isChargeable", "language", "manualViews", "name", "novelId", "status", "updatedAt", "views", "wordCount") SELECT "authEndTime", "authStartTime", "author", "categoryId", "chineseName", "copyrightCompanyId", "coverImage", "createdAt", "createdBy", "description", "id", "isChargeable", "language", "manualViews", "name", "novelId", "status", "updatedAt", "views", "wordCount" FROM "novels";
DROP TABLE "novels";
ALTER TABLE "new_novels" RENAME TO "novels";
CREATE UNIQUE INDEX "novels_novelId_key" ON "novels"("novelId");
CREATE TABLE "new_payment_wall_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentWallId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bonusCoins" INTEGER,
    "isDefaultSelected" BOOLEAN NOT NULL DEFAULT false,
    "showBadge" BOOLEAN NOT NULL DEFAULT false,
    "marketingText" TEXT,
    "subscriptionText" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_wall_products_paymentWallId_fkey" FOREIGN KEY ("paymentWallId") REFERENCES "payment_walls" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_wall_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payment_wall_products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_payment_wall_products" ("bonusCoins", "createdAt", "createdBy", "id", "isDefaultSelected", "marketingText", "paymentWallId", "productId", "showBadge", "sort", "subscriptionText", "type", "updatedAt") SELECT "bonusCoins", "createdAt", "createdBy", "id", "isDefaultSelected", "marketingText", "paymentWallId", "productId", "showBadge", "sort", "subscriptionText", "type", "updatedAt" FROM "payment_wall_products";
DROP TABLE "payment_wall_products";
ALTER TABLE "new_payment_wall_products" RENAME TO "payment_wall_products";
CREATE TABLE "new_payment_walls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentWallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userSegmentId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_walls_userSegmentId_fkey" FOREIGN KEY ("userSegmentId") REFERENCES "user_segments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payment_walls_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_payment_walls" ("createdAt", "createdBy", "id", "name", "paymentWallId", "sort", "status", "updatedAt", "userSegmentId") SELECT "createdAt", "createdBy", "id", "name", "paymentWallId", "sort", "status", "updatedAt", "userSegmentId" FROM "payment_walls";
DROP TABLE "payment_walls";
ALTER TABLE "new_payment_walls" RENAME TO "payment_walls";
CREATE UNIQUE INDEX "payment_walls_paymentWallId_key" ON "payment_walls"("paymentWallId");
CREATE TABLE "new_pricing_tier_novels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pricingTierId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "uniformChapterPrice" INTEGER,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pricing_tier_novels_pricingTierId_fkey" FOREIGN KEY ("pricingTierId") REFERENCES "pricing_tiers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pricing_tier_novels_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "novels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pricing_tier_novels_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pricing_tier_novels" ("createdAt", "createdBy", "id", "novelId", "pricingTierId", "uniformChapterPrice", "updatedAt") SELECT "createdAt", "createdBy", "id", "novelId", "pricingTierId", "uniformChapterPrice", "updatedAt" FROM "pricing_tier_novels";
DROP TABLE "pricing_tier_novels";
ALTER TABLE "new_pricing_tier_novels" RENAME TO "pricing_tier_novels";
CREATE UNIQUE INDEX "pricing_tier_novels_pricingTierId_novelId_key" ON "pricing_tier_novels"("pricingTierId", "novelId");
CREATE TABLE "new_pricing_tiers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pricingTierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userSegmentId" TEXT NOT NULL,
    "defaultChapterPrice" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pricing_tiers_userSegmentId_fkey" FOREIGN KEY ("userSegmentId") REFERENCES "user_segments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pricing_tiers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pricing_tiers" ("createdAt", "createdBy", "defaultChapterPrice", "id", "name", "pricingTierId", "sort", "status", "updatedAt", "userSegmentId") SELECT "createdAt", "createdBy", "defaultChapterPrice", "id", "name", "pricingTierId", "sort", "status", "updatedAt", "userSegmentId" FROM "pricing_tiers";
DROP TABLE "pricing_tiers";
ALTER TABLE "new_pricing_tiers" RENAME TO "pricing_tiers";
CREATE UNIQUE INDEX "pricing_tiers_pricingTierId_key" ON "pricing_tiers"("pricingTierId");
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "coins" INTEGER,
    "subscriptionDuration" TEXT,
    "productIdExternal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_products" ("coins", "createdAt", "createdBy", "id", "name", "os", "price", "productId", "productIdExternal", "status", "subscriptionDuration", "type", "updatedAt") SELECT "coins", "createdAt", "createdBy", "id", "name", "os", "price", "productId", "productIdExternal", "status", "subscriptionDuration", "type", "updatedAt" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_productId_key" ON "products"("productId");
CREATE TABLE "new_promo_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "promo_codes_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "novels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "promo_codes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_promo_codes" ("channelName", "code", "codeId", "createdAt", "createdBy", "id", "novelId", "status", "updatedAt") SELECT "channelName", "code", "codeId", "createdAt", "createdBy", "id", "novelId", "status", "updatedAt" FROM "promo_codes";
DROP TABLE "promo_codes";
ALTER TABLE "new_promo_codes" RENAME TO "promo_codes";
CREATE UNIQUE INDEX "promo_codes_codeId_key" ON "promo_codes"("codeId");
CREATE TABLE "new_user_segments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "osCondition" TEXT,
    "systemLanguage" TEXT,
    "countryLevels" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_segments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_user_segments" ("conditions", "countryLevels", "createdAt", "createdBy", "id", "name", "osCondition", "segmentId", "status", "updatedAt") SELECT "conditions", "countryLevels", "createdAt", "createdBy", "id", "name", "osCondition", "segmentId", "status", "updatedAt" FROM "user_segments";
DROP TABLE "user_segments";
ALTER TABLE "new_user_segments" RENAME TO "user_segments";
CREATE UNIQUE INDEX "user_segments_segmentId_key" ON "user_segments"("segmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "departments_deptId_key" ON "departments"("deptId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_roleId_key" ON "roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "menus_menuId_key" ON "menus"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_menuId_permission_key" ON "role_permissions"("roleId", "menuId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "columns_columnId_key" ON "columns"("columnId");

-- CreateIndex
CREATE UNIQUE INDEX "column_novels_columnId_novelId_key" ON "column_novels"("columnId", "novelId");

-- CreateIndex
CREATE UNIQUE INDEX "homepage_strategies_strategyId_key" ON "homepage_strategies"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "homepage_strategy_columns_strategyId_columnId_key" ON "homepage_strategy_columns"("strategyId", "columnId");
