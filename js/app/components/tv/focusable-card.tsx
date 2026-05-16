import { useRef, useState } from "react";
import { Animated, Easing, Pressable, View, ViewStyle } from "react-native";

interface FocusableCardProps {
  onPress?: () => void;
  hasTVPreferredFocus?: boolean;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

const FOCUS_SCALE = 1.08;
const FOCUS_DURATION_MS = 140;

export function FocusableCard({
  onPress,
  hasTVPreferredFocus,
  children,
  style,
}: FocusableCardProps) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (target: number) => {
    Animated.timing(scale, {
      toValue: target,
      duration: FOCUS_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => {
          setFocused(true);
          animateTo(FOCUS_SCALE);
        }}
        onBlur={() => {
          setFocused(false);
          animateTo(1);
        }}
      >
        <View
          style={{
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 4,
            borderColor: focused ? "#fff" : "transparent",
          }}
        >
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
}
