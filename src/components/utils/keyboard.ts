// src/utils/keyboard.ts
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Keyboard } from "react-native";

let _keyboardDisabled = false;
const listeners: (() => void)[] = [];

export const setKeyboardDisabled = async (disabled: boolean) => {
  _keyboardDisabled = disabled;
  try {
    await AsyncStorage.setItem("keyboardDisabled", disabled.toString());
  } catch {}
  listeners.forEach((cb) => cb());
};

export const getKeyboardDisabled = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem("keyboardDisabled");
    return val === "true";
  } catch {
    return false;
  }
};

export const useKeyboardDisabled = (): [boolean, (v: boolean) => void] => {
  const [disabled, setDisabled] = useState(_keyboardDisabled);

  useEffect(() => {
    const listener = () => setDisabled(_keyboardDisabled);
    listeners.push(listener);

    // Initial load
    getKeyboardDisabled().then((val) => {
      _keyboardDisabled = val;
      setDisabled(val);
    });

    return () => {
      listeners.splice(listeners.indexOf(listener), 1);
    };
  }, []);

  const setter = (value: boolean) => {
    setKeyboardDisabled(value);
    setDisabled(value);
  };

  return [disabled, setter];
};

// Optional: auto-dismiss keyboard when turned off
export const useAutoDismissKeyboard = () => {
  const [disabled] = useKeyboardDisabled();
  useEffect(() => {
    if (disabled && Keyboard.isVisible()) {
      Keyboard.dismiss();
    }
  }, [disabled]);
};