import { suggestSynonymGroups, suggestSynonymsFlat } from './languageTools';

const SYNONYMS: Record<string, string[]> = {
  angry: ['furious', 'irritated', 'incensed', 'heated', 'livid'],
  ask: ['question', 'press', 'probe', 'request', 'wonder'],
  beautiful: ['striking', 'elegant', 'gorgeous', 'radiant', 'graceful'],
  begin: ['start', 'open', 'launch', 'commence', 'initiate'],
  big: ['large', 'massive', 'broad', 'towering', 'substantial'],
  bright: ['vivid', 'luminous', 'brilliant', 'gleaming', 'radiant'],
  break: ['snap', 'fracture', 'shatter', 'interrupt', 'rupture'],
  carry: ['hold', 'haul', 'bear', 'bring', 'shoulder'],
  calm: ['still', 'quiet', 'composed', 'serene', 'steady'],
  cold: ['chilled', 'icy', 'frosted', 'numb', 'wintry'],
  come: ['arrive', 'enter', 'approach', 'appear', 'return'],
  close: ['near', 'tight', 'intimate', 'narrow', 'nearby'],
  cry: ['sob', 'weep', 'wail', 'break', 'mourn'],
  dark: ['dim', 'shadowed', 'black', 'gloomy', 'unlit'],
  die: ['collapse', 'fade', 'perish', 'expire', 'fall'],
  door: ['entry', 'threshold', 'exit', 'gate', 'hatch'],
  easy: ['simple', 'clean', 'effortless', 'direct', 'smooth'],
  enter: ['come in', 'step in', 'arrive', 'cross in', 'move in'],
  fall: ['drop', 'collapse', 'tumble', 'sink', 'plunge'],
  fast: ['quick', 'swift', 'rapid', 'sudden', 'brisk'],
  feel: ['sense', 'seem', 'register', 'read', 'land'],
  fight: ['struggle', 'clash', 'battle', 'spar', 'resist'],
  find: ['discover', 'locate', 'spot', 'uncover', 'detect'],
  good: ['strong', 'solid', 'sharp', 'effective', 'excellent'],
  grab: ['snatch', 'seize', 'clutch', 'catch', 'take'],
  hard: ['difficult', 'rigid', 'severe', 'harsh', 'unyielding'],
  hear: ['catch', 'detect', 'overhear', 'notice', 'make out'],
  hide: ['conceal', 'mask', 'bury', 'cover', 'shield'],
  hold: ['grip', 'clutch', 'carry', 'contain', 'keep'],
  jump: ['leap', 'spring', 'lurch', 'bound', 'jolt'],
  know: ['understand', 'recognize', 'realize', 'sense', 'grasp'],
  leave: ['exit', 'depart', 'go', 'abandon', 'split'],
  look: ['glance', 'stare', 'watch', 'study', 'peer'],
  loud: ['booming', 'piercing', 'deafening', 'thunderous', 'raucous'],
  make: ['create', 'build', 'shape', 'force', 'craft'],
  move: ['shift', 'cross', 'glide', 'step', 'drift'],
  open: ['begin', 'unlock', 'reveal', 'spread', 'start'],
  pull: ['drag', 'draw', 'tug', 'yank', 'haul'],
  push: ['shove', 'press', 'drive', 'force', 'nudge'],
  quiet: ['silent', 'hushed', 'muted', 'still', 'soft'],
  reveal: ['show', 'expose', 'uncover', 'disclose', 'unveil'],
  run: ['sprint', 'rush', 'bolt', 'dash', 'race'],
  sad: ['somber', 'heavy', 'mournful', 'bleak', 'wistful'],
  say: ['reply', 'murmur', 'announce', 'insist', 'whisper'],
  scream: ['shout', 'shriek', 'yell', 'howl', 'cry out'],
  see: ['notice', 'spot', 'glimpse', 'clock', 'observe'],
  shake: ['tremble', 'shudder', 'quiver', 'rattle', 'wobble'],
  show: ['reveal', 'display', 'expose', 'present', 'signal'],
  slow: ['gradual', 'unhurried', 'measured', 'languid', 'deliberate'],
  small: ['tiny', 'minor', 'compact', 'slight', 'modest'],
  smile: ['grin', 'beam', 'smirk', 'soften', 'glow'],
  stand: ['rise', 'wait', 'remain', 'loom', 'hold'],
  stop: ['halt', 'freeze', 'pause', 'cease', 'end'],
  strange: ['odd', 'unusual', 'uncanny', 'peculiar', 'offbeat'],
  take: ['grab', 'seize', 'collect', 'accept', 'steal'],
  talk: ['speak', 'chat', 'argue', 'discuss', 'confer'],
  turn: ['pivot', 'rotate', 'shift', 'wheel', 'face'],
  walk: ['stride', 'stroll', 'pace', 'cross', 'wander'],
  want: ['need', 'crave', 'desire', 'seek', 'long for'],
  watch: ['observe', 'study', 'monitor', 'track', 'eye'],
  whisper: ['murmur', 'breathe', 'hush', 'mutter', 'susurrate'],
  write: ['draft', 'compose', 'script', 'shape', 'author']
};

const SYNONYM_GROUPS = [
  ['abandon', 'desert', 'leave', 'forsake', 'ditch', 'drop'],
  ['able', 'capable', 'ready', 'fit', 'competent', 'prepared'],
  ['afraid', 'scared', 'fearful', 'terrified', 'uneasy', 'nervous'],
  ['again', 'anew', 'fresh', 'once more', 'over again'],
  ['air', 'atmosphere', 'breeze', 'draft', 'wind'],
  ['alive', 'living', 'awake', 'animated', 'vital'],
  ['alone', 'solitary', 'isolated', 'single', 'separate'],
  ['amazing', 'astonishing', 'remarkable', 'stunning', 'extraordinary'],
  ['answer', 'reply', 'respond', 'return', 'explain'],
  ['appear', 'emerge', 'show', 'surface', 'materialize'],
  ['argue', 'debate', 'fight', 'dispute', 'bicker'],
  ['arrive', 'reach', 'enter', 'come', 'appear'],
  ['attack', 'strike', 'assault', 'charge', 'lunge'],
  ['avoid', 'evade', 'dodge', 'sidestep', 'escape'],
  ['bad', 'poor', 'rough', 'weak', 'awful', 'grim'],
  ['barely', 'hardly', 'scarcely', 'just', 'almost not'],
  ['beat', 'hit', 'strike', 'pound', 'thump'],
  ['behind', 'back', 'after', 'rear', 'following'],
  ['believe', 'trust', 'accept', 'think', 'suspect'],
  ['bend', 'curve', 'bow', 'fold', 'flex'],
  ['better', 'stronger', 'cleaner', 'sharper', 'improved'],
  ['blood', 'gore', 'bleeding', 'wound', 'injury'],
  ['body', 'figure', 'form', 'frame', 'corpse'],
  ['burn', 'scorch', 'char', 'ignite', 'flare'],
  ['busy', 'active', 'crowded', 'occupied', 'swamped'],
  ['call', 'phone', 'shout', 'name', 'summon'],
  ['careful', 'cautious', 'precise', 'watchful', 'deliberate'],
  ['change', 'shift', 'alter', 'transform', 'turn'],
  ['chase', 'pursue', 'follow', 'hunt', 'trail'],
  ['clean', 'clear', 'neat', 'polished', 'simple'],
  ['climb', 'scale', 'rise', 'crawl up', 'ascend'],
  ['confused', 'lost', 'uncertain', 'bewildered', 'disoriented'],
  ['control', 'command', 'manage', 'direct', 'steer'],
  ['corner', 'edge', 'angle', 'bend', 'nook'],
  ['cover', 'hide', 'shield', 'blanket', 'protect'],
  ['danger', 'threat', 'risk', 'hazard', 'peril'],
  ['dead', 'lifeless', 'still', 'gone', 'cold'],
  ['decide', 'choose', 'settle', 'determine', 'resolve'],
  ['deep', 'low', 'profound', 'buried', 'intense'],
  ['destroy', 'wreck', 'ruin', 'demolish', 'shatter'],
  ['different', 'strange', 'changed', 'distinct', 'unlike'],
  ['drag', 'pull', 'haul', 'draw', 'tow'],
  ['dream', 'vision', 'fantasy', 'memory', 'wish'],
  ['drink', 'sip', 'swallow', 'gulp', 'chug'],
  ['drop', 'fall', 'release', 'let go', 'sink'],
  ['empty', 'vacant', 'hollow', 'bare', 'abandoned'],
  ['escape', 'flee', 'run', 'break free', 'get out'],
  ['face', 'look at', 'confront', 'turn toward', 'meet'],
  ['fear', 'dread', 'terror', 'panic', 'alarm'],
  ['final', 'last', 'closing', 'ultimate', 'terminal'],
  ['follow', 'trail', 'track', 'pursue', 'shadow'],
  ['force', 'push', 'drive', 'compel', 'pressure'],
  ['forget', 'miss', 'lose', 'blank', 'neglect'],
  ['friend', 'ally', 'companion', 'partner', 'confidant'],
  ['funny', 'comic', 'amusing', 'wry', 'playful'],
  ['gentle', 'soft', 'tender', 'mild', 'careful'],
  ['ghost', 'spirit', 'apparition', 'phantom', 'memory'],
  ['give', 'hand', 'offer', 'pass', 'grant'],
  ['glass', 'window', 'pane', 'mirror', 'crystal'],
  ['go', 'leave', 'move', 'head', 'depart'],
  ['great', 'excellent', 'strong', 'impressive', 'major'],
  ['ground', 'floor', 'earth', 'street', 'surface'],
  ['guess', 'suspect', 'imagine', 'estimate', 'think'],
  ['gun', 'weapon', 'pistol', 'firearm', 'sidearm'],
  ['happy', 'glad', 'pleased', 'bright', 'delighted'],
  ['hate', 'despise', 'resent', 'loathe', 'detest'],
  ['heavy', 'weighty', 'dense', 'burdensome', 'loaded'],
  ['help', 'aid', 'assist', 'support', 'rescue'],
  ['home', 'house', 'place', 'shelter', 'base'],
  ['hope', 'wish', 'expect', 'trust', 'long'],
  ['hurry', 'rush', 'race', 'dash', 'speed'],
  ['hurt', 'wound', 'injure', 'ache', 'damage'],
  ['idea', 'thought', 'notion', 'plan', 'concept'],
  ['inside', 'within', 'indoors', 'interior', 'inward'],
  ['keep', 'hold', 'retain', 'save', 'guard'],
  ['kill', 'murder', 'slay', 'destroy', 'execute'],
  ['kiss', 'embrace', 'touch', 'press lips', 'peck'],
  ['late', 'delayed', 'after', 'behind', 'tardy'],
  ['laugh', 'chuckle', 'cackle', 'giggle', 'crack up'],
  ['lead', 'guide', 'direct', 'steer', 'command'],
  ['light', 'glow', 'shine', 'lamp', 'beam'],
  ['listen', 'hear', 'attend', 'eavesdrop', 'tune in'],
  ['little', 'small', 'minor', 'brief', 'slight'],
  ['live', 'exist', 'survive', 'reside', 'remain'],
  ['lock', 'seal', 'shut', 'fasten', 'secure'],
  ['lonely', 'alone', 'isolated', 'empty', 'abandoned'],
  ['long', 'lengthy', 'extended', 'drawn-out', 'far'],
  ['lose', 'misplace', 'drop', 'fail', 'surrender'],
  ['love', 'adore', 'cherish', 'want', 'need'],
  ['meet', 'encounter', 'join', 'face', 'greet'],
  ['memory', 'recollection', 'flashback', 'image', 'remembrance'],
  ['moment', 'beat', 'instant', 'second', 'pause'],
  ['money', 'cash', 'funds', 'payment', 'fortune'],
  ['near', 'close', 'nearby', 'approaching', 'adjacent'],
  ['need', 'require', 'want', 'lack', 'depend on'],
  ['new', 'fresh', 'recent', 'different', 'unfamiliar'],
  ['noise', 'sound', 'racket', 'clatter', 'din'],
  ['old', 'aged', 'worn', 'ancient', 'former'],
  ['outside', 'outdoors', 'external', 'beyond', 'open air'],
  ['pain', 'ache', 'hurt', 'agony', 'sting'],
  ['place', 'spot', 'location', 'site', 'room'],
  ['plan', 'scheme', 'strategy', 'design', 'approach'],
  ['point', 'aim', 'direct', 'gesture', 'indicate'],
  ['power', 'control', 'force', 'strength', 'authority'],
  ['pretty', 'attractive', 'lovely', 'graceful', 'striking'],
  ['problem', 'trouble', 'issue', 'conflict', 'obstacle'],
  ['protect', 'guard', 'shield', 'defend', 'cover'],
  ['question', 'ask', 'challenge', 'doubt', 'query'],
  ['quick', 'fast', 'swift', 'sudden', 'brisk'],
  ['real', 'true', 'actual', 'genuine', 'solid'],
  ['remember', 'recall', 'recognize', 'keep in mind', 'recollect'],
  ['right', 'correct', 'proper', 'true', 'direct'],
  ['room', 'space', 'chamber', 'area', 'interior'],
  ['rough', 'jagged', 'coarse', 'hard', 'brutal'],
  ['safe', 'secure', 'protected', 'clear', 'harmless'],
  ['save', 'rescue', 'keep', 'protect', 'preserve'],
  ['search', 'look for', 'seek', 'hunt', 'scan'],
  ['secret', 'hidden', 'private', 'classified', 'concealed'],
  ['serious', 'grave', 'stern', 'heavy', 'intense'],
  ['shoot', 'fire', 'film', 'capture', 'record'],
  ['short', 'brief', 'quick', 'small', 'compact'],
  ['silent', 'quiet', 'still', 'wordless', 'hushed'],
  ['simple', 'easy', 'plain', 'clean', 'direct'],
  ['sit', 'settle', 'perch', 'drop down', 'take a seat'],
  ['sleep', 'rest', 'doze', 'nap', 'slumber'],
  ['speak', 'talk', 'say', 'tell', 'voice'],
  ['stare', 'gaze', 'look', 'glare', 'peer'],
  ['start', 'begin', 'launch', 'open', 'commence'],
  ['steal', 'take', 'snatch', 'lift', 'rob'],
  ['story', 'tale', 'narrative', 'plot', 'account'],
  ['strong', 'powerful', 'solid', 'tough', 'forceful'],
  ['surprise', 'shock', 'stun', 'startle', 'astonish'],
  ['throw', 'toss', 'hurl', 'fling', 'pitch'],
  ['tight', 'close', 'tense', 'narrow', 'compressed'],
  ['tired', 'exhausted', 'weary', 'spent', 'drained'],
  ['touch', 'feel', 'tap', 'brush', 'contact'],
  ['trap', 'snare', 'catch', 'corner', 'confine'],
  ['true', 'real', 'honest', 'accurate', 'genuine'],
  ['try', 'attempt', 'test', 'strive', 'push'],
  ['understand', 'know', 'grasp', 'realize', 'read'],
  ['vanish', 'disappear', 'fade', 'evaporate', 'slip away'],
  ['wait', 'pause', 'linger', 'hold', 'stay'],
  ['wall', 'barrier', 'partition', 'surface', 'blockade'],
  ['warm', 'heated', 'soft', 'kind', 'glowing'],
  ['water', 'rain', 'liquid', 'sea', 'river'],
  ['weak', 'frail', 'thin', 'soft', 'fragile'],
  ['wild', 'uncontrolled', 'feral', 'frantic', 'chaotic'],
  ['window', 'glass', 'pane', 'opening', 'view'],
  ['work', 'labor', 'function', 'operate', 'write'],
  ['wrong', 'mistaken', 'false', 'bad', 'off'],
  ['young', 'new', 'fresh', 'early', 'youthful']
];

const EXPANDED_SYNONYMS = buildExpandedSynonyms(SYNONYMS, SYNONYM_GROUPS);

export function suggestSynonyms(word: string): string[] {
  const normalized = normalizeLookupWord(word);
  if (!normalized) return [];
  const robustOptions = suggestSynonymsFlat(word, 18);
  const options = robustOptions.length ? robustOptions : lookupSynonyms(normalized);
  return preserveCase(word, options).filter((option) => option.toLowerCase() !== normalized).slice(0, 18);
}

export { suggestSynonymGroups };

function lookupSynonyms(word: string): string[] {
  const candidates = lookupForms(word);
  for (const candidate of candidates) {
    const options = EXPANDED_SYNONYMS[candidate];
    if (options?.length) return options;
  }
  return fallbackSynonyms(word);
}

function lookupForms(word: string): string[] {
  const forms = [word];
  if (word.endsWith('ing') && word.length > 5) {
    const stem = word.slice(0, -3);
    forms.push(stem, stem + 'e');
    if (stem.length > 2 && stem.at(-1) === stem.at(-2)) forms.push(stem.slice(0, -1));
  }
  if (word.endsWith('ed') && word.length > 4) forms.push(word.slice(0, -2), word.slice(0, -1));
  if (word.endsWith('es') && word.length > 4) forms.push(word.slice(0, -2));
  if (word.endsWith('s') && word.length > 3) forms.push(word.slice(0, -1));
  return Array.from(new Set(forms));
}

function fallbackSynonyms(word: string): string[] {
  const families = Object.entries(EXPANDED_SYNONYMS)
    .filter(([key]) => key.includes(word) || word.includes(key))
    .flatMap(([, options]) => options);
  return Array.from(new Set(families));
}

function preserveCase(source: string, options: string[]): string[] {
  if (source === source.toUpperCase()) return options.map((option) => option.toUpperCase());
  if (/^[A-Z]/.test(source)) return options.map((option) => option.charAt(0).toUpperCase() + option.slice(1));
  return options;
}

function buildExpandedSynonyms(base: Record<string, string[]>, groups: string[][]): Record<string, string[]> {
  const expanded: Record<string, Set<string>> = {};

  function add(key: string, values: string[]) {
    const normalized = normalizeLookupWord(key);
    if (!normalized) return;
    expanded[normalized] ??= new Set<string>();
    values.map(normalizeOption).filter(Boolean).forEach((value) => {
      if (value !== normalized) expanded[normalized].add(value);
    });
  }

  Object.entries(base).forEach(([key, values]) => add(key, values));
  groups.forEach((group) => {
    const normalizedGroup = group.map(normalizeOption).filter(Boolean);
    normalizedGroup.forEach((word) => add(word, normalizedGroup.filter((item) => item !== word)));
  });

  return Object.fromEntries(Object.entries(expanded).map(([key, values]) => [key, Array.from(values)]));
}

function normalizeLookupWord(word: string): string {
  return word.trim().toLowerCase().replace(/[^a-z'-]/g, '');
}

function normalizeOption(word: string): string {
  return word.trim().toLowerCase().replace(/[^a-z' -]/g, '');
}
