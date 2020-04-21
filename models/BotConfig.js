const mongoose = require('mongoose');

const schema = mongoose.Schema({
	youtubeAvatarHash: String,
});

module.exports = mongoose.model('BotConfig', schema, 'botconfig');
