import { Text as RNText, type TextProps } from 'react-native';
import { color as palette, type as typeScale, type TypeVariant } from '@/theme/tokens';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/** Single text primitive: every string in the app uses a Figma text style. */
export function Text({ variant = 'bodyM', color = palette.text.primary, align, style, ...rest }: AppTextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[typeScale[variant], { color }, align ? { textAlign: align } : null, style]}
    />
  );
}
