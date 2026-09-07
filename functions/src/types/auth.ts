export type SocialNetwork =
    | 'email'
    | 'discord'
    | 'twitter'
    | 'instagram'
    | 'youtube'
    | 'twitch'
    | 'wca'
    | 'other';

export type SocialPrivacy = 'hidden' | 'friends' | 'public';

export interface SocialProfile {
    id: string;
    network: SocialNetwork;
    value: string;
    privacy: SocialPrivacy;
}

export interface UserData {
    uid: string;
    shortId?: string;
    email: string | null;
    username: string;
    color: string;
    emailVerified: boolean;
    following?: string[];
    starredUsers?: string[];
    blockedUsers?: string[];
    socials?: SocialProfile[];
    lastSeenAt?: string;
    status?: string;
    isGhostMode?: boolean;
    pinnedGoalIds?: string[];
}

export interface AuthContextType {
    user: UserData | null;
    loading: boolean;
    emailSignUp: (email: string, pass: string) => Promise<unknown>;
    emailSignIn: (email: string, pass: string) => Promise<unknown>;
    resendVerificationEmail: () => Promise<void>;
    logout: () => Promise<void>;
    deleteUserAccount?: () => Promise<void>;
    toggleFollowUser: (targetUid: string) => Promise<void>;
    toggleStarUser: (targetUid: string) => Promise<void>;
    toggleBlockUser: (targetUid: string) => Promise<void>;
    updateGhostMode: (isGhost: boolean) => Promise<void>;
}
