const fs = require('fs');
const homedir = require('os').homedir();

const axios = require('axios').default;

const { getServerlessServices } = require('../../scripts/common');

if (!process.argv[2]) {
  throw new Error('Please provide an output path');
}

let apiKey = process.env.TWILIO_API_KEY;
let apiSecret = process.env.TWILIO_API_SECRET;
if (!apiKey || !apiSecret) {
  // Fall back to Twilio CLI profile if present
  try {
    const profileConfig = JSON.parse(fs.readFileSync(`${homedir}/.twilio-cli/config.json`, 'utf8'));
    if (profileConfig.activeProject && profileConfig.profiles) {
      const profile = profileConfig.profiles[profileConfig.activeProject];

      if (profile) {
        apiKey = profile.apiKey;
        apiSecret = profile.apiSecret;
      }
    }
  } catch (error) {
    console.log(error);
  }

  if (!apiKey || !apiSecret) {
    throw new Error('Please set the TWILIO_API_KEY and TWILIO_API_SECRET environment variables');
  }
}

console.log('Fetching serverless domain...');
const outputPath = `${process.argv[2]}`;
const domain = getServerlessServices()?.scheduledFunctionsDomain;
console.log('Fetching latest deployed config...');

if (domain) {
  axios
    .get(`https://${domain}/admin/fetch-config?apiKey=${apiKey}&apiSecret=${apiSecret}`)
    .then((response) => {
      if (response.status === 200) {
        fs.writeFileSync(outputPath, JSON.stringify(response.data, null, 2), 'utf8');
        console.log(`Saved latest deployed config to ${outputPath}`);
      } else {
        console.log('Unable to fetch data', response);
      }
    })
    .catch((error) => {
      console.log('Unable to fetch data', error);
    });
} else {
  console.log('Existing serverless domain not found; assuming new deployment');
}
