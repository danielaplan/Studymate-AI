import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { colors } from '../theme';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function MenuIcon({ size = 20, color = colors.brandGreen, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7H21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M3 12H21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M3 17H21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function BackIcon({ size = 20, color = colors.textPrimary, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = colors.textPrimary, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PaperclipIcon({ size = 20, color = colors.textMuted, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DocumentIcon({ size = 20, color = colors.brandGreen, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14 2V8H20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 13H8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M16 17H8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M10 9H8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SparklesIcon({ size = 18, color = colors.brandGreen, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 16L19.9 19.1L23 20L19.9 20.9L19 24L18.1 20.9L15 20L18.1 19.1L19 16Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SearchIcon({ size = 18, color = colors.textPlaceholder, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M21 21L16.65 16.65" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function SendIcon({ size = 18, color = colors.brandGreen, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19V5M5 12L12 5L19 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MicIcon({ size = 18, color = colors.textMuted, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 1A3 3 0 009 4V12A3 3 0 0015 12V4A3 3 0 0012 1Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 10V12A7 7 0 015 12V10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 19V23M8 23H16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ScanIcon({ size = 18, color = colors.brandGreen, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7V5C3 3.89543 3.89543 3 5 3H7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M17 3H19C20.1046 3 21 3.89543 21 5V7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M21 17V19C21 20.1046 20.1046 21 19 21H17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7 21H5C3.89543 21 3 20.1046 3 19V17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7 12H17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ShieldIcon({ size = 20, color = colors.brandGreen, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SettingsIcon({ size = 20, color = colors.brandGreen, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M19.4 15A1.65 1.65 0 0020 16.34L20.09 16.53A2 2 0 0117.8 19.5L17.61 19.41A1.65 1.65 0 0016.27 20V20.22A2 2 0 0113.22 22H10.78A2 2 0 018.78 20V19.78A1.65 1.65 0 007.44 19.41L7.25 19.5A2 2 0 014.96 16.53L5.05 16.34A1.65 1.65 0 004.47 15H4.22A2 2 0 012.22 12V12A2 2 0 014.22 9H4.47A1.65 1.65 0 005.05 7.66L4.96 7.47A2 2 0 017.25 4.5L7.44 4.59A1.65 1.65 0 008.78 4.22V4A2 2 0 0110.78 2H13.22A2 2 0 0115.22 4V4.22A1.65 1.65 0 0016.56 4.59L16.75 4.5A2 2 0 0119.04 7.47L18.95 7.66A1.65 1.65 0 0019.53 9H19.78A2 2 0 0121.78 12V12A2 2 0 0119.78 15H19.4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MoreVerticalIcon({ size = 18, color = colors.textMuted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="6" r="1.5" fill={color} />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      <Circle cx="12" cy="18" r="1.5" fill={color} />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 18, color = colors.textMuted, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 16, color = colors.textMuted, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 6V12L16 14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FolderIcon({ size = 16, color = colors.textMuted, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HomeNavIcon({ size = 22, color = colors.inactiveTab, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M9 21V12H15V21" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function SubjectsNavIcon({ size = 22, color = colors.inactiveTab, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6.5 2H20V22H6.5A2.5 2.5 0 014 19.5V4.5A2.5 2.5 0 016.5 2Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M8 7H16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M8 11H14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ChatNavIcon({ size = 22, color = colors.inactiveTab, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="6" width="18" height="13" rx="3" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="8.5" cy="12.5" r="1.2" fill={color} />
      <Circle cx="15.5" cy="12.5" r="1.2" fill={color} />
      <Path d="M12 2V6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M1 12H3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M21 12H23" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileNavIcon({ size = 22, color = colors.inactiveTab, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}
