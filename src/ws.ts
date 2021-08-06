/**
 * ws模块导出Server的行为在cjs和esm下不一致
 */

export { Server as WebSocketServer } from 'ws';