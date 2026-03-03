/**
 * OpenClaw Gateway WebSocket Client
 *
 * Implements the OpenClaw gateway protocol for authenticating and
 * communicating with the agent running inside a container.
 *
 * Protocol flow:
 * 1. Connect to ws://<gatewayUrl>
 * 2. Receive connect.challenge with nonce
 * 3. Send connect request with token + device credentials + signed nonce
 * 4. Receive hello-ok with session token
 * 5. Send chat.send requests
 * 6. Receive streaming events + final response
 */

import crypto from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger('OpenClawGateway');

let wsNativeAddonsDisabled = false;

/**
 * In Next.js webpack server bundles, optional native ws deps may be replaced
 * with "ignored" stubs. That can trigger runtime errors such as
 * "bufferUtil.mask is not a function" when ws tries to use them.
 *
 * Force ws to use pure-JS fallback paths in this runtime.
 */
function ensureWsPureJsMode(): void {
  if (wsNativeAddonsDisabled) return;
  if (!process.env.WS_NO_BUFFER_UTIL) process.env.WS_NO_BUFFER_UTIL = '1';
  if (!process.env.WS_NO_UTF_8_VALIDATE) process.env.WS_NO_UTF_8_VALIDATE = '1';
  wsNativeAddonsDisabled = true;
}

ensureWsPureJsMode();

export interface DeviceCredentials {
  deviceId: string;
  publicKey: string; // Raw Ed25519 public key, base64url
  privateKeyPem: string; // PEM-encoded Ed25519 private key
  role: string; // e.g. "operator"
  scopes: string[]; // e.g. ["operator.admin", "operator.approvals", "operator.pairing"]
}

export interface GatewayConnectResult {
  success: boolean;
  protocol?: number;
  role?: string;
  deviceToken?: string;
  error?: string;
}

export interface ChatSendResult {
  success: boolean;
  content?: string;
  error?: string;
  runId?: string;
}

export interface GatewayRuntimeEvent {
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Connect to OpenClaw gateway, authenticate, and send a chat message.
 * Returns the agent's response.
 */
export async function sendGatewayMessage(
  gatewayUrl: string,
  gatewayToken: string,
  device: DeviceCredentials | null,
  message: string,
  sessionKey: string,
  options?: { timeout?: number; onEvent?: (event: GatewayRuntimeEvent) => void }
): Promise<ChatSendResult> {
  ensureWsPureJsMode();
  const timeout = options?.timeout || 60000;
  const { default: WebSocket } = await import('ws');

  return new Promise((resolve) => {
    const reqLog = log.child({ sessionKey, gatewayUrl });
    const ws = new WebSocket(gatewayUrl);
    let resolved = false;
    let authenticated = false;
    let responseContent = '';
    let runId: string | undefined;

    // Keepalive timer: resets on every incoming WS event so the connection
    // stays open as long as the agent is actively processing (multi-turn
    // tool-use loops can take 5+ minutes).
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          reqLog.warn('Gateway message timeout', { timeout, hasContent: responseContent.length > 0 });
          resolve({
            success: responseContent.length > 0,
            content: responseContent || undefined,
            error: responseContent.length > 0 ? undefined : 'Timeout waiting for agent response',
          });
        }
      }, timeout);
    };
    resetTimer();

    ws.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reqLog.error('WebSocket error', { error: err.message });
        resolve({ success: false, error: `WebSocket error: ${err.message}` });
      }
    });

    ws.on('close', (code, reason) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reqLog.info('WebSocket closed', { code, reason: reason.toString(), hasContent: responseContent.length > 0 });
        resolve({
          success: responseContent.length > 0,
          content: responseContent || undefined,
          error: responseContent.length > 0 ? undefined : `Connection closed: ${code} ${reason}`,
        });
      }
    });

    ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());

        // Step 1: Handle connect.challenge
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          reqLog.debug('Connect challenge received');

          // Build connect request — token-only auth is sufficient for
          // local gateway mode. Device credentials are optional and only
          // needed for remote/multi-node gateway topologies.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const connectParams: Record<string, any> = {
            minProtocol: 3,
            maxProtocol: 3,
            auth: { token: gatewayToken },
            // Token-only mode still needs explicit operator scopes for chat.send.
            role: 'operator',
            scopes: ['operator.read', 'operator.write', 'operator.admin', 'operator.approvals', 'operator.pairing'],
            client: {
              id: 'cli',
              platform: 'linux',
              mode: 'cli',
              version: '1.0.0',
            },
          };

          // If device credentials are available, include signed payload
          if (device) {
            const nonce = msg.payload.nonce;
            const signedAt = Date.now();
            const role = device.role || 'operator';
            const scopes = device.scopes?.length ? device.scopes : ['operator.admin'];
            const scopesStr = scopes.join(',');
            const payload = [
              'v2', device.deviceId, 'cli', 'cli', role, scopesStr,
              String(signedAt), gatewayToken, nonce,
            ].join('|');

            const privateKey = crypto.createPrivateKey(device.privateKeyPem);
            const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64url');

            connectParams.role = role;
            connectParams.scopes = scopes;
            connectParams.device = {
              id: device.deviceId,
              publicKey: device.publicKey,
              signature,
              signedAt,
              nonce,
            };
            reqLog.debug('Using device-signed auth', { role });
          } else {
            reqLog.debug('Using token-only auth (no device credentials)');
          }

          ws.send(JSON.stringify({
            type: 'req',
            id: crypto.randomUUID(),
            method: 'connect',
            params: connectParams,
          }));
          return;
        }

        // Step 2: Handle connect response
        if (msg.type === 'res' && msg.payload?.type === 'hello-ok') {
          authenticated = true;
          reqLog.info('Gateway authenticated', {
            protocol: msg.payload.protocol,
            role: msg.payload.auth?.role,
          });

          // Step 3: Send chat message
          const chatReq = {
            type: 'req',
            id: crypto.randomUUID(),
            method: 'chat.send',
            params: {
              sessionKey,
              message,
              idempotencyKey: crypto.randomUUID(),
            },
          };

          ws.send(JSON.stringify(chatReq));
          return;
        }

        // Handle connect error
        if (msg.type === 'res' && msg.ok === false && !authenticated) {
          resolved = true;
          clearTimeout(timer);
          ws.close();
          reqLog.warn('Gateway auth failed', { error: msg.error?.message });
          resolve({ success: false, error: `Auth failed: ${msg.error?.message || 'unknown'}` });
          return;
        }

        // Handle chat.send response (initial ack)
        if (msg.type === 'res' && msg.ok === true && msg.payload?.runId) {
          runId = msg.payload.runId;
          reqLog.debug('Chat started', { runId });
          // Reset timer — agent may take minutes for LLM inference before
          // streaming any events. Give it a full timeout window from now.
          resetTimer();
          // Emit synthetic thinking event so frontend knows agent is processing
          options?.onEvent?.({
            event: 'agent',
            payload: { stream: 'thinking', data: { delta: 'Agent is thinking...' } } as Record<string, unknown>,
          });
          return;
        }

        // Handle chat.send rejection (agent busy, rate limited, etc.)
        if (msg.type === 'res' && msg.ok === false && authenticated) {
          resolved = true;
          clearTimeout(timer);
          ws.close();
          const errorMsg = msg.error?.message || msg.payload?.message || 'Chat request rejected';
          reqLog.warn('Chat.send rejected', { error: errorMsg, code: msg.error?.code });
          resolve({ success: false, error: `Agent rejected: ${errorMsg}` });
          return;
        }

        // Handle streaming events
        if (msg.type === 'event') {
          // Reset keepalive timer on any event — agent is still active
          resetTimer();

          const event = msg.event || '';
          const payload = msg.payload || {};
          options?.onEvent?.({
            event,
            payload: payload as Record<string, unknown>,
          });

          // Log every event for debugging (abbreviated payload)
          const stream = payload.stream || '';
          const phase = payload.data?.phase || payload.state || '';
          reqLog.debug('WS event', {
            event,
            stream,
            phase,
            hasData: !!payload.data,
            hasDelta: !!(payload.data?.delta || payload.delta),
            accumulatedLen: responseContent.length,
          });

          // Accumulate text deltas from agent stream
          // Format: event="agent", payload.stream="assistant", payload.data.delta
          if (event === 'agent' && payload.stream === 'assistant' && payload.data?.delta) {
            // Emit synthetic "generating" event on first delta
            if (responseContent.length === 0) {
              options?.onEvent?.({
                event: 'agent',
                payload: { stream: 'thinking', data: { delta: 'Generating response...' } } as Record<string, unknown>,
              });
            }
            responseContent += payload.data.delta;
          }

          // Also check flat delta/text format (legacy/alternative)
          if (payload.delta && event !== 'agent') {
            responseContent += payload.delta;
          }

          // Check for completion: chat event with state="final"
          const isChatFinal = event === 'chat' && payload.state === 'final';
          const isChatError = event === 'chat' && payload.state === 'error';
          // Agent lifecycle end — fires between EACH agentic turn, not just final
          const isAgentEnd = event === 'agent' && payload.stream === 'lifecycle' && payload.data?.phase === 'end';
          const isAgentError = event === 'agent' && payload.stream === 'lifecycle' && payload.data?.phase === 'error';
          // Legacy completion events
          const isLegacyDone = event === 'agent.done' || event === 'chat.done' || event === 'run.done';

          // Helper to finalize the WS connection
          const finalize = (trigger: string, extraText?: string) => {
            if (resolved) return;
            const finalContent = responseContent || extraText || '';
            if (finalContent.length === 0) {
              reqLog.debug('Completion event without content, waiting for more events', { trigger });
              return;
            }
            resolved = true;
            clearTimeout(timer);
            ws.close();
            reqLog.info('Agent response complete', {
              contentLength: finalContent.length,
              runId,
              trigger,
            });
            resolve({ success: true, content: finalContent, runId });
          };

          // chat.final and legacy events are definitive — resolve immediately
          if ((isChatFinal || isLegacyDone) && !resolved) {
            // Extract final text from various chat.final payload formats
            let finalText: string | undefined;
            if (isChatFinal) {
              const msgContent = payload.message?.content;
              if (Array.isArray(msgContent)) {
                const textParts = msgContent
                  .filter((c: Record<string, unknown>) => c.type === 'text' && typeof c.text === 'string')
                  .map((c: Record<string, unknown>) => c.text as string);
                if (textParts.length > 0) finalText = textParts.join('');
              } else if (typeof msgContent === 'string') {
                finalText = msgContent;
              }
              if (!finalText && typeof payload.text === 'string') finalText = payload.text;
              if (!finalText && typeof payload.content === 'string') finalText = payload.content;
            }

            reqLog.info('Definitive completion event', {
              runId,
              trigger: isChatFinal ? 'chat.final' : 'legacy',
              accumulatedLen: responseContent.length,
              finalTextLen: finalText?.length || 0,
            });
            finalize(isChatFinal ? 'chat.final' : 'legacy', finalText);
          }

          // agent.end fires between EACH agentic turn (tool-use cycles).
          // Don't resolve immediately — wait for chat.final or more events.
          if (isAgentEnd && !resolved) {
            reqLog.info('agent.end received (may be intermediate turn)', {
              runId,
              accumulatedLen: responseContent.length,
            });
            // Emit synthetic thinking so frontend knows agent may still be working
            options?.onEvent?.({
              event: 'agent',
              payload: { stream: 'thinking', data: { delta: 'Processing...' } } as Record<string, unknown>,
            });

            if (responseContent.length > 0) {
              // We have accumulated content — use a short grace period (15s).
              // If this was the final turn, chat.final may never arrive, so
              // resolve after 15s of silence instead of waiting the full 5 min.
              // If this was intermediate, the next event's resetTimer() will
              // override this with the full keepalive window.
              clearTimeout(timer);
              timer = setTimeout(() => {
                if (!resolved) {
                  reqLog.info('Grace period expired after agent.end, resolving with accumulated content', {
                    runId,
                    contentLength: responseContent.length,
                  });
                  finalize('agent.end.grace');
                }
              }, 15000);
            } else {
              // No content yet — use full keepalive to wait for more events
              resetTimer();
            }
          }

          // Resolve quickly on explicit runtime errors instead of waiting for timeout.
          if ((isChatError || isAgentError) && !resolved) {
            resolved = true;
            clearTimeout(timer);
            ws.close();

            const runtimeError =
              payload.errorMessage ||
              payload.data?.error ||
              payload.data?.message ||
              'Agent runtime error';

            reqLog.warn('Agent response failed', {
              runId,
              trigger: isChatError ? 'chat.error' : 'agent.error',
              error: runtimeError,
            });
            resolve({ success: false, error: String(runtimeError), runId });
          }
        }
      } catch (err) {
        reqLog.error('Error processing gateway message', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  });
}
