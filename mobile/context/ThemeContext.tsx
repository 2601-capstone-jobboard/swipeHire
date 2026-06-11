import React, { createContext, useContext, useState, useEffect } from "react";

import { useColorScheme } from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { darkTheme, lightTheme } from "../theme";

type ThemeMode = "light" | "dark";

const THEME_KEY = "swipehire-theme";

type ThemeContextType = {
  theme: {
    mode: ThemeMode;
    background: string;
    card: string;
    text: string;
    secondaryText: string;
    border: string;
    primary: string;
    danger: string;
  };

  themeMode: ThemeMode;

  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemTheme = useColorScheme();

  const [themeMode, setThemeMode] = useState<ThemeMode>(
    systemTheme === "dark" ? "dark" : "light",
  );

  // Load saved theme when app starts
  useEffect(() => {
    async function loadTheme() {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_KEY);

        if (savedTheme === "dark" || savedTheme === "light") {
          setThemeMode(savedTheme);
        }
      } catch (err) {
        console.log("Failed to load theme", err);
      }
    }

    loadTheme();
  }, []);

  // Toggle + save theme
  const toggleTheme = async () => {
    const newTheme = themeMode === "dark" ? "light" : "dark";

    setThemeMode(newTheme);

    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme);
    } catch (err) {
      console.log("Failed to save theme", err);
    }
  };

  const baseTheme = themeMode === "dark" ? darkTheme : lightTheme;

  const theme = {
    ...baseTheme,
    mode: themeMode,
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
};
