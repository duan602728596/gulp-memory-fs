const gulp = require('gulp');
const typescript = require('gulp-typescript');
const terser = require('gulp-terser');
const tsconfig = require('./tsconfig.json');

const tsOptions = {
  ...tsconfig.compilerOptions,
  skipLibCheck: true
};

function serverBuild() {
  const result = gulp.src('src/**/!(client).ts')
    .pipe(typescript(tsOptions));

  return result.js.pipe(gulp.dest('lib'));
}

function clientBuild() {
  const result = gulp.src('src/client.ts')
    .pipe(typescript({
      ...tsOptions,
      target: 'ES3'
    }));

  return result.js
    .pipe(terser())
    .pipe(gulp.dest('lib'));
}

exports.default = gulp.parallel(serverBuild, clientBuild);