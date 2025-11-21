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
import LabelPrint from "./src/components/screens/Label_Print/label_Print"; // <- renamed import for consistency
import { RefreshButton } from "./src/components/Storage_Clear/Storage_Clear";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  PickAndPack: undefined; // SalesOrderScreen (pick & pack list)
  SalesOrderScreen: undefined; // kept in case other code navigates by this name
  LabelPrint: undefined; // Label print screen
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
            headerLeft: () => null, // remove back button
            headerRight: () => <RefreshButton />,
            headerRightContainerStyle: { backgroundColor: "transparent" },
          }}
        />

        {/* Optional: keep direct SalesOrderScreen route if other code references it */}
        <Stack.Screen
          name="SalesOrderScreen"
          component={SalesOrderScreen}
          options={{
            title: "Sales Order",
            headerRight: () => <RefreshButton />,
          }}
        />

        {/* Label Print */}
        <Stack.Screen
          name="LabelPrint"
          component={LabelPrint}
          options={{
            title: "Label Print",
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

        {/* Order Details - Back goes to PickAndPack (label shows Pick and Pack) */}
        <Stack.Screen
          name="OrderDetails"
          component={OrderDetailsScreen}
          options={({ route }) => ({
            title: `Order ${route.params.saleOrderNumber}`,
            headerBackVisible: true,
            headerBackTitle: "Pick and Pack",
          })}
        />

        {/* Upload (modal) */}
        <Stack.Screen
          name="Upload"
          component={UploadScreen}
          options={{
            presentation: "modal",
            title: "Upload Order",
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
