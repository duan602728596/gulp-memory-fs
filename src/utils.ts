import * as path from 'path';
import { OutPath } from './types';

/**
 * 格式化输出路径
 * @param { string } output: 输出目录
 * @param { string } relative: 目录
 */
export function formatOutPath(output: string, relative: string): OutPath {
  // 文件路径
  const outputFilePath: string = path.join(output, relative)
    .replace(/\\/g, '/');

  // 目录路径
  const outputDirPath: string = path.dirname(outputFilePath);

  return {
    file: outputFilePath,
    dir: outputDirPath
  };
}