const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) n += copyDir(from, to);
    else {
      fs.copyFileSync(from, to);
      n += 1;
    }
  }
  return n;
}

const fontSrc = path.join(
  __dirname,
  "../frontend/dist/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts"
);
const fontDest = path.join(__dirname, "../frontend/dist/fonts");
if (fs.existsSync(fontSrc)) {
  fs.mkdirSync(fontDest, { recursive: true });
  for (const file of fs.readdirSync(fontSrc)) {
    fs.copyFileSync(path.join(fontSrc, file), path.join(fontDest, file));
  }
  console.log(`copy-web-fonts: copied ${fs.readdirSync(fontDest).length} files to /fonts`);
} else {
  console.warn("copy-web-fonts: source fonts missing, skip");
}

const pub = path.join(__dirname, "../frontend/public");
const dist = path.join(__dirname, "../frontend/dist");
const copied = copyDir(pub, dist);
console.log(`copy-public: copied ${copied} files into dist`);
