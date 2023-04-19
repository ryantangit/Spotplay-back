const express = require('express');
require('dotenv').config()

//Creation of express object
const app = express();

//Login and authenticate in Spotify
app.get('/login', (req, res)=> {
	const scope = "user-top-read";
	const state = generateRandomString(16);
	const authUrl = "https://accounts.spotify.com/authorize?";
	const authSearchParam = new URLSearchParams();
	authSearchParam.append("client_id", process.env.SPOTIFY_CLIENT_ID);
	authSearchParam.append("response_type", "code");
	authSearchParam.append("redirect_uri", process.env.SPOTIFY_REDIRECT_URI);
	authSearchParam.append("scope", scope);
	authSearchParam.append("state", state)
	res.redirect(authUrl + authSearchParam.toString());
});

app.get('/callback', (req, res) => {
	res.send("hello world");
});

const port = 3000;
app.listen(port, ()=>{
	console.log(`Server is listening on port ${port}`);
});

//Helper Functions
function generateRandomString(length) {
  let text = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
