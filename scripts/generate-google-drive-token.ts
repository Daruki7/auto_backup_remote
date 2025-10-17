/**
 * Google Drive OAuth2 Token Generator
 *
 * This script helps you generate OAuth2 token for Google Drive API
 *
 * Prerequisites:
 * 1. Download credentials.json from Google Cloud Console
 * 2. Place it in credentials/credentials.json
 * 3. Run this script: yarn generate-token
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as readline from 'readline';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const CREDENTIALS_PATH = 'credentials/credentials.json';
const TOKEN_PATH = 'credentials/token.json';

async function generateToken() {
  console.log('🔑 Google Drive OAuth2 Token Generator\n');

  // Check if credentials file exists
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`❌ Credentials file not found: ${CREDENTIALS_PATH}`);
    console.log('\n📝 Steps to get credentials.json:');
    console.log('1. Go to https://console.cloud.google.com/');
    console.log('2. Create or select a project');
    console.log('3. Enable Google Drive API');
    console.log('4. Create OAuth 2.0 Client ID credentials');
    console.log('5. Download JSON and save as credentials/credentials.json');
    console.log('6. Run this script again\n');
    process.exit(1);
  }

  // Load credentials
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const oauth2Credentials = credentials.installed || credentials.web;

  if (!oauth2Credentials) {
    console.error('❌ Invalid credentials format');
    console.log(
      'Expected OAuth2 client credentials with "installed" or "web" key',
    );
    process.exit(1);
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    oauth2Credentials.client_id,
    oauth2Credentials.client_secret,
    oauth2Credentials.redirect_uris[0],
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('📋 Steps to authorize:');
  console.log('\n1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Authorize the application');
  console.log('3. Copy the authorization code from the URL\n');

  // Get authorization code from user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('4. Paste the authorization code here: ', async (code) => {
    rl.close();

    try {
      // Exchange code for token
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Save token to file
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

      console.log('\n✅ Token generated successfully!');
      console.log(`📁 Saved to: ${TOKEN_PATH}`);
      console.log('\n🎉 You can now use Google Drive upload!');
      console.log('\n📝 Next steps:');
      console.log('1. Set in .env: GOOGLE_DRIVE_ENABLED=true');
      console.log('2. Start app: yarn dev');
      console.log('3. Test backup with Google Drive enabled\n');
    } catch (error) {
      console.error('\n❌ Error generating token:', error.message);
      console.log('\nPlease try again with the correct authorization code');
      process.exit(1);
    }
  });
}

generateToken();
