const express = require('express');
const {MongoClient, ServerApiVersion} = require("mongodb");
require('dotenv').config()
//Creation of express object
const app = express();

//Creation of MONGOClient object
const mongoURI = `mongodb+srv://rtan:${process.env.MONGODB_PASSWORD}@cluster0.zlgkjb8.mongodb.net/?retryWrites=true&w=majority`;
const mongoClient = new MongoClient(mongoURI, {
	serverApi:{
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true
	}
});
mongoClient.connect();
console.log("Connected to MongoDB");

//Login and authenticate in Spotify
app.get('/login', (req, res)=> {
	const scope = "user-top-read user-read-private user-read-email";
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

//TODO store front-end url as the state for redirect
//Callback after Spotify authentication
app.get('/callback', async (req, res) => {

	//Retrieve access token and refresh token after receiving the authentication token
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

	//use spotify.UUID as the key to the MongoDB 
	const UUIDUri = "https://api.spotify.com/v1/me";
	const UUIDHeaders = new Headers();
	UUIDHeaders.append("Authorization", "Bearer " + authData.access_token);
	const UUIDResponse = await fetch(UUIDUri, {method: "GET", headers: UUIDHeaders});
	const UUIDData = await UUIDResponse.json();
	const spotifyDatabase = mongoClient.db("Spotplay-back");
	const UUIDCollection = spotifyDatabase.collection("UUID");
	const UUIDQuery = {UUID: UUIDData.id}; 
	const UUIDUpdate = {$set:{
		accessToken: authData.access_token,
		refreshToken: authData.refresh_token,
		expire: authData.expires_in
	}}
	const UUIDOption = {upsert: true};
	await UUIDCollection.updateOne(UUIDQuery, UUIDUpdate, UUIDOption);
	res.json({UUID: UUIDData.id});
});

//TODO middleware, take uuid as parameter, verify, access, probably can test with curl
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
