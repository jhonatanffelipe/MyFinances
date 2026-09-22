import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  dbFolder?: string;
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'myfinances-config.json');

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading config file:', err);
  }
  return {};
}

export function saveConfig(config: AppConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving config file:', err);
  }
}
