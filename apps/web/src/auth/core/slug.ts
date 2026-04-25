import { generateSlug as generateRandomWordSlug } from 'random-word-slugs';

const SUFFIX_LENGTH = 4;

function generateBase36Suffix() {
  return Math.random()
    .toString(36)
    .slice(2, 2 + SUFFIX_LENGTH)
    .padEnd(SUFFIX_LENGTH, '0');
}

export function generateSlug() {
  return `${generateRandomWordSlug()}-${generateBase36Suffix()}`;
}
