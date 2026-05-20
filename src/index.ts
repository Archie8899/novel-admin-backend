import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { operationLogMiddleware } from './middleware/operationLog';

// 加载环境变量
dotenv.config();

// 导入路由
import authRoutes from './routes/auth';
import fbAuthRoutes from './routes/fbAuth';
import categoryRoutes from './routes/category';
import copyrightRoutes from './routes/copyright';
import novelRoutes from './routes/novel';
import chapterRoutes from './routes/chapter';
import productRoutes from './routes/product';
import paymentWallRoutes from './routes/paymentWall';
import landingPageRoutes from './routes/landingPage';
import promoCodeRoutes from './routes/promoCode';
import channelRoutes from './routes/channel';
import orderRoutes from './routes/order';
import appUserRoutes from './routes/appUser';
import userSegmentRoutes from './routes/userSegment';
import pricingTierRoutes from './routes/pricingTier';
import adminUserRoutes from './routes/adminUser';
import roleRoutes from './routes/role';
import departmentRoutes from './routes/department';
import menuRoutes from './routes/menu';
import operationLogRoutes from './routes/operationLog';
import uploadRoutes from './routes/upload';
import columnRoutes from './routes/column';
import homepageStrategyRoutes from './routes/homepageStrategy';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 上传文件
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/fb-authorizations', fbAuthRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/copyright-companies', copyrightRoutes);
app.use('/api/novels', novelRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payment-walls', paymentWallRoutes);
app.use('/api/landing-pages', landingPageRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/app-users', appUserRoutes);
app.use('/api/user-segments', userSegmentRoutes);
app.use('/api/pricing-tiers', pricingTierRoutes);
app.use('/api/admin-users', adminUserRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/operation-logs', operationLogRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/homepage-strategies', homepageStrategyRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// 错误处理
app.use(notFoundHandler);
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API documentation: http://localhost:${PORT}/api/health`);
});

export default app;
