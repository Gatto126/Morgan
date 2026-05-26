export const LOCAL_AUTH_DOMAIN = "morgan.local";

const usernamePattern = /^[a-z0-9]{2,24}$/;
const pinPattern = /^[a-zA-Z0-9]{6,16}$/;

export function normalizeLocalUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidLocalUsername(username: string) {
  return usernamePattern.test(normalizeLocalUsername(username));
}

export function isValidLocalPin(pin: string) {
  return pinPattern.test(pin);
}

export function localUsernameToEmail(username: string) {
  return `${normalizeLocalUsername(username)}@${LOCAL_AUTH_DOMAIN}`;
}
