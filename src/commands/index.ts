/**
 * 统一导出所有命令
 */

import { type CommandDef } from '../registry.js';
import { connectionCommands } from './connection.js';
import { pageCommands } from './page.js';
import { snapshotCommands } from './snapshot.js';
import { inputCommands } from './input.js';
import { assertCommands } from './assert.js';
import { navigateCommands } from './navigate.js';
import { consoleCommands } from './console.js';
import { networkCommands } from './network.js';
import { screenshotCommands } from './screenshot.js';
import { scriptCommands } from './script.js';
import { diagnoseCommands } from './diagnose.js';
import { ideCommands } from './ide.js';
import { configCommands } from './config.js';
import { sessionCommandDefs } from './session.js';
import { storageCommands } from './storage.js';

export const allCommands: CommandDef[] = [
  ...connectionCommands,
  ...pageCommands,
  ...snapshotCommands,
  ...inputCommands,
  ...assertCommands,
  ...navigateCommands,
  ...consoleCommands,
  ...networkCommands,
  ...screenshotCommands,
  ...scriptCommands,
  ...diagnoseCommands,
  ...ideCommands,
  ...configCommands,
  ...sessionCommandDefs,
  ...storageCommands,
];
