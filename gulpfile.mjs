import util from 'util';
import path from 'path';
import fs from 'fs';
import glob from 'glob';
import gulp from 'gulp';
import typescript from 'gulp-typescript';
import terser from 'gulp-terser';
import tsconfig from './tsconfig.json';

const globPromise = util.promisify(glob);

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

/* 添加文件扩展名 */
async function addJsExt() {
  const files = await globPromise('esm/**/!(client).js');

  for (const file of files) {
    const text = await fs.promises.readFile(file, { encoding: 'utf8' });
    const textArr = text.split(/\n/);

    textArr.forEach(function(value, index) {
      if (
        (/^import /.test(value) || /^export {/.test(value))
        && (/from '\./.test(value) || /import '\./.test(value))
      ) {
        const newValue = value.replace(/';$/, ".js';");

        textArr[index] = newValue;
      }
    });

    await fs.promises.writeFile(file, textArr.join('\n'));
  }
}

/* 写入package.js文件 */
async function writeTypeModulePackageJsonFile() {
  await fs.promises.writeFile(
    path.join('esm/package.json'),
    JSON.stringify({ type: 'module' }, null, 2) + '\n'
  );
}

export default gulp.series(
  gulp.parallel(
    serverBuild,
    createClientBuild('lib'),
    serverESMBuild,
    createClientBuild('esm')
  ),
  gulp.parallel(
    addJsExt,
    writeTypeModulePackageJsonFile
  )
);