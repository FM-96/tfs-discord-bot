const {COLORS} = require('../constants/suggestions.js');

const suggestionChannels = {};
for (const guildConfig of process.env.SUGGESTION_CHANNELS.split(',')) {
	const [guild, channel] = guildConfig.split(':');
	suggestionChannels[guild] = channel;
}

module.exports = {
	command: 'list-suggestions',
	aliases: [],
	description: null,
	usage: null,
	ownerOnly: false,
	adminOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		if (!suggestionChannels[message.guild.id] || !message.client.channels.get(suggestionChannels[message.guild.id])) {
			return;
		}

		const messages = await getChannelHistory(message.client.channels.get(suggestionChannels[message.guild.id]));

		const acceptedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.ACCEPTED);
		const closedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.CLOSED);
		const openSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.OPEN);
		const rejectedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.REJECTED);
		const implementedSuggestions = messages.filter(e => isValidSuggestion(e) && e.embeds[0].color === COLORS.IMPLEMENTED);

		let text = '';
		text += `**__Closed Suggestions:__** ${closedSuggestions.length}\n`;
		text += closedSuggestions.map((e, i) => `\`C${i + 1}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
		text += '\n';

		text += `**__Accepted Suggestions:__** ${acceptedSuggestions.length}\n`;
		text += acceptedSuggestions.map((e, i) => `\`A${i + 1}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
		text += '\n';

		text += `**__Open Suggestions:__** ${openSuggestions.length}\n`;
		text += openSuggestions.map((e, i) => `\`O${i + 1}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
		text += '\n';

		if (message.content.slice(context.argsOffset).trim().toLowerCase().startsWith('all')) {
			text += `**__Rejected Suggestions:__** ${rejectedSuggestions.length}\n`;
			text += rejectedSuggestions.map((e, i) => `\`R${i + 1}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
			text += '\n';

			text += `**__Implemented Suggestions:__** ${implementedSuggestions.length}\n`;
			text += implementedSuggestions.map((e, i) => `\`I${i + 1}\` ${shorten(e.embeds[0].description)}\n${e.url}`).join('\n');
			text += '\n';
		}

		await message.channel.send(text, {split: true});
	},
};

/**
 * Fetches all messages from a channel
 * @param {*} channel The channel to fetch the messages in
 * @returns {Promise.<Array.<Object>>} An array of all fetched messages
 */
async function getChannelHistory(channel) {
	const result = [];
	let lastMessage;
	let done = false;

	do {
		const options = {limit: 100};
		options.before = lastMessage;

		const messages = await channel.fetchMessages(options);
		if (messages.size) {
			result.push(...messages.values());
			lastMessage = messages.lastKey();
		} else {
			done = true;
		}
	} while (!done);

	return result;
}

function shorten(string) {
	let shortened = string.slice(0, 80);
	if (shortened.includes('\n')) {
		shortened = shortened.split('\n')[0];
	}
	if (shortened !== string) {
		shortened += '…';
	}
	return shortened;
}

function isValidSuggestion(message) {
	return message.embeds[0] && message.embeds[0].title === 'Suggestion' && message.embeds[0].description;
}
