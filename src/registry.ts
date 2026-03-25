/**
 * 命令注册表 - 管理所有 CLI 命令的定义和查找
 */

import { SharedContext } from './context.js';

export interface ArgDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  required?: boolean;
  default?: any;
  description: string;
  alias?: string;
}

export interface CommandDef {
  name: string;
  description: string;
  category: string;
  args: ArgDef[];
  handler: (args: Record<string, any>, ctx: SharedContext) => Promise<string>;
}

class CommandRegistry {
  private commands: Map<string, CommandDef> = new Map();

  register(cmd: CommandDef): void {
    this.commands.set(cmd.name, cmd);
  }

  registerAll(cmds: CommandDef[]): void {
    for (const cmd of cmds) {
      this.register(cmd);
    }
  }

  get(name: string): CommandDef | undefined {
    return this.commands.get(name);
  }

  getAll(): CommandDef[] {
    return Array.from(this.commands.values());
  }

  getByCategory(): Map<string, CommandDef[]> {
    const map = new Map<string, CommandDef[]>();
    for (const cmd of this.commands.values()) {
      const list = map.get(cmd.category) || [];
      list.push(cmd);
      map.set(cmd.category, list);
    }
    return map;
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }
}

/** 全局命令注册表单例 */
export const registry = new CommandRegistry();

/** 便捷函数：定义命令 */
export function defineCommand(def: CommandDef): CommandDef {
  return def;
}
