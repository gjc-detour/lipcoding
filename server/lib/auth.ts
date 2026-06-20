export interface User {
  id: string;
  displayName: string;
  token: string;
}

export const DEFAULT_USER: User = {
  id: "default",
  displayName: "Default User",
  token: "",
};

export const SESSION_COOKIE_NAME = "lip_session";
export const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseAllowedUsers(value: string | undefined): User[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, displayName, token, ...extra] = entry.split(":");

      if (!id?.trim() || !displayName?.trim() || !token?.trim() || extra.length > 0) {
        throw new Error(
          "ALLOWED_USERS must use the format \"userId:displayName:token\" separated by commas"
        );
      }

      return {
        id: id.trim(),
        displayName: displayName.trim(),
        token: token.trim(),
      };
    });
}

export function getAllowedUsers(): User[] {
  return parseAllowedUsers(process.env.ALLOWED_USERS);
}

export function isAuthenticationConfigured(): boolean {
  return getAllowedUsers().length > 0;
}

export function getUserByToken(token: string): User | null {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return null;
  }

  return getAllowedUsers().find((user) => user.token === normalizedToken) ?? null;
}

export function getUserById(id: string): User | null {
  const normalizedId = id.trim();
  if (!normalizedId) {
    return null;
  }

  return getAllowedUsers().find((user) => user.id === normalizedId) ?? null;
}
