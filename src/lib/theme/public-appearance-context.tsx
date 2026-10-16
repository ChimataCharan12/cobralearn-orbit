import React, { createContext, useContext, useMemo } from "react";
import {
  type PublicAppearanceConfig,
  DEFAULT_PUBLIC_APPEARANCE_CONFIG,
  generatePublicAppearanceCss,
} from "@/lib/public-appearance";

export {
  type PublicAppearanceConfig,
  DEFAULT_PUBLIC_APPEARANCE_CONFIG,
  generatePublicAppearanceCss,
};

const PublicAppearanceContext = createContext<PublicAppearanceConfig | null>(null);

export interface PublicAppearanceProviderProps {
  appearance?: Partial<PublicAppearanceConfig> | null;
  children: React.ReactNode;
}

export function PublicAppearanceProvider({
  appearance,
  children,
}: PublicAppearanceProviderProps) {
  const effectiveConfig = useMemo<PublicAppearanceConfig>(() => {
    return {
      ...DEFAULT_PUBLIC_APPEARANCE_CONFIG,
      ...(appearance || {}),
    };
  }, [appearance]);

  const css = useMemo(() => {
    return generatePublicAppearanceCss(effectiveConfig);
  }, [effectiveConfig]);

  return (
    <PublicAppearanceContext.Provider value={effectiveConfig}>
      {/* Inject scoped dynamic tokens and toggles for public routes only */}
      <style
        id="cobra-public-appearance-styles"
        dangerouslySetInnerHTML={{ __html: css }}
      />
      {children}
    </PublicAppearanceContext.Provider>
  );
}

/**
 * Accesses public appearance configuration.
 * Safe to use anywhere — returns DEFAULT_PUBLIC_APPEARANCE_CONFIG when outside a provider.
 */
export function usePublicAppearance(): PublicAppearanceConfig {
  const context = useContext(PublicAppearanceContext);
  return context || DEFAULT_PUBLIC_APPEARANCE_CONFIG;
}
