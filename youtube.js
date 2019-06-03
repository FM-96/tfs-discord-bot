const {google} = require('googleapis');

module.exports = google.youtube({
	version: 'v3',
	auth: process.env.YOUTUBE_API_KEY,
});
