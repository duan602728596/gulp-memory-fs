const gulp = require('gulp');
const path = require('path');
const GulpMemoryFs = require('../cjs');

const gulpMemoryFs = new GulpMemoryFs({
  dir: 'dist'
});

function js() {
  return gulp.src(path.join(__dirname, 'src/**/*.js'))
    .pipe(gulpMemoryFs.watch('dist'))
    .pipe(gulpMemoryFs.dest('dist'));
}

function html() {
  return gulp.src(path.join(__dirname, 'src/**/*.html'))
    .pipe(gulpMemoryFs.dest('dist'));
}

function watch() {
  gulp.watch('src/**/*.js', js);
  gulp.watch('src/**/*.html', html);
}

async function server() {
  await gulpMemoryFs.createServer();
}

exports.default = gulp.series(
  gulp.parallel(js, html),
  gulp.parallel(watch, server)
);