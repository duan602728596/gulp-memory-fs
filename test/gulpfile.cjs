const path = require('node:path');
const gulp = require('gulp');
const GulpMemoryFs = require('../lib/GulpMemoryFs.js').default;

const mock = {
  'GET /mock/0': [0, 1, 2, 3],
  '/mock/1': { name: 'test', value: 12 },
  'GET /mock/2': 'Hello, world.',
  'POST /mock/3': [{ name: 'test', value: 22 }],
  '/mock/4': (ctx, next) => ctx.body = { name: 'test', value: 32 }
};

const proxy = {
  '/proxy/raw/githubusercontent': {
    target: 'https://raw.githubusercontent.com/',
    changeOrigin: true,
    pathRewrite: {
      '^/proxy/raw/githubusercontent': ''
    }
  }
};

const gulpMemoryFs = new GulpMemoryFs({
  dir: 'dist',
  reload: true,
  /*
  // https配置
  https: {
    key: path.join(__dirname, '../dev.key'),
    cert: path.join(__dirname, '../dev.crt')
  },
  */
  mock,
  proxy
});

function js() {
  return gulp.src(path.join(__dirname, 'src/**/*.js'))
    .pipe(gulpMemoryFs.changed())
    .pipe(gulpMemoryFs.dest());
}

function html() {
  return gulp.src(path.join(__dirname, 'src/**/*.html'))
    .pipe(gulpMemoryFs.dest());
}

function css() {
  return gulp.src(path.join(__dirname, 'src/**/*.css'))
    .pipe(gulpMemoryFs.dest());
}

function img() {
  return gulp.src(path.join(__dirname, 'src/**/*.{avif,png,jpg,webp}'), { encoding: false })
    .pipe(gulpMemoryFs.dest());
}

function watch() {
  gulp.watch('src/**/*.js', js);
  gulp.watch('src/**/*.html', html);
  gulp.watch('src/**/*.css', css);
  gulp.watch('src/**/*.{avif,png,jpg,webp}', img);
}

async function server() {
  await gulpMemoryFs.createServer();
}

exports.default = gulp.series(
  gulp.parallel(js, html, css, img),
  gulp.parallel(watch, server)
);