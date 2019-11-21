import { Stats } from 'fs';
import * as MemoryFs from 'memory-fs';
import { IFs } from 'memfs';
import { Context } from 'koa';

/* https证书配置项 */
export interface Https {
  key: string;
  cert: string;
}

/* koa function */
export type KoaFunc = (ctx: Context, next: Function) => void | Promise<void>;

/* 传递参数 */
export interface GulpMemoryFsArgs {
  port: number;
  dir: string;
  https?: Https;
  reload?: boolean;
  reloadTime?: number;
  fsType?: 'memory-fs' | 'memfs';
  mock?: {
    [key: string]: any | KoaFunc;
  };
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
export interface ServerArgs extends Omit<GulpMemoryFsArgs, 'fsType'> {
  fs: MemoryFs | IFs;
}