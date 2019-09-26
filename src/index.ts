import * as path from 'path';
import { ParsedPath } from 'path';
import { Stats } from 'fs';
import * as MemoryFs from 'memory-fs';
import * as through2 from 'through2';
import * as PluginError from 'plugin-error';
import Server from './server';
import { GulpMemoryFsArgs, File, OutPath, Https } from './types';

class GulpMemoryFs {
  private PLUGIN_NAME: string;
  private fs: MemoryFs;
  private port: number;
  private dir: string;
  private https?: Https;
  private reload: boolean;
  private server: Server;
  private cTime: Map<string, number>;

  constructor(args: GulpMemoryFsArgs) {
    const {
      port = 7777,
      dir,
      https,
      reload
    }: GulpMemoryFsArgs = args;

    this.PLUGIN_NAME = 'gulp-memory-fs'; // 插件名
    this.fs = new MemoryFs();            // 内存文件系统
    this.port = port;                    // 服务监听的端口号
    this.dir = this.getDir(dir);   // 服务的文件目录
    this.https = https;
    this.reload = !!reload;
    this.server = new Server({      // 服务
      port,
      dir: this.dir,
      fs: this.fs,
      https,
      reload
    });
    this.cTime = new Map<string, number>(); // 记录缓存时间
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
   * @param { string } output: 输出目录
   */
  dest(output: string): Function {
    const _this: this = this;
    const outputDir: string = this.getDir(output);

    return through2.obj(function(file: File, enc: string, callback: Function): any {
      // 错误判断
      if (file.isStream()) {
        this.emit('error', new PluginError(_this.PLUGIN_NAME, 'Streams are not supported!'));

        return callback();
      }

      // 判断是否为html文件
      const fileResult: ParsedPath = path.parse(file.relative);
      const isHtml: boolean = fileResult.ext === '.html';
      let contents: string | Buffer = isHtml
        ? file.contents.toString('utf8')
        : file.contents; // 文件

      // 注入灵魂
      if (isHtml && typeof contents === 'string') {
        contents = _this.server.injectionScripts(contents);
      }

      const formatOutput: OutPath = _this.formatOutPath(outputDir, file.relative);

      // 写入文件
      _this.fs.mkdirpSync(formatOutput.dir);
      _this.fs.writeFileSync(formatOutput.file, contents);
      _this.cTime.set(formatOutput.file, new Date().getTime());

      // reload
      _this.reload && _this.server.reloadFunc();

      return callback();
    });
  }

  /**
   * 监视文件
   * @param { string } output: 输出目录
   */
  changed(output: string): Function {
    const _this: this = this;
    const outputDir: string = this.getDir(output);

    return through2.obj(function(file: File, enc: string, callback: Function): any {
      // 当前文件的修改时间
      const stats: Stats = file.stat;
      const mtime: number = stats.mtime.getTime();

      // 编译文件的修改时间
      const formatOutput: OutPath = _this.formatOutPath(outputDir, file.relative);
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