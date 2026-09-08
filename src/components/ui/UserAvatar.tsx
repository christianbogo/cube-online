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
    const isBlackProfile =
        effectiveColor.toLowerCase() === '#18181b' ||
        effectiveColor.toLowerCase() === '#000000' ||
        effectiveColor.toLowerCase() === '#27272a' ||
        effectiveColor.toLowerCase() === '#2d333b';
    const fillColor = isBlackProfile ? 'var(--profile-black, #2d333b)' : effectiveColor;

    return (
        <div
            className={`${roundedClassName || 'rounded-lg'} shrink-0 ${className || ''}`}
            style={{ backgroundColor: fillColor, ...style }}
            onClick={onClick}
            title={title || (user?.username ? `${user.username}'s profile` : undefined)}
            aria-label={ariaLabel || (user?.username ? `${user.username}'s profile` : undefined)}
        >
            {children}
        </div>
    );
}

export default UserAvatar;
