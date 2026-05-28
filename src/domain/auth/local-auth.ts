export const LOCAL_AUTH_DOMAIN = "morgan.local";
export const LOCAL_PASSWORD_MIN_LENGTH = 15;
export const LOCAL_PASSWORD_MAX_LENGTH = 128;

const usernamePattern = /^[a-z0-9]{2,24}$/;

export function normalizeLocalUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidLocalUsername(username: string) {
  return usernamePattern.test(normalizeLocalUsername(username));
}

export function hasLocalPasswordInput(password: string) {
  return password.length > 0 && password.length <= LOCAL_PASSWORD_MAX_LENGTH;
}

export function isValidLocalPassword(password: string) {
  return (
    hasLocalPasswordInput(password) &&
    password.length >= LOCAL_PASSWORD_MIN_LENGTH &&
    password.trim().length > 0
  );
}

export function getLocalPasswordPolicyHint() {
  return `${LOCAL_PASSWORD_MIN_LENGTH}-${LOCAL_PASSWORD_MAX_LENGTH} characters; spaces and symbols allowed`;
}

export function localUsernameToEmail(username: string) {
  return `${normalizeLocalUsername(username)}@${LOCAL_AUTH_DOMAIN}`;
}
