/**
 * @file src/utils/source-ids.ts
 * @desc Ids for sources pools makes up itself (host and community pools): 8 base36 characters,
 *       the first a letter. A letter first keeps them out of otdb's numeric ids, which
 *       `bySourceId` sorts first, so an otdb pool keeps its name when a host pool joins it. The
 *       pool id is "<kind>-<id>". A new id skips every taken one, and ids are never reused: the
 *       caller counts current and former sources and every pool id as taken. Randomness comes
 *       from `crypto.getRandomValues` (the Web Crypto global, not node:crypto) unless a test
 *       passes its own bytes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

/** A generated source id: a letter, then 7 base36 characters. */
export const SOURCE_ID_PATTERN = /^[a-z][0-9a-z]{7}$/;

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 8;
/** How many new ids to try before giving up on finding a free one. */
const MAX_TRIES = 20;

export type RandomBytes = (length: number) => Uint8Array;

const webCryptoBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

/**
 * @function isSourceId
 * @param id {string} an id
 * @returns {boolean} whether it's a generated source id's shape
 */
export const isSourceId = (id: string): boolean => SOURCE_ID_PATTERN.test(id);

/** One character of `alphabet`, uniform: a byte past the last whole alphabet is drawn again. */
const pick = (alphabet: string, random: RandomBytes): string => {
  const limit = 256 - (256 % alphabet.length);
  for (;;) {
    const byte = random(1)[0] ?? 0;
    if (byte < limit) return alphabet[byte % alphabet.length] ?? "";
  }
};

/**
 * @function newSourceId
 * @param random {RandomBytes} random bytes (tests); Web Crypto by default
 * @returns {string} a new id matching SOURCE_ID_PATTERN
 */
export const newSourceId = (random: RandomBytes = webCryptoBytes): string => {
  let id = pick(LETTERS, random);
  while (id.length < ID_LENGTH) id += pick(BASE36, random);
  return id;
};

/**
 * @function uniqueSourceId
 * @param isTaken {(id: string) => boolean} whether an id is in use (as a source id of the kind,
 *        current or former, or inside a pool id)
 * @param random {RandomBytes} random bytes (tests); Web Crypto by default
 * @returns {string} a new id that isn't taken
 * @throws {Error} when 20 new ids in a row are all taken
 */
export const uniqueSourceId = (
  isTaken: (id: string) => boolean,
  random: RandomBytes = webCryptoBytes,
): string => {
  for (let i = 0; i < MAX_TRIES; i++) {
    const id = newSourceId(random);
    if (!isTaken(id)) return id;
  }
  throw new Error(`Couldn't find a free source id in ${MAX_TRIES} tries.`);
};
