const gulp = require('gulp');
const typescript = require('gulp-typescript');
const terser = require('gulp-terser');
const tsconfig = require('./tsconfig.json');

function serverBuild() {
  const result = gulp.src('src/**/!(client).ts')
    .pipe(typescript(tsconfig.compilerOptions));

  return result.js.pipe(gulp.dest('lib'));
}

function clientBuild() {
  const result = gulp.src('src/client.ts')
    .pipe(typescript({
      ...tsconfig.compilerOptions,
      target: 'ES3'
    }));

  return result.js
    .pipe(terser())
    .pipe(gulp.dest('lib'));
}

exports.default = gulp.parallel(serverBuild, clientBuild);