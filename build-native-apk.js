const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('Daraga ResponD - Native Android APK Compiler');
console.log('App ID: ph.gov.daraga.respond');
console.log('====================================================');

try {
  console.log('1. Syncing Web Assets to Android Project...');
  execSync('npx cap sync android', { stdio: 'inherit', cwd: __dirname });

  console.log('2. Native Android Project Directory created at:');
  console.log(path.join(__dirname, 'android'));
  
  console.log('\n✅ Native Android Project Ready!');
  console.log('To build signed APK / AAB bundles:');
  console.log('• Open Android Studio: npx cap open android');
  console.log('• Or run Gradle: cd android && ./gradlew assembleRelease');
  console.log('====================================================');
} catch (err) {
  console.error('Build step failed:', err.message);
}
