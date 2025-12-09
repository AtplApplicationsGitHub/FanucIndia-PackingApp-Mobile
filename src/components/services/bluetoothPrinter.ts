// src/services/bluetoothPrinter.ts
import { Platform, PermissionsAndroid } from "react-native";

export type BluetoothPrinterDevice = {
  name: string;
  address: string;
};

let lastConnectedAddress: string | null = null;

async function requestAndroidBluetoothPermissions() {
  if (Platform.OS !== "android") return;

  const permissions = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ];

  const granted = await PermissionsAndroid.requestMultiple(permissions);

  const allGranted = permissions.every(
    (perm) => granted[perm] === PermissionsAndroid.RESULTS.GRANTED
  );

  if (!allGranted) {
    throw new Error("Bluetooth permissions not granted");
  }
}


export async function connectToFirstPairedPrinter(): Promise<BluetoothPrinterDevice> {
  // Dynamic import to avoid crashes in wrong environments
  const mod: any = await import("react-native-bluetooth-escpos-printer");
  const BluetoothManager = mod?.BluetoothManager;

  if (!BluetoothManager) {
    throw new Error(
      "Bluetooth native module not loaded. " +
        "Make sure you ran 'npx expo prebuild' and are not using Expo Go."
    );
  }

  // 1. Permissions (Android)
  await requestAndroidBluetoothPermissions();

  // 2. Ensure Bluetooth is enabled
  const enabled: boolean = await BluetoothManager.isBluetoothEnabled();
  if (!enabled) {
    await BluetoothManager.enableBluetooth();
  }

  // 3. Scan devices
  const devicesJson: string = await BluetoothManager.scanDevices();

  let pairedDevices: BluetoothPrinterDevice[] = [];
  try {
    const parsed = JSON.parse(devicesJson);
    pairedDevices = parsed.paired || [];
  } catch (e) {
    console.warn("Failed to parse Bluetooth devices JSON:", devicesJson, e);
  }

  if (!pairedDevices || pairedDevices.length === 0) {
    throw new Error("No paired Bluetooth printers found");
  }

  const device = pairedDevices[0];

  // 4. Connect
  await BluetoothManager.connect(device.address);
  lastConnectedAddress = device.address;

  return device;
}

/**
 * Disconnect currently connected printer (if any).
 */
export async function disconnectPrinter(): Promise<void> {
  const mod: any = await import("react-native-bluetooth-escpos-printer");
  const BluetoothManager = mod?.BluetoothManager;

  if (!BluetoothManager) {
    throw new Error("Bluetooth native module not loaded");
  }

  try {
    // Most libs support disconnect() without args
    await BluetoothManager.disconnect();
  } catch (err) {
    console.warn("Error while disconnecting printer:", err);
  } finally {
    lastConnectedAddress = null;
  }
}
