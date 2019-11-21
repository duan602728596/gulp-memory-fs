# gulp-memory-fs

![](demonstrate.gif)

`gulp-memory-fs`可以让开发者在使用gulp构建时也可以使用内存文件系统（[memory-fs](https://github.com/webpack/memory-fs)或[memfs](https://github.com/streamich/memfs)）。

## 开始使用

```javascript
const gulp = require('gulp');
const GulpMemoryFs = require('gulp-memory-fs');

const mfs = new GulpMemoryFs({
  dir: 'dist'
});

function build() {
  return gulp.src(path.join(__dirname, 'src/**/*.js'))
    .pipe(mfs.changed('dist'))
    .pipe(mfs.dest('dist'));
}

async function server() {
  await gulpMemoryFs.createServer();
}

function watch() {
  gulp.watch('src/**/*.js', build);
}

exports.default = gulp.series(
  build,
  gulp.parallel(watch, server)
);
```

打开浏览器，输入`http://127.0.0.1:7777/`，开始开发。

## API

### GulpMemoryFs

| 参数       | 类型                           | 说明                                   | 默认值      |
| ---        | ---                            | ---                                    | ---         |
| port       | number                         | 服务的端口号                           | 7777        |
| dir        | string                         | 资源的目录                             | &nbsp;      |
| https      | { key: string; cert: string; } | 配置https证书的文件地址，服务启用https | &nbsp;      |
| reload     | boolean                        | 文件保存时，浏览器是否刷新             | false       |
| reloadTime | number                         | 文件修改后，浏览器的延迟刷新时间       | 250         |
| fsType     | 'memory-fs' &#124; 'memfs'     | 使用的内存文件系统                     | 'memory-fs' |
| mock       | { [key: string]: any &#124; ((ctx: Context, next: Function) => void | Promise<void>); } | 配置mock数据 | &nbsp; |
| proxy      | { [key: string]: object; }     | 配置代理                               | &nbsp;      |

### GulpMemoryFs.prototype.changed & GulpMemoryFs.prototype.dest

由于是内存文件系统，无法使用`gulp-changed`，使用`GulpMemoryFs.prototype.changed`来只编译修改后的文件。

| 参数   | 类型   |  说明          |
| ---    | ---    | ---            |
| output | string | 输出文件的目录 |

### GulpMemoryFs.prototype.createServer

启动服务。

## Mock

mock的映射规则如下：

```javascript
const mock = {
  // 使用方法
  'GET /mock/data': { data: [1, 2] },

  // 省略请求方法时，默认的请求方法为GET
  '/mock/data': { data: [1, 2] },

  // 支持自定义函数，API 参考 koa 和 @koa/router
  'POST /mock/data': (ctx, next) => ctx.body = 'ok'
};
```

## Proxy

proxy的规则如下：

```javascript
const proxy = {
  '/proxy/raw/githubusercontent': {
    target: 'https://raw.githubusercontent.com/',
    changeOrigin: true,
    pathRewrite: {
      '^/proxy/raw/githubusercontent': ''
    }
  }
};
```

proxy的配置参考[http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)。

## Test

```
npm run example
npm run test
```