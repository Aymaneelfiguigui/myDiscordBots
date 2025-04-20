const { Client, GatewayIntentBits, MessageEmbed, MessageActionRow, MessageButton, ButtonStyle, ButtonBuilder, ActionRowBuilder, ComponentType } = require('discord.js');


//const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const ffmpeg = require('fluent-ffmpeg');
const gtts = require('node-gtts');
const gTTS = require('gtts');
const creatoMate = require('creatomate');
const Tesseract = require('tesseract.js');
const { exec } = require('child_process');
const { execSync } = require('child_process');




const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,

    ],
});
const fs = require('fs');



let rawdata = fs.readFileSync('config.json');
let config = JSON.parse(rawdata);



const path = require('path');
const os = require('os');

const TOKEN = config.botToken;


const prefix = '!';



async function ElevenLabsTTS2(text, voiceId = 'pNInz6obpgDQGcFmaJgB', outputFile = 'Voice.mp3') {
    // Replace vertical bars with "I" and remove pound and dollar signs
    text = text.replace(/\|/g, 'I').replace(/[\$£]/g, '');

    const body = {
        text: text,
        voice_settings: {
            "stability": 0,
            "similarity_boost": 0
        }
    };
    const options = {
        method: 'POST',
        headers: { 'xi-api-key': '406ffc5adb08920ac368d2c4fc955baf', 'Content-Type': 'application/json' },
        data: body,
        url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        responseType: 'arraybuffer' // Set responseType to 'arraybuffer' to handle binary data
    };
    try {
        const response = await axios(options);
        const data = response.data;

        // Data is an ArrayBuffer, convert it to a Buffer
        let buffer = Buffer.from(data);

        fs.writeFileSync(outputFile, buffer);
    } catch (error) {
        console.error('Failed to convert base64 string to buffer:', error);
    }
}
function imageToText(imagePath) {
    return new Promise((resolve, reject) => {
        Tesseract.recognize(
            imagePath,
            'eng',
        ).then(({ data: { text } }) => {
            const splitText = text.split('ANSWER:');
            const question = splitText[0].replace('QUESTION:', '').trim();
            const answer = splitText[1].trim();

            const qa = { question, answer };

            fs.readFile('qa.json', 'utf8', (err, data) => {
                if (err) {
                    // If the file does not exist, create it
                    fs.writeFile('qa.json', JSON.stringify([qa]), 'utf8', err => {
                        if (err) reject(err);
                        else resolve();
                    });
                } else {
                    // If the file exists, append to it if the question and answer do not already exist
                    const existingData = JSON.parse(data);
                    const exists = existingData.some(item => item.question === qa.question && item.answer === qa.answer);

                    if (!exists) {
                        existingData.push(qa);
                        fs.writeFile('qa.json', JSON.stringify(existingData), 'utf8', err => {
                            if (err) reject(err);
                            else resolve();
                        });
                    }
                }
            });
        });
    });
}

async function generateVideo() {
    console.log('Generating video...');
    // Extract the text from the images
        // await Promise.all([
        //     imageToText('1q.png'),
        //     imageToText('2q.png')
        // ]);

    const data = JSON.parse(fs.readFileSync('qa.json', 'utf8'));

    // Generate the audio for each question and answer
    for (let i = 0; i < data.length; i++) {
        const question = data[i].question;
        const answer = data[i].answer;
        //Crm8VULvkVs5ZBDa1Ixm
        await ElevenLabsTTS2(question, "Crm8VULvkVs5ZBDa1Ixm", `question${i}.mp3`);
        await ElevenLabsTTS2(answer, undefined, `answer${i}.mp3`);
    }

    // Create a text file that contains the list of audio files to concatenate
    const fileList = data.flatMap((_, i) => [`file 'question${i}.mp3'`, `file 'answer${i}.mp3'`]).join('\n');
    fs.writeFileSync('files.txt', fileList);

    // Concatenate the audio files
    const command = `ffmpeg -f concat -safe 0 -i files.txt -c copy qaAudio.mp3`;
    execSync(command);

    // Overlay the audio on the video
    overlayAudioOnVideo('background55.mp4', 'qaAudio.mp3', 'sheikh.mp4');
    console.log('Video generated successfully');
}
function overlayAudioOnVideo(backgroundVideo, audioFile, outputFile) {
    // Get the duration of the audio file
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioFile}`, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }

        const duration = stdout.trim();

        // Overlay the audio on the video and crop the video to match the audio duration
        const command = `ffmpeg -i ${backgroundVideo} -i ${audioFile} -t ${duration} -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 ${outputFile}`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        });
    });
}
generateVideo();

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

});




client.login(TOKEN);