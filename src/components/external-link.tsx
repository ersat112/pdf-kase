import React from 'react';
import {
  Linking,
  Pressable,
  Text,
  type GestureResponderEvent,
} from 'react-native';

type ExternalLinkProps = {
  href: string;
  asChild?: boolean;
  children?: React.ReactNode;
};

async function openExternalHref(href: string) {
  const trimmed = href.trim();

  if (!trimmed) {
    return;
  }

  const supported = await Linking.canOpenURL(trimmed);

  if (!supported) {
    throw new Error('Bağlantı açılamadı.');
  }

  await Linking.openURL(trimmed);
}

export function ExternalLink({
  href,
  asChild = false,
  children,
}: ExternalLinkProps) {
  const handlePress = async (
    originalOnPress?: ((event: GestureResponderEvent) => void) | undefined,
    event?: GestureResponderEvent,
  ) => {
    originalOnPress?.(event as GestureResponderEvent);
    await openExternalHref(href);
  };

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      onPress?: (event: GestureResponderEvent) => void;
    }>;

    return React.cloneElement(child, {
      onPress: (event: GestureResponderEvent) => {
        void handlePress(child.props.onPress, event);
      },
    });
  }

  return (
    <Pressable
      onPress={(event) => {
        void handlePress(undefined, event);
      }}
    >
      {typeof children === 'string' ? <Text>{children}</Text> : children}
    </Pressable>
  );
}