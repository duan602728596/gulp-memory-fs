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
import * as connect from 'koa-connect';
import * as proxy from 'http-proxy-middleware';
import * as mime from 'mime-types';
import * as MemoryFs from 'memory-fs';
import { IFs } from 'memfs';
import * as socketIO from 'socket.io';
import * as detectPort from 'detect-port';
import * as internalIp from 'internal-ip';
import * as colors from 'colors/safe';
import * as _ from 'lodash';
import * as moduleAlias from 'module-alias';
import { ServerArgs, Https, KoaFunc } from './types';

// TODO: http-proxy模块不支持http2
moduleAlias.addAlias('http-proxy', '@bbkkbkk/http-proxy');

class Server {
  private port: number;
  private dir: string;
  private fs: MemoryFs | IFs;
  private https?: Https;
  private reload: boolean;
  private reloadTime: number;
  private mock?: {
    [key: string]: any | KoaFunc;
  };
  private proxy?: {
    [key: string]: object;
  };

  private app: Koa;
  private router: Router;

  private server: Http1Server | Http2SecureServer;
  private socket: socketIO.Socket;

  private socketIOScript: Buffer;
  private clientScript: string;

  constructor(args: ServerArgs) {
    const {
      port,       // 服务监听的端口号
      dir,        // 服务的文件目录
      fs,         // 内存文件系统
      https,      // http2
      reload,     // 是否刷新
      reloadTime, // 刷新时间
      mock,       // mock数据
      proxy
    }: ServerArgs = args;

    this.port = port || 7777;
    this.dir = dir;
    this.fs = fs;
    this.https = https;
    this.reload = !!reload;
    this.reloadTime = reloadTime || 250;
    this.mock = mock;
    this.proxy = proxy;

    this.app = new Koa();
    this.router = new Router();
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
        const data: string = '(function() {\n'
          + `\n${ this.clientScript }\n\n`
          + 'client({\n'
          + `  reloadTime: ${ this.reloadTime }\n`
          + '});\n\n'
          + '})();';

        ctx.type = 'application/javascript';
        ctx.status = 200;
        ctx.body = data;

        return true;
      }
    }

    return false;
  }

  // 创建proxy的中间件
  createProxyMiddleware(): void {
    if (!this.proxy) return;

    for (const key in this.proxy) {
      this.app.use(connect(
        proxy(key, {
          changeOrigin: true,
          logLevel: 'info',
          ...this.proxy[key]
        })
      ));
    }
  }

  // 创建中间件
  createMiddleware(): void {
    this.app.use(this.router.routes())
      .use(this.router.allowedMethods());
  }

  // 创建mock路由
  createMockRouters(): void {
    if (!this.mock) return;

    for (const key in this.mock) {
      // 拆分，解析方法
      const formatData: string[] = _.without(key.split(/\s+/), '');
      let method: string = 'get';
      let uri: string = '';

      if (formatData.length === 0) continue;

      if (formatData.length === 1) uri = formatData[0];
      else [method, uri] = [formatData[0].toLocaleLowerCase(), formatData[1]];

      // 判断router是否有该方法
      method = method in this.router ? method : 'get';

      const value: KoaFunc | any = this.mock[key];
      const routerFunc: KoaFunc = typeof value === 'function'
        ? value
        : (ctx: Context, next: Function): void => ctx.body = value;

      this.router[method](uri, routerFunc);
    }
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
    const scripts: string = '\n\n<!-- gulp-memory-fs injection scripts start -->\n'
      + '<script src="/gulp-memory-fs/socket.io.js"></script>\n'
      + '<script src="/gulp-memory-fs/client.js"></script>\n'
      + '<!-- gulp-memory-fs injection scripts end -->';

    return `${ html }${ scripts }`;
  }

  // reload
  reloadFunc(): void {
    if (!this.socket) return;

    this.socket.emit('RELOAD');
  }

  // 判断端口是否被占用，并使用新端口
  async getPort(): Promise<void> {
    this.port = await detectPort(this.port);
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

  // 输出本机IP信息
  async runningAtLog(): Promise<void> {
    const ip: string = await internalIp.v4() || '127.0.0.1';
    const protocol: string = this.https ? 'https' : 'http';
    const logs: string[] = [
      ' Running at:',
      ` - Local:   ${ protocol }://127.0.0.1:${ this.port }`,
      ` - Network: ${ protocol }://${ ip }:${ this.port }`
    ];

    console.log(`\n${ colors.cyan(logs.join('\n')) }\n`);
  }

  // 初始化
  async init(): Promise<void> {
    this.createProxyMiddleware();
    this.createMiddleware();
    this.createMockRouters();
    this.createRouters();
    await this.getPort();
    await this.createServer();

    // 是否刷新
    if (this.reload) {
      await this.getFile();
      this.createSocket();
    }

    await this.runningAtLog();
  }
}

export default Server;