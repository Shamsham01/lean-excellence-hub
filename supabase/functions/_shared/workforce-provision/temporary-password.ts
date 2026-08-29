const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*";
const ALL = `${UPPERCASE}${LOWERCASE}${DIGITS}${SYMBOLS}`;

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/;

function randomInt(bound: number): number {
  if (bound <= 0) {
    throw new Error("invalid randomInt bound");
  }

  const bytes = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / bound) * bound;

  while (true) {
    crypto.getRandomValues(bytes);
    const value = bytes[0]!;
    if (value < limit) {
      return value % bound;
    }
  }
}

function pickCharacter(alphabet: string): string {
  const characters = [...alphabet];
  const index = randomInt(characters.length);
  const character = characters[index];
  if (!character) {
    throw new Error("failed to pick password character");
  }
  return character;
}

function secureShuffle(values: string[]): string[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    const temporary = shuffled[index]!;
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = temporary;
  }
  return shuffled;
}

export function generateWorkforceTemporaryPassword(length = 22): string {
  if (length < 12) {
    throw new Error(
      "workforce temporary passwords must be at least 12 characters",
    );
  }

  const characters = [
    pickCharacter(UPPERCASE),
    pickCharacter(LOWERCASE),
    pickCharacter(DIGITS),
    pickCharacter(SYMBOLS),
    ...Array.from({ length: length - 4 }, () => pickCharacter(ALL)),
  ];

  if (
    characters.length !== length ||
    characters.some((character) => character.length !== 1)
  ) {
    throw new Error("workforce temporary password generation failed");
  }

  return secureShuffle(characters).join("");
}

export function satisfiesWorkforcePasswordPolicy(password: string): boolean {
  return (
    password.length >= 12 &&
    PASSWORD_POLICY.test(password) &&
    [...password].every((character) => ALL.includes(character))
  );
}
