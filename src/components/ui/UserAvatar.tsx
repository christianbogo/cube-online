import React from 'react';
import { type WcaUserLike } from '../../utils/wca';
export { WcaBadge, type WcaBadgeProps } from './WcaBadge';

export interface UserAvatarProps {
    user?: (WcaUserLike & { color?: string; username?: string }) | null;
    color?: string;
    /** @deprecated WCA badge is now displayed next to the name, not as profile picture */
    hasWca?: boolean;
    className?: string;
    style?: React.CSSProperties;
    onClick?: (e: React.MouseEvent<Element>) => void;
    title?: string;
    children?: React.ReactNode;
    roundedClassName?: string;
    ariaLabel?: string;
}

export function UserAvatar({
    user,
    color,
    className,
    style,
    onClick,
    title,
    children,
    roundedClassName,
    ariaLabel,
}: UserAvatarProps) {
    const effectiveColor = color || user?.color || '#ef4444';
    const isGradient = effectiveColor.includes('gradient');
    const isBlackProfile =
        !isGradient && (
            effectiveColor.toLowerCase() === '#18181b' ||
            effectiveColor.toLowerCase() === '#000000' ||
            effectiveColor.toLowerCase() === '#27272a' ||
            effectiveColor.toLowerCase() === '#2d333b'
        );
    const fillColor = isBlackProfile ? 'var(--profile-black, #2d333b)' : effectiveColor;

    const seedStr = user?.username || (user as { uid?: string } | null | undefined)?.uid || effectiveColor;
    const hash = seedStr
        .split('')
        .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const duration = 7 + (hash % 6);
    const delay = -(hash % 10);

    const backgroundStyle: React.CSSProperties = isGradient
        ? {
            background: fillColor,
            backgroundSize: '300% 300%',
            animation: `store-gradient-pan ${duration}s ease-in-out infinite`,
            animationDelay: `${delay}s`,
        }
        : {
            backgroundColor: fillColor
        };

    return (
        <div
            className={`${roundedClassName || 'rounded-lg'} shrink-0 overflow-hidden ${className || ''}`}
            style={{ ...backgroundStyle, ...style }}
            onClick={onClick}
            title={title || (user?.username ? `${user.username}'s profile` : undefined)}
            aria-label={ariaLabel || (user?.username ? `${user.username}'s profile` : undefined)}
        >
            {children}
        </div>
    );
}

export default UserAvatar;
