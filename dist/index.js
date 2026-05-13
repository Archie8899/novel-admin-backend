"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("./middleware/errorHandler");
// 加载环境变量
dotenv_1.default.config();
// 导入路由
const auth_1 = __importDefault(require("./routes/auth"));
const fbAuth_1 = __importDefault(require("./routes/fbAuth"));
const category_1 = __importDefault(require("./routes/category"));
const copyright_1 = __importDefault(require("./routes/copyright"));
const novel_1 = __importDefault(require("./routes/novel"));
const chapter_1 = __importDefault(require("./routes/chapter"));
const product_1 = __importDefault(require("./routes/product"));
const paymentWall_1 = __importDefault(require("./routes/paymentWall"));
const landingPage_1 = __importDefault(require("./routes/landingPage"));
const promoCode_1 = __importDefault(require("./routes/promoCode"));
const channel_1 = __importDefault(require("./routes/channel"));
const order_1 = __importDefault(require("./routes/order"));
const appUser_1 = __importDefault(require("./routes/appUser"));
const userSegment_1 = __importDefault(require("./routes/userSegment"));
const pricingTier_1 = __importDefault(require("./routes/pricingTier"));
const adminUser_1 = __importDefault(require("./routes/adminUser"));
const role_1 = __importDefault(require("./routes/role"));
const department_1 = __importDefault(require("./routes/department"));
const menu_1 = __importDefault(require("./routes/menu"));
const operationLog_1 = __importDefault(require("./routes/operationLog"));
const upload_1 = __importDefault(require("./routes/upload"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// 中间件
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// 静态文件服务 - 上传文件
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API路由
app.use('/api/auth', auth_1.default);
app.use('/api/fb-authorizations', fbAuth_1.default);
app.use('/api/categories', category_1.default);
app.use('/api/copyright-companies', copyright_1.default);
app.use('/api/novels', novel_1.default);
app.use('/api/chapters', chapter_1.default);
app.use('/api/products', product_1.default);
app.use('/api/payment-walls', paymentWall_1.default);
app.use('/api/landing-pages', landingPage_1.default);
app.use('/api/promo-codes', promoCode_1.default);
app.use('/api/channels', channel_1.default);
app.use('/api/orders', order_1.default);
app.use('/api/app-users', appUser_1.default);
app.use('/api/user-segments', userSegment_1.default);
app.use('/api/pricing-tiers', pricingTier_1.default);
app.use('/api/admin-users', adminUser_1.default);
app.use('/api/roles', role_1.default);
app.use('/api/departments', department_1.default);
app.use('/api/menus', menu_1.default);
app.use('/api/operation-logs', operationLog_1.default);
app.use('/api/upload', upload_1.default);
// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});
// 错误处理
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 API documentation: http://localhost:${PORT}/api/health`);
});
exports.default = app;
//# sourceMappingURL=index.js.map