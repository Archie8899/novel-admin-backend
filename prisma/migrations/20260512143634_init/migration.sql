-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chineseName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "categories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "copyright_companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "copyright_companies_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "novels" (
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
    CONSTRAINT "novels_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chapters" (
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
    CONSTRAINT "chapters_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
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
    CONSTRAINT "products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_walls" (
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
    CONSTRAINT "payment_walls_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_wall_products" (
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
    CONSTRAINT "payment_wall_products_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "landing_pages" (
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
    CONSTRAINT "landing_pages_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fb_authorizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenExpiry" DATETIME NOT NULL,
    "adAccounts" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fb_authorizations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "promo_codes" (
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
    CONSTRAINT "promo_codes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "channels_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "storeOrderId" TEXT,
    "userId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "productPrice" INTEGER NOT NULL,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL,
    "promoCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "os" TEXT,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "isSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_segments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "segmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "osCondition" TEXT,
    "countryLevels" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_segments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pricing_tiers" (
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
    CONSTRAINT "pricing_tiers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pricing_tier_novels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pricingTierId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "uniformChapterPrice" INTEGER,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pricing_tier_novels_pricingTierId_fkey" FOREIGN KEY ("pricingTierId") REFERENCES "pricing_tiers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pricing_tier_novels_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "novels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pricing_tier_novels_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pricing_tier_novel_ranges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pricingTierNovelId" TEXT NOT NULL,
    "startChapter" INTEGER NOT NULL,
    "endChapter" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pricing_tier_novel_ranges_pricingTierNovelId_fkey" FOREIGN KEY ("pricingTierNovelId") REFERENCES "pricing_tier_novels" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_categoryId_key" ON "categories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "copyright_companies_companyId_key" ON "copyright_companies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "novels_novelId_key" ON "novels"("novelId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_chapterId_key" ON "chapters"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_novelId_chapterNumber_key" ON "chapters"("novelId", "chapterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "products_productId_key" ON "products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_walls_paymentWallId_key" ON "payment_walls"("paymentWallId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_codeId_key" ON "promo_codes"("codeId");

-- CreateIndex
CREATE UNIQUE INDEX "channels_channelId_key" ON "channels"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderId_key" ON "orders"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_userId_key" ON "app_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_segments_segmentId_key" ON "user_segments"("segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tiers_pricingTierId_key" ON "pricing_tiers"("pricingTierId");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tier_novels_pricingTierId_novelId_key" ON "pricing_tier_novels"("pricingTierId", "novelId");
