// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/components/Login/login";
import HomeScreen from "./src/components/Home_screen/home_screen";
import PickAndPackScreen from "./src/components/pick_and_pack/pick_and_pack";
import MaterialFGScreen from "./src/components/Material_FG/material_fg";
import MaterialDispatchScreen from "./src/components/Material_Dispatch/material_dispatch";

export type RootStackParamList = {
  Login: undefined;          // ✅ include Login in the stack
  Home: undefined;
  PickAndPack: undefined;
  MaterialFG: undefined;
  MaterialDispatch: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Login"      // ✅ start on the Login screen
        screenOptions={{
          headerTitleAlign: "center",
        }}
      >
        {/* Login screen (first screen) */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        {/* Home screen → remove header completely */}
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />

        {/* Other screens → header with back button */}
        <Stack.Screen
          name="PickAndPack"
          component={PickAndPackScreen}
          options={{ title: "Pick and Pack" }}
        />
        <Stack.Screen
          name="MaterialFG"
          component={MaterialFGScreen}
          options={{ title: "Material FG / Transfer" }}
        />
        <Stack.Screen
          name="MaterialDispatch"
          component={MaterialDispatchScreen}
          options={{ title: "Material Dispatch" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
