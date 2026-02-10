/**
 * Prismer TypeScript SDK — Comprehensive Integration Tests
 *
 * Runs against the live production environment (https://prismer.cloud).
 * Requires PRISMER_API_KEY_TEST env var.
 *
 * Usage:
 *   PRISMER_API_KEY_TEST="sk-prismer-live-..." npx vitest run tests/integration.test.ts --reporter=verbose
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PrismerClient } from '../src/index';

// Increase default test timeout for integration tests hitting a live API.
// Individual slow tests (search, PDF parse) get even longer timeouts below.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_KEY = process.env.PRISMER_API_KEY_TEST;
if (!API_KEY) {
  throw new Error('PRISMER_API_KEY_TEST environment variable is required');
}

const RUN_ID = Date.now().toString(36); // unique per run to avoid collisions

/** Create a client authenticated with the API key */
function apiClient(): PrismerClient {
  return new PrismerClient({
    apiKey: API_KEY!,
    environment: 'production',
    timeout: 60_000,
  });
}

/** Create a client authenticated with an IM JWT token */
function imClient(token: string): PrismerClient {
  return new PrismerClient({
    apiKey: token,
    environment: 'production',
    timeout: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Group 1: Context API
// ---------------------------------------------------------------------------

describe('Context API', () => {
  const client = apiClient();

  it('load() single URL — returns success with mode single_url', async () => {
    const result = await client.load('https://example.com');
    expect(result.success).toBe(true);
    expect(result.mode).toBe('single_url');
    expect(result.result).toBeDefined();
    expect(result.result!.url).toContain('example.com');
    // hqcc may or may not exist depending on cache state
    expect(typeof result.result!.cached).toBe('boolean');
  });

  it('load() batch URLs — returns success with mode batch_urls', async () => {
    const result = await client.load([
      'https://example.com',
      'https://httpbin.org/html',
    ]);
    expect(result.success).toBe(true);
    expect(result.mode).toBe('batch_urls');
    expect(result.results).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results!.length).toBeGreaterThanOrEqual(1);
  });

  it('load() search query — returns success', async () => {
    const result = await client.load('What is TypeScript?', {
      inputType: 'query',
    });
    expect(result.success).toBe(true);
    // mode could be 'query' for search-based load
    expect(result.requestId).toBeDefined();
  }, 60_000);

  it('save() — saves content and returns success', async () => {
    const result = await client.save({
      url: `https://test-${RUN_ID}.example.com/integration-test`,
      hqcc: `# Integration Test Content\n\nSaved at ${new Date().toISOString()} by run ${RUN_ID}.`,
    });
    expect(result.success).toBe(true);
  });

  it('search() — performs a search query', async () => {
    const result = await client.search('example domain');
    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Group 2: Parse API
// ---------------------------------------------------------------------------

describe('Parse API', () => {
  const client = apiClient();

  it('parsePdf() with URL — returns success and requestId', async () => {
    const result = await client.parsePdf(
      'https://arxiv.org/pdf/2401.00001.pdf',
      'fast',
    );
    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();
    // The response may be synchronous (document) or async (taskId)
    const hasDocOrTask = result.document !== undefined || result.taskId !== undefined;
    expect(hasDocOrTask).toBe(true);
  }, 60_000);

  it('parse() with mode auto — returns success', async () => {
    const result = await client.parse({
      url: 'https://arxiv.org/pdf/2401.00001.pdf',
      mode: 'auto',
    });
    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Group 3: IM API — Full Lifecycle
// ---------------------------------------------------------------------------

describe('IM API', () => {
  const client = apiClient();

  // State shared across IM tests
  let agentAToken: string;
  let agentAId: string;
  let agentAUsername: string;
  let agentBToken: string;
  let agentBId: string;
  let agentBUsername: string;
  let clientA: PrismerClient; // authenticated with agent A's JWT
  let clientB: PrismerClient; // authenticated with agent B's JWT
  let directConversationId: string;
  let groupId: string;

  // -----------------------------------------------------------------------
  // Account
  // -----------------------------------------------------------------------

  describe('Account', () => {
    it('register() agent A — returns isNew=true and token', async () => {
      agentAUsername = `test-agent-a-${RUN_ID}`;
      const reg = await client.im.account.register({
        type: 'agent',
        username: agentAUsername,
        displayName: `Test Agent A (${RUN_ID})`,
        agentType: 'assistant',
        capabilities: ['testing', 'integration'],
        description: 'Integration test agent A',
      });
      expect(reg.ok).toBe(true);
      expect(reg.data).toBeDefined();
      expect(reg.data!.isNew).toBe(true);
      expect(reg.data!.token).toBeDefined();
      expect(typeof reg.data!.token).toBe('string');
      expect(reg.data!.imUserId).toBeDefined();

      agentAToken = reg.data!.token;
      agentAId = reg.data!.imUserId;
      clientA = imClient(agentAToken);
    });

    it('register() agent B — second agent as message target', async () => {
      agentBUsername = `test-agent-b-${RUN_ID}`;
      const reg = await client.im.account.register({
        type: 'agent',
        username: agentBUsername,
        displayName: `Test Agent B (${RUN_ID})`,
        agentType: 'specialist',
        capabilities: ['testing'],
        description: 'Integration test agent B',
      });
      expect(reg.ok).toBe(true);
      expect(reg.data).toBeDefined();
      expect(reg.data!.isNew).toBe(true);
      expect(reg.data!.token).toBeDefined();

      agentBToken = reg.data!.token;
      agentBId = reg.data!.imUserId;
      clientB = imClient(agentBToken);
    });

    it('me() — returns user profile and agentCard', async () => {
      const me = await clientA.im.account.me();
      expect(me.ok).toBe(true);
      expect(me.data).toBeDefined();
      expect(me.data!.user).toBeDefined();
      expect(me.data!.user.username).toBe(agentAUsername);
      expect(me.data!.agentCard).toBeDefined();
      expect(me.data!.agentCard!.agentType).toBe('assistant');
    });

    it('refreshToken() — returns a new token', async () => {
      const refresh = await clientA.im.account.refreshToken();
      expect(refresh.ok).toBe(true);
      expect(refresh.data).toBeDefined();
      expect(refresh.data!.token).toBeDefined();
      expect(typeof refresh.data!.token).toBe('string');
      // Update token for subsequent calls
      agentAToken = refresh.data!.token;
      clientA = imClient(agentAToken);
    });
  });

  // -----------------------------------------------------------------------
  // Direct Messaging
  // -----------------------------------------------------------------------

  describe('Direct Messaging', () => {
    it('send() — agent A sends message to agent B', async () => {
      const result = await clientA.im.direct.send(agentBId, 'Hello from Agent A!');
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.message).toBeDefined();
      expect(result.data!.message.id).toBeDefined();
      expect(result.data!.conversationId).toBeDefined();
      directConversationId = result.data!.conversationId;
    });

    it('send() — agent B replies to agent A', async () => {
      const result = await clientB.im.direct.send(agentAId, 'Hello back from Agent B!');
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.message.id).toBeDefined();
    });

    it('getMessages() — retrieves message history', async () => {
      const result = await clientA.im.direct.getMessages(agentBId);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Credits
  // -----------------------------------------------------------------------

  describe('Credits', () => {
    it('get() — returns balance for new agent', async () => {
      const result = await clientA.im.credits.get();
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data!.balance).toBe('number');
    });

    it('transactions() — returns transaction array', async () => {
      const result = await clientA.im.credits.transactions();
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Contacts & Discovery
  // -----------------------------------------------------------------------

  describe('Contacts & Discovery', () => {
    it('contacts.list() — returns contacts array', async () => {
      const result = await clientA.im.contacts.list();
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      // After messaging agent B, agent B should be in contacts
      if (result.data!.length > 0) {
        const contact = result.data!.find(
          (c) => c.username === agentBUsername,
        );
        expect(contact).toBeDefined();
      }
    });

    it('contacts.discover() — returns array of agents', async () => {
      const result = await clientA.im.contacts.discover();
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Groups
  // -----------------------------------------------------------------------

  describe('Groups', () => {
    it('create() — creates a group chat', async () => {
      const result = await clientA.im.groups.create({
        title: `Test Group ${RUN_ID}`,
        description: 'Integration test group',
        members: [agentBId],
      });
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.groupId).toBeDefined();
      groupId = result.data!.groupId;
    });

    it('list() — lists groups', async () => {
      const result = await clientA.im.groups.list();
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });

    it('get() — gets group details', async () => {
      const result = await clientA.im.groups.get(groupId);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.groupId).toBe(groupId);
      expect(result.data!.title).toContain('Test Group');
    });

    it('send() — sends message to group', async () => {
      const result = await clientA.im.groups.send(groupId, 'Hello group!');
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.message).toBeDefined();
    });

    it('addMember() — adds a member (may already be present)', async () => {
      // Agent B is already a member from creation, so this may succeed or return an error.
      // We test the call completes without throwing.
      const result = await clientA.im.groups.addMember(groupId, agentBId);
      // Could be ok=true (added) or ok=false (already member)
      expect(result).toBeDefined();
    });

    it('getMessages() — retrieves group messages', async () => {
      const result = await clientA.im.groups.getMessages(groupId);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Conversations
  // -----------------------------------------------------------------------

  describe('Conversations', () => {
    it('list() — returns conversations array', async () => {
      const result = await clientA.im.conversations.list();
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });

    it('get() — returns conversation details', async () => {
      expect(directConversationId).toBeDefined();
      const result = await clientA.im.conversations.get(directConversationId);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBe(directConversationId);
    });

    it('markAsRead() — marks conversation as read', async () => {
      const result = await clientA.im.conversations.markAsRead(directConversationId);
      expect(result.ok).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Messages (low-level by conversationId)
  // -----------------------------------------------------------------------

  describe('Messages (low-level)', () => {
    it('send() — sends message to a conversation', async () => {
      expect(directConversationId).toBeDefined();
      const result = await clientA.im.messages.send(
        directConversationId,
        'Low-level message test',
      );
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.message).toBeDefined();
      expect(result.data!.message.content).toBe('Low-level message test');
    });

    it('getHistory() — retrieves messages for conversation', async () => {
      const result = await clientA.im.messages.getHistory(directConversationId);
      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Workspace
  // -----------------------------------------------------------------------

  describe('Workspace', () => {
    it('init() — initializes a 1:1 workspace', async () => {
      const result = await clientA.im.workspace.init();
      // Workspace may or may not be available in test env
      if (result.ok) {
        expect(result.data).toBeDefined();
        expect(result.data!.workspaceId).toBeDefined();
        expect(result.data!.conversationId).toBeDefined();
      } else {
        // Acceptable: workspace feature may not be enabled
        expect(result.error).toBeDefined();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('register duplicate username (re-register same agent) — should return isNew=false or error', async () => {
      const reg = await client.im.account.register({
        type: 'agent',
        username: agentAUsername,
        displayName: `Test Agent A duplicate (${RUN_ID})`,
      });
      // Server may return ok with isNew=false (idempotent) or error 409
      if (reg.ok) {
        expect(reg.data!.isNew).toBe(false);
      } else {
        expect(reg.error).toBeDefined();
      }
    });

    it('send to nonexistent user — should fail', async () => {
      const result = await clientA.im.direct.send(
        'nonexistent-user-id-00000000',
        'This should fail',
      );
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('access without auth — should fail (401)', async () => {
      const noAuthClient = new PrismerClient({
        apiKey: 'invalid-token-not-real',
        environment: 'production',
      });
      const result = await noAuthClient.im.account.me();
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
