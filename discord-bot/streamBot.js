const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { exec } = require('child_process');
const fs = require('fs');

// Load configuration
const rawdata = fs.readFileSync('config.json');
const config = JSON.parse(rawdata);
const TOKEN = config.botToken;
const prefix = '!';

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Audio player for streaming
const player = createAudioPlayer();
let connection = null;
let currentStreamer = null;
let streamPlatform = null; 

// Function to start streaming
const startStream = async (streamerName, message, platform) => {
  try {
    // Extract the live stream URL using yt-dlp
    let tvOrCom = platform === 'twitch' ? 'tv' : 'com';
    const streamUrl = `https://${platform}.${tvOrCom}/${streamerName}`;
    const command = `C:\\Python312\\Scripts\\yt-dlp.exe -g "${streamUrl}"`; 

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error extracting stream URL:', error);
        return message.reply('Failed to extract the stream URL. Please check the streamer name and try again.');
      }

      const audioUrl = stdout.trim(); 
      if (!audioUrl) {
        return message.reply('No stream URL found. Is the streamer live?');
      }

      // Stream the audio using FFmpeg
      const resource = createAudioResource(audioUrl);
      player.play(resource);
      connection.subscribe(player);

      message.reply(`Now streaming live audio from ${streamerName}'s ${platform} stream.`);
    });
  } catch (error) {
    console.error('Error streaming audio:', error);
    message.reply('Failed to stream audio. Please check the streamer name and try again.');
  }
};

// Handle player state changes
player.on(AudioPlayerStatus.Idle, () => {
  if (currentStreamer) {
    console.log('Stream stopped. Attempting to reconnect...');
    setTimeout(() => {
      startStream(currentStreamer, { reply: (text) => console.log(text) }, streamPlatform);
    }, 5000); // Retry after 5 seconds
  }
});

player.on('error', (error) => {
  console.error('Audio player error:', error);
  if (currentStreamer) {
    console.log('Attempting to reconnect after error...');
    setTimeout(() => {
      startStream(currentStreamer, { reply: (text) => console.log(text) }, streamPlatform);
    }, 5000); // Retry after 5 seconds
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots or without the prefix
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  // Parse the command
  const [command, ...args] = message.content.slice(prefix.length).split(' ');

  if (command === 'stream') {
    const platform = args[0]?.toLowerCase(); // Extract platform (e.g., twitch, kick)
    const streamerName = args[1]; // Extract streamer name

    if (!streamerName) {
      return message.reply('Please provide a streamer name. Example: `!stream twitch streamer_name`');
    }

    if (!['twitch', 'kick', 'youtube'].includes(platform)) {
      return message.reply('Invalid platform. Supported platforms: `twitch`, `kick`, `youtube`.');
    }

    // Check if the user is in a voice channel
    if (!message.member.voice.channel) {
      return message.reply('You need to be in a voice channel to use this command.');
    }

    // Join the voice channel
    connection = joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    currentStreamer = streamerName;
    streamPlatform = platform; // Update the platform
    startStream(streamerName, message, platform);
  }

  if (command === 'leave') {
    // Disconnect from the voice channel
    if (connection) {
      connection.destroy();
      connection = null;
      currentStreamer = null;
      streamPlatform = null;
      message.reply('Left the voice channel.');
    } else {
      message.reply('I am not in a voice channel.');
    }
  }

  if (command === 'stop') {
    // Stop the audio playback
    if (player.state.status !== AudioPlayerStatus.Idle) {
      player.stop();
      message.reply('Stopped the audio playback.');
    } else {
      message.reply('No audio is currently playing.');
    }
  }
});

// Log in to Discord
client.login(TOKEN);