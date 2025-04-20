const { Client, GatewayIntentBits, MessageEmbed,MessageActionRow, MessageButton, ButtonStyle, ButtonBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');


const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,

	],
});

let rawdata = fs.readFileSync('config.json');
let config = JSON.parse(rawdata);


const TOKEN = config.botToken;



const prefix = '!';

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Function to scrape all gun names

let categories = {};


async function scrapeAttachments(mode = 'Warzone') {

    try {
        const param = (mode === 'Warzone') ? 'warzone-meta' : ((mode === 'Zombies') ? 'zombies' : 'mw3');
        // Make HTTP request to the website
        const response = await axios.get("https://warzoneloadout.games/" + param + "/");
        const html = response.data;

        // Load HTML content into Cheerio
        const $ = cheerio.load(html);

        // Select the Warzone tab
        //const warzoneTab = $('#' + mode);
        
        // Iterate over each category element within the Warzone tab
        $('.wz2_weapontables').find('.metatier').each((index, element) => {
            // Get the category name
            let categoryName = $(element).text().trim();
        
            // Create a new array in the object with the category name as the key
            categories[categoryName] = [];
        
            // Iterate over each gun within the current category
            $(element).nextUntil('.metatier', '.weapontables__weapon').each((i, gunElement) => {
                // Get the gun name
                let gunName = $(gunElement).find('.updated__wz2_weaponname').text().trim();
        
                // Get the gun attachments
                let attachments = [];
                $(gunElement).find('.new-attachment').each((i, attachmentElement) => {
                    let attachmentCategory = $(attachmentElement).find('.new-attachment__slot').text().trim();
                    let attachmentName = $(attachmentElement).find('.new-attachment__name').text().trim();
                    attachments.push({category: attachmentCategory, name: attachmentName});
                });
        
                // Push the gun name and its attachments into the array corresponding to the current category
                categories[categoryName].push({gun: gunName, attachments: attachments});

            });
        });
        

    } catch (error) {
        console.error('Error:', error);
    }
}


// Call the function to scrape attachments

// Function to get attachments for a specific gun


const possibleCommands = [];

let gunsInCategories = {
    Warzone: [],
    Zombies: [],
    MW3_Multiplayer: []
};

function updateGunsInCategoriesAndCommands(game) {
    // Initialize gunsInCategories[game] to an empty array if it's not already an array
    if (!Array.isArray(gunsInCategories[game])) {
        gunsInCategories[game] = [];
    }
    return scrapeAttachments(game).then(() => {
        for (let category in categories) {
            for (let gun of categories[category]) {
                // Create a new object with the gun's name, category, and attachments
                const gunInfo = {
                    name: gun.gun.toLowerCase(),
                    category: category,
                    attachments: gun.attachments
                };

                // Check if a gun with the same name and category already exists in the array
                const existingGun = gunsInCategories[game].find(g => g.name === gunInfo.name && g.category === gunInfo.category);

                // If the gun does not exist, add it to the array
                if (!existingGun) {
                    gunsInCategories[game].push(gunInfo);
                }

                // Add the gun's name to the possibleCommands array if it's not already there
                if (!possibleCommands.includes(gunInfo.name)) {
                    possibleCommands.push(gunInfo.name);
                }
            }
        }
    });
}

Promise.all([
    updateGunsInCategoriesAndCommands('Warzone'),
    updateGunsInCategoriesAndCommands('Zombies'),
    updateGunsInCategoriesAndCommands('MW3_Multiplayer')

]).catch(error => console.error(error))





function getAttachments(gunName, mode) {
    // Check if gunsInCategories[mode] is an array
    if (!Array.isArray(gunsInCategories[mode])) {
        return null;
    }

    // Iterate over each gun within the specified mode
    for (let gun of gunsInCategories[mode]) {
        // If the gun name matches the specified gun name
        if (gun.name === gunName.toLowerCase()) {
            // Return the attachments for the gun
            return gun.attachments;
        }
    }

    // If the gun name was not found, return null
    return null;
}

client.on('messageCreate', message => {
    // Ignore messages from bots and messages without the command prefix
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    // Extract the command and arguments from the message
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.join(' ').toLowerCase(); // Join all arguments with a space to form the command
    // Check if the command is 'test'
    if (command === 'test') {
        // Send 'Test passed' message
        message.channel.send('Test passed! hihih');
    }
    if (possibleCommands.includes(command)) {
        // Create a row of buttons
        const components = [
            {
                type: 1,
                components: []
            }
        ];
    
        // Check if the gun is present in each mode and add the corresponding button
        for (let mode in gunsInCategories) {
            if (gunsInCategories[mode].some(gun => gun.name === command.toLowerCase())) {
                components[0].components.push({
                    type: 2,
                    label: mode,
                    style: 2,
                    custom_id: mode.toLowerCase()
                });
            }
        }
    
        const embed = {
            color : 0x0099ff,
            title: `Attachments for ${command}`,
        }
    
        // Send the message with the buttons
        message.channel.send({ embeds: [embed], components });
    }
    else {
        console.log("ana hna hh")
    }

});

function isGunPresentInCategory(category, gunName) {
    return gunsInCategories[category].includes(gunName.toLowerCase());
}
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // Get the gun name from the embed title
    const title = interaction.message.embeds[0].title;
    const gunName = title.replace('Attachments for ', '');    
    
    let mode;
   if(interaction.customId === 'warzone'){
         mode = 'Warzone';
    }
    else if(interaction.customId === 'zombies'){
        mode = 'Zombies';
    }
    else if(interaction.customId === 'mw3_multiplayer'){
        mode = 'MW3_Multiplayer';
    }



    // Get the attachments for the specified gun and mode
    const newAttachments = getAttachments(gunName, mode);

    // Create a new embed with the new attachments
    const newEmbed = {
        color: 0x0099ff,
        title: `Attachments for ${gunName}`,
        fields: newAttachments.map(attachment => ({
            name: attachment.category,
            value: attachment.name
        }))
    };

   




    await interaction.update({ embeds: [newEmbed]});
});




const clientSecret = config.twitchCS;
const streamerUsername = 'amastan69';
const twitchApiUrl = 'https://api.twitch.tv/helix/streams';
const twitchApiToken = "hhrvk93fgc54i7z6ly006mpkpmqfdl";
const twitchApiClientId ="6epx7vv1ite4bz18xof2yw7ncy51id";

async function isStreamerLive() {
    try {
        // Make HTTP request to the Twitch API
        const response = await axios.get(twitchApiUrl, {
            headers: {
                'Client-ID': twitchApiClientId,
                'Authorization': `Bearer ${twitchApiToken}`
            },
            params: {
                user_login: streamerUsername
            }
        });

        // Check if the streamer is live
        return response.data.data.length > 0;
    } catch (error) {
        console.error('Error:', error);
    }
}

// Check if the streamer is live every 5 minutes
let wasLive = false;

setInterval(async () => {
    const isLive = await isStreamerLive();

    if (isLive && !wasLive) {
        // If the streamer is live and was not live the last time we checked
        const embed = {
            color: 0x9146FF,
            title: `Lmehdi rass lbzoula is live, come watch!`,
            url: `https://www.twitch.tv/${streamerUsername}`,
            thumbnail: {
                url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/17d406c6-964e-4e0f-afef-704b99b1d633-profile_image-70x70.png',
            },
            fields: [
                { name: 'Streaming now at', value: `[Twitch](https://www.twitch.tv/${streamerUsername})` },
            ],
            image: {
                url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZif60pvFODXyNpfhhIX3YOwnlRHMLL4ML0w&usqp=CAU',
            },
            timestamp: new Date(),
        };

        // Send the embed message to the Discord channel
        client.channels.cache.get('YOUR_CHANNEL_ID').send({ embeds: [embed] });

        // Update the wasLive variable
        wasLive = true;
    } else if (!isLive) {
        // If the streamer is not live
        wasLive = false;
    }
}, 3 * 60 * 1000); // Check every 3 minutes

const ytdl = require('ytdl-core');


client.on('messageCreate', async message => {
    // Ignore messages from bots and messages without the command prefix
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    // Extract the command and arguments from the message
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'playy') {
        // The 'play' command takes a YouTube URL as the first argument
        const url = args[0];

        // Check if the URL is a valid YouTube URL
        if (ytdl.validateURL(url)) {
            // Get the voice channel the user is in
            const channel = message.member.voice.channel;

            if (channel) {
                try {
                    // Join the voice channel
                    const connection = joinVoiceChannel({
                        channelId: channel.id,
                        guildId: channel.guild.id,
                        adapterCreator: channel.guild.voiceAdapterCreator,
                    });

                    // Create a player
                    const player = createAudioPlayer();

                    // Create an audio resource from the YouTube video
                    const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
                    const resource = createAudioResource(stream);

                    // Play the audio resource
                    player.play(resource);
                    connection.subscribe(player);

                    console.log('Playing audio...');

                    // Leave the voice channel when the video is done playing
                    player.on(AudioPlayerStatus.Idle, () => {
                        connection.destroy();
                        console.log('Left the voice channel.');
                    });

                    // Log errors from the player
                    player.on('error', error => {
                        console.error('Error:', error.message);
                    });

                } catch (error) {
                    console.error('Error connecting to the voice channel:', error);
                    message.reply('There was an error connecting to the voice channel.');
                }
            } else {
                message.reply('You need to join a voice channel first!');
            }
        } else {
            message.reply('Please provide a valid YouTube URL.');
        }
    }
});

client.login(TOKEN);


