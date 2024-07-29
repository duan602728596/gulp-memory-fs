import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

/**
 * ws模块导出Server的行为在cjs和esm下不一致
 */
export { WebSocketServer } from 'ws';

/**
 * 文件位置
 */
export const dirname: string = path.dirname(fileURLToPath(import.meta.url));

/**
 * ESM模块加载
 * @param { string } id
 */
export function importESM(id: string): any {
  return import(id);
}