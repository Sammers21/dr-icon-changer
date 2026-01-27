import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Store } from "@tauri-apps/plugin-store";
import "./App.css";
import { TgaImage, tgaToBase64 } from "./TgaImage";

// Import default DR icons
import stunDefault from "./assets/default-drs/spell_frost_stun.tga";
import incapDefault from "./assets/default-drs/spell_holy_dizzy.tga";
import fearDefault from "./assets/default-drs/spell_nature_astralrecalgroup.tga";
import rootDefault from "./assets/default-drs/spell_nature_stranglevines.tga";

// Import alternative icons - Stun
import stunAlt1 from "./assets/alternative-stun/ability_rogue_kidneyshot.tga";
import stunAlt2 from "./assets/alternative-stun/ability_CheapShot.tga";

// Import alternative icons - Incap (sheep)
import incapAlt1 from "./assets/alternaitve-incap/spell_nature_polymorph.tga";
import incapAlt2 from "./assets/alternaitve-incap/spell_frost_chainsofice.tga";

// Import alternative icons - Fear
import fearAlt1 from "./assets/alternative-fear/spell_shadow_possession.tga";

// Import alternative icons - Root
import rootAlt1 from "./assets/alternative-root/spell_frost_frostnova.tga";

// Import app logo
import appLogo from "./assets/app-logo.png";

type Screen = "folder-select" | "version-select" | "dr-customize";

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
    ],
    selectedIcon: stunDefault,
    affectedAbilities: ["Concussive Shot (Hunter)", "Concussion Blow", "War Stomp", "and other stun-related abilities"],
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
    ],
    selectedIcon: incapDefault,
    affectedAbilities: ["Repentance", "Gouge", "Sap", "and other incapacitate abilities"],
  },
  {
    id: "fear",
    name: "Fear",
    description: "Fear effects (Psychic Scream, Howl of Terror, etc.)",
    defaultIcon: fearDefault,
    defaultIconName: "Spell_Nature_AstralRecalGroup.tga",
    alternatives: [
      { src: fearAlt1, name: "Possession" },
    ],
    selectedIcon: fearDefault,
    affectedAbilities: ["Intimidating Shout", "Psychic Scream", "Howl of Terror", "and other fear abilities"],
  },
  {
    id: "root",
    name: "Root",
    description: "Root effects (Entangling Roots, Frost Nova, etc.)",
    defaultIcon: rootDefault,
    defaultIconName: "Spell_Nature_StrangleVines.tga",
    alternatives: [
      { src: rootAlt1, name: "Frost Nova" },
    ],
    selectedIcon: rootDefault,
    affectedAbilities: ["Entangling Roots", "Mass Entanglement", "Earthbind Totem", "and other root abilities"],
  },
];

function App() {
  const [screen, setScreen] = useState<Screen>("folder-select");
  const [wowFolder, setWowFolder] = useState<string>("");
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [drCategories, setDRCategories] = useState<DRCategory[]>(initialDRCategories);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [applyingIcon, setApplyingIcon] = useState<string | null>(null);
  const [resettingAll, setResettingAll] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load saved WoW folder on app start
  useEffect(() => {
    async function loadSavedFolder() {
      try {
        const store = await Store.load("settings.json");
        const savedFolder = await store.get<string>("wowFolder");
        
        if (savedFolder) {
          setWowFolder(savedFolder);
          // Try to get versions for the saved folder
          const detectedVersions = await invoke<string[]>("get_wow_versions", {
            wowFolder: savedFolder,
          });
          
          if (detectedVersions.length > 0) {
            setVersions(detectedVersions);
            setScreen("version-select");
          }
        }
      } catch (e) {
        console.error("Failed to load saved folder:", e);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadSavedFolder();
  }, []);

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
        setWowFolder(folderPath);
        setError("");

        // Get WoW versions from the selected folder
        const detectedVersions = await invoke<string[]>("get_wow_versions", {
          wowFolder: folderPath,
        });

        if (detectedVersions.length === 0) {
          setError(
            "No WoW version directories found. Please select a valid WoW folder (should contain directories like _retail_, _beta_, etc.)"
          );
          setVersions([]);
        } else {
          setVersions(detectedVersions);
          setScreen("version-select");
          // Save the folder for next time
          await saveWowFolder(folderPath);
        }
      }
    } catch (e) {
      setError(`Error: ${e}`);
    }
  }

  function selectVersion(version: string) {
    setSelectedVersion(version);
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
          cat.id === categoryId ? { ...cat, selectedIcon: iconSrc } : cat
        )
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
          cat.id === categoryId ? { ...cat, selectedIcon: cat.defaultIcon } : cat
        )
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
        prev.map((cat) => ({ ...cat, selectedIcon: cat.defaultIcon }))
      );
    } catch (e) {
      setError(`Failed to reset all icons: ${e}`);
    } finally {
      setResettingAll(false);
    }
  }

  // Format version name for display (remove underscores and capitalize)
  function formatVersionName(version: string): string {
    return version.replace(/_/g, "").charAt(0).toUpperCase() + version.replace(/_/g, "").slice(1);
  }

  return (
    <main className="container">
      <div className="background-glow"></div>
      {isLoading && (
        <div className="loading-screen">
          <div className="logo-container">
            <img src={appLogo} alt="DR Logo" className="logo" />
          </div>
          <p className="description">Loading...</p>
        </div>
      )}
      {!isLoading && screen === "folder-select" && (
        <div className="folder-select-screen">
          <div 
            className={`logo-container ${isHovering ? 'hovering' : ''}`}
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
          {wowFolder && (
            <p className="selected-path">Selected: {wowFolder}</p>
          )}
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
          <p className="selected-path">
            <span className="path-icon">📂</span>
            {wowFolder}
          </p>
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
            Click on a category to change its icon. Changes are applied instantly to{" "}
            <strong>{formatVersionName(selectedVersion)}</strong>.
          </p>
          <div className="restart-notice">
            <strong>⚠️ Important:</strong> After changing icons, a <strong>full game restart</strong> is required. 
            Using <code>/reload</code> will not apply the changes.
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
                    {applyingIcon !== category.id && category.selectedIcon !== category.defaultIcon && (
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
                    <p className="alternatives-label">Choose an icon (changes apply instantly):</p>
                    <div className="alternatives-grid">
                      <div
                        className={`alternative-icon ${category.selectedIcon === category.defaultIcon ? "selected" : ""} ${applyingIcon ? "disabled" : ""}`}
                        onClick={() => !applyingIcon && selectDRIcon(category.id, category.defaultIcon)}
                      >
                        <TgaImage src={category.defaultIcon} alt="Default" />
                        <span>Default</span>
                      </div>
                      {category.alternatives.map((alt, idx) => (
                        <div
                          key={idx}
                          className={`alternative-icon ${category.selectedIcon === alt.src ? "selected" : ""} ${applyingIcon ? "disabled" : ""}`}
                          onClick={() => !applyingIcon && selectDRIcon(category.id, alt.src)}
                        >
                          <TgaImage src={alt.src} alt={alt.name} />
                          <span>{alt.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="disclaimer-warning">
                      <strong>⚠️ Warning:</strong>
                      Changing this icon will also affect the appearance of: {category.affectedAbilities.join(", ")}. 
                      This is because they share the same base icon texture.
                    </div>
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
