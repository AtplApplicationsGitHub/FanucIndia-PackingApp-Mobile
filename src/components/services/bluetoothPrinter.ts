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
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION, // Added for better location handling
  ];

  const granted = await PermissionsAndroid.requestMultiple(permissions);

  const allGranted = permissions.every(
    (perm) => granted[perm] === PermissionsAndroid.RESULTS.GRANTED
  );

  if (!allGranted) {
    throw new Error("Bluetooth and location permissions not granted. Please enable them in app settings.");
  }
}

export async function connectToFirstPairedPrinter(): Promise<BluetoothPrinterDevice> {
  // Dynamic import to avoid crashes in wrong environments
  const mod: any = await import("react-native-bluetooth-escpos-printer");
  const BluetoothManager = mod?.BluetoothManager;

  if (!BluetoothManager) {
    throw new Error(
      "Bluetooth native module not loaded. Ensure you're not using Expo Go—use a development build or APK instead. Run 'npx expo prebuild' and test on device."
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

  let allDevices: BluetoothPrinterDevice[] = [];
  try {
    const parsed = JSON.parse(devicesJson);
    allDevices = [...(parsed.paired || []), ...(parsed.found || [])];
  } catch (e) {
    console.warn("Failed to parse Bluetooth devices JSON:", devicesJson, e);
    throw new Error("Failed to parse scanned devices. Try again or check Bluetooth settings.");
  }

  if (allDevices.length === 0) {
    throw new Error("No Bluetooth printers found. Please pair your printer in device settings first (Settings > Bluetooth > Pair new device).");
  }

  // Prefer first paired; fallback to first found (may require manual pairing if connect fails)
  const device = allDevices[0];

  // 4. Connect
  try {
    await BluetoothManager.connect(device.address);
    lastConnectedAddress = device.address;
  } catch (err) {
    throw new Error(`Failed to connect to ${device.name} (${device.address}). Ensure it's paired and in range. Error: ${err.message}`);
  }

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
    await BluetoothManager.disconnect();
  } catch (err) {
    console.warn("Error while disconnecting printer:", err);
  } finally {
    lastConnectedAddress = null;
  }
}