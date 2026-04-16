const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'android/app/src/main/AndroidManifest.xml');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('android:scheme="tel"')) {
  const insertIndex = content.indexOf('</queries>');
  if (insertIndex !== -1) {
    const urlsToInject = `
        <intent>
            <action android:name="android.intent.action.DIAL" />
            <data android:scheme="tel" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SENDTO" />
            <data android:scheme="smsto" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="http" />
        </intent>
    `;
    content = content.slice(0, insertIndex) + urlsToInject + content.slice(insertIndex);
    fs.writeFileSync(file, content);
    console.log('Fixed AndroidManifest queries.');
  }
}
