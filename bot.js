const { Client, GatewayIntentBits, Collection, EmbedBuilder, REST, Routes } = require('discord.js');
const { config } = require('dotenv');
const fs = require('fs');
const path = require('path');
const Database = require('./database');

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.db = new Database();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }
}

client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  client.user.setActivity('/generate | License Bot', { type: 'WATCHING' });

  // Register slash commands
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    
    console.log('📝 Registering slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    
    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
});

// Monitor #hits channel for new messages with explicit console tracking
client.on('messageCreate', async (message) => {
  try {
    // Check if the channel matches your .env file variable configuration
    if (message.channel.id !== process.env.HITS_CHANNEL_ID) return;

    console.log(`\n📡 [HITS CHANNEL EVENT] Message dropped in monitored channel.`);
    console.log(`   • Author Account Profile: ${message.author.tag} (ID: ${message.author.id})`);
    console.log(`   • Webhook/App Source Profile Flag: ${message.author.bot ? 'Yes' : 'No'}`);
    console.log(`   • Immediate Embed Count Payload: ${message.embeds ? message.embeds.length : 0}`);
    if (message.content) console.log(`   • Plain-Text Contents String: "${message.content}"`);

    // Hand execution task processing over to HitsManager
    await require('./managers/HitsManager').processHitsEmbed(message, client);
  } catch (error) {
    console.error('❌ Error caught within messageCreate handler segment:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.log(`Command ${interaction.commandName} not found`);
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ An error occurred!',
        ephemeral: true,
      }).catch(console.error);
    }
  }

  // Button interactions
  if (interaction.isButton()) {
    // Core claim initialization button
    if (interaction.customId.startsWith('claim_')) {
      try {
        await require('./managers/AccountManager').handleClaimButton(interaction, client);
      } catch (error) {
        console.error(error);
      }
    }
    // Thread decision selections (Claim or Sell)
    else if (interaction.customId.startsWith('decision_')) {
      try {
        await require('./managers/AccountManager').handleDecisionButton(interaction, client);
      } catch (error) {
        console.error(error);
      }
    }
  }

  // Modal submissions
  if (interaction.isModalSubmit()) {
    // Initial username string verification step
    if (interaction.customId.startsWith('verify_')) {
      try {
        await require('./managers/AccountManager').handleVerifyModal(interaction, client);
      } catch (error) {
        console.error(error);
      }
    }
    // Shop custom pricing evaluation submission step
    else if (interaction.customId.startsWith('sellprice_')) {
      try {
        await require('./managers/AccountManager').handleSellPriceModal(interaction, client);
      } catch (error) {
        console.error(error);
      }
    }
  }
});

client.login(process.env.TOKEN);
