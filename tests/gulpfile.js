const gulp = require('gulp');
const path = require('path');
const GulpMemoryFs = require('../cjs');

const mock = {
  'GET /mock/0': [0, 1, 2, 3],
  '/mock/1': { name: 'test', value: 12 },
  'GET /mock/2': 'Hello, world.',
  'POST /mock/3': [{ name: 'test', value: 22 }],
  '/mock/4': (ctx, next) => ctx.body = { name: 'test', value: 32 }
};

const gulpMemoryFs = new GulpMemoryFs({
  dir: 'dist',
  reload: true,
  fsType: 'memfs',
  mock
});

function js() {
  return gulp.src(path.join(__dirname, 'src/**/*.js'))
    .pipe(gulpMemoryFs.changed('dist'))
    .pipe(gulpMemoryFs.dest('dist'));
}

function html() {
  return gulp.src(path.join(__dirname, 'src/**/*.html'))
    .pipe(gulpMemoryFs.dest('dist'));
}

function css() {
  return gulp.src(path.join(__dirname, 'src/**/*.css'))
    .pipe(gulpMemoryFs.dest('dist'));
}

function watch() {
  gulp.watch('src/**/*.js', js);
  gulp.watch('src/**/*.html', html);
  gulp.watch('src/**/*.css', css);
}

async function server() {
  await gulpMemoryFs.createServer();
}

exports.default = gulp.series(
  gulp.parallel(js, html, css),
  gulp.parallel(watch, server)
);