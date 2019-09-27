import { Stats } from 'fs';
import * as MemoryFs from 'memory-fs';

export interface Https {
  key: string;
  cert: string;
}

export interface GulpMemoryFsArgs {
  port: number;
  dir: string;
  https?: Https;
  reload?: boolean;
  reloadTime?: number;
}

export interface ServerArgs extends GulpMemoryFsArgs {
  fs: MemoryFs;
}

export interface File {
  isStream: () => boolean;
  contents: Buffer;
  relative: string;
  stat: Stats;
}

export interface OutPath {
  file: string;
  dir: string;
}

export type Socket = { [key: string]: any };