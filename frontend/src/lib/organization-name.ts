export const MAX_ORGANIZATION_NAME_LENGTH = 50;

export function normalizeOrganizationName(name: string): string {
  return name.trim().slice(0, MAX_ORGANIZATION_NAME_LENGTH);
}
