// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/components/screens/Login/login";
import HomeScreen from "./src/components/screens/Home_screen/home_screen";
import PickAndPackScreen from "./src/components/screens/pick_and_pack/SalesOrder_Screen";
import MaterialFGScreen from "./src/components/screens/Material_FG/material_fg";
import MaterialDispatchScreen from "./src/components/screens/Material_Dispatch/material_dispatch";

// ✅ ADD THIS: your Order Details screen component.
//    Adjust the import path if your file lives somewhere else.
import OrderDetailsScreen from "./src/components/screens/pick_and_pack/OrderDetails";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  PickAndPack: undefined;
  MaterialFG: undefined;
  MaterialDispatch: undefined;
  // ✅ ADD THIS: must exist to navigate to "OrderDetails"
  OrderDetails: { saleOrderNumber: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerTitleAlign: "center" }}
      >
        {/* Login screen (first screen) */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        {/* Home screen */}
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />

        {/* Pick & Pack list (where you likely open OrderDetails from) */}
        <Stack.Screen
          name="PickAndPack"
          component={PickAndPackScreen}
          options={{ title: "Pick and Pack" }}
        />

        {/* Material FG */}
        <Stack.Screen
          name="MaterialFG"
          component={MaterialFGScreen}
          options={{ title: "Material FG / Transfer" }}
        />

        {/* Material Dispatch */}
        <Stack.Screen
          name="MaterialDispatch"
          component={MaterialDispatchScreen}
          options={{ title: "Material Dispatch" }}
        />

        {/* ✅ NEW: Order Details screen so navigation.navigate("OrderDetails", { saleOrderNumber }) works */}
        <Stack.Screen
          name="OrderDetails"
          component={OrderDetailsScreen}
          options={{ title: "Order Details" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
