const discord = require('discord.js');

const {getGuildConfig} = require('../guildConfigManager.js');

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
	test: async message => true,
	run: async (message, context) => {
		const config = await getGuildConfig(message.guild.id);

		if (!config.levelUpEnabled || message.author.id !== config.levelUpBot || !config.levelUpRoles.length) {
			return;
		}

		const levelUpRegex = new RegExp(config.levelUpMessage);
		const match = message.content.match(levelUpRegex);
		if (match) {
			const [, userId, level] = match;
			const levelUpRole = config.levelUpRoles.find(e => e.level === Number(level));
			if (levelUpRole) {
				const user = await message.client.fetchUser(userId);
				const member = await message.guild.fetchMember(user);
				const role = levelUpRole.role;
				await member.addRole(role);

				const loggingChannel = config.loggingChannel;
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
