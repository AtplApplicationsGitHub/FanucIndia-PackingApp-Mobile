// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Adjust these import paths if your file structure differs
import LoginScreen from "./src/components/screens/Login/login";
import HomeScreen from "./src/components/screens/Home_screen/home_screen";
import SalesOrderScreen from "./src/components/screens/pick_and_pack/SalesOrder_Screen";
import MaterialFGScreen from "./src/components/screens/Material_FG/material_fg";
import MaterialDispatchScreen from "./src/components/screens/Material_Dispatch/material_dispatch";
import OrderDetailsScreen from "./src/components/screens/pick_and_pack/OrderDetails";
import UploadScreen from "./src/components/screens/pick_and_pack/upload";
import { RefreshButton } from "./src/components/Storage_Clear/Storage_Clear";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  PickAndPack: undefined;  // SalesOrderScreen
  SalesOrderScreen: undefined;  // SalesOrderScreen
  MaterialFG: undefined;
  MaterialDispatch: undefined;
  OrderDetails: { saleOrderNumber: string };
  Upload: { saleOrderNumber: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerTitleAlign: "center",
          headerTitleStyle: {
            fontSize: 16,
            fontWeight: "600",
          },
          headerStyle: {
            backgroundColor: "#F7F7F8",
          },
        }}
      >
        {/* Login */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        {/* Home */}
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />

        {/* Pick & Pack list - NO BACK BUTTON */}
        <Stack.Screen
          name="PickAndPack"
          component={SalesOrderScreen}
          options={{ 
            title: "Pick and Pack",
            headerLeft: () => null, // ✅ FIXED: Remove back button
            headerRight: () => <RefreshButton />,
            headerRightContainerStyle: { backgroundColor: "transparent" },
          }}
        />

        {/* Material FG */}
        <Stack.Screen
          name="MaterialFG"
          component={MaterialFGScreen}
          options={{ 
            title: "Material FG/Transfer",
          }}
        />

        {/* Material Dispatch */}
        <Stack.Screen
          name="MaterialDispatch"
          component={MaterialDispatchScreen}
          options={{ title: "Material Dispatch" }}
        />

        {/* ✅ FIXED: OrderDetails - NAVIGATES BACK TO PickAndPack ONLY */}
        <Stack.Screen
          name="OrderDetails"
          component={OrderDetailsScreen}
          options={({ route }) => ({
            title: `Order ${route.params.saleOrderNumber}`,
            // ✅ Back button visible, goes to PickAndPack
            headerBackVisible: true,
            headerBackTitle: "Pick and Pack", // ✅ Set back button label to "Pick and Pack"
          })}
        />

        {/* Upload */}
        <Stack.Screen
          name="Upload"
          component={UploadScreen}
          options={{
            presentation: 'modal',
            title: 'Upload Order',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}