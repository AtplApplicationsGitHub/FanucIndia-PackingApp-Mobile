// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import LoginScreen from "./src/components/screens/Login/login";
import HomeScreen from "./src/components/screens/Home_screen/home_screen";
import MaterialFGScreen from "./src/components/screens/Material_FG/material_fg";
import MaterialDispatchScreen from "./src/components/screens/Material_Dispatch/material_dispatch";
import LabelPrint from "./src/components/screens/CustomerLabel_Print/label_Print";
import VehicleEntry from "./src/components/screens/Vehicle_Entry/VehicleEntry";
import PutAwayScreen from "./src/components/screens/put_away/putaway";
import LocationAccuracyScreen from "./src/components/screens/Location Accuracy/Location";
import ContentAccuracyScreen from "./src/components/screens/Content_Accuracy/ContentAccuracy";
import SettingsScreen from "./src/components/screens/Settings/settings";
import SoundDemoScreen from "./src/components/Demo-modules/SoundDemo/Sounddemo";
import AttachmentsScreen from "./src/components/screens/UploadAttachments/Attachments";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  LabelPrint: undefined;
  VehicleEntry: undefined;
  MaterialFG: undefined;
  MaterialDispatch: undefined;
  PutAway: undefined;
  LocationAccuracy: undefined;
  ContentAccuracy: undefined;
  Settings: undefined;
  SoundDemo: undefined;
  UploadAttachments: undefined;
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
              fontSize: 18,
              fontWeight: "600",
              color: "#0B0F19",
            },
            headerStyle: {
              backgroundColor: "#FFFFFF",
            },
            headerTintColor: "#0B0F19",
            headerShadowVisible: true, 
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

          {/* Label Print */}
          <Stack.Screen
            name="LabelPrint"
            component={LabelPrint}
            options={{ title: "Customer Label Print" }}
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

          {/* Put Away */}
          <Stack.Screen
            name="PutAway"
            component={PutAwayScreen}
            options={{ title: "Put Away" }}
          />

          {/* Location Accuracy */}
          <Stack.Screen
            name="LocationAccuracy"
            component={LocationAccuracyScreen}
            options={{ title: "Location Accuracy" }}
          />

          {/* Content Accuracy */}
          <Stack.Screen
            name="ContentAccuracy"
            component={ContentAccuracyScreen}
            options={{ title: "Content Accuracy" }}
          />

          {/* Settings */}
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: "Settings" }}
          />

          {/* Sound Demo */}
          <Stack.Screen
            name="SoundDemo"
            component={SoundDemoScreen}
            options={{ title: "Sound Demo" }}
          />

          {/* Upload Attachments */}
          <Stack.Screen
            name="UploadAttachments"
            component={AttachmentsScreen}
            options={{ title: "Upload Attachments" }}
          />

        </Stack.Navigator>
      </NavigationContainer>
  );
}
