import gulp from 'gulp';
import typescript from 'gulp-typescript';
import terser from 'gulp-terser';
import tsconfig from './tsconfig.json';

const tsOptions = {
  ...tsconfig.compilerOptions,
  skipLibCheck: true
};

const tsESMOptions = {
  ...tsconfig.compilerOptions,
  skipLibCheck: true,
  module: 'ESNext'
};

function serverBuild() {
  const result = gulp.src('src/**/!(client).ts')
    .pipe(typescript(tsOptions));

  return result.js.pipe(gulp.dest('lib'));
}

function serverESMBuild() {
  const result = gulp.src('src/**/!(client|cjs).ts')
    .pipe(typescript(tsESMOptions));

  return result.js.pipe(gulp.dest('esm'));
}

function createClientBuild(output) {
  return function clientBuild() {
    const result = gulp.src('src/client.ts')
      .pipe(typescript({
        ...tsOptions,
        target: 'ES3'
      }));

    return result.js
      .pipe(terser())
      .pipe(gulp.dest(output));
  };
}

export default gulp.parallel(
  serverBuild,
  createClientBuild('lib'),
  serverESMBuild,
  createClientBuild('esm')
);