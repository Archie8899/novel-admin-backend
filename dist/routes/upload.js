"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const helpers_1 = require("../utils/helpers");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 确保上传目录存在
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
const coversDir = path_1.default.join(uploadsDir, 'covers');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs_1.default.existsSync(coversDir)) {
    fs_1.default.mkdirSync(coversDir, { recursive: true });
}
// 配置 multer
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, coversDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const filename = `${(0, uuid_1.v4)()}${ext}`;
        cb(null, filename);
    },
});
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('只支持 JPG、PNG、GIF、WebP 格式的图片'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
    },
});
// 封面上传
router.post('/cover', auth_1.authMiddleware, upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return (0, helpers_1.errorResponse)(res, 400, '请选择要上传的图片');
    }
    // 返回访问URL
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/uploads/covers/${req.file.filename}`;
    return (0, helpers_1.successResponse)(res, {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        url,
    }, '上传成功');
}));
// 通用文件上传
router.post('/file', auth_1.authMiddleware, upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return (0, helpers_1.errorResponse)(res, 400, '请选择要上传的文件');
    }
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/uploads/files/${req.file.filename}`;
    return (0, helpers_1.successResponse)(res, {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        url,
    }, '上传成功');
}));
// 错误处理中间件
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
exports.default = router;
//# sourceMappingURL=upload.js.map