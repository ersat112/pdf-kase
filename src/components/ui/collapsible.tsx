// src/components/ui/collapsible.tsx
import React, { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

type Props = PropsWithChildren<{
  title: string;
}>;

export function Collapsible({ children, title }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={styles.root}>
      <Pressable
        style={({ pressed }) => [
          styles.heading,
          pressed && styles.pressedHeading,
        ]}
        onPress={() => setIsOpen((value) => !value)}
      >
        <View style={styles.button}>
          <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
      </Pressable>

      {isOpen ? (
        <Animated.View entering={FadeIn.duration(180)}>
          <View style={styles.content}>{children}</View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pressedHeading: {
    opacity: 0.72,
  },
  button: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#17202B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    color: '#F3F6FA',
    fontSize: 16,
    fontWeight: '800',
    transform: [{ rotate: '90deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '-90deg' }],
  },
  title: {
    color: '#F3F6FA',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    marginLeft: 24,
    borderRadius: 12,
    backgroundColor: '#121821',
    padding: 12,
  },
});