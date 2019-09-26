import * as path from 'path';
import { Stats } from 'fs';
import * as MemoryFs from 'memory-fs';
import * as through2 from 'through2';
import * as PluginError from 'plugin-error';
import Server from './server';
import { formatOutPath } from './utils';
import { GulpMemoryFsArgs, File, OutPath, Https } from './types';

class GulpMemoryFs {
  private PLUGIN_NAME: string;
  private fs: MemoryFs;
  private port: number;
  private dir: string;
  private https?: Https;
  private server: Server;
  private cTime: Map<string, number>;

  constructor(args: GulpMemoryFsArgs) {
    const {
      port = 7777,
      dir,
      https
    }: GulpMemoryFsArgs = args;

    this.PLUGIN_NAME = 'gulp-memory-fs';                 // 插件名
    this.fs = new MemoryFs();                            // 内存文件系统
    this.port = port;                                    // 服务监听的端口号
    this.dir = path.isAbsolute(dir) ? dir : `/${ dir }`; // 服务的文件目录
    this.https = https;
    this.server = new Server({                      // 服务
      port,
      dir: this.dir,
      fs: this.fs,
      https
    });
    this.cTime = new Map<string, number>();              // 记录缓存时间
  }

  /**
   * 替换gulp.dest
   * @param { string } output: 输出目录
   */
  dest(output: string): Function {
    const _this: this = this;
    const outputDir: string = path.isAbsolute(output) ? output : `/${ output }`; // 转为绝对路径

    return through2.obj(function(file: File, enc: string, callback: Function): any {
      // 错误判断
      if (file.isStream()) {
        this.emit('error', new PluginError(_this.PLUGIN_NAME, 'Streams are not supported!'));

        return callback();
      }

      const contents: Buffer = file.contents; // 文件
      const formatOutput: OutPath = formatOutPath(outputDir, file.relative);

      // 写入文件
      _this.fs.mkdirpSync(formatOutput.dir);
      _this.fs.writeFileSync(formatOutput.file, contents);
      _this.cTime.set(formatOutput.file, new Date().getTime());

      return callback();
    });
  }

  /**
   * 监视文件
   * @param { string } output: 输出目录
   */
  watch(output: string): Function {
    const _this: this = this;
    const outputDir: string = path.isAbsolute(output) ? output : `/${ output }`; // 转为绝对路径

    return through2.obj(function(file: File, enc: string, callback: Function): any {
      // 当前文件的修改时间
      const stats: Stats = file.stat;
      const mtime: number = stats.mtime.getTime();

      // 编译文件的修改时间
      const formatOutput: OutPath = formatOutPath(outputDir, file.relative);
      const time: number | undefined = _this.cTime.get(formatOutput.file);

      // 文件的最新修改时间大于缓存时间
      if (!time || mtime > time) {
        this.push(file);
      }

      return callback();
    });
  }

  // 初始化服务
  async createServer(): Promise<void> {
    await this.server.init();
  }
}

export default GulpMemoryFs;