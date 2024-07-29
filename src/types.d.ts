import type { Stats } from 'fs';
import type { IFs } from 'memfs';
import type { Context, Next } from 'koa';
import type { Options } from 'http-proxy-middleware';

/* https证书配置项 */
export interface Https {
  key: string;
  cert: string;
}

/* koa function */
export type KoaFunc = (ctx: Context, next: Next) => void | Promise<void>;

/* 传递参数 */
export interface GulpMemoryFsArgs {
  port: number;
  dir: string;
  https?: Https;
  reload?: boolean;
  reloadTime?: number;
  mock?: Record<string, any | KoaFunc>;
  proxy?: Record<string, Options>;
  mimeTypes?: Record<string, string>;
}

/* 文件的参数 */
export interface File {
  isStream: () => boolean;
  contents: Buffer;
  relative: string;
  stat: Stats;
}

/* 输出路径 */
export interface OutPath {
  file: string;
  dir: string;
}

/* Server的传递参数 */
export interface ServerArgs extends GulpMemoryFsArgs {
  fs: IFs;
}