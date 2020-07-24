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
		const locked = message.client.emojis.get(process.env.LOCKED_EMOJI);

		const maxEmojis = EMOJI_LIMITS[message.guild.premiumTier];

		const guildEmojis = message.guild.emojis.filter(e => !e.animated);
		const guildAniEmojis = message.guild.emojis.filter(e => e.animated);

		const emojis = guildEmojis.array().map(e => (e.available ? e : locked)).concat(Array(Math.max(maxEmojis - guildEmojis.size, 0)).fill(placeholder)).map(e => String(e));
		const aniEmojis = guildAniEmojis.array().map(e => (e.available ? e : locked)).concat(Array(Math.max(maxEmojis - guildAniEmojis.size, 0)).fill(placeholder)).map(e => String(e));

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
