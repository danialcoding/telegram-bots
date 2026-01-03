// src/utils/storage.ts
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import axios from 'axios';
import logger from './logger';
import crypto from 'crypto';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

const UPLOAD_DIR = path.join(__dirname, '../../public/uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * ایجاد پوشه uploads در صورت عدم وجود
 */
export async function initializeStorage(): Promise<void> {
  try {
    const folders = [
      UPLOAD_DIR,
      path.join(UPLOAD_DIR, 'images'),
      path.join(UPLOAD_DIR, 'videos'),
      path.join(UPLOAD_DIR, 'voices'),
      path.join(UPLOAD_DIR, 'documents'),
      path.join(UPLOAD_DIR, 'stickers'),
    ];

    for (const folder of folders) {
      if (!fs.existsSync(folder)) {
        await mkdir(folder, { recursive: true });
        logger.info(`✅ Created folder: ${folder}`);
      }
    }
  } catch (error) {
    logger.error('❌ Error initializing storage:', error);
    throw error;
  }
}

/**
 * دانلود فایل از تلگرام و ذخیره روی سرور
 */
export async function downloadAndSaveFile(
  bot: any,
  fileId: string,
  fileType: 'photo' | 'video' | 'voice' | 'document' | 'sticker'
): Promise<{ localPath: string; fileSize: number; mimeType: string }> {
  try {
    // دریافت لینک فایل از تلگرام
    const fileLink = await bot.telegram.getFileLink(fileId);
    
    logger.info(`📥 Downloading file: ${fileId} from ${fileLink.href}`);

    // دانلود فایل
    const response = await axios.get(fileLink.href, {
      responseType: 'arraybuffer',
      maxContentLength: MAX_FILE_SIZE,
      timeout: 60000, // 60 seconds
    });

    const fileBuffer = Buffer.from(response.data);
    const fileSize = fileBuffer.length;

    // بررسی سایز فایل
    if (fileSize > MAX_FILE_SIZE) {
      throw new Error(`❌ File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    // تولید نام یونیک برای فایل
    const hash = crypto.createHash('md5').update(fileId).digest('hex');
    const timestamp = Date.now();
    const ext = getFileExtension(response.headers['content-type'] || '', fileType);
    const filename = `${timestamp}_${hash}${ext}`;

    // مسیر ذخیره
    const subFolder = getSubFolder(fileType);
    const localPath = path.join(UPLOAD_DIR, subFolder, filename);
    const relativePath = `/uploads/${subFolder}/${filename}`;

    // ذخیره فایل
    await writeFile(localPath, fileBuffer);

    logger.info(`✅ File saved: ${relativePath} (${(fileSize / 1024).toFixed(2)} KB)`);

    return {
      localPath: relativePath,
      fileSize,
      mimeType: response.headers['content-type'] || 'application/octet-stream',
    };
  } catch (error: any) {
    if (error.response?.status === 413) {
      throw new Error('❌ فایل بیش از حد بزرگ است. حداکثر سایز مجاز: 50MB');
    }
    logger.error('❌ Error downloading file:', error);
    throw error;
  }
}

/**
 * حذف فایل از سرور
 */
export async function deleteFile(localPath: string): Promise<void> {
  try {
    if (!localPath) return;

    const fullPath = path.join(__dirname, '../../public', localPath);
    
    if (fs.existsSync(fullPath)) {
      await unlink(fullPath);
      logger.info(`🗑️ File deleted: ${localPath}`);
    }
  } catch (error) {
    logger.error('❌ Error deleting file:', error);
  }
}

/**
 * بررسی وجود فایل
 */
export async function fileExists(localPath: string): Promise<boolean> {
  try {
    const fullPath = path.join(__dirname, '../../public', localPath);
    await stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * دریافت اندازه فایل
 */
export async function getFileSize(localPath: string): Promise<number> {
  try {
    const fullPath = path.join(__dirname, '../../public', localPath);
    const stats = await stat(fullPath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * تعیین پوشه فرعی بر اساس نوع فایل
 */
function getSubFolder(fileType: string): string {
  const folderMap: Record<string, string> = {
    photo: 'images',
    video: 'videos',
    voice: 'voices',
    document: 'documents',
    sticker: 'stickers',
  };

  return folderMap[fileType] || 'documents';
}

/**
 * تعیین پسوند فایل بر اساس MIME type
 */
function getFileExtension(mimeType: string, fileType: string): string {
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/mpeg': '.mpeg',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'text/plain': '.txt',
  };

  if (extMap[mimeType]) {
    return extMap[mimeType];
  }

  // پسوند پیش‌فرض بر اساس نوع فایل
  const defaultExt: Record<string, string> = {
    photo: '.jpg',
    video: '.mp4',
    voice: '.ogg',
    document: '.pdf',
    sticker: '.webp',
  };

  return defaultExt[fileType] || '';
}

/**
 * فرمت کردن سایز فایل برای نمایش
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * بررسی سایز فایل قبل از دانلود
 */
export async function checkFileSize(bot: any, fileId: string): Promise<number> {
  try {
    const file = await bot.telegram.getFile(fileId);
    return file.file_size || 0;
  } catch (error) {
    logger.error('❌ Error checking file size:', error);
    return 0;
  }
}

export const storageService = {
  initializeStorage,
  downloadAndSaveFile,
  deleteFile,
  fileExists,
  getFileSize,
  formatFileSize,
  checkFileSize,
  MAX_FILE_SIZE,
};
