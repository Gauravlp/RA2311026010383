import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getAuthToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const credentialsPath = path.join(__dirname, '../credentials.json');
        const credsStr = fs.readFileSync(credentialsPath, 'utf8');
        const credentials = JSON.parse(credsStr);

        const response = await axios.post('http://20.207.122.201/evaluation-service/auth', {
            email: credentials.email,
            name: credentials.name,
            rollNo: credentials.rollNo,
            accessCode: credentials.accessCode,
            clientId: credentials.clientID,
            clientSecret: credentials.clientSecret
        });

        cachedToken = response.data.access_token;
        if (response.data.expires_in) {
            tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 5000;
        }
        
        console.log('Successfully acquired new token.');
        return cachedToken as string;
    } catch (error) {
        console.error('Error getting auth token:', error);
        throw error;
    }
}