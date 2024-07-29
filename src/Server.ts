import './alias';
import * as path from 'node:path';
import type { ParsedPath } from 'node:path';
import * as http from 'node:http';
import type { Server as Http1Server, IncomingMessage } from 'node:http';
import * as http2 from 'node:http2';
import type { SecureServerOptions, Http2SecureServer } from 'node:http2';
import * as fs from 'node:fs';
import * as net from 'node:net';
import type { Server as NetServer, Socket } from 'node:net';
import Koa from 'koa';
import type { Context, Middleware, Next } from 'koa';
import Router from '@koa/router';
import connect from 'koa-connect';
import { createProxyMiddleware, type Options as ProxyMiddlewareOptions } from 'http-proxy-middleware';
import mime from 'mime-types';
import type { IFs } from 'memfs';
import WebSocket from 'ws';
import type { internalIpV4 as InternalIpV4 } from 'internal-ip';
import type Chalk from 'chalk';
import log4js, { type Logger } from 'log4js';
// @ts-ignore mjs and cjs
import { WebSocketServer, dirname } from './utils';
import type { ServerArgs, Https, KoaFunc } from './types';

class Server {
  // 默认的mime类型
  static defaultMimeMaps: Record<string, string> = {
    avifs: 'image/avif-sequence'
  };

  public port: number;
  public dir: string;
  public fs: IFs;
  public https?: Https;
  public reload: boolean;
  public reloadTime: number;
  public mock?: Record<string, any | KoaFunc>;
  public proxy?: Record<string, ProxyMiddlewareOptions>;
  public mimeTypes?: Record<string, string>;

  public app: Koa;
  public router: Router;
  public logger: Logger;

  public server: Http1Server | Http2SecureServer;
  public wsServer?: WebSocketServer;
  public pingTimer?: NodeJS.Timeout;

  public clientScript?: string;

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

    this.logger = log4js.getLogger();
    this.logger.level = 'info';
  }

  // gulp-memory-fs注入的文件解析
  fileParsing(ctxPath: string, ctx: Context): boolean {
    if (/^\/@@\/gulp-memory-fs/i.test(ctxPath)) {
      const result: ParsedPath = path.parse(ctxPath);

      if (result.base === 'client.js') {
        const data: string = `(function() {
${ this.clientScript }\n
  client({
    reloadTime: ${ this.reloadTime }
  });
})();`;

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
        createProxyMiddleware({
          pathFilter: key,
          changeOrigin: true,
          logger: this.logger,
          ...this.proxy[key]
        })
      ));
    }
  }

  // 重写mime types的中间件
  createRewriteMime(): Middleware {
    return async function(ctx: Context, next: Next): Promise<void> {
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
      const formatData: string[] = key.split(/\s+/).filter((o: string): boolean => o !== '');
      let method: string = 'get';
      let uri: string = '';

      if (formatData.length === 0) continue;

      if (formatData.length === 1) {
        uri = formatData[0];
      } else {
        [method, uri] = [formatData[0].toLocaleLowerCase(), formatData[1]];
      }

      // 判断router是否有该方法
      method = method in this.router ? method : 'get';

      const value: KoaFunc | any = this.mock[key];
      const routerFunc: KoaFunc = typeof value === 'function'
        ? value
        : (ctx: Context, next: Next): void => ctx.body = value;

      this.router[method](uri, routerFunc);
    }
  }

  // 创建路由
  createRouters(): void {
    this.router.get(/^\/.*/, (ctx: Context, next: Next): void => {
      try {
        const ctxPath: string = ctx.path === '/' ? '/index.html' : ctx.path; // 路径
        const filePath: string = path.join(this.dir, ctxPath)               // 文件
          .replace(/\\/g, '/');
        const mimeType: string | boolean = mime.lookup(ctxPath);

        // gulp-memory-fs注入的文件解析
        const fp: boolean = this.fileParsing(ctxPath, ctx);

        if (fp) return;

        // 判断文件是否存在
        if (!this.fs.existsSync(filePath)) {
          ctx.status = 404;

          return;
        }

        // mime-type
        if (typeof mimeType === 'string') {
          ctx.type = mimeType;
        }

        let content: Buffer | string = this.fs.readFileSync(filePath);

        // 注入脚本
        if (this.reload && mimeType === 'text/html') {
          content = this.injectionScripts(content.toString());
        }

        ctx.status = 200;
        ctx.body = content;
      } catch (err) {
        ctx.status = 500;
        ctx.body = `<pre style="font-size: 14px; white-space: pre-wrap;">${ err.stack.toString() }</pre>`;

        this.logger.error(err);
      }
    });
  }

  // 启动服务
  async serverInit(): Promise<void> {
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
      + '<script src="/@@/gulp-memory-fs/client.js"></script>\n'
      + '<!-- gulp-memory-fs injection scripts end -->';

    return `${ html }${ scripts }`;
  }

  // reload
  reloadFunc(): void {
    if (this.wsServer) {
      this.wsServer.clients.forEach((ws: WebSocket): void => {
        ws.send(JSON.stringify({
          type: 'reload'
        }));
      });
    }
  }

  /**
   * 检查端口占用情况
   * @param { number } port - 检查的端口
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
   * @param { number } port - 检查的端口
   * @param { Array<number> } ignorePort - 忽略的端口
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

  // 创建websocket服务
  websocketServerInit(): void {
    this.wsServer = new WebSocketServer({
      noServer: true,
      path: '/@@/gulp-memory-fs/ws'
    });

    this.server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer): void => {
      if (!this.wsServer.shouldHandle(req)) {
        return;
      }

      this.wsServer.handleUpgrade(req, socket, head, (connection: WebSocket): void => {
        this.wsServer.emit('connection', connection, req);
      });
    });

    this.wsServer.on('connection', (ws: WebSocket): void => {
      ws['isAlive'] = true;
      ws.on('error', (err: Error): void => {
        this.logger.error(err);
      });
      ws.on('pong', (): void => {
        ws['isAlive'] = true;
      });
    });

    this.wsServer.on('close', (): void => {
      clearTimeout(this.pingTimer);
    });

    this.pingTimer = setInterval((): void => {
      this.wsServer.clients.forEach((ws: WebSocket): void => {
        if (!ws['isAlive']) {
          return ws.terminate();
        }

        ws['isAlive'] = false;
        ws.ping();
      });
    }, 30_000);
  }

  // 获取注入的脚本文件
  async getInjectScriptFile(): Promise<void> {
    this.clientScript = await fs.promises.readFile(path.join(dirname, 'client/client.js'), { encoding: 'utf8' });
  }

  // 输出本机IP信息
  async runningAtLog(): Promise<void> {
    const [chalkModule, { internalIpV4 }]: [{ default: typeof Chalk }, { internalIpV4: typeof InternalIpV4 }]
      = await Promise.all([import('chalk'), import('internal-ip')]);
    const ip: string = await internalIpV4() || '127.0.0.1';
    const protocol: string = this.https ? 'https' : 'http';
    const logs: string[] = [
      ' Running at:',
      ` - Local:   ${ protocol }://127.0.0.1:${ this.port }`,
      ` - Network: ${ protocol }://${ ip }:${ this.port }`
    ];

    console.log(`\n${ chalkModule.default.cyan(logs.join('\n')) }\n`);
  }

  // 初始化
  async init(): Promise<void> {
    this.createProxyMiddleware();
    this.createMiddleware();
    this.createMockRouters();
    this.createRouters();
    await this.getPort();
    await this.serverInit();

    // 是否刷新
    if (this.reload) {
      await this.getInjectScriptFile();
      this.websocketServerInit();
    }

    await this.runningAtLog();
  }
}

export default Server;