/**
 * Static irregular forms list for lemmatization.
 * Contains ~200 most frequent irregular verbs with all principal parts,
 * full conjugations of be/do/have, and common irregular plurals.
 */

// Type for irregular verb entries: base -> past -> past participle
type IrregularVerb = [string, string, string];

// Type for irregular noun entries: singular -> plural
type IrregularNoun = [string, string];

/**
 * Most frequent irregular verbs with all principal parts.
 * Source: Based on frequency lists and common irregular verbs.
 */
const IRREGULAR_VERBS: IrregularVerb[] = [
  // Top 50 most common
  ['be', 'was', 'been'],
  ['have', 'had', 'had'],
  ['do', 'did', 'done'],
  ['say', 'said', 'said'],
  ['go', 'went', 'gone'],
  ['get', 'got', 'gotten'],
  ['make', 'made', 'made'],
  ['know', 'knew', 'known'],
  ['think', 'thought', 'thought'],
  ['take', 'took', 'taken'],
  ['see', 'saw', 'seen'],
  ['come', 'came', 'come'],
  ['want', 'wanted', 'wanted'],
  ['use', 'used', 'used'],
  ['find', 'found', 'found'],
  ['give', 'gave', 'given'],
  ['tell', 'told', 'told'],
  ['work', 'worked', 'worked'],
  ['call', 'called', 'called'],
  ['try', 'tried', 'tried'],
  ['ask', 'asked', 'asked'],
  ['need', 'needed', 'needed'],
  ['feel', 'felt', 'felt'],
  ['become', 'became', 'become'],
  ['leave', 'left', 'left'],
  ['put', 'put', 'put'],
  ['mean', 'meant', 'meant'],
  ['keep', 'kept', 'kept'],
  ['let', 'let', 'let'],
  ['begin', 'began', 'begun'],
  ['seem', 'seemed', 'seemed'],
  ['help', 'helped', 'helped'],
  ['talk', 'talked', 'talked'],
  ['turn', 'turned', 'turned'],
  ['start', 'started', 'started'],
  ['show', 'showed', 'shown'],
  ['hear', 'heard', 'heard'],
  ['play', 'played', 'played'],
  ['run', 'ran', 'run'],
  ['move', 'moved', 'moved'],
  ['like', 'liked', 'liked'],
  ['live', 'lived', 'lived'],
  ['believe', 'believed', 'believed'],
  ['hold', 'held', 'held'],
  ['bring', 'brought', 'brought'],
  ['happen', 'happened', 'happened'],
  ['write', 'wrote', 'written'],
  ['provide', 'provided', 'provided'],
  ['sit', 'sat', 'sat'],
  ['stand', 'stood', 'stood'],
  ['lose', 'lost', 'lost'],
  ['pay', 'paid', 'paid'],
  ['meet', 'met', 'met'],
  ['include', 'included', 'included'],
  ['continue', 'continued', 'continued'],
  ['set', 'set', 'set'],
  ['learn', 'learnt', 'learnt'],
  ['change', 'changed', 'changed'],
  ['lead', 'led', 'led'],
  ['understand', 'understood', 'understood'],
  ['watch', 'watched', 'watched'],
  ['follow', 'followed', 'followed'],
  ['stop', 'stopped', 'stopped'],
  ['create', 'created', 'created'],
  ['speak', 'spoke', 'spoken'],
  ['read', 'read', 'read'],
  ['spend', 'spent', 'spent'],
  ['grow', 'grew', 'grown'],
  ['open', 'opened', 'opened'],
  ['walk', 'walked', 'walked'],
  ['win', 'won', 'won'],
  ['offer', 'offered', 'offered'],
  ['remember', 'remembered', 'remembered'],
  ['love', 'loved', 'loved'],
  ['consider', 'considered', 'considered'],
  ['appear', 'appeared', 'appeared'],
  ['buy', 'bought', 'bought'],
  ['wait', 'waited', 'waited'],
  ['serve', 'served', 'served'],
  ['die', 'died', 'died'],
  ['send', 'sent', 'sent'],
  ['build', 'built', 'built'],
  ['stay', 'stayed', 'stayed'],
  ['fall', 'fell', 'fallen'],
  ['cut', 'cut', 'cut'],
  ['reach', 'reached', 'reached'],
  ['kill', 'killed', 'killed'],
  ['remain', 'remained', 'remained'],
  ['suggest', 'suggested', 'suggested'],
  ['raise', 'raised', 'raised'],
  ['pass', 'passed', 'passed'],
  ['sell', 'sold', 'sold'],
  ['require', 'required', 'required'],
  ['decide', 'decided', 'decided'],
  ['break', 'broke', 'broken'],
  ['develop', 'developed', 'developed'],
  ['receive', 'received', 'received'],
  ['agree', 'agreed', 'agreed'],
  ['support', 'supported', 'supported'],
  ['hit', 'hit', 'hit'],
  ['occur', 'occurred', 'occurred'],
  ['claim', 'claimed', 'claimed'],
  ['accept', 'accepted', 'accepted'],
  ['deal', 'dealt', 'dealt'],
  ['fail', 'failed', 'failed'],
  ['produce', 'produced', 'produced'],
  ['realize', 'realized', 'realized'],
  ['fill', 'filled', 'filled'],
  ['join', 'joined', 'joined'],
  ['save', 'saved', 'saved'],
  ['draw', 'drew', 'drawn'],
  ['choose', 'chose', 'chosen'],
  ['forget', 'forgot', 'forgotten'],
  ['lose', 'lost', 'lost'],
  ['wear', 'wore', 'worn'],
  ['teach', 'taught', 'taught'],
  ['catch', 'caught', 'caught'],
  ['allow', 'allowed', 'allowed'],
  ['beat', 'beat', 'beaten'],
  ['fight', 'fought', 'fought'],
  ['hide', 'hid', 'hidden'],
  ['cover', 'covered', 'covered'],
  ['reduce', 'reduced', 'reduced'],
  ['close', 'closed', 'closed'],
  ['finish', 'finished', 'finished'],
  ['improve', 'improved', 'improved'],
  
  // Additional irregular verbs (next 100+)
  ['fly', 'flew', 'flown'],
  ['throw', 'threw', 'thrown'],
  ['wake', 'woke', 'woken'],
  ['sing', 'sang', 'sung'],
  ['drink', 'drank', 'drunk'],
  ['eat', 'ate', 'eaten'],
  ['ride', 'rode', 'ridden'],
  ['drive', 'drove', 'driven'],
  ['ring', 'rang', 'rung'],
  ['sink', 'sank', 'sunk'],
  ['swim', 'swam', 'swum'],
  ['rise', 'rose', 'risen'],
  ['fall', 'fell', 'fallen'],
  ['shut', 'shut', 'shut'],
  ['arise', 'arose', 'arisen'],
  ['bear', 'bore', 'borne'],
  ['bid', 'bid', 'bid'],
  ['bite', 'bit', 'bitten'],
  ['bleed', 'bled', 'bled'],
  ['blow', 'blew', 'blown'],
  ['broadcast', 'broadcast', 'broadcast'],
  ['burst', 'burst', 'burst'],
  ['creep', 'crept', 'crept'],
  ['dig', 'dug', 'dug'],
  ['dive', 'dove', 'dived'],
  ['feed', 'fed', 'fed'],
  ['feel', 'felt', 'felt'],
  ['flee', 'fled', 'fled'],
  ['fling', 'flung', 'flung'],
  ['forecast', 'forecast', 'forecast'],
  ['forgive', 'forgave', 'forgiven'],
  ['freeze', 'froze', 'frozen'],
  ['grind', 'ground', 'ground'],
  ['hang', 'hung', 'hung'],
  ['hear', 'heard', 'heard'],
  ['hew', 'hewed', 'hewn'],
  ['knit', 'knit', 'knit'],
  ['lay', 'laid', 'laid'],
  ['lead', 'led', 'led'],
  ['lean', 'leant', 'leant'],
  ['leap', 'leapt', 'leapt'],
  ['leave', 'left', 'left'],
  ['lend', 'lent', 'lent'],
  ['light', 'lit', 'lit'],
  ['overcome', 'overcame', 'overcome'],
  ['prove', 'proved', 'proven'],
  ['quit', 'quit', 'quit'],
  ['rid', 'rid', 'rid'],
  ['seek', 'sought', 'sought'],
  ['shake', 'shook', 'shaken'],
  ['shear', 'sheared', 'shorn'],
  ['shine', 'shone', 'shone'],
  ['shoot', 'shot', 'shot'],
  ['shrink', 'shrank', 'shrunk'],
  ['sling', 'slung', 'slung'],
  ['smite', 'smote', 'smitten'],
  ['sow', 'sowed', 'sown'],
  ['speed', 'sped', 'sped'],
  ['spell', 'spelt', 'spelt'],
  ['spill', 'spilt', 'spilt'],
  ['spin', 'spun', 'spun'],
  ['spit', 'spat', 'spit'],
  ['split', 'split', 'split'],
  ['spoil', 'spoilt', 'spoilt'],
  ['spring', 'sprang', 'sprung'],
  ['steal', 'stole', 'stolen'],
  ['stick', 'stuck', 'stuck'],
  ['stink', 'stank', 'stunk'],
  ['strike', 'struck', 'struck'],
  ['sweep', 'swept', 'swept'],
  ['swing', 'swung', 'swung'],
  ['tear', 'tore', 'torn'],
  ['thrust', 'thrust', 'thrust'],
  ['tread', 'trod', 'trodden'],
  ['undergo', 'underwent', 'undergone'],
  ['understand', 'understood', 'understood'],
  ['undertake', 'undertook', 'undertaken'],
  ['weave', 'wove', 'woven'],
  ['weep', 'wept', 'wept'],
  ['wind', 'wound', 'wound'],
  ['withdraw', 'withdrew', 'withdrawn'],
  ['withhold', 'withheld', 'withheld'],
  ['withstand', 'withstood', 'withstood'],
];

/**
 * Common irregular plural nouns: singular -> plural
 */
const IRREGULAR_NOUNS: IrregularNoun[] = [
  // Most common
  ['child', 'children'],
  ['man', 'men'],
  ['woman', 'women'],
  ['person', 'people'],
  ['tooth', 'teeth'],
  ['foot', 'feet'],
  ['goose', 'geese'],
  ['mouse', 'mice'],
  ['louse', 'lice'],
  ['ox', 'oxen'],
  
  // Same singular and plural
  ['deer', 'deer'],
  ['sheep', 'sheep'],
  ['fish', 'fish'],
  ['salmon', 'salmon'],
  ['trout', 'trout'],
  ['series', 'series'],
  ['species', 'species'],
  ['aircraft', 'aircraft'],
  ['spacecraft', 'spacecraft'],
  ['offspring', 'offspring'],
  ['cattle', 'cattle'],
  ['police', 'police'],
  
  // Latin/Greek plurals
  ['cactus', 'cacti'],
  ['focus', 'foci'],
  ['fungus', 'fungi'],
  ['nucleus', 'nuclei'],
  ['radius', 'radii'],
  ['syllabus', 'syllabi'],
  ['analysis', 'analyses'],
  ['basis', 'bases'],
  ['crisis', 'crises'],
  ['thesis', 'theses'],
  ['phenomenon', 'phenomena'],
  ['criterion', 'criteria'],
  ['datum', 'data'],
  ['medium', 'media'],
  ['bacterium', 'bacteria'],
  ['curriculum', 'curricula'],
  ['alumnus', 'alumni'],
  ['genus', 'genera'],
  ['index', 'indices'],
  ['matrix', 'matrices'],
  ['vertex', 'vertices'],
  ['appendix', 'appendices'],
  
  // Other irregular plurals
  ['axe', 'axes'],
  ['die', 'dice'],
  ['hoof', 'hooves'],
  ['leaf', 'leaves'],
  ['life', 'lives'],
  ['knife', 'knives'],
  ['loaf', 'loaves'],
  ['potato', 'potatoes'],
  ['tomato', 'tomatoes'],
  ['cargo', 'cargoes'],
  ['echo', 'echoes'],
  ['embargo', 'embargoes'],
  ['hero', 'heroes'],
  ['mango', 'mangoes'],
  ['mosquito', 'mosquitoes'],
  ['torpedo', 'torpedoes'],
  ['veto', 'vetoes'],
  ['zero', 'zeros'],
  ['buffalo', 'buffaloes'],
  ['tornado', 'tornadoes'],
  ['volcano', 'volcanoes'],
  ['bureau', 'bureaux'],
  ['chateau', 'chateaux'],
  ['plateau', 'plateaux'],
  ['corps', 'corps'],
];

/**
 * Build a map from all irregular forms to their base form.
 */
function buildIrregularVerbMap(verbs: IrregularVerb[]): Record<string, string> {
  const map: Record<string, string> = {};
  
  for (const [base, past, pastParticiple] of verbs) {
    map[base.toLowerCase()] = base.toLowerCase();
    if (past.toLowerCase() !== base.toLowerCase()) {
      map[past.toLowerCase()] = base.toLowerCase();
    }
    if (pastParticiple.toLowerCase() !== base.toLowerCase() && 
        pastParticiple.toLowerCase() !== past.toLowerCase()) {
      map[pastParticiple.toLowerCase()] = base.toLowerCase();
    }
  }
  
  return map;
}

/**
 * Build a map from all irregular plural forms to their singular form.
 */
function buildIrregularNounMap(nouns: IrregularNoun[]): Record<string, string> {
  const map: Record<string, string> = {};
  
  for (const [singular, plural] of nouns) {
    const singularLower = singular.toLowerCase();
    const pluralLower = plural.toLowerCase();
    
    map[singularLower] = singularLower;
    if (pluralLower !== singularLower) {
      map[pluralLower] = singularLower;
    }
  }
  
  return map;
}

/**
 * Build a map from conjugation forms to their base form.
 * Every form in the conjugation array maps to the first element (base form).
 */
function buildConjugationMap(conjugation: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const base = (conjugation[0] as string).toLowerCase();
  for (const form of conjugation) {
    const lowerForm = form.toLowerCase();
    if (lowerForm !== base) {
      map[lowerForm] = base;
    }
    map[base] = base;
  }
  return map;
}

/**
 * Mapping of all irregular verb forms to their base form.
 */
export const IRREGULAR_VERB_MAP: Record<string, string> = buildIrregularVerbMap(IRREGULAR_VERBS);

/**
 * Mapping of all irregular plural forms to their singular form.
 */
export const IRREGULAR_PLURAL_MAP: Record<string, string> = buildIrregularNounMap(IRREGULAR_NOUNS);

/**
 * Full conjugation of be.
 */
export const BE_CONJUGATION = ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'];

/**
 * Full conjugation of do.
 */
export const DO_CONJUGATION = ['do', 'does', 'did', 'done', 'doing'];

/**
 * Full conjugation of have.
 */
export const HAVE_CONJUGATION = ['have', 'has', 'had', 'having'];

/**
 * Combined irregular forms map (verbs + nouns + conjugations).
 * Maps any irregular form to its lemma/base form.
 */
export const IRREGULAR_FORMS_MAP: Record<string, string> = {
  ...IRREGULAR_VERB_MAP,
  ...IRREGULAR_PLURAL_MAP,
  ...buildConjugationMap(BE_CONJUGATION),
  ...buildConjugationMap(DO_CONJUGATION),
  ...buildConjugationMap(HAVE_CONJUGATION),
};

/**
 * Check if a word is in the irregular forms map and return its lemma.
 */
export function getIrregularLemma(word: string): string | null {
  const lowerWord = word.toLowerCase();
  return IRREGULAR_FORMS_MAP[lowerWord] || null;
}
