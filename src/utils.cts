/**
 * ws模块导出Server的行为在cjs和esm下不一致
 */

import importESM from '@sweet-milktea/utils/importESM.cjs';

export { Server as WebSocketServer } from 'ws';
export { importESM };

export const dirname: string = __dirname;