export interface WcaUserLike {
    wcaId?: string | null;
    socials?: Array<{ network: string; value?: string | null }> | null;
    hasWca?: boolean;
}

/**
 * Checks whether a given user object represents a user with a linked WCA profile.
 */
export function hasLinkedWca(user?: WcaUserLike | null): boolean {
    if (!user) return false;
    if (user.hasWca === true) return true;
    if (typeof user.wcaId === 'string' && user.wcaId.trim() !== '') return true;
    if (Array.isArray(user.socials)) {
        return user.socials.some(
            s => s.network === 'wca' && typeof s.value === 'string' && s.value.trim() !== ''
        );
    }
    return false;
}
