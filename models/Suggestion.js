const mongoose = require('mongoose');

const schema = mongoose.Schema({
	guildId: String,
	channelId: String,
	messageId: String,
	endTime: Date,
});

module.exports = mongoose.model('Suggestion', schema, 'suggestions');
