export type SocialNetwork =
    | 'email'
    | 'discord'
    | 'twitter'
    | 'instagram'
    | 'youtube'
    | 'twitch'
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
    starredUsers?: string[];
    blockedUsers?: string[];
    socials?: SocialProfile[];
    lastSeenAt?: string;
    status?: string;
}

export interface AuthContextType {
    user: UserData | null;
    loading: boolean;
    emailSignUp: (email: string, pass: string) => Promise<unknown>;
    emailSignIn: (email: string, pass: string) => Promise<unknown>;
    resendVerificationEmail: () => Promise<void>;
    logout: () => Promise<void>;
    deleteUserAccount?: () => Promise<void>;
    toggleStarUser: (targetUid: string) => Promise<void>;
    toggleBlockUser: (targetUid: string) => Promise<void>;
}
