const { Client, GatewayIntentBits, MessageEmbed, MessageActionRow, MessageButton, ButtonStyle, ButtonBuilder, ActionRowBuilder, ComponentType } = require('discord.js');


//const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const ffmpeg = require('fluent-ffmpeg');
const gtts = require('node-gtts');
const fs = require('fs-extra');
const gTTS = require('gtts');
const creatoMate = require('creatomate');



const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,

    ],
});


let rawdata = fs.readFileSync('config.json');
let config = JSON.parse(rawdata);



const path = require('path');
const os = require('os');



async function tikTokSpeech(text, url, defaultApi = 1) {
    const voice = 'en_us_006';
    let sentences = text.match(/[^\.!\?]+[\.!\?]+/g);
    let buffers = [];
    for (let sentence of sentences) {
        const body = {
            text: sentence,
            voice: voice
        };
        const response = await axios.post(url, body);
        const data = response.data;

        let audioData;
        if (defaultApi === 1) {
            audioData = data.data;
        } else {
            audioData = data.base64;
        }
        try {
            let buffer = Buffer.from(audioData, 'base64');
            buffers.push(buffer);
        } catch (error) {
            console.error('Failed to convert base64 string to buffer:', error);
            }
       
    }
    let audioBuffer = Buffer.concat(buffers);
    fs.writeFileSync('Voice.mp3', audioBuffer);
}

async function ElevenLabsTTS(text){
    let sentences = text.match(/[^\.!\?]+[\.!\?]+/g);
    let buffers = [];
    for (let sentence of sentences) {
        const body = {

            method: "post",
            url: "https://api.elevenlabs.io/v1/text-to-speech/nLkWaMcfCvaeQhZuj9cF",
            header: {
                "content-type": "application/json"
            },
            body: {
                text: sentence,
                voice_settings: {
                    "stability": 0,
                    "similarity_boost": 0
                }
            },
            cookie: {},
            query: {}

        };
        const url ="https://elevenlabs.io/docs/api/request"
        const response = await axios.post(url, body);
        const data = response.data;


        let audioData;
        audioData = data.response.data;


        
        try {
            let buffer = Buffer.from(audioData, 'base64');
            buffers.push(buffer);
        } catch (error) {
            console.error('Failed to convert base64 string to buffer:', error);
            }
       
    }
    let audioBuffer = Buffer.concat(buffers);
    fs.writeFileSync('Voice.mp3', audioBuffer);
}
async function ElevenLabsTTS2(text, voiceId = 'pNInz6obpgDQGcFmaJgB'){
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





async function createVideo(backgroundVideo, subtitles, speechFile, outputFile, overlays) {
    console.log('Creating video...');
    return new Promise(async (resolve, reject) => {
        const tempFile = `temp_${Date.now()}.srt`;

        const speechDuration = await getAudioDurationInSeconds(speechFile);

        const averageSubtitleDuration = speechDuration / subtitles.length;

        const srtContent = subtitles
            .map((subtitle, index) => {
                const start = formatTime(index * averageSubtitleDuration);
                const end = formatTime((index + 1) * averageSubtitleDuration);
                return `${index + 1}\n${start} --> ${end}\n${subtitle}\n\n`;
            })
            .join('');
        fs.writeFileSync(tempFile, srtContent);

        let ffmpegCommand = ffmpeg()
            .input(backgroundVideo)
            .input(speechFile)
            .input(tempFile);

        let complexFilter = [
            {
                filter: 'scale',
                options: '-1:1920',
                inputs: '0:v',
                outputs: 'scaled'
            },
            {
                filter: 'crop',
                options: '1080:1920',
                inputs: 'scaled',
                outputs: 'cropped'
            },
            {
                filter: 'subtitles',
                options: {
                    filename: tempFile,
                    force_style: 'FontName=Info Story,FontSize=8,PrimaryColour=&H00ffffff,Alignment=10,MarginV=40'
                },
                inputs: 'cropped',
                outputs: 'subtitled'
            },

            {
                filter: 'amix',
                options: 'inputs=1',
                inputs: ['1:a'],
                outputs: 'audio'
            }
        ];

        let lastOutput = 'subtitled';

        overlays.forEach((overlay, index) => {
            if (overlay.image) {
                ffmpegCommand = ffmpegCommand.input(overlay.image);
                complexFilter.push({
                    filter: 'scale',
                    options: 'iw*1.5:-1',  // Adjust the overlay size (80% of the original width)
                    inputs: `${index + 3}:v`,
                    outputs: `scaled_overlay${index}`
                });
                complexFilter.push({
                    filter: 'overlay',
                    options: {
                        x: '(main_w-overlay_w)/2',  // Center the overlay horizontally
                        y: 'main_h-overlay_h-20',  // Position the overlay below the subtitles
                        enable: `between(t,${overlay.start},${overlay.end})`  // Show the overlay only during its time range
                    },
                    inputs: [lastOutput, `scaled_overlay${index}`],
                    outputs: `overlaid${index}`
                });
                lastOutput = `overlaid${index}`;
            }
        });

        complexFilter.push({
            filter: 'null',
            inputs: [lastOutput],
            outputs: 'video'
        });

        ffmpegCommand
            .complexFilter(complexFilter)
            .outputOptions([
                '-map', '[video]',
                '-map', '[audio]',
                '-c:a', 'aac',
            ])
            .audioCodec('aac')
            .videoCodec('libx264')
            .on('end', () => {
                overlays.forEach(overlay => {
                    if (overlay.image) {
                        fs.unlinkSync(overlay.image);
                    }
                });
                fs.unlinkSync(tempFile);
                resolve();
        console.log('Video created');

            })
            .on('error', (err) => {
                fs.unlinkSync(tempFile);
                reject(err);
            })
            .setDuration(speechDuration)
            .save(outputFile);
    });
}





client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.content === '!onthisday') {


        let death = await getOnThisDayEvents("deaths", 1);
        let birth = await getOnThisDayEvents("births", 1);
        let events = await getOnThisDayEvents("events", 2);


        let speechText = `Hello, everyone, This is YOUR daily briefing on the events that unfolded on this very day throughout history. `;
        let subtitles = ['    '];

        // Remove birth year from death text
        let deathText = death[0].text.replace(/ \(b\. \d+\)/, '');
        speechText += `Starting with a notable demise: In ${death[0].year}, ${deathText}. `;
        //subtitles.push(`Notable death: ${death[0].year}: ${deathText}`);

        speechText += `Moving on to a significant birth: In ${birth[0].year}, ${birth[0].text}. `;
        //subtitles.push(`Significant birth: ${birth[0].year}: ${birth[0].text}`);

        speechText += `Now let's discuss some important events that happened on this day. `;
        events.forEach(event => {
            speechText += `In ${event.year}, ${event.text}. `;
            //subtitles.push(`Event: ${event.year}: ${event.text}`);
        });

        speechText += `Follow for more!`;
        //subtitles.push('Follow for more!');

        
        
       

        let overlays = [
            { start: 5, end: 12, image: await getImage(death[0]) },
            { start: 16, end: 20, image: await getImage(birth[0]) },
            { start: 23, end: 35, image: await getImage(events[0]) },
            { start: 36, end: 40, image: await getImage(events[1]) }
        ];

        const url = 'https://gesserit.co/api/tiktok-tts';
        const defualtApi = 2;

        //await tikTokSpeech(speechText, url, defualtApi);
        await ElevenLabsTTS2(speechText);
        await createVideo('background6.mp4', subtitles, 'Voice.mp3', 'output.mp4', overlays);
    }
});
async function getImage(event) {
    if (event && event.pages) {
        for (let page of event.pages) {
            if (page.thumbnail && page.thumbnail.source) {
                const imageResponse = await axios.get(page.thumbnail.source, { responseType: 'arraybuffer' });
                const imageBuffer = Buffer.from(imageResponse.data, 'binary');
                const imageFile = `image_${Date.now()}.jpg`;
                fs.writeFileSync(imageFile, imageBuffer);
                return imageFile;
            }
        }
    }
    console.log('No image found for event:', event);
    return null;
}


async function getOnThisDayEvents(type, numEvents = 1) {
    let today = new Date();
    let month = String(today.getMonth() + 1).padStart(2, '0');
    let day = String(today.getDate()).padStart(2, '0');
    let url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/${type}/${month}/${day}`;
    const response = await axios.get(url);
    const data = response.data;
    const eventsWithImages = [];
    for (let event of data[type]) {
        if (event.pages) {
            for (let page of event.pages) {
                if (page.thumbnail && page.thumbnail.source) {
                    eventsWithImages.push(event);
                    if (eventsWithImages.length === numEvents) {
                        return eventsWithImages;
                    }
                    break;
                }
            }
        }
    }
    return eventsWithImages;
}

function formatTime(seconds) {
    const date = new Date(null);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 12);
}

function getAudioDurationInSeconds(audioFile) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioFile, function (err, metadata) {
            if (err) {
                reject(err);
            } else {
                resolve(metadata.format.duration);
            }
        });
    });
}

const TOKEN = config.botToken;









const prefix = '!';

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
});


client.login(TOKEN);