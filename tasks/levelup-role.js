const discord = require('discord.js');

const levelUpConfig = {};
for (const guildConfig of process.env.LEVELUP_ROLES.split(',')) {
	const [guild, roles] = guildConfig.split(':');
	levelUpConfig[guild] = {};
	for (const roleConfig of roles.split(' ')) {
		const [level, role] = roleConfig.split('=');
		levelUpConfig[guild][level] = role;
	}
}

const loggingChannels = {};
for (const guildConfig of process.env.LOGGING_CHANNELS.split(',')) {
	const [guild, channel] = guildConfig.split(':');
	loggingChannels[guild] = channel;
}

module.exports = {
	name: 'levelup-role',
	limited: false,
	ownerOnly: false,
	adminOnly: false,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: true,
	botsOnly: false,
	allowSelf: false,
	test: async message => message.author.id === process.env.LEVELUP_BOT && message.guild && levelUpConfig[message.guild.id],
	run: async (message, context) => {
		const levelUpMessage = new RegExp(process.env.LEVELUP_MESSAGE);
		const match = message.content.match(levelUpMessage);
		if (match) {
			const [, userId, level] = match;
			const roleId = levelUpConfig[message.guild.id][level];
			if (roleId) {
				const user = await message.client.fetchUser(userId);
				const member = await message.guild.fetchMember(user);
				const role = message.guild.roles.get(roleId);
				await member.addRole(role);
				const loggingChannel = message.client.channels.get(loggingChannels[message.guild.id]);
				if (loggingChannel) {
					const embed = new discord.RichEmbed()
						.setAuthor(user.tag, user.avatarURL)
						.setDescription(`${member} reached level ${level} and was added to ${role}.`)
						.setColor(role.color)
						.setFooter(`ID: ${user.id}`)
						.setTimestamp();
					await loggingChannel.send(embed);
				}
			}
		}
	},
};
