import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 创建管理员用户
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@novel.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@novel.com',
      password: adminPassword,
      name: 'Admin',
      role: 'admin',
      status: 'active',
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // 创建测试用户
  const testPassword = await bcrypt.hash('test123', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@novel.com' },
    update: {},
    create: {
      username: 'test',
      email: 'test@novel.com',
      password: testPassword,
      name: 'Test User',
      role: 'editor',
      status: 'active',
    },
  });
  console.log('✅ Created test user:', testUser.email);

  // 创建小说分类
  const categories = [
    { categoryId: 'CAT000001', name: 'Fantasy', chineseName: '奇幻', status: 'active' },
    { categoryId: 'CAT000002', name: 'Romance', chineseName: '言情', status: 'active' },
    { categoryId: 'CAT000003', name: 'Sci-Fi', chineseName: '科幻', status: 'active' },
    { categoryId: 'CAT000004', name: 'Mystery', chineseName: '悬疑', status: 'active' },
    { categoryId: 'CAT000005', name: 'Action', chineseName: '动作', status: 'active' },
    { categoryId: 'CAT000006', name: 'Comedy', chineseName: '喜剧', status: 'active' },
    { categoryId: 'CAT000007', name: 'Horror', chineseName: '恐怖', status: 'active' },
    { categoryId: 'CAT000008', name: 'Drama', chineseName: '剧情', status: 'inactive' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { categoryId: cat.categoryId },
      update: {},
      create: {
        ...cat,
        createdBy: admin.id,
      },
    });
  }
  console.log('✅ Created categories:', categories.length);

  // 创建版权方
  const companies = [
    { companyId: 'CPY000001', name: 'Pearl Publishing', status: 'active' },
    { companyId: 'CPY000002', name: 'Dragon Books', status: 'active' },
    { companyId: 'CPY000003', name: 'Star Novels', status: 'active' },
    { companyId: 'CPY000004', name: 'Moonlight Press', status: 'inactive' },
  ];

  for (const company of companies) {
    await prisma.copyrightCompany.upsert({
      where: { companyId: company.companyId },
      update: {},
      create: {
        ...company,
        createdBy: admin.id,
      },
    });
  }
  console.log('✅ Created copyright companies:', companies.length);

  // 创建用户分层
  const segments = [
    {
      segmentId: 'SEG000001',
      name: 'iOS High Value',
      conditions: ['os', 'country_level'],
      osCondition: 'iOS',
      countryLevels: { T0: ['US', 'UK'], T1: ['CA', 'AU'] },
      status: 'active',
    },
    {
      segmentId: 'SEG000002',
      name: 'Android General',
      conditions: ['os'],
      osCondition: 'Android',
      countryLevels: {},
      status: 'active',
    },
    {
      segmentId: 'SEG000003',
      name: 'H5 Tier1 Countries',
      conditions: ['country_level'],
      osCondition: null,
      countryLevels: { T0: ['US', 'UK', 'CA', 'AU', 'DE', 'FR'] },
      status: 'active',
    },
  ];

  for (const segment of segments) {
    await prisma.userSegment.upsert({
      where: { segmentId: segment.segmentId },
      update: {},
      create: {
        segmentId: segment.segmentId,
        name: segment.name,
        conditions: JSON.stringify(segment.conditions),
        osCondition: segment.osCondition,
        countryLevels: JSON.stringify(segment.countryLevels),
        status: segment.status,
        createdBy: admin.id,
      },
    });
  }
  console.log('✅ Created user segments:', segments.length);

  // 创建商品
  const products = [
    { productId: 'PRD000001', name: '100 Coins Pack', type: 'recharge', os: 'H5', price: 99, coins: 100, status: 'active' },
    { productId: 'PRD000002', name: '500 Coins Pack', type: 'recharge', os: 'H5', price: 449, coins: 500, status: 'active' },
    { productId: 'PRD000003', name: '1000 Coins Pack', type: 'recharge', os: 'H5', price: 799, coins: 1000, status: 'active' },
    { productId: 'PRD000004', name: 'VIP Weekly', type: 'subscription', os: 'H5', price: 299, subscriptionDuration: '1week', status: 'active' },
    { productId: 'PRD000005', name: 'VIP Monthly', type: 'subscription', os: 'H5', price: 999, subscriptionDuration: '1month', status: 'active' },
    { productId: 'PRD000006', name: 'VIP Yearly', type: 'subscription', os: 'H5', price: 7999, subscriptionDuration: '12months', status: 'active' },
    { productId: 'PRD000007', name: 'Starter Pack', type: 'recharge', os: 'iOS', price: 129, coins: 80, productIdExternal: 'com.novel.starter', status: 'active' },
    { productId: 'PRD000008', name: 'Premium Pack', type: 'recharge', os: 'Android', price: 599, coins: 600, productIdExternal: 'com.novel.premium', status: 'active' },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { productId: product.productId },
      update: {},
      create: {
        ...product,
        createdBy: admin.id,
      },
    });
  }
  console.log('✅ Created products:', products.length);

  // 创建渠道
  const channels = [
    { channelId: 'CH000001', name: 'Google Ads', secret: 'google_secret_key_123' },
    { channelId: 'CH000002', name: 'Facebook Ads', secret: 'facebook_secret_key_456' },
    { channelId: 'CH000003', name: 'TikTok Ads', secret: 'tiktok_secret_key_789' },
    { channelId: 'CH000004', name: 'Organic', secret: 'organic_secret_key_000' },
  ];

  for (const channel of channels) {
    await prisma.channel.upsert({
      where: { channelId: channel.channelId },
      update: {},
      create: {
        ...channel,
        createdBy: admin.id,
      },
    });
  }
  console.log('✅ Created channels:', channels.length);

  // 创建示例小说
  const fantasyCategory = await prisma.category.findFirst({ where: { name: 'Fantasy' } });
  const romanceCategory = await prisma.category.findFirst({ where: { name: 'Romance' } });
  const pearlPublishing = await prisma.copyrightCompany.findFirst({ where: { name: 'Pearl Publishing' } });

  if (fantasyCategory && pearlPublishing) {
    const novel = await prisma.novel.upsert({
      where: { novelId: 'NOV000001' },
      update: {},
      create: {
        novelId: 'NOV000001',
        name: 'The Dragon Chronicles',
        chineseName: '龙之编年史',
        categoryId: fantasyCategory.id,
        language: 'english',
        author: 'John Smith',
        copyrightCompanyId: pearlPublishing.id,
        description: 'An epic fantasy tale of dragons and heroes.',
        coverImage: 'https://example.com/covers/dragon.jpg',
        isChargeable: true,
        wordCount: 150000,
        views: 50000,
        manualViews: 10000,
        status: 'online',
        createdBy: admin.id,
      },
    });
    console.log('✅ Created sample novel:', novel.name);

    // 创建章节
    const chapters = [
      { chapterId: 'CHP000001', title: 'The Beginning', chapterNumber: 1, isChargeable: false, price: null },
      { chapterId: 'CHP000002', title: 'The Journey Starts', chapterNumber: 2, isChargeable: true, price: 10 },
      { chapterId: 'CHP000003', title: 'First Battle', chapterNumber: 3, isChargeable: true, price: 10 },
      { chapterId: 'CHP000004', title: 'The Dragon Appears', chapterNumber: 4, isChargeable: true, price: 15 },
      { chapterId: 'CHP000005', title: 'Alliance', chapterNumber: 5, isChargeable: true, price: 15 },
    ];

    for (const chapter of chapters) {
      await prisma.chapter.upsert({
        where: { chapterId: chapter.chapterId },
        update: {},
        create: {
          ...chapter,
          novelId: novel.id,
          content: `Chapter content for "${chapter.title}" goes here. This is a sample chapter with rich text content...`,
          createdBy: admin.id,
        },
      });
    }
    console.log('✅ Created chapters:', chapters.length);
  }

  // 创建示例用户
  const appUsers = [
    { userId: 'USR000001', email: 'user1@example.com', os: 'H5', coins: 500, isSubscribed: true, status: 'active' },
    { userId: 'USR000002', email: 'user2@example.com', os: 'iOS', coins: 200, isSubscribed: false, status: 'active' },
    { userId: 'USR000003', email: 'user3@example.com', os: 'Android', coins: 1000, isSubscribed: true, status: 'active' },
  ];

  for (const user of appUsers) {
    await prisma.appUser.upsert({
      where: { userId: user.userId },
      update: {},
      create: user,
    });
  }
  console.log('✅ Created app users:', appUsers.length);

  // 创建示例订单
  const testUserData = await prisma.appUser.findFirst({ where: { userId: 'USR000001' } });
  const rechargeProduct = await prisma.product.findFirst({ where: { productId: 'PRD000002' } });

  if (testUserData && rechargeProduct) {
    const order = await prisma.order.upsert({
      where: { orderId: 'ORD000001' },
      update: {},
      create: {
        orderId: 'ORD000001',
        storeOrderId: 'STORE_ORD_123456',
        userId: testUserData.id, // 使用AppUser的id字段
        productName: rechargeProduct.name,
        productType: 'recharge',
        productPrice: rechargeProduct.price,
        paymentMethod: 'PayPal',
        status: 'paid',
        promoCode: 'WELCOME10',
      },
    });
    console.log('✅ Created sample order:', order.orderId);
  }

  // 创建角色
  const roles = [
    { roleId: 'ROLE001', name: '超级管理员', code: 'super_admin', description: '拥有所有权限', status: 'active' },
    { roleId: 'ROLE002', name: '管理员', code: 'admin', description: '拥有大部分管理权限', status: 'active' },
    { roleId: 'ROLE003', name: '编辑', code: 'editor', description: '负责内容编辑', status: 'active' },
    { roleId: 'ROLE004', name: '运营', code: 'operator', description: '负责运营数据分析', status: 'active' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { roleId: role.roleId },
      update: {},
      create: {
        ...role,
        createdBy: admin.id,
      },
    });
  }
  console.log('✅ Created roles:', roles.length);

  // 创建部门
  const departments = [
    { deptId: 'DEPT001', name: '技术部', sort: 1, status: 'active' },
    { deptId: 'DEPT002', name: '运营部', sort: 2, status: 'active' },
    { deptId: 'DEPT003', name: '编辑部', sort: 3, status: 'active' },
    { deptId: 'DEPT004', name: '市场部', sort: 4, status: 'active' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { deptId: dept.deptId },
      update: {},
      create: {
        ...dept,
        createdBy: admin.id,
      },
    });
  }
  console.log('✅ Created departments:', departments.length);

  // 创建菜单
  const menus = [
    { menuId: 'MENU001', name: '仪表盘', path: '/dashboard', icon: 'Dashboard', sort: 1, type: 'menu', status: 'active' },
    { menuId: 'MENU002', name: '小说管理', path: '/novels', icon: 'Book', sort: 2, type: 'menu', status: 'active' },
    { menuId: 'MENU003', name: '充值订阅', path: '/products', icon: 'Dollar', sort: 3, type: 'menu', status: 'active' },
    { menuId: 'MENU004', name: '投放管理', path: '/landing-pages', icon: 'Rocket', sort: 4, type: 'menu', status: 'active' },
    { menuId: 'MENU005', name: '分销管理', path: '/promo-codes', icon: 'Share', sort: 5, type: 'menu', status: 'active' },
    { menuId: 'MENU006', name: '订单管理', path: '/orders', icon: 'ShoppingCart', sort: 6, type: 'menu', status: 'active' },
    { menuId: 'MENU007', name: '系统管理', path: '/system', icon: 'Setting', sort: 7, type: 'menu', status: 'active' },
    { menuId: 'MENU008', name: '用户分层', path: '/user-segments', icon: 'Usergroup', parentId: null, sort: 7, type: 'menu', status: 'active' },
    { menuId: 'MENU009', name: '定价层级', path: '/pricing-tiers', icon: 'Tag', sort: 8, type: 'menu', status: 'active' },
  ];

  for (const menu of menus) {
    await prisma.menu.upsert({
      where: { menuId: menu.menuId },
      update: {},
      create: {
        ...menu,
        createdBy: admin.id,
      },
    });
  }
  console.log('✅ Created menus:', menus.length);

  console.log('\n🎉 Database seed completed!');
  console.log('\n📝 Login credentials:');
  console.log('   Admin: admin@novel.com / admin123');
  console.log('   Test: test@novel.com / test123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
