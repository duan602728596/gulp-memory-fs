# gulp-memory-fs

[中文文档](README_zhCN.md)

![](demonstrate.gif)

`gulp-memory-fs` allows developers to use the memory file system ( [memfs](https://github.com/streamich/memfs) ) when building with gulp。   

> [memory-fs](https://github.com/webpack/memory-fs) is deprecated.

## Start Using

```javascript
const gulp = require('gulp');
const GulpMemoryFs = require('gulp-memory-fs');

const mfs = new GulpMemoryFs({
  dir: 'dist'
});

function build() {
  return gulp.src(path.join(__dirname, 'src/**/*.js'))
    .pipe(mfs.changed()) // or mfs.changed('dist')
    .pipe(mfs.dest());   // or mfs.dest('dist')
}

async function server() {
  await mfs.createServer();
}

function watch() {
  gulp.watch('src/**/*.js', build);
}

exports.default = gulp.series(
  build,
  gulp.parallel(watch, server)
);
```

Open the browser and type `http://127.0.0.1:7777/` to start development.

## API

### GulpMemoryFs

| Parameter  | Type                           | Description                                                                    | Default     |
| ---        | ---                            | ---                                                                            | ---         |
| port       | number                         | Service port number                                                            | 7777        |
| dir        | string                         | Directory of resources                                                         | &nbsp;      |
| https      | { key: string; cert: string; } | Configure the file address of the https certificate, service enables https.    | &nbsp;      |
| reload     | boolean                        | Whether the browser refreshes when the file is saved                           | false       |
| reloadTime | number                         | Delayed refresh time of the browser after the file is modified                 | 250         |
| mock       | { [key: string]: any &#124; ((ctx: Context, next: Function) => void &#124; Promise<void>); } | Configuring mock data | &nbsp; |
| proxy      | { [key: string]: object; }     | Configuring the proxy                                                          | &nbsp;      |
| mimeTypes  | { [key: string]: string; }     | Configure mimeTypes                                                            | &nbsp;      |

### GulpMemoryFs.prototype.changed & GulpMemoryFs.prototype.dest

Since it is a memory file system, you cannot use `gulp-changed` and use `GulpMemoryFs.prototype.changed` to compile only the modified file.

| Parameter | Type   | Description           |
| ---       | ---    | ---                   |
| output    | string | Output file directory |

### GulpMemoryFs.prototype.createServer

Start the service.

## Mock

The mapping rules of mock are as follows:

```javascript
const mock = {
  // How to use
  'GET /mock/data': { data: [1, 2] },

  // When the request method is omitted, the default request method is GET
  '/mock/data': { data: [1, 2] },

  // Support for custom functions, API reference koa and @koa/router
  'POST /mock/data': (ctx, next) => ctx.body = 'ok'
};
```

## Proxy

The rules of the proxy are as follows:

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

Proxy configuration reference [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware).

## MimeTypes

```javascript
const mimeTypes = {
  avif: 'image/avif'
};
```

## Test

```
npm run example
npm run test
```