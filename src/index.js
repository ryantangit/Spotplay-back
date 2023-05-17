const express = require('express');
const {MongoClient, ServerApiVersion} = require("mongodb");
const path = require("node:path");
const cors = require("cors");
require('dotenv').config({path: __dirname+"/.env"})
//Creation of express object
const app = express();
app.use(cors({origin: 'http://localhost:3001'}));

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
	let tokenParams = new URLSearchParams();
	tokenParams.append("code", code);
	tokenParams.append("redirect_uri", process.env.SPOTIFY_REDIRECT_URI);
	tokenParams.append("grant_type", "authorization_code");
	const authResponse = await fetch(tokenUrl, {method: "POST", headers: tokenHeaders, body: tokenParams});
    const authData = await authResponse.json();

	//use spotify.UUID as the key to the MongoDB 
	const uuidUri = "https://api.spotify.com/v1/me";
	const uuidHeaders = new Headers();
	uuidHeaders.append("Authorization", "Bearer " + authData.access_token);
	const uuidResponse = await fetch(uuidUri, {method: "GET", headers: uuidHeaders});
	const uuidData = await uuidResponse.json();
	
	await storingTokens(uuidData.id, authData.access_token, authData.refresh_token, authData.expires_in);
	res.redirect(`http://localhost:3001/User?uuid=${uuidData.id}`);
});

//TODO Clean up the data that gets sent, refer to SpotifyAPI for more information
//Testing getting top five albums
app.get("/topfivetracks/:uuid", uuidTokenProcess, async(req, res)=>{
	let trackUrl = "https://api.spotify.com/v1/me/top/tracks?";
	let topFiveHeaders = new Headers();
	topFiveHeaders.append("Authorization", req.headers.Authorization);
	let topFiveParams = new URLSearchParams();
	topFiveParams.append('limit', 5);
	let response = await fetch(trackUrl + topFiveParams.toString(), {method: "GET", headers: topFiveHeaders});
	let data = await response.json();
	res.json(extractNTopTrackEntries(data, 5));
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

//Middleware Functions
async function uuidTokenProcess(req, res, next) {
	const tokens = await retrieveTokens(req.params.uuid);
	let accessToken = tokens.accessToken
	if (tokens.accessToken == null){
		res.redirect("/error")
	}
	//If the MongoDB password is outdated, request a new one, then put in the database
	if (tokens.expire <= Date.now()){
		const refreshData = await requestNewAccessToken(tokens.refreshToken);
		accessToken = refreshData.access_token;
		storingTokens(req.params.uuid, accessToken, tokens.refreshToken, refreshData.expires_in)
	}
	req.headers.Authorization = `Bearer ${accessToken}`
	next();
}

//MongoDB Helper Functions ------------------------------------------------------------------------------
async function storingTokens(uuid, accessToken, refreshToken, duration){	
	const spotifyDatabase = mongoClient.db("Spotplay-back");
	const uuidCollection = spotifyDatabase.collection("UUID");
	const uuidQuery = {UUID: uuid}; 
	const uuidUpdate = {$set:{
		accessToken: accessToken,
		refreshToken: refreshToken,
		expire: Date.now() + (duration * 1000)
	}}
	const uuidOption = {upsert: true};
	await uuidCollection.updateOne(uuidQuery, uuidUpdate, uuidOption);
}
async function retrieveTokens(uuid){
	const spotifyDatabase = mongoClient.db("Spotplay-back");
	const uuidCollection = spotifyDatabase.collection("UUID");
	const uuidFoundOne = await uuidCollection.findOne({UUID: `${uuid}`});
	return uuidFoundOne;		
}
//MongoDB Helper Functions END---------------------------------------------------------------------------

//Spotify Helper Functions ------------------------------------------------------------------------------
async function requestNewAccessToken(refreshToken){
	let tokenHeaders = new Headers();
	tokenHeaders.append("Authorization", "Basic " + (new Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString("base64")));
	let tokenUrl = "https://accounts.spotify.com/api/token"
	let tokenParams = new URLSearchParams();
	tokenParams.append("refresh_token", refreshToken);
	tokenParams.append("grant_type", "refresh_token");
	const refreshResponse = await fetch(tokenUrl, {method: "POST", headers: tokenHeaders, body: tokenParams});
	const refreshData = await refreshResponse.json();
	return refreshData;
}
//Spotify Helper Functions END---------------------------------------------------------------------------

//Utility Functions
function generateRandomString(length) {
  let text = '';
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function extractNTopTrackEntries(trackData, n){
	const topFiveArray = [];
	for (let i = 0; i < n; i++){
		const trackName = trackData.items[i].name;
		const trackArtists = trackData.items[i].artists;
		const trackAlbum = trackData.items[i].album;
		topFiveArray.push({name: trackName, artists: trackArtists, album: trackAlbum});
	}
	return JSON.stringify(topFiveArray);
}
