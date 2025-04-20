const { Client, GatewayIntentBits, MessageEmbed,MessageActionRow, MessageButton, ButtonStyle, ButtonBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');
const puppeteer = require('puppeteer');




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
const proxyUrl = 'http://104.16.105.146:80'; 

const agent = new HttpsProxyAgent(proxyUrl);

const clientId = '1217567591686602889'; 
const guildId = '1084965710100443228'; 



const TOKEN = config.botToken;



const prefix = '!';

const commands = [{
  name: 'compare',
  description: 'compare latest fetched lines, worst case senario it will compare the projections from 2 mins ago .',
}, {
  name: 'comparenow',
  description: 'Compares latest lines, might take a while...',
}];

const rest = new REST({ version: '9' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
let previousProjections = []

let previousScores = []


client.on('ready', async () => {

    console.log(`Logged in as ${client.user.tag}`);   

  
    //  previousProjections = await getPlayerProjections();
    //  previousScores = await scrapeUnderdogFantasy();
  
    // // Set up polling to check for updates every 2 minutes 
    // setInterval(checkForUpdates, 0.4 * 60 * 1000); 
});


async function getPlayerProjections() {
  let projectionsWithNames = [];

    const url = 'https://api.prizepicks.com/projections';
    const params = {
      league_id: 159,
      per_page: 250,
      single_stat: true,
      game_mode: 'pickem'
    };
    const headers = {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Content-Type': 'application/json',
      'Origin': 'https://app.prizepicks.com',
      'Referer': 'https://app.prizepicks.com/',
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Opera";v="108"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 OPR/108.0.0.0',
      'X-Device-Id': 'b9d8f1fb-b650-457e-a625-c1472fecc266',
      'X-Device-Info': 'name=,os=windows,osVersion=Windows NT 10.0; Win64; x64,isSimulator=false,platform=web,appVersion=web'
    };
  
    try {
      const response = await axios.get(url, { params, headers });
      const data = response.data.data;



      const included = response.data.included;
      
    // Create a map of player IDs to player names
    const playerMap = {};
    included.forEach(player => {
      if (player.type === 'new_player') {
        playerMap[player.id] = player.attributes.display_name;
      }
    });
    
    // Now map each projection to a player name and score
     projectionsWithNames = data.map(projection => {
      if (projection.type === 'projection' && projection.attributes.stat_type === 'MAPS 1-2 Kills') {
        const playerId = projection.relationships.new_player.data.id;
        return {
          name: playerMap[playerId],
          score: projection.attributes.line_score,
          Opps : projection.attributes.description,
          time : projection.attributes.start_time
        };
      }
    }).filter(Boolean); // remove undefined entries


    return projectionsWithNames;
      
  
    } catch (error) {
      console.error('Error fetching player projections:', error);
    }
  }

async function scrapeUnderdogFantasy() {

  //analyse script duration
  const start = Date.now();
  
  // Launch Puppeteer
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();





  // Set a desktop-sized viewport
  await page.setViewport({ width: 1280, height: 800 });

  // Set geolocation and grant permission
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('https://underdogfantasy.com', ['geolocation']);
  await page.setGeolocation({latitude: 59.95, longitude: 30.31667}); // Use coordinates as needed

  // Navigate to the login page
  await page.setJavaScriptEnabled(true);

  await page.goto('https://underdogfantasy.com/login', { timeout: 60000 });


  // Fill in the login form
  await page.type('input[data-testid="email_input"]', 'darap18909@etopys.com');
  await page.type('input[data-testid="password_input"]', 'Ayman?123');

    

  // Click the login button and wait for navigation
  await Promise.all([
    page.click('button[data-testid="sign-in-button"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
  ]);

 



  // Now that you are logged in, navigate to the page you want to scrape
  await page.goto('https://underdogfantasy.com/pick-em/higher-lower/all', { waitUntil: 'networkidle0', timeout: 60000 });  //await page.type('input[data-testid="player-search-input"]', 'val:');
  await page.setJavaScriptEnabled(false);

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.resourceType() !== 'document' && req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
      req.abort();
    } else {
      req.continue();
    }
  });





  // Retrieve and log the HTML of the page
  const html = await page.content();
  const $ = cheerio.load(html);

  // Initialize an array to hold the player names and scores
  const playerScores = [];

  // Select the container with all the cards
  const cardsContainer = $('[data-testid="overundercells-container"]');

  // Iterate over each card and extract the player's name and score
  cardsContainer.find('div[data-testid="over-under-cell"]').each((index, element) => {
  let playerName = $(element).find('h1[data-testid="player-name"]').text().trim();
  const scoreText = $(element).find('div[data-testid="stat-line-container"] p').first().text().trim();

    // Extract the opponent team name
    const matchInfoElements = $(element).find('p.styles__matchInfoText__klQeu');
    let opponentTeam, time;
    if (matchInfoElements.length >= 2) {
      const matchInfoParts = $(matchInfoElements[0]).text().split(/ vs | @ /);
      opponentTeam = matchInfoParts[1];
      time = $(matchInfoElements[1]).text().trim().replace(/^-\s*/, '');
    
    }


  // Check if the player's name starts with "Val: "
  if (playerName.startsWith('Val: ')) {
    // Remove the "Val: " prefix from the player's name
    playerName = playerName.replace(/^Val:\s*/, '');

    // Check if the score text contains "Map 1+2" and does not contain "Map 1+2+3"
    if (scoreText.includes('Map 1+2') && !scoreText.includes('Map 1+2+3')) {
      // Extract the score value
      const score = scoreText.match(/[\d.]+ Kills/)[0];

      
      // Extract the opponent
        playerScores.push({ playerName, score, Opps: opponentTeam, time });
     
    }
  }
});

const transformedPlayerScores = playerScores.map(player => ({
  name: player.playerName,
  score: parseFloat(player.score.split(' ')[0]),
  Opps: player.Opps,
  time: player.time
}));

// Log the filtered player names and scores

// Close the browser
await browser.close();
console.log("Script duration in seconds : ", (Date.now() - start) / 1000, "s");
return transformedPlayerScores;

}

 const cooldowns = new Map();
 const COOLDOWN_PERIOD = 60 * 1000; // 60 seconds in milliseconds


client.on('messageCreate', async message => {
    if (message.content === '!compare') {
        sendComparision(previousProjections, previousScores, message);
    }

    
    if (message.content === '!comparenow') {
        const now = Date.now();
        const lastFetchTime = cooldowns.get(message.author.id);

        if (lastFetchTime && now - lastFetchTime < COOLDOWN_PERIOD) {
            const timeLeft = ((COOLDOWN_PERIOD - (now - lastFetchTime)) / 1000).toFixed(1);
            message.reply(`Please wait ${timeLeft} more second(s) before reusing the \`!compare\` command.`);
            return;
        }

        cooldowns.set(message.author.id, now);

        const projectionsWithNames = await getPlayerProjections();
        const transformedPlayerScores = await scrapeUnderdogFantasy();
        sendComparision(projectionsWithNames, transformedPlayerScores, message);
    }
    if (message.content.startsWith('!bans')) {
      const args = message.content.split(' '); // Split the message content into words
      const userId = args[1]; // The second word should be the user ID
      const reason = args.slice(2).join(' ') || 'no reason'; // The rest of the words make up the reason
  
      // Fetch the guild and ban the user
      const guild = message.guild;
      guild.members.ban(userId, { reason })
        .then(() => message.reply(`User with ID ${userId} has been banned for ${reason}`))
        .catch(error => message.reply('Failed to ban user: ' + error.message));
    }
}); 




function sendComparision(previousProjections, previousScores, message){
    let embeds = [{
        color: 0x0099ff,
        title: 'Score Comparison',
        fields: [],
    }];
    previousProjections.sort((a, b) => {
      const aPlayer = previousScores.find(player => player.name === a.name);
      const bPlayer = previousScores.find(player => player.name === b.name);
      const aDifference = aPlayer ? Math.abs(a.score - aPlayer.score) : 0;
      const bDifference = bPlayer ? Math.abs(b.score - bPlayer.score) : 0;
      return bDifference - aDifference;
  });

    previousProjections.forEach(projection => {
        const correspondingPlayer = previousScores.find(player => player.name === projection.name);
        if (correspondingPlayer) {
            const difference = Math.abs(projection.score - correspondingPlayer.score);
                if (embeds[embeds.length - 1].fields.length === 25) {
                    // If the last embed already has 25 fields, create a new embed
                    embeds.push({
                        color: 0x0099ff,
                        title: 'Score Comparison (cont.)',
                        fields: [],
                    });
                }
                embeds[embeds.length - 1].fields.push({
                    name: `Player: ${projection.name}`,
                    value: `Score on prizeandpicks: ${projection.score}\nScore from underdogs: ${correspondingPlayer.score}\nDifference: ${difference}\nOpps: ${correspondingPlayer.Opps}\nTime: ${correspondingPlayer.time}`,
                });
            
        }
    });

    if (embeds[0].fields.length > 0) {
        embeds.forEach(embed => message.reply({ embeds: [embed] }));
    } else {
        message.reply('No differences found.');
    }
}
async function checkForUpdates() {
  try {
    // Fetch the latest data
    const newProjectionsWithNames = await getPlayerProjections();
    const newTransformedPlayerScores = await scrapeUnderdogFantasy();

    //test case 
    // let newProjectionsWithNames = [
    //   { name: 'SugarZ3ro', score: 27.5 }
    // ];
    
    // let newTransformedPlayerScores = [
    //   { name: 'SugarZ3ro', score: 27.5 },
    //   { name: 'NewPlayerShouldntAppear', score: 30 } // New score that doesn't exist in previousProjections
    // ];


    // Compare with stored data and find new lines
    const newLines = findNewLines(newProjectionsWithNames, newTransformedPlayerScores);

    // Notify users if there are new lines
    if (newLines.length > 0) {
        const channel = client.channels.cache.get('1084965710591185021'); // Replace with your channel ID

        const groupedLines = newLines.reduce((group, line) => {
            const lineStr = `${line.playerName}: ${line.score}\n`;
            if (!group[line.website]) {
                group[line.website] = lineStr;
            } else if ((group[line.website] + lineStr).length <= 1024) {
                group[line.website] += lineStr;
            } else {
                group[line.website + ' cont.'] = lineStr;
            }
            return group;
        }, {});

        const fields = Object.entries(groupedLines).map(([name, value]) => ({ name, value }));

        const embed = [{
            color: 0xFFA500,
            title: 'New Lines',
            fields,
        }];

        channel.send({
            content: 'Hello @everyone, new lines have just dropped',
            embeds: embed
        });
    }
    else {
      console.log('No new lines found.');
    }

    // Update stored data with new data for the next comparison
    previousProjections = newProjectionsWithNames;
    previousScores = newTransformedPlayerScores;
  } catch (error) {
    console.error('An error occurred while checking for updates:', error);
  }
}


function findNewLines(newProjections, newScores) {
    const newLines = [];

    // Find new projections
    newProjections.forEach(projection => {
        const exists = previousProjections.some(prev => prev.name === projection.name && prev.score === projection.score);
        if (!exists) {
            newLines.push({
                playerName: projection.name,
                score: projection.score,
                website: 'PrizePicks'
            });
        }
    });

    // Find new scores
    newScores.forEach(score => {
        const existsInPreviousScores = previousScores.some(prev => prev.name === score.name && prev.score === score.score);
        const existsInPrizePicks = newProjections.some(projection => projection.name === score.name && projection.score === score.score);
        if (!existsInPreviousScores && existsInPrizePicks) {
            newLines.push({
                playerName: score.name,
                score: score.score,
                website: 'Underdog Fantasy'
            });
        }
    });

    // Update previous data for the next comparison
    previousProjections = newProjections;
    previousScores = newScores;

    return newLines;
}


client.login(TOKEN);







