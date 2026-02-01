import { z } from 'zod';

// ============================================================================
// Auth Schemas
// ============================================================================
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// Room Schemas
// ============================================================================
export const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(64, 'Room name must be at most 64 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Room name can only contain letters, numbers, hyphens, and underscores'),
  emptyTimeout: z.number().min(0).max(86400).optional(),
  maxParticipants: z.number().min(0).max(1000).optional(),
  metadata: z.string().max(4096).optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

// ============================================================================
// Participant Schemas
// ============================================================================
export const updatePermissionsSchema = z.object({
  canSubscribe: z.boolean(),
  canPublish: z.boolean(),
  canPublishData: z.boolean(),
  canPublishSources: z.array(z.string()).optional(),
  canUpdateMetadata: z.boolean().optional(),
  hidden: z.boolean().optional(),
  recorder: z.boolean().optional(),
  agent: z.boolean().optional(),
});

export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;

// ============================================================================
// SIP Trunk Schemas
// ============================================================================
export const sipTrunkSchema = z.object({
  name: z.string().min(1, 'Trunk name is required').max(64),
  inbound_addresses: z.array(z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IP address')).optional(),
  outbound_address: z.string().optional(),
  outbound_number: z.string().optional(),
  inbound_numbers: z.array(z.string()).optional(),
  inbound_username: z.string().optional(),
  inbound_password: z.string().optional(),
  outbound_username: z.string().optional(),
  outbound_password: z.string().optional(),
  metadata: z.string().max(4096).optional(),
});

export type SipTrunkInput = z.infer<typeof sipTrunkSchema>;

// ============================================================================
// Dispatch Rule Schemas
// ============================================================================
export const dispatchRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(64),
  trunk_ids: z.array(z.string()).min(1, 'At least one trunk is required'),
  hide_phone_number: z.boolean().optional(),
  inbound_numbers: z.array(z.string()).optional(),
  rule: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('direct'),
      room_name: z.string().min(1),
      pin: z.string().optional(),
    }),
    z.object({
      type: z.literal('individual'),
      room_prefix: z.string().min(1),
      pin: z.string().optional(),
    }),
    z.object({
      type: z.literal('callee'),
      room_prefix: z.string().optional(),
      pin: z.string().optional(),
      randomize: z.boolean().optional(),
    }),
  ]),
  metadata: z.string().max(4096).optional(),
});

export type DispatchRuleInput = z.infer<typeof dispatchRuleSchema>;

// ============================================================================
// Agent Schemas
// ============================================================================
export const agentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(64),
  type: z.enum(['voice', 'multimodal', 'transcription', 'custom']),
  description: z.string().max(500).optional(),
  config: z.object({
    sttProvider: z.string().optional(),
    ttsProvider: z.string().optional(),
    llmProvider: z.string().optional(),
    llmModel: z.string().optional(),
    systemPrompt: z.string().max(8000).optional(),
    voice: z.string().optional(),
    language: z.string().optional(),
    interruptionThreshold: z.number().min(0).max(1).optional(),
    vadSensitivity: z.number().min(0).max(1).optional(),
  }).optional(),
  metadata: z.string().max(4096).optional(),
});

export type AgentInput = z.infer<typeof agentSchema>;

// ============================================================================
// API Key Schemas
// ============================================================================
export const apiKeySchema = z.object({
  name: z.string().min(1, 'Key name is required').max(64),
  permissions: z.array(z.enum(['rooms', 'egress', 'ingress', 'sip', 'agents', 'webhooks'])),
  expiresAt: z.string().datetime().optional(),
});

export type ApiKeyInput = z.infer<typeof apiKeySchema>;

// ============================================================================
// Webhook Schemas
// ============================================================================
export const webhookSchema = z.object({
  url: z.string().url('Invalid URL'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  apiKey: z.string().optional(),
});

export type WebhookInput = z.infer<typeof webhookSchema>;

// ============================================================================
// Storage Config Schemas
// ============================================================================
export const storageConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('s3'),
    name: z.string().min(1),
    bucket: z.string().min(1),
    region: z.string().min(1),
    accessKey: z.string().min(1),
    secretKey: z.string().min(1),
    endpoint: z.string().url().optional(),
    forcePathStyle: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('gcs'),
    name: z.string().min(1),
    bucket: z.string().min(1),
    credentials: z.string().min(1),
  }),
  z.object({
    type: z.literal('azure'),
    name: z.string().min(1),
    container: z.string().min(1),
    accountName: z.string().min(1),
    accountKey: z.string().min(1),
  }),
]);

export type StorageConfigInput = z.infer<typeof storageConfigSchema>;

// ============================================================================
// Firewall Schemas
// ============================================================================
export const firewallRuleSchema = z.object({
  cidr: z.string().regex(
    /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/,
    'Invalid CIDR notation'
  ),
  description: z.string().max(256).optional(),
  action: z.enum(['allow', 'deny']),
  priority: z.number().min(0).max(65535),
});

export type FirewallRuleInput = z.infer<typeof firewallRuleSchema>;

// ============================================================================
// Quota Schemas
// ============================================================================
export const roomLimitsSchema = z.object({
  maxParticipants: z.number().min(0).max(3000),
  maxPublishers: z.number().min(0).max(100),
  maxTracksPerParticipant: z.number().min(0).max(20),
  maxBitratePerTrack: z.number().min(0).max(10000000), // bps
  maxRoomDuration: z.number().min(0).max(86400), // seconds
});

export type RoomLimitsInput = z.infer<typeof roomLimitsSchema>;

export const rateLimitsSchema = z.object({
  requestsPerMinute: z.number().min(0).max(10000),
  burstSize: z.number().min(0).max(1000),
  connectionsPerIP: z.number().min(0).max(100),
});

export type RateLimitsInput = z.infer<typeof rateLimitsSchema>;

// ============================================================================
// Team Member Schemas
// ============================================================================
export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'operator', 'viewer']),
  message: z.string().max(500).optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// ============================================================================
// Room Template Schemas
// ============================================================================
export const roomTemplateSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  emptyTimeout: z.number().min(0).max(86400),
  maxParticipants: z.number().min(0).max(3000),
  metadata: z.record(z.string(), z.unknown()).optional(),
  egressPreset: z.string().optional(),
});

export type RoomTemplateInput = z.infer<typeof roomTemplateSchema>;

// ============================================================================
// Egress Schemas
// ============================================================================
export const roomCompositeEgressSchema = z.object({
  roomName: z.string().min(1),
  layout: z.enum(['grid', 'speaker', 'single-speaker']).optional(),
  audioOnly: z.boolean().optional(),
  videoOnly: z.boolean().optional(),
  customBaseUrl: z.string().url().optional(),
  fileOutputs: z.array(z.object({
    fileType: z.enum(['mp4', 'ogg', 'webm']),
    filepath: z.string().optional(),
    disableManifest: z.boolean().optional(),
    s3: z.object({
      bucket: z.string(),
      region: z.string().optional(),
    }).optional(),
  })).optional(),
  streamOutputs: z.array(z.object({
    protocol: z.enum(['rtmp']),
    urls: z.array(z.string().url()),
  })).optional(),
});

export type RoomCompositeEgressInput = z.infer<typeof roomCompositeEgressSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function formatZodErrors(errors: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  for (const error of errors.issues) {
    const path = error.path.join('.');
    formatted[path] = error.message;
  }
  return formatted;
}
