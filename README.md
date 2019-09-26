# gulp-memory-fs

[中文文档](README_zhCN.md)

![](demonstrate.gif)

`gulp-memory-fs` allows developers to use the memory file system ( [memory-fs](https://github.com/webpack/memory-fs) ) when building with gulp。

## Start Using

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
  gulp.watch('src/**/*.js', js);
}

exports.default = gulp.series(
  build,
  gulp.parallel(watch, server)
);
```

Open the browser and type `http://127.0.0.1:7777/` to start development.

## API

### GulpMemoryFs

| Parameter | Type | Description | Default |
| --- | --- | --- | --- |
| port | number | Service port number | 7777 |
| dir | string | Directory of resources | &nbsp; |
| reload | boolean | Whether the browser refreshes when the file is saved | false |
| https | { key: string; cert: string; } | Configure https certificate, service enable https | &nbsp; |

### GulpMemoryFs.prototype.changed & GulpMemoryFs.prototype.dest

Since it is a memory file system, you cannot use `gulp-changed` and use `GulpMemoryFs.prototype.changed` to compile only the modified file.

| Parameter | Type | Description |
| --- | --- | --- | --- |
| output | string | Output file directory |