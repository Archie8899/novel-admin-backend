"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.roleMiddleware = roleMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const helpers_1 = require("../utils/helpers");
// 验证Token中间件
function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return (0, helpers_1.errorResponse)(res, 401, '未提供认证令牌');
        }
        const token = authHeader.substring(7);
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return (0, helpers_1.errorResponse)(res, 401, '令牌已过期');
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return (0, helpers_1.errorResponse)(res, 401, '无效的令牌');
        }
        return (0, helpers_1.errorResponse)(res, 401, '认证失败');
    }
}
// 角色验证中间件
function roleMiddleware(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return (0, helpers_1.errorResponse)(res, 401, '未登录');
        }
        if (!allowedRoles.includes(req.user.role)) {
            return (0, helpers_1.errorResponse)(res, 403, '权限不足');
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map