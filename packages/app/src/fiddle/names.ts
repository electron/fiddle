const ADJECTIVES = [
  'amber',
  'ancient',
  'bold',
  'brave',
  'bright',
  'calm',
  'clever',
  'cosmic',
  'crisp',
  'curious',
  'dapper',
  'eager',
  'fancy',
  'fluffy',
  'gentle',
  'giant',
  'glossy',
  'golden',
  'happy',
  'hidden',
  'humble',
  'icy',
  'jolly',
  'kind',
  'lively',
  'lucky',
  'mellow',
  'mighty',
  'misty',
  'noble',
  'odd',
  'polite',
  'proud',
  'quick',
  'quiet',
  'rapid',
  'rusty',
  'shiny',
  'silent',
  'silly',
  'sleepy',
  'snappy',
  'sturdy',
  'sunny',
  'swift',
  'tidy',
  'tiny',
  'vivid',
  'witty',
  'zesty',
];

const NOUNS = [
  'badger',
  'beacon',
  'breeze',
  'canyon',
  'comet',
  'cookie',
  'crane',
  'dolphin',
  'ember',
  'falcon',
  'fern',
  'fjord',
  'forest',
  'gadget',
  'garden',
  'glacier',
  'harbor',
  'island',
  'kettle',
  'lagoon',
  'lantern',
  'meadow',
  'meteor',
  'moose',
  'nebula',
  'otter',
  'owl',
  'panda',
  'pebble',
  'pepper',
  'planet',
  'puffin',
  'quartz',
  'rabbit',
  'raven',
  'river',
  'rocket',
  'sparrow',
  'spruce',
  'squirrel',
  'summit',
  'teapot',
  'thunder',
  'tiger',
  'tulip',
  'valley',
  'violet',
  'walrus',
  'willow',
  'zebra',
];

function pick(words: readonly string[], random: () => number): string {
  return words[Math.floor(random() * words.length) % words.length]!;
}

/** A random 3-word, hyphenated name such as `sleepy-golden-otter`. */
export function randomProjectName(random: () => number = Math.random): string {
  return [pick(ADJECTIVES, random), pick(ADJECTIVES, random), pick(NOUNS, random)].join(
    '-',
  );
}

/** The last segment of a folder path (either separator), or undefined if there is none. */
export function projectNameFromFolder(folder: string): string | undefined {
  const name = folder
    .split(/[/\\]+/)
    .filter(Boolean)
    .pop();
  return name && !/^[a-z]:$/i.test(name) ? name : undefined;
}

/** The local folder's name if there is one, otherwise a random name. */
export function getProjectName(folder?: string, random?: () => number): string {
  return (folder && projectNameFromFolder(folder)) || randomProjectName(random);
}
