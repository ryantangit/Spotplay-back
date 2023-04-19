const express = require('express');
require('dotenv').config()

//Creation of express object
const app = express();

//TODO: Not scalable at the moment. Will have to use a database to store for each user
let accessToken = "";
let refreshToken = "";

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

//Callback after Spotify authentication
app.get('/callback', async (req, res) => {
	const code = req.query.code || null;
	const state = req.query.code || null;
	if (state == null){
		res.redirect('/error');
	}
    let tokenHeaders = new Headers();
	tokenHeaders.append("Authorization", "Basic " + (new Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString("base64")));
	let tokenUrl = "https://accounts.spotify.com/api/token"
	let tokenBody = new URLSearchParams();
	tokenBody.append("code", code);
	tokenBody.append("redirect_uri", process.env.SPOTIFY_REDIRECT_URI);
	tokenBody.append("grant_type", "authorization_code");
	const authResponse = await fetch(tokenUrl, {method: "POST", headers: tokenHeaders, body: tokenBody});
	const authData = await authResponse.json();
	accessToken = authData.access_token;
	refreshToken = authData.refresh_token;
	res.redirect("/topfive");
});

//Testing getting top five albums
app.get("/topfive", async(req, res)=>{
	let trackUrl = "https://api.spotify.com/v1/me/top/tracks?";
	let topFiveHeaders = new Headers();
	topFiveHeaders.append("Authorization", "Bearer " + accessToken);
	let topFiveParams = new URLSearchParams();
	topFiveParams.append('limit', 5);

	let response = await fetch(trackUrl + topFiveParams, {method: "GET", headers: topFiveHeaders});
	let data = await response.json();
	res.send(data);
});

//Error
app.get('/error', (req, res)=> {
	res.send("An error has occured :(");
});

// localhost:3000
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
