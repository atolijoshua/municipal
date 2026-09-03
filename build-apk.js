const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('Daraga ResponD - Android APK Package Generator');
console.log('====================================================');

const capacitorConfig = {
  appId: 'gov.albay.daraga.respond',
  appName: 'Daraga ResponD',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    url: 'http://192.168.8.46:8000',
    cleartext: true
  }
};

fs.writeFileSync(
  path.join(__dirname, 'capacitor.config.json'),
  JSON.stringify(capacitorConfig, null, 2)
);

console.log('✅ Generated capacitor.config.json for Daraga ResponD!');
console.log('');
console.log('To build Android APK file on your computer:');
console.log('1. Run: npx @capacitor/cli create-android-project');
console.log('2. Run: npx @capacitor/cli build android');
console.log('====================================================');
