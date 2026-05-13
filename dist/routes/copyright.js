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
// 获取版权方列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { companyId, companyName, status, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (companyId) {
        where.companyId = companyId;
    }
    if (companyName) {
        where.name = { contains: companyName };
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
    const [companies, total] = await Promise.all([
        prisma_1.default.copyrightCompany.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                createdByUser: {
                    select: { name: true, email: true }
                }
            }
        }),
        prisma_1.default.copyrightCompany.count({ where }),
    ]);
    // 格式化返回数据
    const data = companies.map(company => ({
        id: company.id,
        companyId: company.companyId,
        name: company.name,
        status: company.status,
        createdBy: company.createdByUser?.name || company.createdByUser?.email || '-',
        createdAt: company.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取有效版权方列表（用于下拉选择）
router.get('/options', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const companies = await prisma_1.default.copyrightCompany.findMany({
        where: { status: 'active' },
        select: {
            id: true,
            companyId: true,
            name: true,
        },
        orderBy: { name: 'asc' },
    });
    return (0, helpers_1.successResponse)(res, companies);
}));
// 获取单个版权方
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const company = await prisma_1.default.copyrightCompany.findUnique({
        where: { id },
        include: {
            createdByUser: {
                select: { name: true, email: true }
            }
        }
    });
    if (!company) {
        return (0, helpers_1.errorResponse)(res, 404, '版权方不存在');
    }
    return (0, helpers_1.successResponse)(res, {
        id: company.id,
        companyId: company.companyId,
        name: company.name,
        status: company.status,
        createdBy: company.createdByUser?.name || company.createdByUser?.email || '-',
        createdAt: company.createdAt,
    });
}));
// 新建版权方
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { companyName, status = 'active' } = req.body;
    // 验证必填字段
    if (!companyName) {
        return (0, helpers_1.errorResponse)(res, 400, '公司名称为必填项');
    }
    // 校验长度
    if (companyName.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '公司名称长度不能超过40字符');
    }
    // 检查名称是否重复
    const existing = await prisma_1.default.copyrightCompany.findFirst({
        where: { name: companyName }
    });
    if (existing) {
        return (0, helpers_1.errorResponse)(res, 400, '该公司名称已存在');
    }
    // 生成唯一编号
    const count = await prisma_1.default.copyrightCompany.count();
    const companyId = `CPY${String(count + 1).padStart(6, '0')}`;
    const company = await prisma_1.default.copyrightCompany.create({
        data: {
            companyId,
            name: companyName,
            status,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: company.id,
        companyId: company.companyId,
        name: company.name,
        status: company.status,
        createdAt: company.createdAt,
    }, '创建成功');
}));
// 编辑版权方
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { companyName, status } = req.body;
    const existingCompany = await prisma_1.default.copyrightCompany.findUnique({ where: { id } });
    if (!existingCompany) {
        return (0, helpers_1.errorResponse)(res, 404, '版权方不存在');
    }
    // 校验长度
    if (companyName && companyName.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '公司名称长度不能超过40字符');
    }
    // 检查名称是否重复
    if (companyName && companyName !== existingCompany.name) {
        const existing = await prisma_1.default.copyrightCompany.findFirst({
            where: { name: companyName }
        });
        if (existing) {
            return (0, helpers_1.errorResponse)(res, 400, '该公司名称已存在');
        }
    }
    const company = await prisma_1.default.copyrightCompany.update({
        where: { id },
        data: {
            name: companyName || existingCompany.name,
            status: status || existingCompany.status,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: company.id,
        companyId: company.companyId,
        name: company.name,
        status: company.status,
        createdAt: company.createdAt,
    }, '更新成功');
}));
// 删除版权方
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingCompany = await prisma_1.default.copyrightCompany.findUnique({ where: { id } });
    if (!existingCompany) {
        return (0, helpers_1.errorResponse)(res, 404, '版权方不存在');
    }
    // 检查是否有关联的小说
    const novelCount = await prisma_1.default.novel.count({ where: { copyrightCompanyId: id } });
    if (novelCount > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该版权方下存在${novelCount}本小说，无法删除`);
    }
    await prisma_1.default.copyrightCompany.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
exports.default = router;
//# sourceMappingURL=copyright.js.map