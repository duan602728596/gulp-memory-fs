import './alias';
import * as path from 'path';
import type { ParsedPath } from 'path';
import * as http from 'http';
import type { Server as Http1Server } from 'http';
import * as http2 from 'http2';
import type { SecureServerOptions, Http2SecureServer } from 'http2';
import * as fs from 'fs';
import * as Koa from 'koa';
import type { Context } from 'koa';
import * as Router from '@koa/router';
import connect = require('koa-connect');
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import * as mime from 'mime-types';
import * as MemoryFs from 'memory-fs';
import type { IFs } from 'memfs';
import * as socketIO from 'socket.io';
import * as detectPort from 'detect-port';
import * as internalIp from 'internal-ip';
import * as chalk from 'chalk';
import * as _ from 'lodash';
import type { ServerArgs, Https, KoaFunc } from './types';

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
    [key: string]: Options;
  };

  private app: Koa;
  private router: Router;

  private server: Http1Server | Http2SecureServer;
  private socket: Set<socketIO.Socket>;

  private socketIOScript: Buffer;
  private socketIOScriptMap: Buffer;
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

    this.port = port ?? 7777;
    this.dir = dir;
    this.fs = fs;
    this.https = https;
    this.reload = !!reload;
    this.reloadTime = reloadTime ?? 250;
    this.mock = mock;
    this.proxy = proxy;

    this.app = new Koa();
    this.router = new Router();
    this.socket = new Set();
  }

  // gulp-memory-fs注入的文件解析
  fileParsing(ctxPath: string, ctx: Context): boolean {
    if (/^\/@@\/gulp-memory-fs/i.test(ctxPath)) {
      const result: ParsedPath = path.parse(ctxPath);

      if (result.base === 'socket.io.min.js') {
        ctx.type = 'application/javascript';
        ctx.status = 200;
        ctx.body = this.socketIOScript;

        return true;
      }

      if (result.base === 'socket.io.min.js.map') {
        ctx.type = 'application/json';
        ctx.status = 200;
        ctx.body = this.socketIOScriptMap;

        return true;
      }

      if (result.base === 'client.js') {
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
        createProxyMiddleware(key, {
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

      if (formatData.length === 1) {
        uri = formatData[0];
      } else {
        // eslint-disable-next-line @typescript-eslint/typedef
        [method, uri] = [formatData[0].toLocaleLowerCase(), formatData[1]];
      }

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

    this.router.get(/^\/.*/, function(ctx: Context, next: Function): void {
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
      + '<script src="/@@/gulp-memory-fs/socket.io.min.js"></script>\n'
      + '<script src="/@@/gulp-memory-fs/client.js"></script>\n'
      + '<!-- gulp-memory-fs injection scripts end -->';

    return `${ html }${ scripts }`;
  }

  // reload
  reloadFunc(): void {
    for (const socket of this.socket) {
      socket.emit('RELOAD');
    }
  }

  // 判断端口是否被占用，并使用新端口
  async getPort(): Promise<void> {
    this.port = await detectPort(this.port);
  }

  // socket
  createSocket(): void {
    const _this: this = this;
    const io: socketIO.Server = new socketIO.Server(this.server as Http1Server);

    io.on('connection', function(socket: socketIO.Socket): void {
      socket.on('disconnect', function(): void {
        _this.socket.delete(socket);
      });

      _this.socket.add(socket);
    });
  }

  // file
  async getFile(): Promise<void> {
    // 查找脚本位置
    const socketIOPath: string = require.resolve('socket.io-client');
    const socketIOPathFile: string = path.join(path.parse(socketIOPath).dir, '../dist/socket.io.min.js');
    const socketIOScriptMap: string = path.join(path.parse(socketIOPath).dir, '../dist/socket.io.min.js.map');

    this.socketIOScript = await fs.promises.readFile(socketIOPathFile);
    this.socketIOScriptMap = await fs.promises.readFile(socketIOScriptMap);
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

    console.log(`\n${ chalk.cyan(logs.join('\n')) }\n`);
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