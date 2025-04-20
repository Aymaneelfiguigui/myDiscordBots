const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates, // Added to ensure the bot can join and manage voice states
    ],
});

let rawdata = fs.readFileSync('config.json');
let config = JSON.parse(rawdata);

const TOKEN = config.botToken;
const prefix = '!';

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

async function tikTokSpeech(text) {
    const voice = 'en_us_001';
    const url = 'https://tiktok-tts.weilnet.workers.dev/api/generation'
    
    
    // Create the request body with the full text
    const body = {
        text: text,
        voice: voice
    };
    
    try {
        // Send the request to the API
        const response = await axios.post(url, body);
        const data = response.data;

        // Extract the audio data
        let audioData = data.data;

        // Convert the base64 string to a buffer
        let buffer = Buffer.from(audioData, 'base64');

        // Write the buffer to an MP3 file
        fs.writeFileSync('Voice.mp3', buffer);
        console.log('Voice.mp3 has been created successfully.');
    } catch (error) {
        console.error('Error occurred while converting text to speech:', error);
    }
}

async function ElevenLabsTTS(text, voiceId = 'pNInz6obpgDQGcFmaJgB'){
    const body = {
        text: text,
        voice_settings: {
            "stability": 0,
            "similarity_boost": 0
        }
    };
    const options = {
        method: 'POST',
        headers: {'xi-api-key': '406ffc5adb08920ac368d2c4fc955baf', 'Content-Type': 'application/json'},
        data: body,
        url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        responseType: 'arraybuffer' // Set responseType to 'arraybuffer' to handle binary data
    };
    try {
        const response = await axios(options);
        const data = response.data;

        // Data is an ArrayBuffer, convert it to a Buffer
        let buffer = Buffer.from(data);

        fs.writeFileSync('Voice.mp3', buffer);
    } catch (error) {
        console.error('Failed to convert base64 string to buffer:', error);
    }
}
function logMessage(username, message) {
    const logFile = 'messageLog.json';
    let logData = [];

    if (fs.existsSync(logFile)) {
        logData = JSON.parse(fs.readFileSync(logFile));
    }

    logData.push({ username, message, timestamp: new Date().toISOString() });
    fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
}
client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'speak' && message.member.voice.channel) {
        const text = args.join(' ');

        let isAnonymous = false;
        if (text.toLowerCase().startsWith('shh')) {
            isAnonymous = true;
            args.shift(); // Remove 'shh' from the arguments
        }

        const content = args.join(' ');
        if (!content) {
            message.reply('Please provide the text to speak.');
            return;
        }

        // await ElevenLabsTTS(content);
        await tikTokSpeech(content)

        const channel = message.member.voice.channel;
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const resource = createAudioResource(path.join(__dirname, 'Voice.mp3'), { inlineVolume: true });
        player.play(resource);

        connection.subscribe(player);

        console.log('Playing the audio...');

        player.on(AudioPlayerStatus.Idle, () => {
            connection.destroy();
            console.log('Finished playing the audio, left the voice channel.');
        });

        player.on('error', error => {
            console.error('Error playing the audio:', error);
        });

        if (isAnonymous) {
            logMessage(message.author.username, content);
            await message.delete(); // Delete the original message to maintain anonymity
            message.channel.send('An anonymous user says: ' + content);
        } else {
            message.channel.send(`${message.author.username} says: ${content}`);
        }
    }
});

async function generateImage(prompt) {
    const payload = {
        prompt: prompt,
        output_format: 'jpeg'
    };

    try {
        const response = await axios.postForm(
            'https://api.stability.ai/v2beta/stable-image/generate/sd3',
            axios.toFormData(payload, new FormData()),
            {
                validateStatus: undefined,
                responseType: 'arraybuffer',
                headers: {
                    Authorization: `sk-LaY0f5QN7yvw8AH3MUIujbJBc1VPNAV5aUOeOkHLl85BKD0u`,
                    Accept: 'image/*'
                },
            }
        );

        if (response.status === 200) {
            const filePath = './generated_image.jpeg';
            fs.writeFileSync(filePath, Buffer.from(response.data));
            return filePath;
        } else {
            throw new Error(`${response.status}: ${response.data.toString()}`);
        }
    } catch (error) {
        console.error('Error generating image:', error);
        throw error;
    }
}

client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'generateimage') {
        const prompt = args.join(' ');
        if (!prompt) {
            message.reply('Please provide a prompt for the image.');
            return;
        }

        try {
            const filePath = await generateImage(prompt);
            await message.reply({
                content: 'Here is your generated image:',
                files: [filePath]
            });
            // Optionally, delete the image file after sending to keep the file system clean
            fs.unlinkSync(filePath);
        } catch (error) {
            message.reply('Failed to generate image. Please try again later.');
        }
    }
});
client.login(TOKEN);
