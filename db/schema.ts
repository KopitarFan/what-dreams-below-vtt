import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  emailVerifiedAt: integer('email_verified_at'),
  createdAt: integer('created_at').notNull(),
});

export const accountSessions = sqliteTable(
  'account_sessions',
  {
    token: text('token').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_account_sessions_account_id').on(table.accountId)],
);

export const authChallenges = sqliteTable(
  'auth_challenges',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    kind: text('kind').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: integer('consumed_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_auth_challenges_account_kind').on(table.accountId, table.kind),
  ],
);

export const authRateLimits = sqliteTable('auth_rate_limits', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull(),
});

export const campaigns = sqliteTable(
  'campaigns',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    joinCode: text('join_code').notNull().unique(),
    keeperToken: text('keeper_token').notNull().unique(),
    keeperAccountId: text('keeper_account_id').references(() => accounts.id),
    year: text('year').notNull().default('1926'),
    location: text('location').notNull().default('Los Angeles County'),
    status: text('status').notNull().default('lobby'),
    sessionNumber: integer('session_number').notNull().default(0),
    sceneTitle: text('scene_title').notNull().default('An empty table'),
    sceneDescription: text('scene_description')
      .notNull()
      .default('The Keeper has not set the first scene.'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_campaigns_keeper_account_id').on(table.keeperAccountId),
  ],
);

export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    name: text('name').notNull(),
    playerToken: text('player_token').notNull().unique(),
    accountId: text('account_id').references(() => accounts.id),
    characterJson: text('character_json'),
    characterStatus: text('character_status').notNull().default('final'),
    notesMarkdown: text('notes_markdown').notNull().default(''),
    tokenKey: text('token_key'),
    x: integer('x').notNull().default(45),
    y: integer('y').notNull().default(55),
    onBoard: integer('on_board', { mode: 'boolean' }).notNull().default(false),
    joinedAt: integer('joined_at').notNull(),
  },
  (table) => [
    index('idx_players_account_campaign').on(table.accountId, table.campaignId),
  ],
);

export const gameEvents = sqliteTable('game_events', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id),
  actor: text('actor').notNull(),
  kind: text('kind').notNull(),
  message: text('message').notNull(),
  payloadJson: text('payload_json'),
  createdAt: integer('created_at').notNull(),
});

export const campaignRuntime = sqliteTable('campaign_runtime', {
  campaignId: text('campaign_id')
    .primaryKey()
    .references(() => campaigns.id),
  stateJson: text('state_json').notNull().default('{}'),
  updatedAt: integer('updated_at').notNull(),
});

export const privateMessages = sqliteTable(
  'private_messages',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    sender: text('sender').notNull(),
    message: text('message').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_private_messages_player').on(table.campaignId, table.playerId),
  ],
);

export const integrationTokens = sqliteTable(
  'integration_tokens',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    scopes: text('scopes').notNull(),
    revokedAt: integer('revoked_at'),
    lastUsedAt: integer('last_used_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_integration_tokens_campaign').on(table.campaignId)],
);
export const contentImports = sqliteTable(
  'content_imports',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    status: text('status').notNull().default('pending'),
    source: text('source').notNull(),
    title: text('title').notNull(),
    packageJson: text('package_json').notNull(),
    validationJson: text('validation_json').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
    approvedAt: integer('approved_at'),
  },
  (table) => [index('idx_content_imports_campaign').on(table.campaignId)],
);

export const integrationAssets = sqliteTable(
  'integration_assets',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('pending'),
    objectKey: text('object_key').notNull().unique(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    sourceUrl: text('source_url'),
    createdAt: integer('created_at').notNull(),
    approvedAt: integer('approved_at'),
  },
  (table) => [index('idx_integration_assets_campaign').on(table.campaignId)],
);

export const boardPieces = sqliteTable('board_pieces', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id')
    .notNull()
    .references(() => campaigns.id),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  initials: text('initials').notNull(),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
  hp: integer('hp'),
  maxHp: integer('max_hp'),
  hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  detailsJson: text('details_json').notNull().default('{}'),
});

export const scenes = sqliteTable(
  'scenes',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    chapter: text('chapter').notNull().default('Chapter 1'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    objective: text('objective').notNull().default(''),
    clues: text('clues').notNull().default(''),
    keeperNotes: text('keeper_notes').notNull().default(''),
    status: text('status').notNull().default('planned'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_scenes_campaign_order').on(table.campaignId, table.sortOrder),
  ],
);

export const loot = sqliteTable(
  'loot',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('mundane'),
    value: text('value').notNull().default(''),
    assignedPlayerId: text('assigned_player_id').references(() => players.id),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_loot_campaign').on(table.campaignId),
    index('idx_loot_player').on(table.assignedPlayerId),
  ],
);

export const campaignMaps = sqliteTable(
  'campaign_maps',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    name: text('name').notNull(),
    objectKey: text('object_key').notNull(),
    contentType: text('content_type').notNull(),
    isCurrent: integer('is_current', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_campaign_maps_campaign').on(table.campaignId)],
);

export const boardMarks = sqliteTable(
  'board_marks',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id),
    kind: text('kind').notNull(),
    dataJson: text('data_json').notNull(),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_board_marks_campaign').on(table.campaignId)],
);
