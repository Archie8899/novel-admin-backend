import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { successResponse, errorResponse } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 确保上传目录存在
const uploadsDir = path.join(process.cwd(), 'uploads');
const coversDir = path.join(uploadsDir, 'covers');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

// 配置 multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, coversDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持 JPG、PNG、GIF、WebP 格式的图片'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

// 封面上传
router.post('/cover', authMiddleware, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return errorResponse(res, 400, '请选择要上传的图片');
  }

  // 返回访问URL
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = `${baseUrl}/uploads/covers/${req.file.filename}`;

  return successResponse(res, {
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    url,
  }, '上传成功');
}));

// 通用文件上传
router.post('/file', authMiddleware, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return errorResponse(res, 400, '请选择要上传的文件');
  }

  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = `${baseUrl}/uploads/files/${req.file.filename}`;

  return successResponse(res, {
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    url,
  }, '上传成功');
}));

// 错误处理中间件
function asyncHandler(fn: (req: Request, res: Response, ...args: any[]) => Promise<any>) {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default router;
