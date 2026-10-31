import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ProfileSectionId =
  | 'socialLinks'
  | 'tokenPermissions'
  | 'readme'
  | 'pinned'
  | 'heatmap'
  | 'subtabs';

export interface ProfileSectionMeta {
  id: ProfileSectionId;
  title: string;
  desc: string;
  icon: string;
}

export const PROFILE_SECTIONS_META: Record<ProfileSectionId, ProfileSectionMeta> = {
  socialLinks: {
    id: 'socialLinks',
    title: 'Social & Web Links',
    desc: 'Website, Twitter/X, Blog & verified social account pills',
    icon: '🔗',
  },
  tokenPermissions: {
    id: 'tokenPermissions',
    title: 'Token Permissions Audit',
    desc: 'Audit badge and required vs missing PAT scopes',
    icon: '🔑',
  },
  readme: {
    id: 'readme',
    title: 'Profile README.md',
    desc: 'Special {username}/{username} GitHub repository profile README',
    icon: '📖',
  },
  pinned: {
    id: 'pinned',
    title: 'Pinned Repositories',
    desc: 'Showcase up to 6 pinned repos from official GraphQL API',
    icon: '📌',
  },
  heatmap: {
    id: 'heatmap',
    title: 'Contribution Heatmap',
    desc: 'Year-round commit & activity contribution squares',
    icon: '🟩',
  },
  subtabs: {
    id: 'subtabs',
    title: 'Repository & Sub-Tabs Container',
    desc: 'Scrollable card holding repos, starred, gists, activity, and network',
    icon: '📂',
  },
};

export interface CustomizationSettings {
  profileSectionOrder: ProfileSectionId[];
  profileSectionVisibility: Record<ProfileSectionId, boolean>;
  defaultProfileSubTab: 'repos' | 'starred' | 'gists' | 'activity' | 'orgs' | 'social';

  defaultRepoSort: 'updated' | 'stars' | 'forks' | 'name';
  defaultRepoFilter: 'all' | 'sources' | 'forks' | 'public' | 'private';
  repoCardDensity: 'detailed' | 'compact';
  repoShowLanguageDot: boolean;
  repoShowForkBadge: boolean;

  defaultRepoDetailTab:
    | 'readme'
    | 'code'
    | 'commits'
    | 'issues'
    | 'actions'
    | 'releases'
    | 'insights';
}

export const DEFAULT_CUSTOMIZATION: CustomizationSettings = {
  profileSectionOrder: [
    'socialLinks',
    'tokenPermissions',
    'readme',
    'pinned',
    'heatmap',
    'subtabs',
  ],
  profileSectionVisibility: {
    socialLinks: true,
    tokenPermissions: true,
    readme: true,
    pinned: true,
    heatmap: true,
    subtabs: true,
  },
  defaultProfileSubTab: 'repos',

  defaultRepoSort: 'updated',
  defaultRepoFilter: 'all',
  repoCardDensity: 'detailed',
  repoShowLanguageDot: true,
  repoShowForkBadge: true,

  defaultRepoDetailTab: 'readme',
};

const STORAGE_KEY = '@gitpulse_customization_v1';

interface CustomizationContextType {
  settings: CustomizationSettings;
  updateSettings: (partial: Partial<CustomizationSettings>) => Promise<void>;
  moveProfileSection: (
    id: ProfileSectionId,
    direction: 'up' | 'down'
  ) => Promise<void>;
  toggleProfileSection: (id: ProfileSectionId) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const CustomizationContext = createContext<CustomizationContextType>({
  settings: DEFAULT_CUSTOMIZATION,
  updateSettings: async () => {},
  moveProfileSection: async () => {},
  toggleProfileSection: async () => {},
  resetToDefaults: async () => {},
});

export const CustomizationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<CustomizationSettings>(
    DEFAULT_CUSTOMIZATION
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((json) => {
      if (json) {
        try {
          const parsed = JSON.parse(json);
          setSettings((prev) => ({
            ...prev,
            ...parsed,
            profileSectionOrder:
              parsed.profileSectionOrder &&
              parsed.profileSectionOrder.length === DEFAULT_CUSTOMIZATION.profileSectionOrder.length
                ? parsed.profileSectionOrder
                : DEFAULT_CUSTOMIZATION.profileSectionOrder,
            profileSectionVisibility: {
              ...DEFAULT_CUSTOMIZATION.profileSectionVisibility,
              ...(parsed.profileSectionVisibility || {}),
            },
          }));
        } catch (e) {
          console.warn('Failed to parse customization settings', e);
        }
      }
    });
  }, []);

  const saveSettings = async (newSettings: CustomizationSettings) => {
    setSettings(newSettings);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  };

  const updateSettings = async (partial: Partial<CustomizationSettings>) => {
    const updated = { ...settings, ...partial };
    await saveSettings(updated);
  };

  const moveProfileSection = async (
    id: ProfileSectionId,
    direction: 'up' | 'down'
  ) => {
    const order = [...settings.profileSectionOrder];
    const index = order.indexOf(id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return;

    // Swap
    const temp = order[index];
    order[index] = order[targetIndex];
    order[targetIndex] = temp;

    await saveSettings({ ...settings, profileSectionOrder: order });
  };

  const toggleProfileSection = async (id: ProfileSectionId) => {
    const updatedVis = {
      ...settings.profileSectionVisibility,
      [id]: !settings.profileSectionVisibility[id],
    };
    await saveSettings({
      ...settings,
      profileSectionVisibility: updatedVis,
    });
  };

  const resetToDefaults = async () => {
    await saveSettings(DEFAULT_CUSTOMIZATION);
  };

  return (
    <CustomizationContext.Provider
      value={{
        settings,
        updateSettings,
        moveProfileSection,
        toggleProfileSection,
        resetToDefaults,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
};

export const useCustomization = () => useContext(CustomizationContext);
