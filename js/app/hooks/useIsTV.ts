import { Platform } from "react-native";

// Static for the lifetime of the process — `Platform.isTV` doesn't change at
// runtime, and reading it in a hook just keeps the call site idiomatic.
const IS_TV: boolean = (Platform as { isTV?: boolean }).isTV ?? false;

export function useIsTV(): boolean {
  return IS_TV;
}

export const isTV = IS_TV;
