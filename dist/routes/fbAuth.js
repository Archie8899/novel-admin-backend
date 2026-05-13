"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../utils/prisma"));
const helpers_1 = require("../utils/helpers");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 获取FB授权列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
        prisma_1.default.fBAuthorization.findMany({
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                createdByUser: {
                    select: { id: true, name: true, email: true },
                },
            },
        }),
        prisma_1.default.fBAuthorization.count(),
    ]);
    return (0, helpers_1.successResponse)(res, { data, total, page, pageSize });
}));
// 删除FB授权
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const auth = await prisma_1.default.fBAuthorization.findUnique({ where: { id } });
    if (!auth) {
        return (0, helpers_1.errorResponse)(res, 404, '授权记录不存在');
    }
    await prisma_1.default.fBAuthorization.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
// FB OAuth 授权登录（重定向到Facebook）
router.get('/facebook', (req, res) => {
    // 这里需要配置Facebook OAuth
    // 重定向到Facebook授权页面
    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || 'your_facebook_app_id';
    const REDIRECT_URI = encodeURIComponent(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/facebook/callback`);
    const FACEBOOK_AUTH_URL = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=ads_management,ads_read`;
    res.redirect(FACEBOOK_AUTH_URL);
});
// FB OAuth 回调
router.get('/facebook/callback', (0, helpers_1.asyncHandler)(async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return (0, helpers_1.errorResponse)(res, 400, '授权失败：未获取到授权码');
    }
    try {
        // 使用code换取access_token
        const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || 'your_facebook_app_id';
        const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'your_facebook_app_secret';
        const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}&redirect_uri=${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/facebook/callback`);
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
            return (0, helpers_1.errorResponse)(res, 400, '获取Access Token失败');
        }
        // 获取用户ID
        const userResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${tokenData.access_token}`);
        const userData = await userResponse.json();
        // 获取广告账号列表
        const accountsResponse = await fetch(`https://graph.facebook.com/v18.0/${userData.id}/adaccounts?access_token=${tokenData.access_token}`);
        const accountsData = await accountsResponse.json();
        // 计算token过期时间（假设90天后过期）
        const tokenExpiry = new Date();
        tokenExpiry.setDate(tokenExpiry.getDate() + 90);
        // 保存到数据库
        const auth = await prisma_1.default.fBAuthorization.create({
            data: {
                userId: userData.id,
                tokenExpiry,
                adAccounts: JSON.stringify(accountsData.data || []),
                createdBy: req.user?.userId,
            },
        });
        // 重定向到前端页面，并传递token
        const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendURL}/login?token=${tokenData.access_token}&user=${encodeURIComponent(JSON.stringify({ id: auth.id, userId: auth.userId }))}`);
    }
    catch (error) {
        console.error('FB OAuth callback error:', error);
        return (0, helpers_1.errorResponse)(res, 500, '授权回调处理失败');
    }
}));
exports.default = router;
//# sourceMappingURL=fbAuth.js.map