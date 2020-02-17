module.exports = {
	updateDatabase,
	memberAdd,
	memberUpdate,
};

const discord = require('discord.js');
const logger = require('winston').loggers.get('default');

const MemberRoles = require('./models/MemberRoles.js');

const loggingChannels = {};
for (const guildConfig of process.env.LOGGING_CHANNELS.split(',')) {
	const [guild, channel] = guildConfig.split(':');
	loggingChannels[guild] = channel;
}

async function updateDatabase(client) {
	// update member roles database
	logger.debug('Updating member roles database');
	const saveOps = [];
	for (const guild of client.guilds.array()) {
		if (!process.env.REMEMBER_ROLES_GUILDS.split(',').includes(guild.id)) {
			continue;
		}

		await guild.fetchMembers();
		let docs = await MemberRoles.find({guildId: guild.id}).exec();

		// don't change documents of members that aren't in the server
		docs = docs.filter(e => guild.member(e.userId));

		// create documents for not yet saved members
		const newMembers = guild.members.array().filter(e => !e.user.bot && e.roles.size && !docs.find(d => d.userId === e.user.id));
		for (const newMember of newMembers) {
			docs.push(new MemberRoles({guildId: guild.id, userId: newMember.user.id, roleIds: []}));
		}

		for (const doc of docs) {
			const memberRoleIds = guild.member(doc.userId).roles.filter(r => !r.managed && r.id !== r.guild.id).map(r => r.id).sort();
			if (memberRoleIds.join() !== doc.roleIds.join()) {
				doc.roleIds = memberRoleIds;
				saveOps.push(doc.save());
			}
		}
	}
	await Promise.all(saveOps);
	logger.info('Finished updating member roles database');
}

async function memberAdd(member) {
	if (!process.env.REMEMBER_ROLES_GUILDS.split(',').includes(member.guild.id)) {
		return;
	}

	if (member.user.bot) {
		return;
	}

	const doc = await MemberRoles.findOne({guildId: member.guild.id, userId: member.user.id}).exec();
	if (doc) {
		const rolesToAdd = [];
		for (const roleId of doc.roleIds) {
			const role = member.guild.roles.get(roleId);
			if (role) {
				rolesToAdd.push(role);
			}
		}
		if (rolesToAdd.length) {
			logger.info(`${member.user.username} (${member.user.id}) rejoined, re-adding ${rolesToAdd.length} roles`);
			member.addRoles(rolesToAdd).catch(logger.error);

			const loggingChannel = member.client.channels.get(loggingChannels[member.guild.id]);
			if (loggingChannel) {
				const embed = new discord.RichEmbed()
					.setAuthor(member.user.tag, member.user.avatarURL)
					.setDescription(`${member} rejoined and was given back the following roles: ${rolesToAdd.map(e => `__${e.name}__`).join(', ')}.`)
					.setColor(0xCC00CC)
					.setFooter(`ID: ${member.id}`)
					.setTimestamp();
				await loggingChannel.send(embed);
			}
		}
	}
}

async function memberUpdate(oldMember, newMember) {
	if (!process.env.REMEMBER_ROLES_GUILDS.split(',').includes(newMember.guild.id)) {
		return;
	}

	if (newMember.user.bot) {
		return;
	}

	const oldMemberRoles = oldMember.roles.filter(e => !e.managed && e.id !== e.guild.id).map(e => e.id).sort();
	const newMemberRoles = newMember.roles.filter(e => !e.managed && e.id !== e.guild.id).map(e => e.id).sort();

	if (oldMemberRoles.join() !== newMemberRoles.join()) {
		let doc = await MemberRoles.findOne({guildId: newMember.guild.id, userId: newMember.user.id}).exec();
		doc = doc || new MemberRoles({guildId: newMember.guild.id, userId: newMember.user.id});
		doc.roleIds = newMemberRoles;
		doc.save().catch(logger.error);
	}
}
