export type CharacterWeapon = {
  id: string;
  name: string;
  skillKey: string;
  skillName: string;
  damage: string;
  range: string;
  attacks: string;
  ammo: number;
  maxAmmo: number;
  malfunction: number;
};
export type SanityEpisode = {
  id: string;
  kind: 'bout' | 'phobia' | 'mania' | 'indefinite';
  name: string;
  notes: string;
};
export type CharacterBackstory = {
  appearance: string;
  ideology: string;
  significantPeople: string;
  meaningfulLocations: string;
  treasuredPossessions: string;
  traits: string;
};
export type CustomSkill = {
  id: string;
  name: string;
  base: number;
  value: number;
};
export type CharacterModifier = {
  id: string;
  name: string;
  target: string;
  amount: number;
  expires: string;
};
export type CharacterSpell = {
  id: string;
  name: string;
  cost: string;
  castingTime: string;
  description: string;
  sanityCost: string;
};
export type CharacterTome = {
  id: string;
  title: string;
  language: string;
  studyTime: string;
  mythosGain: string;
  sanityLoss: string;
  spells: string;
  notes: string;
};
export type Character = {
  name: string;
  occupation: string;
  age: number;
  residence: string;
  str: number;
  con: number;
  siz: number;
  dex: number;
  app: number;
  int: number;
  pow: number;
  edu: number;
  luck: number;
  hp: number;
  sanity: number;
  mp: number;
  credit: number;
  anchor: string;
  connection: string;
  secret: string;
  skills?: Record<string, number>;
  customSkills?: CustomSkill[];
  weapons?: CharacterWeapon[];
  mov?: number;
  build?: number;
  damageBonus?: string;
  maxHp?: number;
  conditions?: string[];
  sanityEpisodes?: SanityEpisode[];
  improvementMarks?: string[];
  occupationFormula?:
    | 'edu4'
    | 'edu2app2'
    | 'edu2dex2'
    | 'edu2str2'
    | 'edu2pow2';
  occupationSkillKeys?: string[];
  cash?: string;
  assets?: string;
  spendingLevel?: string;
  possessions?: string;
  backstory?: CharacterBackstory;
  modifiers?: CharacterModifier[];
  spells?: CharacterSpell[];
  tomes?: CharacterTome[];
  chase?: {
    speed: number;
    actionPoints: number;
    location: string;
    vehicle: string;
    vehicleBuild: number;
    notes: string;
  };
};
export type Player = {
  id: string;
  name: string;
  character: Character | null;
  tokenUrl: string | null;
  x: number;
  y: number;
  onBoard: boolean;
};
export type PieceDetails = {
  occupation?: string;
  description?: string;
  motivation?: string;
  hook?: string;
  secret?: string;
  str?: number;
  con?: number;
  siz?: number;
  dex?: number;
  app?: number;
  int?: number;
  pow?: number;
  fighting?: number;
  damage?: string;
  armor?: string;
  sanityLoss?: string;
  attacks?: string;
  notes?: string;
};
export type Piece = {
  id: string;
  name: string;
  kind: string;
  initials: string;
  x: number;
  y: number;
  hp: number | null;
  maxHp: number | null;
  hidden: boolean;
  details: PieceDetails;
};
export type GameEvent = {
  id: string;
  actor: string;
  kind: string;
  message: string;
  createdAt: number;
  payload?: unknown;
};
export type Scene = {
  id: string;
  chapter: string;
  title: string;
  description: string;
  objective: string;
  clues: string;
  keeperNotes: string;
  status: string;
  sortOrder: number;
};
export type Loot = {
  id: string;
  name: string;
  description: string;
  category: string;
  value: string;
  assignedPlayerId: string | null;
  createdAt: number;
};
export type CampaignMap = {
  id: string;
  name: string;
  url: string;
  isCurrent: boolean;
  createdAt: number;
};
export type BoardPoint = { x: number; y: number };
export type BoardMark = {
  id: string;
  kind: 'freehand' | 'line' | 'ruler' | 'rect' | 'circle' | 'sticker' | 'fog';
  data: {
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    color?: string;
    label?: string;
    points?: BoardPoint[];
  };
  hidden: boolean;
};
export type Encounter = {
  title: string;
  hook: string;
  opposition: string;
  clue: string;
  complication: string;
  stakes: string;
  difficulty: string;
  sanityLoss: string;
};
export type CombatEntry = {
  id: string;
  type: 'player' | 'piece';
  name: string;
  initiative: number;
  hp: number | null;
  maxHp: number | null;
  hidden: boolean;
};
export type Handout = {
  id: string;
  title: string;
  body: string;
  revealed: boolean;
  createdAt: number;
};
export type PrivateMessage = {
  id: string;
  sender: string;
  message: string;
  createdAt: number;
};
export type KeeperRuntime = {
  combat: {
    active: boolean;
    round: number;
    turnIndex: number;
    order: CombatEntry[];
  };
  handouts: Handout[];
};
export type ContentImportSummary = {
  id: string;
  title: string;
  source: string;
  status: string;
  createdAt: number;
  contents: {
    scenes: number;
    cast: number;
    handouts: number;
    encounters: number;
  };
};
export type IntegrationTokenSummary = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
  revoked: boolean;
};
export type IntegrationAssetSummary = {
  id: string;
  name: string;
  kind: string;
  status: string;
  contentType: string;
  byteSize: number;
  createdAt: number;
  url: string;
};
export type Campaign = {
  id: string;
  name: string;
  joinCode: string;
  year: string;
  location: string;
  status: string;
  sessionNumber: number;
  sceneTitle: string;
  sceneDescription: string;
  playerNotes: string;
  players: Player[];
  pieces: Piece[];
  events: GameEvent[];
  scenes: Scene[];
  loot: Loot[];
  maps: CampaignMap[];
  marks: BoardMark[];
  runtime: KeeperRuntime;
  privateMessages: PrivateMessage[];
  imports: ContentImportSummary[];
  integrationTokens: IntegrationTokenSummary[];
  integrationAssets: IntegrationAssetSummary[];
};
export type Session = {
  role: 'keeper' | 'player' | null;
  token: string;
  accountId?: string;
  email?: string;
  campaignId: string | null;
  playerId?: string;
  displayName: string;
};
export type Membership = {
  campaignId: string;
  name: string;
  year: string;
  location: string;
  status: string;
  sessionNumber: number;
  role: 'keeper' | 'player';
  playerId: string | null;
  characterName: string | null;
};
