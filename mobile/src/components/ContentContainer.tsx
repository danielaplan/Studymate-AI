import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '../theme';

interface ContentContainerProps {
  children: React.ReactNode;
  style?: any;
}

/**
 * Tablet/iPad adaptivity wrapper. On phones it is a plain full-width column; on
 * tablet widths (>=768pt) it caps content at a comfortable reading measure and
 * centers it, so phone layouts don't stretch edge-to-edge on iPad. Resolves the
 * audit's "supportsTablet:true but no responsive container" finding.
 */
export function ContentContainer({ children, style }: ContentContainerProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <View
      style={[
        styles.outer,
        isTablet && styles.tablet,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
  },
  tablet: {
    maxWidth: 760,
    alignSelf: 'center',
  },
});
