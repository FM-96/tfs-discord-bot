require('dotenv').config();
require('./configureLogger.js');

const commandHandler = require('command-handler');
const Discord = require('discord.js');
const got = require('got');
const logger = require('winston').loggers.get('default');
const mongoose = require('mongoose');
const express = require('express');

const crypto = require('crypto');
const path = require('path');

const {getBotConfig, loadBotConfig} = require('./botConfigManager.js');
const {getGuildConfig, getYoutubeGuildIconSyncEnabled} = require('./guildConfigManager.js');
const reactionHandler = require('./reactionHandler.js');
const rememberRoles = require('./rememberRoles.js');
const youtube = require('./youtube.js');
const routes = require('./app/routes.js');

commandHandler.setOwnerId(process.env.OWNER_ID);
commandHandler.setGlobalPrefixes(false);
commandHandler.setModRoleGetter(getModRoles);

// register commands
try {
	const registerResults = commandHandler.registerCommandsFolder(path.join(__dirname, '.', 'commands'));
	logger.info(`${registerResults.registered} commands registered`);
	logger.info(`${registerResults.disabled} commands disabled`);
} catch (err) {
	logger.fatal('Error while registering commands:');
	logger.fatal(err);
	process.exit(1);
}

// register tasks
try {
	const registerResults = commandHandler.registerTasksFolder(path.join(__dirname, '.', 'tasks'));
	logger.info(`${registerResults.registered} tasks registered`);
	logger.info(`${registerResults.disabled} tasks disabled`);
} catch (err) {
	logger.fatal('Error while registering tasks:');
	logger.fatal(err);
	process.exit(1);
}

const app = express();
app.use(routes);

const client = new Discord.Client({
	partials: [
		'MESSAGE',
		'REACTION',
	],
	ws: {
		intents: Discord.Intents.ALL,
	},
});
global.client = client;

client.once('ready', () => {
	commandHandler.setGlobalPrefixes([`<@${client.user.id}> `, `<@!${client.user.id}> `, process.env.PREFIX]);

	if (process.env.YOUTUBE_GUILD_ICON_SYNC === 'true' || process.env.YOUTUBE_BOT_AVATAR_SYNC === 'true') {
		logger.debug('YouTube icon synchronization turned on');
		setInterval(checkYouTubeAvatar, process.env.YOUTUBE_POLLING_INTERVAL * 1000);
	} else {
		logger.debug('YouTube icon synchronization turned off');
	}

	setPresence();
	setInterval(setPresence, 900000); // refresh presence every 15 minutes
});

client.on('ready', async () => {
	logger.info('Successfully logged in');

	try {
		await rememberRoles.updateDatabase(client);
	} catch (err) {
		logger.error('Error while updating role database:');
		logger.error(err);
	}
});

client.on('message', async message => {
	// explicit commands
	let commandMatch = false;
	try {
		const commandResults = await commandHandler.checkCommand(message);
		commandMatch = commandResults.match;
	} catch (err) {
		console.error('Error while checking commands:');
		console.error(err);
	}

	// tasks (i.e. context commmands)
	try {
		await commandHandler.checkTasks(message, commandMatch);
	} catch (err) {
		console.error('Error while checking tasks:');
		console.error(err);
	}
});

client.on('messageReactionAdd', async (reaction, user) => {
	try {
		if (reaction.partial) {
			await reaction.fetch();
		}
		await reactionHandler.runReactionListeners(reaction, user);
	} catch (err) {
		logger.error('Error while processing reaction listeners:');
		logger.error(err);
	}
});

client.on('guildMemberAdd', async (member) => {
	try {
		await rememberRoles.memberAdd(member);
	} catch (err) {
		logger.error('Error while processing new member:');
		logger.error(err);
	}
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
	try {
		await rememberRoles.memberUpdate(oldMember, newMember);
	} catch (err) {
		logger.error('Error while updating member roles:');
		logger.error(err);
	}
});

mongoose.connect(process.env.MONGODB, {useNewUrlParser: true, useUnifiedTopology: true})
	.then(() => loadBotConfig())
	.then(() => client.login(process.env.BOT_TOKEN))
	.then(() => app.listen(process.env.PORT))
	.catch(err => {
		logger.fatal('Error logging in:');
		logger.fatal(err);
		process.exit(1);
	});

async function checkYouTubeAvatar() {
	try {
		logger.debug('Checking YouTube channel');

		const channelRes = await youtube.channels.list({
			id: process.env.YOUTUBE_CHANNEL_ID,
			part: 'id,snippet',
		});

		const channelObj = channelRes.data.items[0];
		const channelName = channelObj.snippet.title;

		const avatarRes = await got(channelObj.snippet.thumbnails.high.url, {
			responseType: 'buffer',
		});
		const avatarBuffer = avatarRes.body;

		logger.debug('Start hashing');
		const avatarHash = crypto.createHash('sha1').update(avatarBuffer).digest('hex');
		logger.debug(`sha1: ${avatarHash}`);

		// update guild icons
		if (process.env.YOUTUBE_GUILD_ICON_SYNC === 'true') {
			const enabledGuilds = await getYoutubeGuildIconSyncEnabled();
			for (const config of enabledGuilds) {
				const guild = client.guilds.cache.get(config.guildId);
				if (!guild) {
					continue;
				}
				if (avatarHash === config.youtubeAvatarHash) {
					continue;
				}
				try {
					await guild.setIcon(avatarBuffer, `Syncing guild icon with YouTube Channel "${channelName}"`);
					config.youtubeAvatarHash = avatarHash;
					await config.save();
					logger.verbose(`Changed guild icon for "${guild.name}" (${guild.id})`);
				} catch (err) {
					if (err.message === 'Missing Permissions') {
						logger.error(`Missing permissions in guild "${guild.name}" (${guild.id}), skipping`);
					} else {
						throw err;
					}
				}
			}
		}

		// update bot avatar
		if (process.env.YOUTUBE_BOT_AVATAR_SYNC === 'true') {
			const config = getBotConfig();
			if (avatarHash !== config.youtubeAvatarHash) {
				await client.user.setAvatar(avatarBuffer);
				config.youtubeAvatarHash = avatarHash;
				await config.save();
				logger.verbose('Changed bot avatar');
			}
		}
	} catch (err) {
		logger.error('Error while checking YouTube channel:');
		logger.error(err);
	}
}

async function getModRoles(guildId) {
	const config = await getGuildConfig(guildId);
	return config.modRoles;
}

async function setPresence() {
	try {
		await client.user.setActivity(`${process.env.PREFIX} help`);
	} catch (err) {
		logger.error('Error while setting presence:');
		logger.error(err);
	}
}
