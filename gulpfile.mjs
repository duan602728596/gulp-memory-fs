import fs from 'fs';
import { glob } from 'glob';
import gulp from 'gulp';
import gulpTypescript from 'gulp-typescript';
import { ProjectCompiler as GulpTypescriptProjectCompiler } from 'gulp-typescript/release/compiler.js';
import gulpTypescriptUtils from 'gulp-typescript/release/utils.js';
import terser from 'gulp-terser';
import rename from 'gulp-rename';
import typescript from 'typescript';
import tsconfig from './tsconfig.json' assert { type: 'json' };

/**
 * fix: 重写 ProjectCompiler 的 attachContentToFile 方法
 *      用于支持mts和cts文件的编译
 */
GulpTypescriptProjectCompiler.prototype.attachContentToFile = function(file, fileName, content) {
  const [, extension] = gulpTypescriptUtils.splitExtension(fileName, ['d.ts', 'd.ts.map']);

  switch (extension) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      file.jsFileName = fileName;
      file.jsContent = content;
      break;

    case 'd.ts.map':
      file.dtsMapFileName = fileName;
      file.dtsMapContent = content;
      break;

    case 'd.ts':
      file.dtsFileName = fileName;
      file.dtsContent = content;
      break;

    case 'map':
      file.jsMapContent = content;
      break;
  }
};

/* typescript配置 */
// cjs
const tsOptions = {
  ...tsconfig.compilerOptions,
  moduleResolution: 'Node16',
  module: 'Node16',
  skipLibCheck: true,
  typescript
};

// esm
const tsESMOptions = {
  ...tsconfig.compilerOptions,
  skipLibCheck: true,
  typescript
};

/* 将mjs和cjs统一重命名为js */
function renameCallback(p) {
  if (p.extname === '.mjs' || p.extname === '.cjs') {
    p.extname = '.js';
  }
}

/* 编译server端的代码 */
// cjs
function serverBuild() {
  const result = gulp.src([
    'src/**/*.{ts,cts}',
    '!src/client.ts'
  ])
    .pipe(gulpTypescript(tsOptions));

  return result.js
    .pipe(rename(renameCallback))
    .pipe(gulp.dest('lib'));
}

// esm
function serverESMBuild() {
  const result = gulp.src([
    'src/**/*.{ts,mts}',
    '!src/client.ts'
  ])
    .pipe(gulpTypescript(tsESMOptions));

  return result.js
    .pipe(rename(renameCallback))
    .pipe(gulp.dest('esm'));
}

/* 编译client自动刷新的注入代码 */
function createClientBuild(output) {
  return function clientBuild() {
    const result = gulp.src('src/client.ts')
      .pipe(gulpTypescript({
        ...tsOptions,
        target: 'ES5'
      }));

    return result.js
      .pipe(terser())
      .pipe(gulp.dest(output));
  };
}

/* 添加文件扩展名 */
async function addJsExt() {
  const files = await glob([
    'esm/**/*.js',
    '!esm/client.js'
  ]);

  for (const file of files) {
    const text = await fs.promises.readFile(file, { encoding: 'utf8' });
    const textArr = text.split(/\n/);

    textArr.forEach(function(value, index) {
      if (
        (/^import /.test(value) || /^export {/.test(value))
        && (/from '\./.test(value) || /import '\./.test(value))
      ) {
        textArr[index] = value.replace(/';$/, ".js';");
      }
    });

    await fs.promises.writeFile(file, textArr.join('\n'));
  }
}

/* 写入package.js文件 */
async function writeTypeModulePackageJsonFile() {
  await fs.promises.writeFile('esm/package.json', JSON.stringify({ type: 'module' }) + '\n');
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