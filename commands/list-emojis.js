const EMOJI_LIMITS = require('../constants/emojiLimits.js');

module.exports = {
	command: 'list-emojis',
	aliases: [],
	description: 'See all custom emojis of the server.',
	usage: '',
	ownerOnly: false,
	adminOnly: false,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		const placeholder = message.client.emojis.get(process.env.PLACEHOLDER_EMOJI);
		const maxEmojis = EMOJI_LIMITS[message.guild.premiumTier];

		const guildEmojis = message.guild.emojis.filter(e => !e.animated);
		const guildAniEmojis = message.guild.emojis.filter(e => e.animated);

		const emojis = guildEmojis.array().concat(Array(maxEmojis - guildEmojis.size).fill(placeholder)).map(e => String(e));
		const aniEmojis = guildAniEmojis.array().concat(Array(maxEmojis - guildAniEmojis.size).fill(placeholder)).map(e => String(e));

		await message.channel.send(`__**Emojis**__\n${guildEmojis.size}/${maxEmojis} used`);
		for (let i = 0; i < emojis.length; i += 20) {
			await message.channel.send(emojis.slice(i, i + 10).join('') + '\n' + emojis.slice(i + 10, i + 20).join(''));
		}

		await message.channel.send(`__**Animated Emojis**__\n${guildAniEmojis.size}/${maxEmojis} used`);
		for (let i = 0; i < aniEmojis.length; i += 20) {
			await message.channel.send(aniEmojis.slice(i, i + 10).join('') + '\n' + aniEmojis.slice(i + 10, i + 20).join(''));
		}
	},
};
