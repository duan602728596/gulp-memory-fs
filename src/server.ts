import * as path from 'path';
import { ParsedPath } from 'path';
import * as http from 'http';
import { Server as Http1Server } from 'http';
import * as http2 from 'http2';
import { SecureServerOptions, Http2SecureServer } from 'http2';
import * as fs from 'fs';
import * as Koa from 'koa';
import { Context } from 'koa';
import * as Router from '@koa/router';
import * as mime from 'mime-types';
import * as MemoryFs from 'memory-fs';
import * as socketIO from 'socket.io';
import { ServerArgs, Https } from './types';

class Server {
  private port: number;
  private dir: string;
  private fs: MemoryFs;
  private https?: Https;
  private reload: boolean;
  private reloadTime: number;

  private app: Koa;
  private router: Router;

  private server: Http1Server | Http2SecureServer;
  private socket: socketIO.Socket;

  private socketIOScript: Buffer;
  private clientScript: string;

  constructor(args: ServerArgs) {
    const {
      port,      // 服务监听的端口号
      dir,       // 服务的文件目录
      fs,        // 内存文件系统
      https,     // http2
      reload,    // 热更新
      reloadTime // 更新时间
    }: ServerArgs = args;

    this.port = port || 7777;
    this.dir = dir;
    this.fs = fs;
    this.https = https;
    this.reload = !!reload;
    this.reloadTime = reloadTime || 250;

    this.app = new Koa();
    this.router = new Router();
  }

  // 创建中间件
  createMiddleware(): void {
    this.app.use(this.router.routes())
      .use(this.router.allowedMethods());
  }

  // gulp-memory-fs注入的文件解析
  fileParsing(ctxPath: string, ctx: Context): boolean {
    if (/^\/gulp-memory-fs/i.test(ctxPath)) {
      const result: ParsedPath = path.parse(ctxPath);

      if (result.name === 'socket.io') {
        ctx.type = 'application/javascript';
        ctx.status = 200;
        ctx.body = this.socketIOScript;

        return true;
      }

      if (result.name === 'client') {
        const data: string = `(function() {\n
          ${ this.clientScript }\n
            client({
              reloadTime: ${ this.reloadTime }
            });\n
          })();`;

        ctx.type = 'application/javascript';
        ctx.status = 200;
        ctx.body = data;

        return true;
      }
    }

    return false;
  }

  // 创建路由
  createRouters(): void {
    const _this: this = this;

    this.router.get('/*', function(ctx: Context, next: Function): void {
      try {
        const ctxPath: string = ctx.path === '/' ? '/index.html' : ctx.path; // 路径
        const filePath: string = path.join(_this.dir, ctxPath)               // 文件
          .replace(/\\/g, '/');
        const mimeType: string | boolean = mime.lookup(ctxPath);

        // gulp-memory-fs注入的文件解析
        const fp: boolean = _this.fileParsing(ctxPath, ctx);

        if (fp) return;

        // 判断文件是否存在
        if (!_this.fs.existsSync(filePath)) {
          ctx.status = 404;

          return;
        }

        // mime-type
        if (typeof mimeType === 'string') {
          ctx.type = mimeType;
        }

        let content: Buffer | string = _this.fs.readFileSync(filePath);

        // 注入脚本
        if (_this.reload && mimeType === 'text/html') {
          content = _this.injectionScripts(content.toString());
        }

        ctx.status = 200;
        ctx.body = content;
      } catch (err) {
        ctx.status = 500;
        ctx.body = err.toString();

        console.error(err);
      }
    });
  }

  // 创建服务
  async createServer(): Promise<void> {
    if (this.https) {
      const keyFile: Buffer = await fs.promises.readFile(this.https.key);
      const certFile: Buffer = await fs.promises.readFile(this.https.cert);
      const httpsConfig: SecureServerOptions = {
        allowHTTP1: true,
        key: keyFile,
        cert: certFile
      };

      this.server = http2.createSecureServer(httpsConfig, this.app.callback())
        .listen(this.port);
    } else {
      this.server = http.createServer(this.app.callback())
        .listen(this.port);
    }
  }

  // 注入脚本
  injectionScripts(html: string): string {
    const scripts: string = `\n
      <!-- gulp-memory-fs injection scripts start -->
      <script src="/gulp-memory-fs/socket.io.js"></script>
      <script src="/gulp-memory-fs/client.js"></script>
      <!-- gulp-memory-fs injection scripts end -->`;

    return `${ html }${ scripts }`;
  }

  // reload
  reloadFunc(): void {
    if (!this.socket) return;

    this.socket.emit('RELOAD');
  }

  // socket
  createSocket(): void {
    const _this: this = this;
    const io: socketIO.Server = socketIO(this.server);

    io.on('connection', function(socket: socketIO.Socket): void {
      _this.socket = socket;
    });
  }

  // file
  async getFile(): Promise<void> {
    // 查找脚本位置
    const socketIOPath: string = require.resolve('socket.io-client');
    const socketIOPathFile: string = path.join(path.parse(socketIOPath).dir, '../dist/socket.io.js');

    this.socketIOScript = await fs.promises.readFile(socketIOPathFile);
    this.clientScript = (await fs.promises.readFile(path.join(__dirname, 'client.js'))).toString();
  }

  // 初始化
  async init(): Promise<void> {
    this.createMiddleware();
    this.createRouters();
    await this.createServer();

    // 热更新
    if (this.reload) {
      await this.getFile();
      this.createSocket();
    }
  }
}

export default Server;