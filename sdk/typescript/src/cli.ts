/**
 * Prismer CLI — manage API keys, register IM agents, and check status.
 *
 * Usage:
 *   prismer init <api-key>
 *   prismer register <username>
 *   prismer status
 *   prismer config show
 *   prismer config set <key> <value>
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as TOML from '@iarna/toml';
import { PrismerClient } from './index';

// Read version from package.json (works in CJS bundle where __dirname is available)
let cliVersion = '1.3.3';
try {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  cliVersion = pkg.version || cliVersion;
} catch {}

// ============================================================================
// Config helpers
// ============================================================================

const CONFIG_DIR = path.join(os.homedir(), '.prismer');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.toml');

interface PrismerCLIConfig {
  default?: {
    api_key?: string;
    environment?: string;
    base_url?: string;
  };
  auth?: {
    im_token?: string;
    im_user_id?: string;
    im_username?: string;
    im_token_expires?: string;
  };
  [key: string]: unknown;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig(): PrismerCLIConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return TOML.parse(raw) as unknown as PrismerCLIConfig;
}

function writeConfig(config: PrismerCLIConfig): void {
  ensureConfigDir();
  const content = TOML.stringify(config as any);
  fs.writeFileSync(CONFIG_PATH, content, 'utf-8');
}

function setNestedValue(obj: Record<string, any>, dotPath: string, value: string): void {
  const parts = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, any>;
  }
  current[parts[parts.length - 1]] = value;
}

// ============================================================================
// CLI
// ============================================================================

const program = new Command();

program
  .name('prismer')
  .description('Prismer Cloud SDK CLI')
  .version(cliVersion);

// --- init -------------------------------------------------------------------

program
  .command('init <api-key>')
  .description('Store API key in ~/.prismer/config.toml')
  .action((apiKey: string) => {
    const config = readConfig();
    if (!config.default) {
      config.default = {};
    }
    config.default.api_key = apiKey;
    if (!config.default.environment) {
      config.default.environment = 'production';
    }
    if (config.default.base_url === undefined) {
      config.default.base_url = '';
    }
    writeConfig(config);
    console.log('API key saved to ~/.prismer/config.toml');
  });

// --- register ---------------------------------------------------------------

program
  .command('register <username>')
  .description('Register an IM agent and store the token')
  .option('--type <type>', 'Identity type: agent or human', 'agent')
  .option('--display-name <name>', 'Display name for the agent')
  .option('--agent-type <agentType>', 'Agent type: assistant, specialist, orchestrator, tool, or bot')
  .option('--capabilities <caps>', 'Comma-separated list of capabilities')
  .action(async (username: string, opts: {
    type: string;
    displayName?: string;
    agentType?: string;
    capabilities?: string;
  }) => {
    const config = readConfig();
    const apiKey = config.default?.api_key;

    if (!apiKey) {
      console.error('Error: No API key configured. Run "prismer init <api-key>" first.');
      process.exit(1);
    }

    const client = new PrismerClient({
      apiKey,
      environment: (config.default?.environment as 'production') || 'production',
      baseUrl: config.default?.base_url || undefined,
    });

    const registerOpts: Parameters<typeof client.im.account.register>[0] = {
      type: opts.type as 'agent' | 'human',
      username,
      displayName: opts.displayName || username,
    };

    if (opts.agentType) {
      registerOpts.agentType = opts.agentType as 'assistant' | 'specialist' | 'orchestrator' | 'tool' | 'bot';
    }

    if (opts.capabilities) {
      registerOpts.capabilities = opts.capabilities.split(',').map((c) => c.trim());
    }

    try {
      const result = await client.im.account.register(registerOpts);

      if (!result.ok || !result.data) {
        console.error('Registration failed:', result.error?.message || 'Unknown error');
        process.exit(1);
      }

      const data = result.data;

      // Store auth details
      if (!config.auth) {
        config.auth = {};
      }
      config.auth.im_token = data.token;
      config.auth.im_user_id = data.imUserId;
      config.auth.im_username = data.username;
      config.auth.im_token_expires = data.expiresIn;
      writeConfig(config);

      console.log('Registration successful!');
      console.log(`  User ID:  ${data.imUserId}`);
      console.log(`  Username: ${data.username}`);
      console.log(`  Display:  ${data.displayName}`);
      console.log(`  Role:     ${data.role}`);
      console.log(`  New:      ${data.isNew}`);
      console.log(`  Expires:  ${data.expiresIn}`);
      console.log('');
      console.log('Token stored in ~/.prismer/config.toml');
    } catch (err) {
      console.error('Registration failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// --- status -----------------------------------------------------------------

program
  .command('status')
  .description('Show current config and token status')
  .action(async () => {
    const config = readConfig();

    console.log('=== Prismer Status ===');
    console.log('');

    // Config section
    const apiKey = config.default?.api_key;
    if (apiKey) {
      const masked = apiKey.length > 16
        ? apiKey.slice(0, 12) + '...' + apiKey.slice(-4)
        : '***';
      console.log(`API Key:     ${masked}`);
    } else {
      console.log('API Key:     (not set)');
    }
    console.log(`Environment: ${config.default?.environment || '(not set)'}`);
    console.log(`Base URL:    ${config.default?.base_url || '(default)'}`);
    console.log('');

    // Auth section
    const token = config.auth?.im_token;
    if (token) {
      console.log(`IM User ID:  ${config.auth?.im_user_id || '(unknown)'}`);
      console.log(`IM Username: ${config.auth?.im_username || '(unknown)'}`);

      const expires = config.auth?.im_token_expires;
      if (expires) {
        const expiresDate = new Date(expires);
        if (!isNaN(expiresDate.getTime())) {
          const now = new Date();
          const isExpired = expiresDate <= now;
          const label = isExpired ? 'EXPIRED' : 'valid';
          console.log(`IM Token:    ${label} (expires ${expiresDate.toISOString()})`);
        } else {
          // Duration string like "7d"
          console.log(`IM Token:    set (expires in ${expires})`);
        }
      } else {
        console.log('IM Token:    set (expiry unknown)');
      }
    } else {
      console.log('IM Token:    (not registered)');
    }

    // Live info (me() requires JWT token, not API key)
    if (token) {
      console.log('');
      console.log('--- Live Info ---');
      try {
        const client = new PrismerClient({
          apiKey: token,
          environment: (config.default?.environment as 'production') || 'production',
          baseUrl: config.default?.base_url || undefined,
        });
        const me = await client.im.account.me();
        if (me.ok && me.data) {
          console.log(`Display:     ${me.data.user.displayName}`);
          console.log(`Role:        ${me.data.user.role}`);
          console.log(`Credits:     ${me.data.credits.balance}`);
          console.log(`Messages:    ${me.data.stats.messagesSent}`);
          console.log(`Unread:      ${me.data.stats.unreadCount}`);
        } else {
          console.log(`Could not fetch live info: ${me.error?.message || 'unknown error'}`);
        }
      } catch (err) {
        console.log(`Could not fetch live info: ${err instanceof Error ? err.message : err}`);
      }
    }
  });

// --- config -----------------------------------------------------------------

const configCmd = program
  .command('config')
  .description('Manage config file');

configCmd
  .command('show')
  .description('Print config file contents')
  .action(() => {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.log('No config file found at ~/.prismer/config.toml');
      console.log('Run "prismer init <api-key>" to create one.');
      return;
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    console.log(raw);
  });

configCmd
  .command('set <key> <value>')
  .description('Set a config value (e.g., prismer config set default.api_key sk-prismer-...)')
  .action((key: string, value: string) => {
    const config = readConfig();
    setNestedValue(config as Record<string, any>, key, value);
    writeConfig(config);
    console.log(`Set ${key} = ${value}`);
  });

// --- parse & run ------------------------------------------------------------

program.parse(process.argv);
