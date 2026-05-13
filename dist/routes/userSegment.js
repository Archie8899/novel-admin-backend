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
// 获取用户分层列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, condition, status, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (name) {
        where.name = { contains: name };
    }
    if (condition && condition !== 'all') {
        // 根据分层条件筛选
        where.conditions = {
            array_contains: condition
        };
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
    const [segments, total] = await Promise.all([
        prisma_1.default.userSegment.findMany({
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
        prisma_1.default.userSegment.count({ where }),
    ]);
    // 格式化返回数据
    const data = segments.map(segment => ({
        id: segment.id,
        segmentId: segment.segmentId,
        name: segment.name,
        conditions: JSON.parse(segment.conditions || "[]"),
        conditionsDisplay: formatConditions(JSON.parse(segment.conditions || "[]")),
        osCondition: segment.osCondition,
        countryLevels: segment.countryLevels,
        status: segment.status,
        statusDisplay: segment.status === 'active' ? '有效' : '无效',
        createdBy: segment.createdByUser?.name || segment.createdByUser?.email || '-',
        createdAt: segment.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取有效用户分层列表（用于下拉选择）
router.get('/options', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const segments = await prisma_1.default.userSegment.findMany({
        where: { status: 'active' },
        select: {
            id: true,
            segmentId: true,
            name: true,
        },
        orderBy: { name: 'asc' },
    });
    return (0, helpers_1.successResponse)(res, segments);
}));
// 获取单个用户分层
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const segment = await prisma_1.default.userSegment.findUnique({
        where: { id },
        include: {
            createdByUser: {
                select: { name: true, email: true }
            }
        }
    });
    if (!segment) {
        return (0, helpers_1.errorResponse)(res, 404, '用户分层不存在');
    }
    return (0, helpers_1.successResponse)(res, {
        ...segment,
        conditions: JSON.parse(segment.conditions || "[]"),
        countryLevels: JSON.parse(segment.countryLevels || "{}"),
    });
}));
// 新建用户分层
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, conditions, osCondition, systemLanguage, countryLevels, status = 'active' } = req.body;
    // 验证必填字段
    if (!name) {
        return (0, helpers_1.errorResponse)(res, 400, '分层名称为必填项');
    }
    // 校验长度
    if (name.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '分层名称长度不能超过40字符');
    }
    // 验证分层条件
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
        return (0, helpers_1.errorResponse)(res, 400, '请选择至少一个分层条件');
    }
    // 验证操作系统条件
    if (conditions.includes('os')) {
        if (!osCondition) {
            return (0, helpers_1.errorResponse)(res, 400, '请选择操作系统条件');
        }
    }
    // 验证国家等级条件
    if (conditions.includes('country_level')) {
        if (!countryLevels) {
            return (0, helpers_1.errorResponse)(res, 400, '请选择国家等级');
        }
    }
    // 生成唯一编号
    const count = await prisma_1.default.userSegment.count();
    const segmentId = `SEG${String(count + 1).padStart(6, '0')}`;
    const segment = await prisma_1.default.userSegment.create({
        data: {
            segmentId,
            name,
            conditions: JSON.stringify(conditions),
            osCondition: conditions.includes('os') ? osCondition : null,
            systemLanguage: conditions.includes('system_language') ? JSON.stringify(systemLanguage || []) : null,
            countryLevels: conditions.includes('country_level') ? JSON.stringify(countryLevels) : '{}',
            status,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: segment.id,
        segmentId: segment.segmentId,
        name: segment.name,
        status: segment.status,
    }, '创建成功');
}));
// 编辑用户分层
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { name, conditions, osCondition, systemLanguage, countryLevels, status } = req.body;
    const existingSegment = await prisma_1.default.userSegment.findUnique({ where: { id } });
    if (!existingSegment) {
        return (0, helpers_1.errorResponse)(res, 404, '用户分层不存在');
    }
    // 校验长度
    if (name && name.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '分层名称长度不能超过40字符');
    }
    // 验证分层条件
    let newConditions = JSON.parse(existingSegment.conditions || "[]");
    let newOsCondition = existingSegment.osCondition;
    let newSystemLanguage = existingSegment.systemLanguage;
    let newCountryLevels = existingSegment.countryLevels;
    if (conditions) {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return (0, helpers_1.errorResponse)(res, 400, '请选择至少一个分层条件');
        }
        newConditions = conditions;
    }
    if (newConditions.includes('os')) {
        if (osCondition !== undefined) {
            newOsCondition = osCondition;
        }
        else if (!existingSegment.osCondition) {
            return (0, helpers_1.errorResponse)(res, 400, '请选择操作系统条件');
        }
    }
    if (newConditions.includes('system_language')) {
        if (systemLanguage !== undefined) {
            newSystemLanguage = JSON.stringify(systemLanguage);
        }
        else if (!existingSegment.systemLanguage) {
            return (0, helpers_1.errorResponse)(res, 400, '请选择系统语言');
        }
    }
    if (newConditions.includes('country_level')) {
        if (countryLevels !== undefined && (!countryLevels || Object.keys(countryLevels).length === 0)) {
            return (0, helpers_1.errorResponse)(res, 400, '请选择国家等级');
        }
        if (countryLevels !== undefined) {
            newCountryLevels = JSON.stringify(countryLevels);
        }
        else if (!existingSegment.countryLevels || existingSegment.countryLevels === '{}') {
            return (0, helpers_1.errorResponse)(res, 400, '请选择国家等级');
        }
    }
    const segment = await prisma_1.default.userSegment.update({
        where: { id },
        data: {
            name: name || existingSegment.name,
            conditions: JSON.stringify(newConditions),
            osCondition: newConditions.includes('os') ? newOsCondition : null,
            systemLanguage: newConditions.includes('system_language') ? newSystemLanguage : null,
            countryLevels: newConditions.includes('country_level') ? newCountryLevels : '{}',
            status: status || existingSegment.status,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: segment.id,
        segmentId: segment.segmentId,
        name: segment.name,
        status: segment.status,
    }, '更新成功');
}));
// 删除用户分层
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingSegment = await prisma_1.default.userSegment.findUnique({ where: { id } });
    if (!existingSegment) {
        return (0, helpers_1.errorResponse)(res, 404, '用户分层不存在');
    }
    // 检查是否有关联的支付墙
    const paymentWallCount = await prisma_1.default.paymentWall.count({
        where: { userSegmentId: id }
    });
    if (paymentWallCount > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该分层已被${paymentWallCount}个支付墙使用，无法删除`);
    }
    // 检查是否有关联的分层定价
    const pricingTierCount = await prisma_1.default.pricingTier.count({
        where: { userSegmentId: id }
    });
    if (pricingTierCount > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该分层已被${pricingTierCount}个分层定价使用，无法删除`);
    }
    await prisma_1.default.userSegment.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
// 辅助函数：格式化分层条件显示
function formatConditions(conditions) {
    if (!conditions || conditions.length === 0)
        return '-';
    const conditionMap = {
        'os': '操作系统',
        'country_level': '国家等级',
    };
    return conditions.map(c => conditionMap[c] || c).join('、');
}
exports.default = router;
//# sourceMappingURL=userSegment.js.map