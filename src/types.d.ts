import type { Stats, PathLike } from 'fs';
import type { IFs } from 'memfs';
import type { TCallback, TMode } from 'memfs/lib/volume';
import type { Context } from 'koa';
import type { Options } from 'http-proxy-middleware';

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
  mock?: { [key: string]: any | KoaFunc };
  proxy?: { [key: string]: Options };
  mimeTypes?: { [key: string]: string };
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

/* mkdirp */
export type VolumeMkdirp = (path: PathLike, mode?: TMode) => any;