import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useDID } from "@streamplace/components";
import { View } from "react-native";
import HomeTV from "src/screens/home.tv";
import LoginTV from "src/screens/login.tv";
import StreamTV from "src/screens/stream.tv";

export type TVStackParamList = {
  TVHome: undefined;
  TVStream: { user: string };
  TVLogin: undefined;
};

const Stack = createNativeStackNavigator<TVStackParamList>();

export default function Shell() {
  const did = useDID();
  const initial = did ? "TVHome" : "TVLogin";

  return (
    <View style={{ flex: 1, backgroundColor: "#0b0b0e" }}>
      <Stack.Navigator
        initialRouteName={initial}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="TVHome" component={HomeTV} />
        <Stack.Screen
          name="TVStream"
          component={StreamTV}
          options={{ animation: "fade" }}
        />
        <Stack.Screen
          name="TVLogin"
          component={LoginTV}
          options={{ presentation: "fullScreenModal" }}
        />
      </Stack.Navigator>
    </View>
  );
}
