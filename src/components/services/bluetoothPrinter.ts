import { Platform, PermissionsAndroid, Permission } from "react-native";
import { BluetoothManager } from "react-native-bluetooth-escpos-printer";

export type BluetoothPrinterDevice = {
  name: string;
  address: string;
};

type RawScanResult = {
  found?: string | BluetoothPrinterDevice[];
  paired?: string | BluetoothPrinterDevice[];
};

let lastConnectedAddress: string | null = null;

function ensureBluetoothManager() {
  if (!BluetoothManager) {
    throw new Error(
      "Bluetooth native module not loaded. Make sure the library is linked and you are running a native build (not Expo Go)."
    );
  }
}


async function requestAndroidBluetoothPermissions() {
  if (Platform.OS !== "android") return;

  const { PERMISSIONS } = PermissionsAndroid;

  const permissions: Permission[] = [];

  if (PERMISSIONS.BLUETOOTH_SCAN)
    permissions.push(PERMISSIONS.BLUETOOTH_SCAN as Permission);
  if (PERMISSIONS.BLUETOOTH_CONNECT)
    permissions.push(PERMISSIONS.BLUETOOTH_CONNECT as Permission);
  if (PERMISSIONS.ACCESS_FINE_LOCATION)
    permissions.push(PERMISSIONS.ACCESS_FINE_LOCATION as Permission);
  if (PERMISSIONS.ACCESS_COARSE_LOCATION)
    permissions.push(PERMISSIONS.ACCESS_COARSE_LOCATION as Permission);

  if (!permissions.length) return;

  const granted = await PermissionsAndroid.requestMultiple(permissions);

  const allGranted = Object.values(granted).every(
    (status) => status === PermissionsAndroid.RESULTS.GRANTED
  );

  if (!allGranted) {
    throw new Error(
      "Bluetooth and location permissions not granted. Please enable them in app settings."
    );
  }
}


export async function connectToFirstPairedPrinter(): Promise<BluetoothPrinterDevice> {
  if (Platform.OS !== "android") {
    throw new Error(
      "Bluetooth printing is only implemented for Android in this project."
    );
  }

  ensureBluetoothManager();

  await requestAndroidBluetoothPermissions();

  // 2. Ensure Bluetooth is enabled
  const enabled: boolean = await BluetoothManager.isBluetoothEnabled();
  if (!enabled) {
    await BluetoothManager.enableBluetooth();
  }

  const devicesStruct = (await BluetoothManager.scanDevices()) as RawScanResult;

  let allDevices: BluetoothPrinterDevice[] = [];

  try {
    const pairedRaw = devicesStruct?.paired ?? "[]";
    const foundRaw = devicesStruct?.found ?? "[]";

    const paired: BluetoothPrinterDevice[] =
      typeof pairedRaw === "string" ? JSON.parse(pairedRaw) : pairedRaw || [];
    const found: BluetoothPrinterDevice[] =
      typeof foundRaw === "string" ? JSON.parse(foundRaw) : foundRaw || [];

    allDevices = [...paired, ...found];
  } catch (e) {
    console.warn("Failed to parse Bluetooth devices:", e);
    throw new Error(
      "Failed to parse scanned devices. Try again or check Bluetooth settings."
    );
  }

  if (!allDevices.length) {
    throw new Error(
      "No Bluetooth printers found. Please pair your printer in device Bluetooth settings first."
    );
  }

  const device = allDevices[0];

  // 4. Connect
  try {
    await BluetoothManager.connect(device.address);
    lastConnectedAddress = device.address;
  } catch (err: any) {
    console.error("Connect printer error:", err);
    throw new Error(
      `Failed to connect to ${device?.name ?? "printer"}. Error: ${
        err?.message ?? String(err)
      }`
    );
  }

  return device;
}

/**
 * Disconnect / unpair the last connected printer, if possible.
 */
export async function disconnectPrinter(): Promise<void> {
  if (Platform.OS !== "android") return;

  ensureBluetoothManager();

  if (!lastConnectedAddress) {
    console.warn("disconnectPrinter called but no active connection stored.");
    return;
  }

  try {
    const manager: any = BluetoothManager;

    if (typeof manager.disconnect === "function") {
      await manager.disconnect(lastConnectedAddress);
    } else if (typeof manager.unpaire === "function") {
      await manager.unpaire(lastConnectedAddress);
    } else {
      console.warn(
        "BluetoothManager has no disconnect/unpaire method – cannot actively disconnect."
      );
    }
  } catch (err) {
    console.warn("Error while disconnecting printer:", err);
  } finally {
    lastConnectedAddress = null;
  }
}
