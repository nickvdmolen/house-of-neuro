import bcrypt from 'bcryptjs';

const BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2y$'];

export const isBcryptHash = (value) =>
  typeof value === 'string' && BCRYPT_PREFIXES.some((prefix) => value.startsWith(prefix));

export const hashPassword = (password) => bcrypt.hashSync(password, 10);

export const verifyPassword = (password, stored) => {
  if (!stored) return false;
  if (isBcryptHash(stored)) return bcrypt.compareSync(password, stored);
  return password === stored;
};

export const checkPassword = (password, stored) => {
  if (!stored) return { ok: false, needsRehash: false };
  if (isBcryptHash(stored)) {
    return { ok: bcrypt.compareSync(password, stored), needsRehash: false };
  }
  const ok = password === stored;
  return { ok, needsRehash: ok && password.trim() !== '' };
};
