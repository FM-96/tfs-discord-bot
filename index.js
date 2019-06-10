require('dotenv').config();
require('./configureLogger.js');

const discord = require('discord.js');
const got = require('got');
const logger = require('winston').loggers.get('default');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const youtube = require('./youtube.js');

const client = new discord.Client();

client.once('ready', () => {
	if (process.env.YOUTUBE_GUILD_ICON_SYNC === 'true' || process.env.YOUTUBE_BOT_AVATAR_SYNC === 'true') {
		logger.debug('YouTube icon synchronization turned on');
		setInterval(checkYouTubeAvatar, process.env.YOUTUBE_POLLING_INTERVAL * 1000);
	} else {
		logger.debug('YouTube icon synchronization turned off');
	}
});

client.on('ready', () => {
	logger.info('Successfully logged in');
});

client.login(process.env.BOT_TOKEN).catch(err => {
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
			encoding: null,
		});
		const avatarBuffer = avatarRes.body;

		logger.debug('Start hashing');
		const avatarHash = crypto.createHash('sha1').update(avatarBuffer).digest('hex');
		logger.debug(`sha1: ${avatarHash}`);

		// compare to saved hash
		let lastAvatarHash;
		try {
			lastAvatarHash = fs.readFileSync(path.join(__dirname, 'lastAvatarHash.txt'), 'utf8');
		} catch (err) {
			// it's not a problem if the file doesn't exist
			if (err.code !== 'ENOENT') {
				throw err;
			}
		}
		if (avatarHash === lastAvatarHash) {
			logger.debug(`Avatar not changed for YouTube channel "${channelName}"`);
			return;
		}
		fs.writeFileSync(path.join(__dirname, 'lastAvatarHash.txt'), avatarHash);
		logger.info(`Changed avatar detected for YouTube channel "${channelName}"`);

		// update guild icons
		if (process.env.YOUTUBE_GUILD_ICON_SYNC === 'true') {
			const guildIds = process.env.DISCORD_GUILDS.split(',');
			for (const guildId of guildIds) {
				const guild = client.guilds.get(guildId);
				if (!guild) {
					logger.warn(`Bot is not in guild ${guildId}, skipping`);
					continue;
				}
				try {
					await guild.setIcon(avatarBuffer, `Syncing guild icon with YouTube Channel "${channelName}"`);
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
			await client.user.setAvatar(avatarBuffer);
			logger.verbose('Changed bot avatar');
		}
	} catch (err) {
		logger.error('Error while checking YouTube channel:');
		logger.error(err);
	}
}
