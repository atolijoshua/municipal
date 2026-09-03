const localtunnel = require('localtunnel');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 8000, subdomain: 'daraga-respond', host: 'https://localtunnel.me' });
    console.log('====================================================');
    console.log(`YOUR OFFICIAL CUSTOM LINK IS LIVE!`);
    console.log(`URL: ${tunnel.url}`);
    console.log('====================================================');
  } catch (err) {
    console.error('Localtunnel Error:', err.message);
  }
})();
