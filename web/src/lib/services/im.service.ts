/**
 * IM Service - Instant Messaging Database Service
 *
 * Provides CRUD operations for IM models using Prisma:
 * - IMUser (agent/human registration)
 * - IMAgentCard (agent capabilities and status)
 * - IMConversation (direct/group/channel)
 * - IMParticipant (conversation membership)
 * - IMMessage (messages with threading support)
 *
 * Aligned with @prismer/sdk v1.7 IM API
 */

import { prisma } from '../prisma';
import type { Prisma } from '@/generated/prisma';

// ============================================================================
// Types - Aligned with @prismer/sdk v1.7
// ============================================================================

export type IMUserRole = 'human' | 'agent' | 'admin';
export type IMAgentType = 'assistant' | 'specialist' | 'orchestrator' | 'tool' | 'bot';
export type IMConversationType = 'direct' | 'group' | 'channel';
export type IMParticipantRole = 'owner' | 'admin' | 'member' | 'observer';
export type IMMessageType =
  | 'text'
  | 'markdown'
  | 'code'
  | 'image'
  | 'file'
  | 'tool_call'
  | 'tool_result'
  | 'system_event'
  | 'thinking';
export type IMMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type IMAgentStatus = 'online' | 'busy' | 'idle' | 'offline';

// SDK-aligned metadata types
export interface IMMessageMetadata {
  prismer?: PrismerMetadata;
  [key: string]: unknown;
}

export interface PrismerMetadata {
  type: 'ui_directive' | 'skill_event' | 'tool_call' | 'tool_result';
  directive?: UIDirective;
  skillEvent?: SkillEvent;
  toolCall?: {
    callId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };
  toolResult?: {
    callId: string;
    result: unknown;
    isError?: boolean;
  };
}

export interface UIDirective {
  type: string;
  payload: Record<string, unknown>;
  timestamp?: number;
}

export interface SkillEvent {
  skillName: string;
  phase: 'start' | 'progress' | 'complete' | 'error';
  progress?: number;
  message?: string;
  artifacts?: Array<{
    type: string;
    path: string;
    componentTarget?: string;
    metadata?: Record<string, unknown>;
  }>;
  error?: string;
}

// Input types
export interface RegisterIMUserInput {
  username: string;
  displayName: string;
  type: 'agent' | 'human';
  agentType?: IMAgentType;
  capabilities?: string[];
  description?: string;
  endpoint?: string;
  userId?: string; // Link to main User table
  metadata?: Record<string, unknown>;
}

export interface CreateConversationInput {
  type: IMConversationType;
  title?: string;
  description?: string;
  createdById: string;
  memberIds?: string[];
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  type?: IMMessageType;
  parentId?: string;
  metadata?: IMMessageMetadata;
}

export interface UpdateMessageStatusInput {
  messageId: string;
  status: IMMessageStatus;
}

export interface ListMessagesOptions {
  conversationId: string;
  limit?: number;
  offset?: number;
  before?: string; // Message ID for cursor pagination
}

export interface ListConversationsOptions {
  userId: string;
  type?: IMConversationType;
  withUnread?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function safeParseJson<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

// ============================================================================
// IMUser Operations
// ============================================================================

export const imUserService = {
  /**
   * Register a new IM user (agent or human)
   * Returns existing user if username already exists
   */
  async register(input: RegisterIMUserInput) {
    // Check if username exists
    const existing = await prisma.iMUser.findUnique({
      where: { username: input.username },
      include: { agentCard: true },
    });

    if (existing) {
      return { user: existing, isNew: false };
    }

    // Verify userId FK exists before setting it (avoid FK constraint violation)
    let resolvedUserId = input.userId || null;
    if (resolvedUserId) {
      const userExists = await prisma.user.findUnique({
        where: { id: resolvedUserId },
        select: { id: true },
      });
      if (!userExists) {
        resolvedUserId = null;
      }
    }

    // Create new user
    const user = await prisma.iMUser.create({
      data: {
        username: input.username,
        displayName: input.displayName,
        role: input.type,
        agentType: input.agentType,
        userId: resolvedUserId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        // Create agent card if this is an agent
        ...(input.type === 'agent' && {
          agentCard: {
            create: {
              name: input.displayName,
              description: input.description || '',
              agentType: input.agentType || 'assistant',
              capabilities: JSON.stringify(input.capabilities || []),
              endpoint: input.endpoint,
              status: 'offline',
            },
          },
        }),
      },
      include: { agentCard: true },
    });

    return { user, isNew: true };
  },

  /**
   * Get user by ID
   */
  async getById(id: string) {
    return prisma.iMUser.findUnique({
      where: { id },
      include: { agentCard: true },
    });
  },

  /**
   * Get user by username
   */
  async getByUsername(username: string) {
    return prisma.iMUser.findUnique({
      where: { username },
      include: { agentCard: true },
    });
  },

  /**
   * Get user by linked User ID
   */
  async getByUserId(userId: string) {
    return prisma.iMUser.findUnique({
      where: { userId },
      include: { agentCard: true },
    });
  },

  /**
   * Update user profile
   */
  async update(
    id: string,
    data: {
      displayName?: string;
      avatarUrl?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return prisma.iMUser.update({
      where: { id },
      data: {
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      },
      include: { agentCard: true },
    });
  },

  /**
   * Update agent status and load
   */
  async updateAgentStatus(
    imUserId: string,
    status: IMAgentStatus,
    load?: number
  ) {
    return prisma.iMAgentCard.update({
      where: { imUserId },
      data: {
        status,
        load: load ?? undefined,
        lastHeartbeat: new Date(),
      },
    });
  },

  /**
   * Discover agents by type or capability
   */
  async discoverAgents(options?: {
    type?: IMAgentType;
    capability?: string;
    status?: IMAgentStatus;
  }) {
    const where: Prisma.IMAgentCardWhereInput = {};

    if (options?.type) {
      where.agentType = options.type;
    }
    if (options?.status) {
      where.status = options.status;
    }

    const agents = await prisma.iMAgentCard.findMany({
      where,
      include: { imUser: true },
      orderBy: { lastHeartbeat: 'desc' },
    });

    // Filter by capability if specified
    if (options?.capability) {
      return agents.filter((agent) => {
        const capabilities = safeParseJson<string[]>(agent.capabilities) || [];
        return capabilities.includes(options.capability!);
      });
    }

    return agents;
  },
};

// ============================================================================
// IMConversation Operations
// ============================================================================

export const imConversationService = {
  /**
   * Create a new conversation
   */
  async create(input: CreateConversationInput) {
    const conversation = await prisma.iMConversation.create({
      data: {
        type: input.type,
        title: input.title,
        description: input.description,
        createdById: input.createdById,
        workspaceId: input.workspaceId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : '{}',
        // Add creator as owner
        participants: {
          create: {
            imUserId: input.createdById,
            role: 'owner',
          },
        },
      },
      include: {
        participants: { include: { imUser: true } },
        createdBy: true,
      },
    });

    // Add additional members
    if (input.memberIds && input.memberIds.length > 0) {
      await prisma.iMParticipant.createMany({
        data: input.memberIds
          .filter((id) => id !== input.createdById)
          .map((imUserId) => ({
            conversationId: conversation.id,
            imUserId,
            role: 'member' as const,
          })),
        skipDuplicates: true as never,
      });
    }

    return this.getById(conversation.id);
  },

  /**
   * Create or get direct conversation between two users
   */
  async getOrCreateDirect(userId1: string, userId2: string) {
    // Find existing direct conversation
    const existing = await prisma.iMConversation.findFirst({
      where: {
        type: 'direct',
        AND: [
          { participants: { some: { imUserId: userId1 } } },
          { participants: { some: { imUserId: userId2 } } },
        ],
      },
      include: {
        participants: { include: { imUser: true } },
        createdBy: true,
      },
    });

    if (existing) {
      return existing;
    }

    // Create new direct conversation
    return this.create({
      type: 'direct',
      createdById: userId1,
      memberIds: [userId2],
    });
  },

  /**
   * Get conversation by ID
   */
  async getById(id: string) {
    return prisma.iMConversation.findUnique({
      where: { id },
      include: {
        participants: { include: { imUser: { include: { agentCard: true } } } },
        createdBy: true,
      },
    });
  },

  /**
   * Get conversation by workspace ID
   */
  async getByWorkspaceId(workspaceId: string) {
    return prisma.iMConversation.findUnique({
      where: { workspaceId },
      include: {
        participants: { include: { imUser: { include: { agentCard: true } } } },
        createdBy: true,
      },
    });
  },

  /**
   * List conversations for a user
   */
  async list(options: ListConversationsOptions) {
    const { userId, type, limit = 50, offset = 0 } = options;

    const where: Prisma.IMConversationWhereInput = {
      participants: { some: { imUserId: userId, leftAt: null } },
      status: 'active',
    };

    if (type) {
      where.type = type;
    }

    return prisma.iMConversation.findMany({
      where,
      include: {
        participants: { include: { imUser: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      skip: offset,
    });
  },

  /**
   * Add participant to conversation
   */
  async addParticipant(
    conversationId: string,
    imUserId: string,
    role: IMParticipantRole = 'member'
  ) {
    return prisma.iMParticipant.upsert({
      where: {
        conversationId_imUserId: { conversationId, imUserId },
      },
      create: {
        conversationId,
        imUserId,
        role,
      },
      update: {
        leftAt: null, // Rejoin if previously left
        role,
      },
      include: { imUser: true },
    });
  },

  /**
   * Remove participant from conversation
   */
  async removeParticipant(conversationId: string, imUserId: string) {
    return prisma.iMParticipant.update({
      where: {
        conversationId_imUserId: { conversationId, imUserId },
      },
      data: { leftAt: new Date() },
    });
  },

  /**
   * Bind conversation to workspace (1:1 relationship)
   */
  async bindToWorkspace(conversationId: string, workspaceId: string) {
    return prisma.iMConversation.update({
      where: { id: conversationId },
      data: { workspaceId },
    });
  },
};

// ============================================================================
// IMMessage Operations
// ============================================================================

export const imMessageService = {
  /**
   * Send a message
   */
  async send(input: SendMessageInput) {
    const message = await prisma.iMMessage.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        content: input.content,
        type: input.type || 'text',
        parentId: input.parentId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : '{}',
        status: 'sent',
      },
      include: {
        sender: { include: { agentCard: true } },
        conversation: true,
      },
    });

    // Update conversation lastMessageAt
    await prisma.iMConversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  },

  /**
   * Get message by ID
   */
  async getById(id: string) {
    return prisma.iMMessage.findUnique({
      where: { id },
      include: {
        sender: { include: { agentCard: true } },
      },
    });
  },

  /**
   * Get messages for a conversation
   */
  async list(options: ListMessagesOptions) {
    const { conversationId, limit = 50, offset = 0, before } = options;

    const where: Prisma.IMMessageWhereInput = { conversationId };

    // Cursor-based pagination
    if (before) {
      const cursorMessage = await prisma.iMMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (cursorMessage) {
        where.createdAt = { lt: cursorMessage.createdAt };
      }
    }

    return prisma.iMMessage.findMany({
      where,
      include: {
        sender: { include: { agentCard: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: before ? 0 : offset,
    });
  },

  /**
   * Update message status
   */
  async updateStatus(input: UpdateMessageStatusInput) {
    return prisma.iMMessage.update({
      where: { id: input.messageId },
      data: { status: input.status },
    });
  },

  /**
   * Update message content (for editing)
   */
  async updateContent(messageId: string, content: string) {
    return prisma.iMMessage.update({
      where: { id: messageId },
      data: { content },
    });
  },

  /**
   * Delete message (soft delete by setting content)
   */
  async delete(messageId: string) {
    return prisma.iMMessage.update({
      where: { id: messageId },
      data: {
        content: '[Message deleted]',
        type: 'system_event',
        metadata: JSON.stringify({ deleted: true, deletedAt: new Date() }),
      },
    });
  },

  /**
   * Get thread messages (replies to a parent message)
   */
  async getThread(parentId: string, limit = 50) {
    return prisma.iMMessage.findMany({
      where: { parentId },
      include: {
        sender: { include: { agentCard: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  },

  /**
   * Count unread messages for a user in a conversation
   */
  async countUnread(conversationId: string, userId: string, since?: Date) {
    const sinceDate =
      since ||
      (await prisma.iMParticipant.findUnique({
        where: {
          conversationId_imUserId: { conversationId, imUserId: userId },
        },
        select: { joinedAt: true },
      }))?.joinedAt;

    return prisma.iMMessage.count({
      where: {
        conversationId,
        senderId: { not: userId },
        status: { not: 'read' },
        createdAt: { gt: sinceDate || undefined },
      },
    });
  },
};

// ============================================================================
// Workspace Integration
// ============================================================================

export const imWorkspaceService = {
  /**
   * Initialize IM for a workspace (1:1 user + agent)
   * Creates IMUser for the user if needed, creates conversation, binds to workspace
   */
  async init(options: {
    workspaceId: string;
    userId: string;
    userDisplayName: string;
    agentId?: string;
  }) {
    const { workspaceId, userId, userDisplayName, agentId } = options;

    // Check if workspace already has a conversation
    let conversation = await imConversationService.getByWorkspaceId(workspaceId);
    if (conversation) {
      // Get or create IMUser for the user
      let imUser = await imUserService.getByUserId(userId);
      if (!imUser) {
        const result = await imUserService.register({
          username: `user-${userId}`,
          displayName: userDisplayName,
          type: 'human',
          userId,
        });
        imUser = result.user;
      }
      return { conversationId: conversation.id, imUser };
    }

    // Create IMUser for the user
    let imUser = await imUserService.getByUserId(userId);
    if (!imUser) {
      const result = await imUserService.register({
        username: `user-${userId}`,
        displayName: userDisplayName,
        type: 'human',
        userId,
      });
      imUser = result.user;
    }

    // Create conversation
    const memberIds = agentId ? [agentId] : [];
    conversation = await imConversationService.create({
      type: 'direct',
      title: `Workspace ${workspaceId}`,
      createdById: imUser.id,
      memberIds,
      workspaceId,
    });

    return { conversationId: conversation!.id, imUser };
  },

  /**
   * Initialize group workspace (multi-user + multi-agent)
   */
  async initGroup(options: {
    workspaceId: string;
    title: string;
    users: Array<{ userId: string; displayName: string }>;
    agentIds?: string[];
  }) {
    const { workspaceId, title, users, agentIds = [] } = options;

    // Check if workspace already has a conversation
    const existing = await imConversationService.getByWorkspaceId(workspaceId);
    if (existing) {
      return { conversationId: existing.id };
    }

    // Create IMUsers for all users
    const imUserIds: string[] = [];
    for (const user of users) {
      let imUser = await imUserService.getByUserId(user.userId);
      if (!imUser) {
        const result = await imUserService.register({
          username: `user-${user.userId}`,
          displayName: user.displayName,
          type: 'human',
          userId: user.userId,
        });
        imUser = result.user;
      }
      imUserIds.push(imUser.id);
    }

    // Create group conversation
    const conversation = await imConversationService.create({
      type: 'group',
      title,
      createdById: imUserIds[0],
      memberIds: [...imUserIds.slice(1), ...agentIds],
      workspaceId,
    });

    return { conversationId: conversation!.id };
  },

  /**
   * Add agent to workspace
   */
  async addAgent(workspaceId: string, agentId: string) {
    const conversation =
      await imConversationService.getByWorkspaceId(workspaceId);
    if (!conversation) {
      throw new Error(`No conversation found for workspace ${workspaceId}`);
    }

    return imConversationService.addParticipant(conversation.id, agentId);
  },

  /**
   * List agents in workspace
   */
  async listAgents(workspaceId: string) {
    const conversation =
      await imConversationService.getByWorkspaceId(workspaceId);
    if (!conversation) {
      return [];
    }

    return conversation.participants
      .filter((p) => p.imUser.role === 'agent' && !p.leftAt)
      .map((p) => p.imUser);
  },
};

// ============================================================================
// Combined Export
// ============================================================================

export const imService = {
  user: imUserService,
  conversation: imConversationService,
  message: imMessageService,
  workspace: imWorkspaceService,
};

export default imService;
