import { GOOGLE_APIS, CLIENT, REDIRECT_URL, GOOGLE_PEOPLE } from './config.js';
import { readCookie, parseJwt } from './helpers.js';

const requestUrl = GOOGLE_APIS;
// let sub;

const data = {
  code: readCookie("code"),
  client_id: CLIENT.CLIENT_ID,
  client_secret: CLIENT.CLIENT_SECRET,
  redirect_uri: `${REDIRECT_URL}/oauth`,
  grant_type: "authorization_code"
};

fetch(requestUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(res => res.json())
.then(result => {
  const token = result.access_token;
  const type = result.token_type;
  const authorization = `${type} ${token}`;

  const id_token = result.id_token;
  document.cookie = `id_token=${id_token}; max-age=3600;`;

  // Decode JWT to get a sub
  // const decodedToken = parseJwt(id_token);
  // console.log(decodedToken);
  // sub = decodedToken.sub;

  // GET request to google people api
  return fetch(GOOGLE_PEOPLE, {
    method: 'GET',
    headers: { 'Authorization': authorization },
  })
})
.then(res => res.json())
.then(result => {
  // It turned out that sub on JWT and the result returns sub
  // Don't need to decode JWT and store sub value to global variable, sub

  const data = {
    first: result.names[0].givenName,
    last: result.names[0].familyName,
    sub: result.names[0].metadata.source.id,
    email: result.emailAddresses[0].value
  };

  document.getElementById("first").innerHTML = `First Name: ${data.first}`;
  document.getElementById("last").innerHTML = `Last Name: ${data.last}`;
  document.getElementById("id_token").innerHTML = `id_token (JWT): ${readCookie("id_token")}`;
  document.getElementById("unique_id").innerHTML = `Unique ID (sub): ${data.sub}`;
  document.getElementById("email").innerHTML = `Email Address: ${data.email}`;

  // Save a user's data to datastore
  return fetch(`${REDIRECT_URL}/users/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: result.names[0].displayName,
      sub: data.sub,
      email: data.email
    })
  });
})
.catch(error => {
  console.log('Error', error);
});
