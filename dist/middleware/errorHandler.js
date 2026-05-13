"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.asyncHandler = asyncHandler;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const helpers_1 = require("../utils/helpers");
// 自定义错误类型
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// 异步处理器包装
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
// 全局错误处理中间件
function errorHandler(err, req, res, next) {
    console.error('Error:', err);
    if (err instanceof AppError) {
        return (0, helpers_1.errorResponse)(res, err.statusCode, err.message);
    }
    // Prisma错误处理
    if (err.name === 'PrismaClientKnownRequestError') {
        const prismaErr = err;
        // 唯一约束错误
        if (prismaErr.code === 'P2002') {
            return (0, helpers_1.errorResponse)(res, 400, '该记录已存在，请勿重复创建');
        }
        // 外键约束错误
        if (prismaErr.code === 'P2003') {
            return (0, helpers_1.errorResponse)(res, 400, '关联数据不存在');
        }
        // 记录未找到
        if (prismaErr.code === 'P2025') {
            return (0, helpers_1.errorResponse)(res, 404, '记录未找到');
        }
    }
    // 未知错误
    return (0, helpers_1.errorResponse)(res, 500, process.env.NODE_ENV === 'production'
        ? '服务器内部错误'
        : err.message);
}
// 404处理
function notFoundHandler(req, res) {
    return (0, helpers_1.errorResponse)(res, 404, `路由 ${req.method} ${req.path} 不存在`);
}
//# sourceMappingURL=errorHandler.js.map