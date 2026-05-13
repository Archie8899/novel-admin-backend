"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
exports.successResponse = successResponse;
exports.paginatedResponse = paginatedResponse;
exports.errorResponse = errorResponse;
exports.parsePaginationParams = parsePaginationParams;
exports.generateId = generateId;
exports.formatDateTime = formatDateTime;
exports.formatViews = formatViews;
// 异步处理器包装
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
// 成功响应
function successResponse(res, data, message) {
    const response = {
        success: true,
        data,
        message,
    };
    return res.json(response);
}
// 分页响应
function paginatedResponse(res, data, total, page, pageSize) {
    const response = {
        success: true,
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
    return res.json(response);
}
// 错误响应
function errorResponse(res, statusCode = 500, message, error) {
    const response = {
        success: false,
        message,
        error,
    };
    return res.status(statusCode).json(response);
}
function parsePaginationParams(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;
    return { page, pageSize, skip };
}
// 生成唯一ID
function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}_${timestamp}${randomStr}` : `${timestamp}${randomStr}`;
}
// 格式化日期
function formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
// 格式化浏览量显示
function formatViews(views) {
    if (views < 1000)
        return views.toString();
    if (views < 1000000)
        return `${(views / 1000).toFixed(1)}k`;
    if (views < 1000000000)
        return `${(views / 1000000).toFixed(1)}m`;
    return '99m+';
}
//# sourceMappingURL=helpers.js.map