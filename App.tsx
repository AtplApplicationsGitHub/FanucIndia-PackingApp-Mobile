// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import LoginScreen from "./src/components/screens/Login/login";
import HomeScreen from "./src/components/screens/Home_screen/home_screen";
import SalesOrderScreen from "./src/components/screens/pick_and_pack/SOScreen/SalesOrder_Screen";
import MaterialFGScreen from "./src/components/screens/Material_FG/material_fg";
import MaterialDispatchScreen from "./src/components/screens/Material_Dispatch/material_dispatch";
import OrderDetailsScreen from "./src/components/screens/pick_and_pack/SO_OrderDetailsScreen/OrderDetails";
import UploadScreen from "./src/components/screens/pick_and_pack/SOScreen/upload";
import LabelPrint from "./src/components/screens/CustomerLabel_Print/label_Print";
import VehicleEntry from "./src/components/screens/Vehicle_Entry/VehicleEntry";
import { RefreshButton } from "./src/components/Storage_Clear/Storage_Clear";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  PickAndPack: undefined;
  SalesOrderScreen: undefined;
  LabelPrint: undefined;
  VehicleEntry: undefined;
  MaterialFG: undefined;
  MaterialDispatch: undefined;
  OrderDetails: { saleOrderNumber: string };
  Upload: { saleOrderNumber: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F7F8" }}>
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

          {/* Pick & Pack List */}
          <Stack.Screen
            name="PickAndPack"
            component={SalesOrderScreen}
            options={{
              title: "Pick and Pack",
              headerLeft: () => null,
              headerRight: () => <RefreshButton />,
            }}
          />

          {/* Optional Fallback */}
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
            options={{ title: "Label Print" }}
          />

          {/* Vehicle Entry */}
          <Stack.Screen
            name="VehicleEntry"
            component={VehicleEntry}
            options={{ title: "Vehicle Entry" }}
          />

          {/* Material FG */}
          <Stack.Screen
            name="MaterialFG"
            component={MaterialFGScreen}
            options={{ title: "Material FG/Transfer" }}
          />

          {/* Material Dispatch */}
          <Stack.Screen
            name="MaterialDispatch"
            component={MaterialDispatchScreen}
            options={{ title: "Material Dispatch" }}
          />

          {/* Order Details */}
          <Stack.Screen
            name="OrderDetails"
            component={OrderDetailsScreen}
            options={({ route }) => ({
              title: `Order ${route.params.saleOrderNumber}`,
              headerBackTitle: "Pick and Pack",
              headerBackVisible: true,
            })}
          />

          {/* Upload Modal */}
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
    </SafeAreaView>
  );
}
