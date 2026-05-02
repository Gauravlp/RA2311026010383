const fs = require('fs');
const https = require('http'); // The URL is http://20.207.122.201

const registerData = JSON.stringify({
  email: "gt7661@srmist.du.in",
  name: "Gourav Kumar Thakur",
  mobileNo: "6378085445",
  githubUsername: "Gauravlp",
  rollNo: "RA2311026010383",
  accessCode: "QkbpxH"
});

const req = https.request({
  hostname: '20.207.122.201',
  port: 80,
  path: '/evaluation-service/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': registerData.length
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Registration Response:', data);
    try {
        const parsed = JSON.parse(data);
        if (parsed.clientID) {
            fs.writeFileSync('credentials.json', JSON.stringify(parsed, null, 2));
            console.log('Saved to credentials.json');
        }
    } catch(e) {
        console.error("Error parsing response", e);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(registerData);
req.end();
