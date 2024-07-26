import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

/**
 * ws模块导出Server的行为在cjs和esm下不一致
 */

export { WebSocketServer } from 'ws';

const __filename: string = fileURLToPath(import.meta.url);

export const dirname: string = path.dirname(__filename);