import * as path from 'path';
import * as http from 'http';
import * as http2 from 'http2';
import * as fs from 'fs';
import { SecureServerOptions } from 'http2';
import * as Koa from 'koa';
import { Context } from 'koa';
import * as Router from '@koa/router';
import * as mime from 'mime-types';
import * as MemoryFs from 'memory-fs';
import { ServerArgs, Https } from './types';

class Server {
  private port: number;
  private dir: string;
  private fs: MemoryFs;
  private app: Koa;
  private router: Router;
  private https?: Https;

  constructor(args: ServerArgs) {
    const {
      port, // 服务监听的端口号
      dir,  // 服务的文件目录
      fs,   // 内存文件系统
      https // http2
    }: ServerArgs = args;

    this.port = port;
    this.dir = dir;
    this.fs = fs;
    this.app = new Koa();
    this.router = new Router();
    this.https = https;
  }

  // 创建中间件
  createMiddleware(): void {
    this.app.use(this.router.routes())
      .use(this.router.allowedMethods());
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

        // 判断文件是否存在
        if (!_this.fs.existsSync(filePath)) {
          ctx.status = 404;

          return;
        }

        if (typeof mimeType === 'string') ctx.type = mimeType;
        ctx.status = 200;
        ctx.body = _this.fs.readFileSync(filePath);
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

      http2.createSecureServer(httpsConfig, this.app.callback())
        .listen(this.port);

    } else {
      http.createServer(this.app.callback())
        .listen(this.port);
    }
  }

  // 初始化
  async init(): Promise<void> {
    this.createMiddleware();
    this.createRouters();
    await this.createServer();
  }
}

export default Server;