export const LOCAL_PASSWORD_MIN_LENGTH = 15;
export const LOCAL_PASSWORD_MAX_LENGTH = 128;
export const LOCAL_EMAIL_MAX_LENGTH = 254;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeLocalEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidLocalEmail(email: string) {
  const normalizedEmail = normalizeLocalEmail(email);
  return (
    normalizedEmail.length > 0 &&
    normalizedEmail.length <= LOCAL_EMAIL_MAX_LENGTH &&
    emailPattern.test(normalizedEmail)
  );
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
