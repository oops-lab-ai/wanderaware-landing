import type { FontKey } from "@/lib/fonts/registry";

import type { ContentLayout, NavbarStyle, SidebarCollapsible, SidebarVariant } from "./layout";
import type { ThemeMode, ThemePreset } from "./theme";

export type PreferencePersistence = "none" | "client-cookie" | "localStorage";

/**
 * All available preference keys and their value types.
 */
export type PreferenceValueMap = {
  theme_mode: ThemeMode;
  theme_preset: ThemePreset;
  font: FontKey;
  content_layout: ContentLayout;
  navbar_style: NavbarStyle;
  sidebar_variant: SidebarVariant;
  sidebar_collapsible: SidebarCollapsible;
};

export type PreferenceKey = keyof PreferenceValueMap;

/**
 * How each preference should be saved.
 *
 * "client-cookie"  - write cookie on the browser only.
 * "localStorage"   - save only on the client.
 * "none"           - no saving, resets on reload.
 */
type PreferencePersistenceConfig = Record<PreferenceKey, PreferencePersistence>;

/**
 * Default preference values on first load.
 */
export const PREFERENCE_DEFAULTS: PreferenceValueMap = {
  theme_mode: "light",
  theme_preset: "default",
  font: "outfit",
  content_layout: "centered",
  navbar_style: "sticky",
  sidebar_variant: "inset",
  sidebar_collapsible: "icon",
};

/**
 * How each preference is persisted.
 * You can change these per-key.
 */
export const PREFERENCE_PERSISTENCE: PreferencePersistenceConfig = {
  theme_mode: "client-cookie",
  theme_preset: "client-cookie",
  font: "client-cookie",
  content_layout: "client-cookie",
  navbar_style: "client-cookie",
  sidebar_variant: "client-cookie",
  sidebar_collapsible: "client-cookie",
};
