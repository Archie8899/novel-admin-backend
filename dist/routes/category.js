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
// Helper to safely get string query param
const getStringParam = (query, key) => {
    const val = query[key];
    if (typeof val === 'string')
        return val;
    if (Array.isArray(val) && typeof val[0] === 'string')
        return val[0];
    return undefined;
};
// 获取分类列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    const query = req.query;
    const where = {};
    const categoryId = getStringParam(query, 'categoryId');
    const categoryName = getStringParam(query, 'categoryName');
    const status = getStringParam(query, 'status');
    const startDate = getStringParam(query, 'startDate');
    const endDate = getStringParam(query, 'endDate');
    if (categoryId) {
        where.categoryId = categoryId;
    }
    if (categoryName) {
        where.name = { contains: categoryName };
    }
    if (status && status !== 'all') {
        where.status = status;
    }
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
            where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
            where.createdAt.lte = new Date(endDate);
        }
    }
    const [categories, total] = await Promise.all([
        prisma_1.default.category.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
        }),
        prisma_1.default.category.count({ where }),
    ]);
    const data = categories.map(cat => ({
        id: cat.id,
        categoryId: cat.categoryId,
        name: cat.name,
        chineseName: cat.chineseName,
        status: cat.status,
        createdBy: cat.createdBy || '-',
        createdAt: cat.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取有效分类列表
router.get('/options', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const categories = await prisma_1.default.category.findMany({
        where: { status: 'active' },
        select: {
            id: true,
            categoryId: true,
            name: true,
            chineseName: true,
        },
        orderBy: { name: 'asc' },
    });
    return (0, helpers_1.successResponse)(res, categories);
}));
// 获取单个分类
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const category = await prisma_1.default.category.findUnique({
        where: { id },
    });
    if (!category) {
        return (0, helpers_1.errorResponse)(res, 404, '分类不存在');
    }
    return (0, helpers_1.successResponse)(res, {
        id: category.id,
        categoryId: category.categoryId,
        name: category.name,
        chineseName: category.chineseName,
        status: category.status,
        createdBy: category.createdBy || '-',
        createdAt: category.createdAt,
    });
}));
// 新建分类
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { categoryName, chineseName, status = 'active' } = req.body;
    if (!categoryName || !chineseName) {
        return (0, helpers_1.errorResponse)(res, 400, '分类名称和中文名称为必填项');
    }
    if (categoryName.length > 40 || chineseName.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '名称长度不能超过40字符');
    }
    const count = await prisma_1.default.category.count();
    const newCategoryId = `CAT${String(count + 1).padStart(6, '0')}`;
    const category = await prisma_1.default.category.create({
        data: {
            categoryId: newCategoryId,
            name: categoryName,
            chineseName,
            status,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: category.id,
        categoryId: category.categoryId,
        name: category.name,
        chineseName: category.chineseName,
        status: category.status,
        createdAt: category.createdAt,
    }, '创建成功');
}));
// 编辑分类
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { categoryName, chineseName, status } = req.body;
    const existingCategory = await prisma_1.default.category.findUnique({ where: { id } });
    if (!existingCategory) {
        return (0, helpers_1.errorResponse)(res, 404, '分类不存在');
    }
    if (categoryName && categoryName.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '分类名称长度不能超过40字符');
    }
    if (chineseName && chineseName.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '中文名称长度不能超过40字符');
    }
    const category = await prisma_1.default.category.update({
        where: { id },
        data: {
            name: categoryName || existingCategory.name,
            chineseName: chineseName || existingCategory.chineseName,
            status: status || existingCategory.status,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: category.id,
        categoryId: category.categoryId,
        name: category.name,
        chineseName: category.chineseName,
        status: category.status,
        createdAt: category.createdAt,
    }, '更新成功');
}));
// 删除分类
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingCategory = await prisma_1.default.category.findUnique({ where: { id } });
    if (!existingCategory) {
        return (0, helpers_1.errorResponse)(res, 404, '分类不存在');
    }
    const novelCount = await prisma_1.default.novel.count({ where: { categoryId: id } });
    if (novelCount > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该分类下存在${novelCount}本小说，无法删除`);
    }
    await prisma_1.default.category.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
exports.default = router;
//# sourceMappingURL=category.js.map