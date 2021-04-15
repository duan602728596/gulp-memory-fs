import * as util from 'util';
import * as path from 'path';
import type { Stats } from 'fs';
import { createFsFromVolume, Volume, IFs } from 'memfs';
import * as through2 from 'through2';
import * as PluginError from 'plugin-error';
import Server from './Server';
import type { GulpMemoryFsArgs, File, OutPath, Https, VolumeMkdirp } from './types';

class GulpMemoryFs {
  static PLUGIN_NAME: string = 'gulp-memory-fs';

  private PLUGIN_NAME: string;
  private mTime: Map<string, number>;
  private fs: IFs;
  private https?: Https;
  private dir: string;
  private reload: boolean;
  private mkdirp: VolumeMkdirp;
  private server: Server;

  constructor(args: GulpMemoryFsArgs) {
    const {
      port,
      dir,
      https,
      reload,
      reloadTime,
      mock,
      proxy,
      mimeTypes
    }: GulpMemoryFsArgs = args;

    this.PLUGIN_NAME = GulpMemoryFs.PLUGIN_NAME; // 插件名
    this.mTime = new Map<string, number>();      // 记录缓存时间
    this.fs = createFsFromVolume(new Volume());  // 内存文件系统
    this.https = https;                          // https证书配置项
    this.dir = this.getDir(dir);                 // 转换文件路径
    this.reload = !!reload;                      // 修改后是否刷新页面
    this.mkdirp = util.promisify(this.fs.mkdirp);

    // 服务
    this.server = new Server({
      fs: this.fs,
      port,
      dir: this.dir,
      https,
      reload,
      reloadTime,
      mock,
      proxy,
      mimeTypes
    });
  }

  // 转为绝对路径
  getDir(output: string): string {
    return path.isAbsolute(output) ? output : `/${ output }`;
  }

  /**
   * 格式化输出路径
   * @param { string } output: 输出目录
   * @param { string } relative: 目录
   */
  formatOutPath(output: string, relative: string): OutPath {
    // 文件路径
    const outputFilePath: string = path.join(output, relative)
      .replace(/\\/g, '/');

    // 目录路径
    const outputDirPath: string = path.dirname(outputFilePath);

    return {
      file: outputFilePath,
      dir: outputDirPath
    };
  }

  /**
   * 替换gulp.dest
   * @param { string | undefined } output: 输出目录
   */
  dest(output?: string): Function {
    const _this: this = this;
    const outputDir: string = output ? this.getDir(output) : this.dir;

    return through2.obj(async function(file: File, enc: string, callback: Function): Promise<any> {
      // 错误判断
      if (file.isStream()) {
        this.emit('error', new PluginError(GulpMemoryFs.PLUGIN_NAME, 'Streams are not supported!'));

        return callback();
      }

      const contents: Buffer = file.contents;
      const formatOutput: OutPath = _this.formatOutPath(outputDir, file.relative);

      // 写入文件
      await _this.mkdirp(formatOutput.dir);
      await _this.fs.promises.writeFile(formatOutput.file, contents);
      _this.mTime.set(formatOutput.file, new Date().getTime());

      // reload
      _this.reload && _this.server.reloadFunc();

      return callback();
    });
  }

  /**
   * 监视文件
   * @param { string | undefined } output: 输出目录
   */
  changed(output?: string): Function {
    const _this: this = this;
    const outputDir: string = output ? this.getDir(output) : this.dir;

    return through2.obj(function(file: File, enc: string, callback: Function): any {
      // 当前文件的修改时间
      const stats: Stats = file.stat;
      const mtime: number = stats.mtime.getTime();

      // 编译文件的修改时间
      const formatOutput: OutPath = _this.formatOutPath(outputDir, file.relative);
      const time: number | undefined = _this.mTime.get(formatOutput.file);

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