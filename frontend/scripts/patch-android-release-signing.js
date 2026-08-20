/**
 * Expo prebuild release imzası debug keystore kullanır.
 * Codemagic CI'da CM_KEYSTORE_* ile release AAB/APK imzalamak için build.gradle patch'ler.
 */
const fs = require("fs");
const path = require("path");

const gradlePath = path.join(__dirname, "..", "android", "app", "build.gradle");
if (!fs.existsSync(gradlePath)) {
  console.error("android/app/build.gradle bulunamadı — önce expo prebuild çalıştırın.");
  process.exit(1);
}

let content = fs.readFileSync(gradlePath, "utf8");

if (content.includes("CM_KEYSTORE_PATH")) {
  console.log("Android release signing zaten yapılandırılmış.");
  process.exit(0);
}

const signingBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (System.getenv("CI") && System.getenv("CM_KEYSTORE_PATH")) {
                storeFile file(System.getenv("CM_KEYSTORE_PATH"))
                storePassword System.getenv("CM_KEYSTORE_PASSWORD")
                keyAlias System.getenv("CM_KEY_ALIAS")
                keyPassword System.getenv("CM_KEY_PASSWORD")
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }`;

content = content.replace(/    signingConfigs \{[\s\S]*?    \}/, signingBlock);
content = content.replace(
  /release \{\n            \/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
  `release {
            signingConfig signingConfigs.release`
);

fs.writeFileSync(gradlePath, content);
console.log("Codemagic release signing patch uygulandı.");
