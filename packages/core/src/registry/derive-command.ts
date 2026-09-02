const PLURAL_TO_SINGULAR: Record<string, string> = {
  stories: 'story',
  bugs: 'bug',
  tasks: 'task',
  iterations: 'iteration',
  wikis: 'wiki',
  comments: 'comment',
  timesheets: 'timesheet',
  workspaces: 'workspace',
  items: 'item',
  categories: 'category',
  plans: 'plan',
  cards: 'card',
  projects: 'project',
  modules: 'module',
  versions: 'version',
  features: 'feature',
  baselines: 'baseline',
  workflows: 'workflow',
  roles: 'role',
  releases: 'release',
  attachments: 'attachment',
};

const VERB_MAP: Record<string, string> = {
  get: 'list',
  add: 'create',
  remove: 'delete',
};

export interface DerivedCommandParts {
  resource: string;
  action: string;
}

function singularize(word: string): string {
  return PLURAL_TO_SINGULAR[word] ?? word;
}

function kebab(words: string[]): string {
  return words.filter(Boolean).map(w => w.replace(/_/g, '-')).join('-');
}

export function deriveCommand(name: string): DerivedCommandParts {
  let segments = name.replace(/^tapd_/, '').split('_');
  let prefix = '';
  if (segments[0] === 'mini') {
    prefix = 'mini';
    segments = segments.slice(1);
  }

  let verb = segments[0] ?? '';
  let rest = segments.slice(1);
  if (verb === 'batch' && rest.length > 0) {
    verb = `batch_${rest[0]}`;
    rest = rest.slice(1);
  }

  if (rest.length === 0) {
    return { resource: kebab([prefix, verb]), action: 'run' };
  }

  if (rest.length === 1) {
    return {
      resource: kebab([prefix, singularize(rest[0])]),
      action: VERB_MAP[verb] ?? verb.replace(/_/g, '-'),
    };
  }

  const lastWord = rest[rest.length - 1];
  if (PLURAL_TO_SINGULAR[lastWord]) {
    return {
      resource: kebab([prefix, ...rest.map(singularize)]),
      action: VERB_MAP[verb] ?? verb.replace(/_/g, '-'),
    };
  }

  const resource = kebab([prefix, singularize(rest[0])]);
  const tail = kebab(rest.slice(1));
  const headVerb = verb === 'get' ? '' : (VERB_MAP[verb] ?? verb.replace(/_/g, '-'));
  return { resource, action: kebab([headVerb, tail]) };
}
