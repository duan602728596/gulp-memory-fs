/**
 * ws模块导出Server的行为在cjs和esm下不一致
 */
import importESM from '@sweet-milktea/utils/importESM.cjs';

export { Server as WebSocketServer } from 'ws';

/**
 * 文件位置
 */
export const dirname: string = __dirname;

/**
 * ESM模块加载
 */
export { importESM };