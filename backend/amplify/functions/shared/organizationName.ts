export const MAX_ORGANIZATION_NAME_LENGTH = 50;

export function normalizeOrganizationName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error('Organization name cannot be empty');
    }
    if (trimmed.length > MAX_ORGANIZATION_NAME_LENGTH) {
        throw new Error(`Organization name must be ${MAX_ORGANIZATION_NAME_LENGTH} characters or fewer`);
    }
    return trimmed;
}

export function generatedOrganizationName(base: string, suffix: string): string {
    const cleanSuffix = suffix.trim();
    const maxBaseLength = Math.max(1, MAX_ORGANIZATION_NAME_LENGTH - cleanSuffix.length);
    return `${base.trim().slice(0, maxBaseLength)}${cleanSuffix}`;
}
