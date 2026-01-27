use std::fs;
use std::path::Path;

/// Get WoW version directories from a given WoW folder path.
/// Returns directories that match the pattern _*_ (like _retail_, _beta_, etc.)
#[tauri::command]
fn get_wow_versions(wow_folder: &str) -> Result<Vec<String>, String> {
    let path = Path::new(wow_folder);

    if !path.exists() {
        return Err("Folder does not exist".to_string());
    }

    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut versions: Vec<String> = Vec::new();

    match fs::read_dir(path) {
        Ok(entries) => {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        if let Some(name) = entry.file_name().to_str() {
                            // Check if directory name matches _*_ pattern
                            if name.starts_with('_') && name.ends_with('_') && name.len() > 2 {
                                versions.push(name.to_string());
                            }
                        }
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }

    versions.sort();
    Ok(versions)
}

/// Apply a DR icon change by copying the source icon to the WoW Interface/ICONS folder
/// with the name of the default icon.
///
/// - wow_folder: The WoW installation folder
/// - version: The WoW version directory (e.g., "_retail_")
/// - default_icon_name: The filename of the default icon (e.g., "spell_frost_stun.jpg")
/// - source_icon_data: Base64 encoded image data of the icon to apply
#[tauri::command]
async fn apply_dr_icon(
    wow_folder: String,
    version: String,
    default_icon_name: String,
    source_icon_data: String,
) -> Result<String, String> {
    // Build the target path: wowFolder/version/Interface/ICONS/
    let interface_path = Path::new(&wow_folder)
        .join(&version)
        .join("Interface")
        .join("ICONS");

    // Create the ICONS directory if it doesn't exist
    if !interface_path.exists() {
        fs::create_dir_all(&interface_path)
            .map_err(|e| format!("Failed to create ICONS directory: {}", e))?;
    }

    // Decode base64 image data
    let image_data = base64_decode(&source_icon_data)
        .map_err(|e| format!("Failed to decode image data: {}", e))?;

    // Write the icon file with the default icon's name
    let target_file = interface_path.join(&default_icon_name);
    fs::write(&target_file, image_data).map_err(|e| format!("Failed to write icon file: {}", e))?;

    Ok(format!("Icon applied successfully to {:?}", target_file))
}

/// Reset a DR icon by removing the custom icon file from the WoW Interface/ICONS folder
#[tauri::command]
async fn reset_dr_icon(
    wow_folder: String,
    version: String,
    default_icon_name: String,
) -> Result<String, String> {
    let target_file = Path::new(&wow_folder)
        .join(&version)
        .join("Interface")
        .join("ICONS")
        .join(&default_icon_name);

    if target_file.exists() {
        fs::remove_file(&target_file).map_err(|e| format!("Failed to remove icon file: {}", e))?;
        Ok(format!(
            "Icon reset successfully, removed {:?}",
            target_file
        ))
    } else {
        Ok("Icon was already at default".to_string())
    }
}

/// Reset all icons by removing the entire ICONS folder from the WoW Interface directory
#[tauri::command]
async fn reset_all_icons(wow_folder: String, version: String) -> Result<String, String> {
    let icons_folder = Path::new(&wow_folder)
        .join(&version)
        .join("Interface")
        .join("ICONS");

    if icons_folder.exists() {
        fs::remove_dir_all(&icons_folder)
            .map_err(|e| format!("Failed to remove ICONS folder: {}", e))?;
        Ok(format!(
            "All icons reset successfully, removed {:?}",
            icons_folder
        ))
    } else {
        Ok("ICONS folder does not exist, nothing to reset".to_string())
    }
}

/// Simple base64 decoder
fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    let base64_str = if let Some(pos) = input.find(",") {
        &input[pos + 1..]
    } else {
        input
    };

    use base64::{engine::general_purpose::STANDARD, Engine as _};
    STANDARD.decode(base64_str).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_wow_versions,
            apply_dr_icon,
            reset_dr_icon,
            reset_all_icons
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
