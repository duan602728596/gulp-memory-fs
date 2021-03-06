import './alias';
import * as path from 'path';
import type { ParsedPath } from 'path';
import * as http from 'http';
import type { Server as Http1Server } from 'http';
import * as http2 from 'http2';
import type { SecureServerOptions, Http2SecureServer } from 'http2';
import * as fs from 'fs';
import * as net from 'net';
import type { Server as NetServer } from 'net';
import * as Koa from 'koa';
import type { Context, Middleware } from 'koa';
import * as Router from '@koa/router';
import connect = require('koa-connect');
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import * as mime from 'mime-types';
import type { IFs } from 'memfs';
import * as socketIO from 'socket.io';
import * as internalIp from 'internal-ip';
import * as chalk from 'chalk';
import * as _ from 'lodash';
import type { ServerArgs, Https, KoaFunc } from './types';

class Server {
  // 默认的mime类型
  static defaultMimeMaps: { [key: string]: string } = {
    avifs: 'image/avif-sequence'
  };

  public port: number;
  public dir: string;
  public fs: IFs;
  public https?: Https;
  public reload: boolean;
  public reloadTime: number;
  public mock?: { [key: string]: any | KoaFunc };
  public proxy?: { [key: string]: Options };
  public mimeTypes?: { [key: string]: string };

  public app: Koa;
  public router: Router;

  public server: Http1Server | Http2SecureServer;
  public socket: Set<socketIO.Socket>;

  public socketIOScript: Buffer;
  public socketIOScriptMap: Buffer;
  public clientScript: string;

  constructor(args: ServerArgs) {
    const {
      port,       // 服务监听的端口号
      dir,        // 服务的文件目录
      fs: ifs,    // 内存文件系统
      https,      // http2
      reload,     // 是否刷新
      reloadTime, // 刷新时间
      mock,       // mock数据
      proxy,
      mimeTypes
    }: ServerArgs = args;

    this.port = port ?? 7777;
    this.dir = dir;
    this.fs = ifs;
    this.https = https;
    this.reload = !!reload;
    this.reloadTime = reloadTime ?? 250;
    this.mock = mock;
    this.proxy = proxy;
    this.mimeTypes = Object.assign({}, Server.defaultMimeMaps, mimeTypes);

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

  // 重写mime types的中间件
  createRewriteMime(): Middleware {
    const _this: this = this;

    return async function(ctx: Context, next: Function): Promise<void> {
      await next();

      if (!(ctx.type && ctx.type !== '')) {
        const parseResult: ParsedPath = path.parse(ctx.url);
        const ext: string = parseResult.ext.replace(/^\./, '');

        if (mime[ext] && mime[ext] !== '') {
          ctx.type = mime[ext];
        }
      }
    };
  }

  // 创建中间件
  createMiddleware(): void {
    this.app.use(this.createRewriteMime());
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
        ctx.body = `<pre style="font-size: 14px; white-space: pre-wrap;">${ err.stack.toString() }</pre>`;

        console.error(err);
      }
    });
  }

  // 创建服务
  async createServer(): Promise<void> {
    if (this.https) {
      const [keyFile, certFile]: [Buffer, Buffer] = await Promise.all([
        fs.promises.readFile(this.https.key),
        fs.promises.readFile(this.https.cert)
      ]);
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

  /**
   * 检查端口占用情况
   * @param { number } port: 检查的端口
   */
  portIsOccupied(port: number): Promise<boolean> {
    return new Promise(function(resolve: Function, reject: Function): void {
      const server: NetServer = net.createServer().listen(port);

      server.on('listening', (): void => {
        server.close();
        resolve(true);
      });
      server.on('error', (err: Error): void => {
        server.close();
        resolve(false);
      });
    });
  }

  /**
   * 判断端口是否被占用，并返回新的端口
   * @param { number } port: 检查的端口
   * @param { Array<number> } ignorePort: 忽略的端口
   */
  async detectPort(port: number, ignorePort: Array<number> = []): Promise<number> {
    let maxPort: number = port + 10; // 最大端口
    let newNumber: number = port,    // 使用的端口
      pt: number = port;

    if (maxPort > 65535) {
      maxPort = 65535;
    }

    while (pt <= maxPort) {
      const portCanUse: boolean = await this.portIsOccupied(pt);

      if (portCanUse && !ignorePort.includes(pt)) {
        newNumber = pt;
        break;
      } else {
        pt++;
      }
    }

    return newNumber;
  }

  // 判断端口是否被占用，并使用新端口
  async getPort(): Promise<void> {
    this.port = await this.detectPort(this.port);
  }

  // socket
  createSocket(): void {
    const _this: this = this;
    const io: socketIO.Server = new socketIO.Server(this.server as Http1Server, {
      path: '/@@/gulp-memory-fs/ws'
    });

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

    // eslint-disable-next-line @typescript-eslint/typedef
    [this.socketIOScript, this.socketIOScriptMap, this.clientScript] = await Promise.all([
      fs.promises.readFile(socketIOPathFile),
      fs.promises.readFile(socketIOScriptMap),
      fs.promises.readFile(path.join(__dirname, 'client.js'), { encoding: 'utf8' })
    ]);
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