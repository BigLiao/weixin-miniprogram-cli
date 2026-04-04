/**
 * Daemon 共享常量
 */

import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP_DIR = tmpdir();

export const SOCKET_PATH = process.platform === 'win32'
  ? '\\\\.\\pipe\\wx-mp-cli-daemon'
  : join(TMP_DIR, 'wx-mp-cli-daemon.sock');

export const PID_FILE = join(TMP_DIR, 'wx-mp-cli-daemon.pid');
export const LOG_FILE = join(TMP_DIR, 'wx-mp-cli.log');
