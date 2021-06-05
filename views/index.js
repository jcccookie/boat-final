import { CLIENT, OAUTH_PROVIDER, REDIRECT_URL } from './config.js';
import { generateState, readCookie } from './helpers.js';

document.getElementById("myButton").addEventListener("click", async () => {
  // create a random state

  document.cookie = `sid=${generateState(30)}; max-age=3600;`;

  // Request for profile and email address
  const requestUrl = `${OAUTH_PROVIDER}?response_type=code&client_id=${CLIENT.CLIENT_ID}&redirect_uri=${REDIRECT_URL}/oauth&scope=profile email&state=${readCookie("sid")}`;

  window.location.href = requestUrl;

  fetch(requestUrl, { mode: "no-cors" });
});