const Discord = require('discord.js');

const CustomRole = require('../models/CustomRole.js');
const {getGuildConfig} = require('../guildConfigManager.js');

const AUDIT_LOG_REASON = 'Managing custom role';

module.exports = {
	command: 'custom-role',
	aliases: [],
	description: 'Set the color and name of your custom role.',
	usage: `<hex color code> [new role name]
	hex color code
		Color code for the role, e.g. "ff0000" for red.
		Put "delete" to delete your custom role.

	new role name
		What to rename the custom role to. If omitted,
		the current name will be kept. If omitted and
		the role doesn't currently exist, the username
		will be used as the role name.`,
	ownerOnly: false,
	adminOnly: false,
	modOnly: false,
	inGuilds: true,
	inDms: false,
	allowBots: false,
	botsOnly: false,
	allowSelf: false,
	run: async (message, context) => {
		const color = context.argv[0];
		const name = context.argv.slice(1).join(' ').trim();

		const config = await getGuildConfig(message.guild.id);
		if (config.customRoleRoles.length) {
			const member = await message.guild.members.fetch(message.author);
			if (!config.customRoleRoles.some(e => member.roles.cache.has(e))) {
				await message.channel.send(`${message.author}, you don't have the required roles to use this command.`);
				return;
			}
		}

		const match = /[a-f0-9]{6}|delete/.exec(color.toLowerCase());
		if (!match) {
			await message.channel.send(`${message.author}, invalid color code. Use a six-digit hex code, e.g. "ff0000" for red.`);
			return;
		}
		const colorCode = match[0];

		if (colorCode === '000000') {
			await message.channel.send(`${message.author}, roles can't be colored pure black. Use a slightly different value such as e.g. "000001" instead.`);
			return;
		}

		const customRolePosition = 1 + Math.max(...config.customRoleIsAboveRoles.map(e => message.guild.roles.cache.get(e)).filter(e => e).map(e => e.position));

		const customRole = await CustomRole.findOne({guildId: message.guild.id, userId: message.author.id}).exec();

		let oldRoleData, newRoleData;

		if (customRole && message.guild.roles.cache.has(customRole.customRoleId)) {
			const role = message.guild.roles.cache.get(customRole.customRoleId);
			oldRoleData = {
				name: role.name,
				color: role.color.toString(16).padStart(6, '0'),
			};
			if (colorCode === 'delete') {
				await role.delete(AUDIT_LOG_REASON);
				await customRole.remove();
			} else {
				newRoleData = {
					name: name || oldRoleData.name,
					color: colorCode,
				};
				await role.edit({
					name: name || undefined,
					color: colorCode,
					position: customRolePosition,
				}, AUDIT_LOG_REASON);
				await message.member.roles.add(role, AUDIT_LOG_REASON);
			}
		} else {
			if (colorCode === 'delete') {
				if (customRole) {
					await customRole.remove();
				}
			} else {
				newRoleData = {
					name: name || message.author.username,
					color: colorCode,
				};
				const newRole = await message.guild.roles.create({
					data: {
						name: name || message.author.username,
						color: colorCode,
						position: customRolePosition,
						permissions: 0,
					},
					reason: AUDIT_LOG_REASON,
				});
				await message.member.roles.add(newRole, AUDIT_LOG_REASON);
				const newCustomRole = customRole || new CustomRole({guildId: message.guild.id, userId: message.author.id});
				newCustomRole.customRoleId = newRole.id;
				await newCustomRole.save();
			}
		}

		let response;
		if (newRoleData) {
			response = 'custom role changed.';
		} else {
			response = 'custom role deleted.';
		}
		await message.reply(response);

		const loggingChannel = config.loggingChannel;
		if (loggingChannel) {
			const embed = new Discord.MessageEmbed()
				.setAuthor(message.author.tag, message.author.avatarURL())
				.setTitle('Custom Role Changed')
				.setColor(colorCode);

			const loggingMessage = `${message.author} (${message.author.id})` + (newRoleData ? ' changed their custom role.' : ' deleted their custom role.');
			embed.setDescription(loggingMessage);

			embed.addField('Old', oldRoleData ? `#${oldRoleData.color}\n${oldRoleData.name}` : 'None', true);
			embed.addField('New', newRoleData ? `#${newRoleData.color}\n${newRoleData.name}` : 'None', true);

			await loggingChannel.send(embed);
		}
	},
};
