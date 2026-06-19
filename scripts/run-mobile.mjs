import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileDir = join(__dirname, "..", "apps", "mobile");
const command = process.argv[2];
const deviceArg = process.argv[3];

function candidateFlutterPaths() {
  const home = homedir();
  if (platform() === "win32") {
    return [
      process.env.FLUTTER_BIN,
      join(process.env.LOCALAPPDATA ?? "", "flutter", "bin", "flutter.bat"),
      join(process.env.USERPROFILE ?? "", "flutter", "bin", "flutter.bat"),
      "C:\\src\\flutter\\bin\\flutter.bat",
      "C:\\flutter\\bin\\flutter.bat",
    ];
  }

  return [
    process.env.FLUTTER_BIN,
    join(home, "development", "flutter", "bin", "flutter"),
    join(home, "flutter", "bin", "flutter"),
  ];
}

function flutterOnPath() {
  const checker = platform() === "win32" ? "where" : "which";
  const result = spawnSync(checker, ["flutter"], { encoding: "utf8", shell: platform() === "win32" });
  if (result.status === 0 && result.stdout.trim()) {
    return "flutter";
  }
  return null;
}

function resolveFlutterBin() {
  for (const candidate of candidateFlutterPaths()) {
    if (!candidate) continue;
    if (candidate === "flutter") continue;
    if (existsSync(candidate)) return candidate;
  }

  return flutterOnPath();
}

function printFlutterInstallHelp() {
  console.error("Flutter was not found on this machine.");
  console.error("");
  if (platform() === "win32") {
    console.error("Windows setup:");
    console.error("  1. Install Flutter: https://docs.flutter.dev/get-started/install/windows");
    console.error("  2. Or clone: git clone https://github.com/flutter/flutter.git -b stable C:\\src\\flutter");
    console.error("  3. Add to PATH: C:\\src\\flutter\\bin");
    console.error("  4. Install Android Studio for the Android emulator");
    console.error("  5. Run: flutter doctor");
    console.error("");
    console.error("Then retry: pnpm mobile:devices");
    console.error("Or set FLUTTER_BIN to the full path of flutter.bat");
  } else {
    console.error("Install Flutter 3.38.10+ and add it to PATH, or set FLUTTER_BIN.");
    console.error("See apps/mobile/README.md");
  }
}

function runFlutter(flutterBin, args) {
  const result = spawnSync(flutterBin, args, {
    cwd: mobileDir,
    stdio: "inherit",
    shell: platform() === "win32",
  });

  if (result.error) {
    console.error(`Failed to run Flutter: ${result.error.message}`);
    printFlutterInstallHelp();
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0 && flutterBin === "flutter") {
    printFlutterInstallHelp();
  }

  process.exit(result.status ?? 1);
}

if (!command || !["devices", "ios", "android"].includes(command)) {
  console.error("Usage: node scripts/run-mobile.mjs <devices|ios|android> [device-id]");
  process.exit(1);
}

const flutterBin = resolveFlutterBin();
if (!flutterBin) {
  printFlutterInstallHelp();
  process.exit(1);
}

if (command === "devices") {
  runFlutter(flutterBin, ["devices"]);
}

if (command === "ios" && platform() === "win32") {
  console.error("iOS Simulator requires macOS with Xcode installed.");
  console.error("On Windows, use: pnpm mobile:android");
  console.error("Or connect a device and run: flutter run -d <device-id>");
  process.exit(1);
}

runFlutter(flutterBin, ["pub", "get"]);

const deviceFlag =
  deviceArg ??
  (command === "ios" ? "ios" : command === "android" ? "android" : undefined);

if (!deviceFlag) {
  console.error("Missing device target.");
  process.exit(1);
}

runFlutter(flutterBin, ["run", "-d", deviceFlag]);
