import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Store } from "@tauri-apps/plugin-store";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { info, error as logError } from "@tauri-apps/plugin-log";
import "./App.css";
import { TgaImage, tgaToBase64 } from "./TgaImage";

// Import default DR icons - silenceDefault commented here to uncomment if Blizzard adds the category
import stunDefault from "./assets/default-drs/spell_frost_stun.tga";
import incapDefault from "./assets/default-drs/spell_holy_dizzy.tga";
import fearDefault from "./assets/default-drs/spell_nature_astralrecalgroup.tga";
import rootDefault from "./assets/default-drs/spell_nature_stranglevines.tga";
// import silenceDefault from "./assets/default-drs/ability_priest_silence.tga";

// Import alternative icons - Stun
import stunAlt1 from "./assets/alternative-stun/ability_rogue_kidneyshot.tga";
import stunAlt2 from "./assets/alternative-stun/ability_CheapShot.tga";
import stunAlt3 from "./assets/alternative-stun/spell_holy_sealofmight.tga";
import stunAlt4 from "./assets/alternative-stun/shaman_pvp_lightninglasso.tga";

// Import alternative icons - Incap (sheep)
import incapAlt1 from "./assets/alternative-incap/spell_nature_polymorph.tga";
import incapAlt2 from "./assets/alternative-incap/spell_frost_chainsofice.tga";
import incapAlt3 from "./assets/alternative-incap/ability_monk_paralysis.tga";
import incapAlt4 from "./assets/alternative-incap/spell_shaman_hex.tga";

// Import alternative icons - Fear
import fearAlt1 from "./assets/alternative-fear/spell_shadow_possession.tga";
import fearAlt2 from "./assets/alternative-fear/spell_shadow_psychicscream.tga";
import fearAlt3 from "./assets/alternative-fear/spell_shadow_mindsteal.tga";

// Import alternative icons - Root
import rootAlt1 from "./assets/alternative-root/spell_frost_frostnova.tga";

// Import alternative icons - Silence - commented here to uncomment if Blizzard adds the category
// import silenceAlt1 from "./assets/alternative-silence/spell_deathknight_strangulate.tga";
// import silenceAlt2 from "./assets/alternative-silence/spell_holy_silence.tga";
// import silenceAlt3 from "./assets/alternative-silence/hunter_pvp_spidersting.tga";

// Import app logo
import appLogo from "./assets/app-logo.png";

type Screen = "auto-detect" | "folder-select" | "version-select" | "dr-customize";

interface DetectedWowFolder {
  folder: string;
  versions: string[];
}

interface DRCategory {
  id: string;
  name: string;
  description: string;
  defaultIcon: string;
  defaultIconName: string; // The filename to use when saving (e.g., "spell_frost_stun.jpg")
  alternatives: { src: string; name: string }[];
  selectedIcon: string;
  affectedAbilities: string[]; // List of abilities that will also change
}

const initialDRCategories: DRCategory[] = [
  {
    id: "stun",
    name: "Stun",
    description: "Stun effects (Hammer of Justice, Kidney Shot, etc.)",
    defaultIcon: stunDefault,
    defaultIconName: "Spell_Frost_Stun.tga",
    alternatives: [
      { src: stunAlt1, name: "Kidney Shot" },
      { src: stunAlt2, name: "Cheap Shot" },
      { src: stunAlt3, name: "Hammer of Justice" },
      { src: stunAlt4, name: "Lightning Lasso" },
    ],
    selectedIcon: stunDefault,
    affectedAbilities: [
      "Concussive Shot (Hunter)",
      "Concussion Blow",
      "War Stomp",
      "and other stun-related abilities",
    ],
  },
  {
    id: "incap",
    name: "Incapacitate",
    description: "Incapacitate effects (Polymorph, Hex, etc.)",
    defaultIcon: incapDefault,
    defaultIconName: "Spell_Holy_Dizzy.tga",
    alternatives: [
      { src: incapAlt1, name: "Polymorph" },
      { src: incapAlt2, name: "Chains of Ice" },
      { src: incapAlt3, name: "Paralysis" },
      { src: incapAlt4, name: "Hex" },
    ],
    selectedIcon: incapDefault,
    affectedAbilities: [    ],
  },
  {
    id: "fear",
    name: "Fear",
    description: "Fear effects (Psychic Scream, Howl of Terror, etc.)",
    defaultIcon: fearDefault,
    defaultIconName: "Spell_Nature_AstralRecalGroup.tga",
    alternatives: [
      { src: fearAlt1, name: "Possession" },
      { src: fearAlt2, name: "Psychic Scream" },
      { src: fearAlt3, name: "Blind" },
    ],
    selectedIcon: fearDefault,
    affectedAbilities: [],
  },
  {
    id: "root",
    name: "Root",
    description: "Root effects (Entangling Roots, Frost Nova, etc.)",
    defaultIcon: rootDefault,
    defaultIconName: "Spell_Nature_StrangleVines.tga",
    alternatives: [{ src: rootAlt1, name: "Frost Nova" }],
    selectedIcon: rootDefault,
    affectedAbilities: [
      "Entangling Roots",
      "Mass Entanglement",
      "Earthbind Totem",
      "and other root abilities",
    ],
  },
  // Silence category commented here to uncomment if Blizzard adds the category
  // {
  //   id: "silence",
  //   name: "Silence",
  //   description: "Silence effects (Silence, Strangulate, etc.) (not yet supported in-game)",
  //   defaultIcon: silenceDefault,
  //   defaultIconName: "Ability_Priest_Silence.tga",
  //   alternatives: [
  //     { src: silenceAlt1, name: "Strangulate" },
  //     { src: silenceAlt2, name: "Unstable Affliction" },
  //     { src: silenceAlt3, name: "Spider Venom" },
  //   ],
  //   selectedIcon: silenceAlt1,
  //   affectedAbilities: [
  //     "Silence",
  //     "Strangulate",
  //     "Spider Venom (Chimaeral Sting)",
  //     "and other abilities",
  //   ],
  // },
];

function App() {
  const [screen, setScreen] = useState<Screen>("folder-select");
  const [wowFolder, setWowFolder] = useState<string>("");
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [autoDetected, setAutoDetected] = useState<DetectedWowFolder | null>(
    null,
  );
  const [drCategories, setDRCategories] =
    useState<DRCategory[]>(initialDRCategories);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [applyingIcon, setApplyingIcon] = useState<string | null>(null);
  const [resettingAll, setResettingAll] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  const [selectedIconsByVersion, setSelectedIconsByVersion] = useState<
    Record<string, Record<string, string>>
  >({});

  // Load saved WoW folder on app start
  useEffect(() => {
    async function loadSavedFolder() {
      try {
        const store = await Store.load("settings.json");
        const savedFolder = await store.get<string>("wowFolder");
        const savedIconsByVersion = await store.get<
          Record<string, Record<string, string>>
        >("selectedIconsByVersion");
        const legacySavedIcons =
          await store.get<Record<string, string>>("selectedIcons");

        if (savedIconsByVersion && Object.keys(savedIconsByVersion).length > 0) {
          setSelectedIconsByVersion(savedIconsByVersion);
        } else if (legacySavedIcons) {
          setSelectedIconsByVersion({ __legacy__: legacySavedIcons });
        }

        let resolvedSaved = false;

        if (savedFolder) {
          const resolved = await resolveWowFolder(savedFolder);
          if (resolved) {
            resolvedSaved = true;
            setWowFolder(resolved.folder);
            setVersions(resolved.versions);
            setScreen("version-select");
            if (resolved.folder !== savedFolder) {
              await saveWowFolder(resolved.folder);
            }
          } else {
            setWowFolder(savedFolder);
          }
        }

        if (!resolvedSaved) {
          const detected =
            await invoke<DetectedWowFolder | null>("auto_detect_wow_folder");
          if (detected) {
            setAutoDetected(detected);
            setScreen("auto-detect");
          } else {
            setScreen("folder-select");
          }
        }
      } catch (e) {
        console.error("Failed to load saved folder:", e);
      } finally {
        setIsLoading(false);
        setSettingsLoaded(true);
      }
    }

    loadSavedFolder();
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (!selectedVersion) return;
    saveSelectedIcons(selectedVersion, drCategories);
  }, [drCategories, settingsLoaded, selectedVersion]);

  // Check for updates on app start
  useEffect(() => {
    async function checkForUpdates() {
      try {
        await info("Checking for updates...");
        const update = await check();
        if (update) {
          await info(`Update available: ${update.version}`);
          console.log(`Update available: ${update.version}`);
          setUpdateAvailable(update.version);
        } else {
          await info("No updates available");
        }
      } catch (e) {
        await logError(`Failed to check for updates: ${e}`);
        console.error("Failed to check for updates:", e);
      }
    }

    checkForUpdates();
  }, []);

  async function installUpdate() {
    setIsUpdating(true);
    try {
      await info("Starting update installation...");
      const update = await check();
      if (update) {
        await info(`Downloading and installing update ${update.version}...`);
        await update.downloadAndInstall();
        await info("Update downloaded and installed successfully");
        // Clear the update banner since download is complete
        setUpdateAvailable(null);
        // Try to relaunch - if this fails, user can manually restart
        try {
          await info("Attempting to relaunch application...");
          await relaunch();
        } catch (relaunchError) {
          await logError(`Relaunch failed: ${relaunchError}`);
          console.error(
            "Relaunch failed, please restart manually:",
            relaunchError,
          );
          // Update is installed, it will apply on next restart
        }
      }
    } catch (e) {
      await logError(`Failed to install update: ${e}`);
      console.error("Failed to install update:", e);
      setIsUpdating(false);
    }
  }

  // Save WoW folder when it changes
  async function saveWowFolder(folder: string) {
    try {
      const store = await Store.load("settings.json");
      await store.set("wowFolder", folder);
      await store.save();
    } catch (e) {
      console.error("Failed to save folder:", e);
    }
  }

  async function saveSelectedIcons(
    version: string,
    categories: DRCategory[],
  ) {
    try {
      const store = await Store.load("settings.json");
      const selections: Record<string, string> = {};
      categories.forEach((category) => {
        selections[category.id] = category.selectedIcon;
      });
      const existing =
        (await store.get<Record<string, Record<string, string>>>(
          "selectedIconsByVersion",
        )) ?? {};
      const updated = { ...existing, [version]: selections };
      await store.set("selectedIconsByVersion", updated);
      await store.save();
      setSelectedIconsByVersion(updated);
    } catch (e) {
      console.error("Failed to save selected icons:", e);
    }
  }

  function buildCategoriesForVersion(
    selections?: Record<string, string>,
  ): DRCategory[] {
    return initialDRCategories.map((category) => {
      const storedIcon = selections ? selections[category.id] : undefined;
      if (!storedIcon) {
        return { ...category, selectedIcon: category.defaultIcon };
      }
      const isDefault = storedIcon === category.defaultIcon;
      const isAlternative = category.alternatives.some(
        (alt) => alt.src === storedIcon,
      );
      return {
        ...category,
        selectedIcon: isDefault || isAlternative ? storedIcon : category.defaultIcon,
      };
    });
  }

  function getParentFolder(folderPath: string): string | null {
    const trimmed = folderPath.replace(/[\\/]+$/, "");
    const match = trimmed.match(/^(.*)[\\/][^\\/]+$/);
    if (!match) return null;
    return match[1] || null;
  }

  async function getWowVersions(folderPath: string): Promise<string[]> {
    return invoke<string[]>("get_wow_versions", { wowFolder: folderPath });
  }

  async function resolveWowFolder(
    folderPath: string,
  ): Promise<{ folder: string; versions: string[] } | null> {
    let current: string | null = folderPath;
    while (current) {
      const versions = await getWowVersions(current).catch(() => []);
      if (versions.length > 0) {
        return { folder: current, versions };
      }
      const next = getParentFolder(current);
      if (!next || next === current) {
        break;
      }
      current = next;
    }
    return null;
  }

  // Helper function to fetch image as base64 (handles TGA files)
  async function fetchImageAsBase64(imageSrc: string): Promise<string> {
    // Use tgaToBase64 for TGA files
    if (imageSrc.toLowerCase().includes(".tga")) {
      return tgaToBase64(imageSrc);
    }

    // For other formats, use standard approach
    const response = await fetch(imageSrc);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function selectWowFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select your World of Warcraft folder",
      });

      if (selected) {
        const folderPath = selected as string;
        setAutoDetected(null);
        setWowFolder(folderPath);
        setError("");

        // Get WoW versions from the selected folder or its parent
        const resolved = await resolveWowFolder(folderPath);
        if (!resolved) {
          setError(
            "No WoW version directories found. Please select a valid WoW folder (should contain directories like _retail_, _beta_, etc.)",
          );
          setVersions([]);
        } else {
          setWowFolder(resolved.folder);
          setVersions(resolved.versions);
          setScreen("version-select");
          // Save the folder for next time
          await saveWowFolder(resolved.folder);
        }
      }
    } catch (e) {
      setError(`Error: ${e}`);
    }
  }

  async function acceptAutoDetected() {
    if (!autoDetected) return;
    setWowFolder(autoDetected.folder);
    setVersions(autoDetected.versions);
    setScreen("version-select");
    setAutoDetected(null);
    await saveWowFolder(autoDetected.folder);
  }

  function rejectAutoDetected() {
    setAutoDetected(null);
    setWowFolder("");
    setVersions([]);
    setSelectedVersion("");
    setError("");
    setScreen("folder-select");
  }

  function selectVersion(version: string) {
    setSelectedVersion(version);
    const selections =
      selectedIconsByVersion[version] ?? selectedIconsByVersion.__legacy__;
    setDRCategories(buildCategoriesForVersion(selections));
    setScreen("dr-customize");
  }

  function goBack() {
    if (screen === "dr-customize") {
      setScreen("version-select");
    } else {
      setScreen("folder-select");
      setVersions([]);
      setSelectedVersion("");
    }
    setError("");
  }

  async function selectDRIcon(categoryId: string, iconSrc: string) {
    const category = drCategories.find((cat) => cat.id === categoryId);
    if (!category) return;

    // If selecting the default icon, reset instead
    if (iconSrc === category.defaultIcon) {
      await resetToDefault(categoryId);
      return;
    }

    setApplyingIcon(categoryId);
    setError("");

    try {
      // Fetch the image and convert to base64
      const base64Data = await fetchImageAsBase64(iconSrc);

      // Call the backend to apply the icon
      await invoke("apply_dr_icon", {
        wowFolder,
        version: selectedVersion,
        defaultIconName: category.defaultIconName,
        sourceIconData: base64Data,
      });

      // Update local state
      setDRCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId ? { ...cat, selectedIcon: iconSrc } : cat,
        ),
      );
      setExpandedCategory(null);
    } catch (e) {
      setError(`Failed to apply icon: ${e}`);
    } finally {
      setApplyingIcon(null);
    }
  }

  function toggleCategory(categoryId: string) {
    setExpandedCategory((prev) => (prev === categoryId ? null : categoryId));
  }

  async function resetToDefault(categoryId: string) {
    const category = drCategories.find((cat) => cat.id === categoryId);
    if (!category) return;

    setApplyingIcon(categoryId);
    setError("");

    try {
      // Call the backend to reset the icon
      await invoke("reset_dr_icon", {
        wowFolder,
        version: selectedVersion,
        defaultIconName: category.defaultIconName,
      });

      // Update local state
      setDRCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? { ...cat, selectedIcon: cat.defaultIcon }
            : cat,
        ),
      );
    } catch (e) {
      setError(`Failed to reset icon: ${e}`);
    } finally {
      setApplyingIcon(null);
    }
  }

  async function resetAllIcons() {
    setResettingAll(true);
    setError("");

    try {
      // Call the backend to remove the ICONS folder
      await invoke("reset_all_icons", {
        wowFolder,
        version: selectedVersion,
      });

      // Reset all categories to default in local state
      setDRCategories((prev) =>
        prev.map((cat) => ({ ...cat, selectedIcon: cat.defaultIcon })),
      );
    } catch (e) {
      setError(`Failed to reset all icons: ${e}`);
    } finally {
      setResettingAll(false);
    }
  }

  // Format version name for display (remove underscores and capitalize)
  function formatVersionName(version: string): string {
    return (
      version.replace(/_/g, "").charAt(0).toUpperCase() +
      version.replace(/_/g, "").slice(1)
    );
  }

  return (
    <main className="container">
      <div className="background-glow"></div>
      {updateAvailable && (
        <div className="update-banner">
          <span>Update v{updateAvailable} available!</span>
          <button
            className="update-btn"
            onClick={installUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? "Updating..." : "Update Now"}
          </button>
        </div>
      )}
      {isLoading && (
        <div className="loading-screen">
          <div className="logo-container">
            <img src={appLogo} alt="DR Logo" className="logo" />
          </div>
          <p className="description">Loading...</p>
        </div>
      )}
      {!isLoading && screen === "auto-detect" && autoDetected && (
        <div className="auto-detect-screen">
          <div className="logo-container small">
            <img src={appLogo} alt="DR Logo" className="logo" />
          </div>
          <h1>We found a World of Warcraft folder</h1>
          <p className="description">
            We scanned common install locations. If this looks right, click Use
            this folder. Otherwise choose a different location.
          </p>
          <div className="selected-path">
            <span className="path-icon">📁</span>
            <span className="path-text">{autoDetected.folder}</span>
          </div>
          <div className="detected-versions">
            Found versions: {autoDetected.versions.join(", ")}
          </div>
          <div className="detect-actions">
            <button className="select-folder-btn" onClick={acceptAutoDetected}>
              Use this folder
            </button>
            <button className="back-btn" onClick={rejectAutoDetected}>
              Choose different
            </button>
          </div>
        </div>
      )}
      {!isLoading && screen === "folder-select" && (
        <div className="folder-select-screen">
          <div
            className={`logo-container ${isHovering ? "hovering" : ""}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <img src={appLogo} alt="DR Logo" className="logo" />
          </div>
          <h1>DR Icon Changer</h1>
          <p className="description">
            Select your World of Warcraft installation folder to get started.
          </p>
          <button className="select-folder-btn" onClick={selectWowFolder}>
            <span className="btn-icon">📁</span>
            Select WoW Folder
          </button>
          {wowFolder && <p className="selected-path">Selected: {wowFolder}</p>}
          {error && <p className="error-message">{error}</p>}
        </div>
      )}

      {!isLoading && screen === "version-select" && (
        <div className="version-select-screen">
          <div className="logo-container small">
            <img src={appLogo} alt="DR Logo" className="logo" />
          </div>
          <h1>Select WoW Version</h1>
          <p className="description">
            Choose which version of WoW you want to work with:
          </p>
          <div className="selected-path valid">
            <span className="path-icon">📂</span>
            <span className="path-text">{wowFolder}</span>
            <span className="valid-checkmark">✓</span>
          </div>
          <div className="version-grid">
            {versions.map((version) => (
              <button
                key={version}
                className={`version-btn ${selectedVersion === version ? "selected" : ""}`}
                onClick={() => selectVersion(version)}
              >
                {formatVersionName(version)}
              </button>
            ))}
          </div>
          <button className="back-btn" onClick={goBack}>
            ← Back
          </button>
        </div>
      )}

      {!isLoading && screen === "dr-customize" && (
        <div className="dr-customize-screen">
          <div className="logo-container small">
            <img src={appLogo} alt="DR Logo" className="logo" />
          </div>
          <h1>Customize DR Icons</h1>
          <p className="description">
            Click on a category to change its icon. Changes are applied
            instantly to <strong>{formatVersionName(selectedVersion)}</strong>.
          </p>
          <div className="restart-notice">
            <strong>⚠️ Important:</strong> After changing icons, a{" "}
            <strong>full game restart</strong> is required. Using{" "}
            <code>/reload</code> will not apply the changes.
          </div>
          {error && <p className="error-message">{error}</p>}

          <div className="dr-categories">
            {drCategories.map((category) => (
              <div
                key={category.id}
                className={`dr-category ${expandedCategory === category.id ? "expanded" : ""} ${applyingIcon === category.id ? "applying" : ""}`}
              >
                <div
                  className="dr-category-header"
                  onClick={() => !applyingIcon && toggleCategory(category.id)}
                >
                  <div className="dr-icon-wrapper">
                    <TgaImage
                      src={category.selectedIcon}
                      alt={category.name}
                      className="dr-icon"
                    />
                    {applyingIcon === category.id && (
                      <span className="loading-badge">⏳</span>
                    )}
                    {applyingIcon !== category.id &&
                      category.selectedIcon !== category.defaultIcon && (
                        <span className="customized-badge">✓</span>
                      )}
                  </div>
                  <div className="dr-category-info">
                    <h3>{category.name}</h3>
                    <p>{category.description}</p>
                  </div>
                  <span className="expand-icon">
                    {expandedCategory === category.id ? "▼" : "▶"}
                  </span>
                </div>

                {expandedCategory === category.id && (
                  <div className="dr-alternatives">
                    <p className="alternatives-label">
                      Choose an icon (changes apply instantly):
                    </p>
                    <div className="alternatives-grid">
                      <div
                        className={`alternative-icon ${category.selectedIcon === category.defaultIcon ? "selected" : ""} ${applyingIcon ? "disabled" : ""}`}
                        onClick={() =>
                          !applyingIcon &&
                          selectDRIcon(category.id, category.defaultIcon)
                        }
                      >
                        <TgaImage src={category.defaultIcon} alt="Default" />
                        <span>Default</span>
                      </div>
                      {category.alternatives.map((alt, idx) => (
                        <div
                          key={idx}
                          className={`alternative-icon ${category.selectedIcon === alt.src ? "selected" : ""} ${applyingIcon ? "disabled" : ""}`}
                          onClick={() =>
                            !applyingIcon && selectDRIcon(category.id, alt.src)
                          }
                        >
                          <TgaImage src={alt.src} alt={alt.name} />
                          <span>{alt.name}</span>
                        </div>
                      ))}
                    </div>
                    {category.affectedAbilities.length > 0 && (
                      <div className="disclaimer-warning">
                        <strong>⚠️ Warning:</strong>
                        Changing this icon will also affect the appearance of:{" "}
                        {category.affectedAbilities.join(", ")}. This is because
                        they share the same base icon texture.
                      </div>
                    )}
                    {category.selectedIcon !== category.defaultIcon && (
                      <button
                        className="reset-btn"
                        disabled={!!applyingIcon}
                        onClick={(e) => {
                          e.stopPropagation();
                          resetToDefault(category.id);
                        }}
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="action-buttons">
            <button className="back-btn" onClick={goBack}>
              ← Back
            </button>
            <button
              className="reset-all-btn"
              onClick={resetAllIcons}
              disabled={resettingAll || !!applyingIcon}
            >
              {resettingAll ? "Resetting..." : "Reset All to Defaults"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
