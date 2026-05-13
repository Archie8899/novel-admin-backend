"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoginLog = exports.operationLogMiddleware = exports.getModuleName = exports.getClientIp = exports.createOperationLog = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// 操作日志白名单（不记录日志的路径）
const WHITELIST_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/facebook',
    '/api/auth/facebook/callback',
];
// 需要记录日志的HTTP方法
const LOG_METHODS = ['POST', 'PUT', 'DELETE'];
const createOperationLog = async (logData) => {
    try {
        await prisma_1.default.operationLog.create({
            data: {
                userId: logData.userId,
                username: logData.username,
                module: logData.module,
                action: logData.action,
                method: logData.method,
                url: logData.url,
                params: logData.params,
                ip: logData.ip,
                userAgent: logData.userAgent,
                status: logData.status || 'success',
                errorMsg: logData.errorMsg,
            },
        });
    }
    catch (error) {
        console.error('Failed to create operation log:', error);
    }
};
exports.createOperationLog = createOperationLog;
// 获取客户端IP
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        '';
};
exports.getClientIp = getClientIp;
// 获取模块名称
const getModuleName = (url) => {
    const path = url.replace('/api/', '');
    const parts = path.split('/');
    // 移除ID等参数部分
    const cleanParts = parts.filter(p => !p.match(/^[a-f0-9]{24}$|^\w{4,}$/i));
    let module = cleanParts[0] || '';
    let action = cleanParts[1] || '';
    // 格式化模块名称
    const moduleMap = {
        'categories': '分类管理',
        'copyright-companies': '版权方管理',
        'novels': '小说管理',
        'chapters': '章节管理',
        'products': '商品管理',
        'payment-walls': '支付墙管理',
        'landing-pages': '落地页管理',
        'promo-codes': '优惠码管理',
        'channels': '渠道管理',
        'orders': '订单管理',
        'app-users': 'App用户管理',
        'user-segments': '用户分层管理',
        'pricing-tiers': '定价层级管理',
        'admin-users': '管理员用户管理',
        'roles': '角色管理',
        'departments': '部门管理',
        'menus': '菜单管理',
        'operation-logs': '操作日志管理',
        'login-logs': '登录日志管理',
    };
    // 格式化动作名称
    const actionMap = {
        'POST': '创建',
        'PUT': '更新',
        'DELETE': '删除',
        'create': '创建',
        'update': '更新',
        'delete': '删除',
    };
    return {
        module: moduleMap[module] || module,
        action: actionMap[action] || action,
    };
};
exports.getModuleName = getModuleName;
// 操作日志中间件
const operationLogMiddleware = async (req, res, next) => {
    // 只记录指定的HTTP方法
    if (!LOG_METHODS.includes(req.method)) {
        return next();
    }
    // 检查白名单
    if (WHITELIST_PATHS.some(p => req.path.includes(p))) {
        return next();
    }
    // @ts-ignore
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        // 如果有用户信息且请求成功，记录日志
        const user = req.user;
        if (user && body && body.success !== false) {
            const { module, action } = (0, exports.getModuleName)(req.path);
            (0, exports.createOperationLog)({
                userId: user.userId,
                username: user.username || user.email || user.userId,
                module,
                action,
                method: req.method,
                url: req.originalUrl,
                params: ['POST', 'PUT'].includes(req.method) ? JSON.stringify(req.body).substring(0, 1000) : undefined,
                ip: (0, exports.getClientIp)(req),
                userAgent: req.headers['user-agent'],
                status: 'success',
                errorMsg: body.message,
            }).catch(err => console.error('Failed to create operation log:', err));
        }
        return originalJson(body);
    };
    next();
};
exports.operationLogMiddleware = operationLogMiddleware;
// 登录日志记录
const createLoginLog = async (data) => {
    try {
        await prisma_1.default.loginLog.create({
            data: {
                userId: data.userId,
                username: data.username,
                ip: data.ip,
                userAgent: data.userAgent,
                status: data.status,
                message: data.message,
            },
        });
    }
    catch (error) {
        console.error('Failed to create login log:', error);
    }
};
exports.createLoginLog = createLoginLog;
//# sourceMappingURL=operationLog.js.map