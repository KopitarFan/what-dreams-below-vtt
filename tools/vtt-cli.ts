#!/usr/bin/env node
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import {
  VttApiClient,
  VttApiError,
  validateContentPackage,
} from '../lib/vtt-api-client';
import type { AssetKind } from '../lib/vtt-api-client';

type Config = { baseUrl: string; campaignId: string; token?: string };
const configPath =
  process.env.WDB_CONFIG_PATH ||
  resolve(homedir(), '.config', 'what-dreams-below', 'config.json');
const args = process.argv.slice(2),
  command = args[0] || 'help';
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const output = (value: unknown) =>
  process.stdout.write(
    `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`,
  );

async function loadConfig(): Promise<Required<Config>> {
  let stored: Partial<Config> = {};
  try {
    stored = JSON.parse(await readFile(configPath, 'utf8'));
  } catch {}
  const config = {
    baseUrl:
      process.env.WDB_VTT_URL ||
      stored.baseUrl ||
      'https://what-dream-below-vtt.friarpuck.com',
    campaignId: process.env.WDB_CAMPAIGN_ID || stored.campaignId || '',
    token: process.env.WDB_VTT_TOKEN || stored.token || '',
  };
  if (!config.campaignId || !config.token)
    throw new Error(
      'Configure a campaign first or set WDB_CAMPAIGN_ID and WDB_VTT_TOKEN.',
    );
  return config as Required<Config>;
}
async function saveConfig(config: Config) {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(configPath, 0o600);
}
async function readJson(path: string) {
  return JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
}
function help() {
  output(`What Dreams Below VTT CLI

Usage:
  npm run vtt -- configure --campaign ID [--url URL] [--token TOKEN]
  npm run vtt -- context [--out FILE]
  npm run vtt -- validate PACKAGE.json
  npm run vtt -- submit PACKAGE.json
  npm run vtt -- imports
  npm run vtt -- upload IMAGE --kind map|token|portrait|handout|sticker [--name NAME]
  npm run vtt -- assets

Environment overrides:
  WDB_VTT_URL, WDB_CAMPAIGN_ID, WDB_VTT_TOKEN, WDB_CONFIG_PATH

For safer automation, provide the token through WDB_VTT_TOKEN instead of shell history.`);
}
async function main() {
  if (command === 'help' || command === '--help' || command === '-h') {
    help();
    return;
  }
  if (command === 'configure') {
    const campaignId = option('campaign');
    if (!campaignId) throw new Error('--campaign is required.');
    const config: Config = {
      baseUrl: option('url') || 'https://what-dream-below-vtt.friarpuck.com',
      campaignId,
    };
    const token = option('token') || process.env.WDB_VTT_TOKEN;
    if (token) config.token = token;
    await saveConfig(config);
    output(`Saved campaign configuration to ${configPath}.`);
    return;
  }
  if (command === 'validate') {
    const path = args[1];
    if (!path) throw new Error('Provide a content-package JSON file.');
    const pack = validateContentPackage(await readJson(path));
    output(
      `Valid content package v${pack.schemaVersion}: ${pack.title}\n${pack.scenes.length} scenes, ${pack.cast.length} cast, ${pack.handouts.length} handouts, ${pack.encounters.length} encounters.`,
    );
    return;
  }
  const config = await loadConfig(),
    client = new VttApiClient(config);
  if (command === 'context') {
    const context = await client.getContext(),
      destination = option('out');
    if (destination) {
      await writeFile(
        resolve(destination),
        `${JSON.stringify(context, null, 2)}\n`,
      );
      output(`Campaign context written to ${destination}.`);
    } else output(context);
    return;
  }
  if (command === 'submit') {
    const path = args[1];
    if (!path) throw new Error('Provide a content-package JSON file.');
    output(await client.submitImport(await readJson(path)));
    return;
  }
  if (command === 'imports') {
    output(await client.listImports());
    return;
  }
  if (command === 'upload') {
    const path = args[1],
      kind = option('kind') as AssetKind | undefined;
    if (!path || !kind) throw new Error('Provide an image path and --kind.');
    const allowed: AssetKind[] = [
      'map',
      'token',
      'portrait',
      'handout',
      'sticker',
    ];
    if (!allowed.includes(kind))
      throw new Error(`Invalid asset kind: ${kind}.`);
    const bytes = await readFile(resolve(path));
    const extension = path.toLowerCase().split('.').pop();
    const mime =
      extension === 'png'
        ? 'image/png'
        : extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : extension === 'webp'
            ? 'image/webp'
            : extension === 'gif'
              ? 'image/gif'
              : '';
    if (!mime)
      throw new Error('Supported image formats: PNG, JPEG, WebP, GIF.');
    output(
      await client.uploadAssetFile({
        file: new Blob([bytes], { type: mime }),
        filename: path.split('/').pop() || 'asset',
        name: option('name') || path.split('/').pop() || 'Generated asset',
        kind,
      }),
    );
    return;
  }
  if (command === 'assets') {
    output(await client.listAssets());
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}
main().catch((error) => {
  if (error instanceof VttApiError)
    process.stderr.write(`VTT API error (${error.status}): ${error.message}\n`);
  else
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
  process.exitCode = 1;
});
