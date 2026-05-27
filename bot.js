const { Client, GatewayIntentBits, Collection, EmbedBuilder, REST, Routes, ChannelType } = require('discord.js');
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
  client.user.setActivity('⭐ Hypixel Accounts | /help', { type: 'WATCHING' });

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    console.log('📝 Registering slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
});

// Monitor #hits channel for new messages
client.on('messageCreate', async (message) => {
  try {
    if (message.channel.id !== process.env.HITS_CHANNEL_ID) return;

    console.log(`\n📡 [HITS CHANNEL EVENT] Message detected`);
    console.log(`   • Author: ${message.author.tag} (ID: ${message.author.id})`);
    console.log(`   • Bot Flag: ${message.author.bot ? 'Yes' : 'No'}`);
    console.log(`   • Embeds Count: ${message.embeds.length}`);

    await require('./managers/HitsManager').processHitsEmbed(message, client);
  } catch (error) {
    console.error('❌ Error in messageCreate handler:', error);
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
    if (interaction.customId.startsWith('claim_')) {
      try {
        await require('./managers/AccountManager').handleClaimButton(interaction, client);
      } catch (error) {
        console.error(error);
      }
    } else if (interaction.customId.startsWith('decision_')) {
      try {
        await require('./managers/AccountManager').handleDecisionButton(interaction, client);
      } catch (error) {
        console.error(error);
      }
    } else if (interaction.customId.startsWith('buy_')) {
      try {
        await require('./managers/TicketManager').handleBuyButton(interaction, client);
      } catch (error) {
        console.error(error);
      }
    } else if (interaction.customId.startsWith('support_')) {
      try {
        await require('./managers/TicketManager').handleSupportButton(interaction, client);
      } catch (error) {
        console.error(error);
      }
    }
  }

  // Select menu interactions
  if (interaction.isStringSelect()) {
    if (interaction.customId.startsWith('account_select_')) {
      try {
        await require('./managers/TicketManager').handleAccountSelect(interaction, client);
      } catch (error) {
        console.error(error);
      }
    }
  }

  // Modal submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('verify_')) {
      try {
        await require('./managers/AccountManager').handleVerifyModal(interaction, client);
      } catch (error) {
        console.error(error);
      }
    } else if (interaction.customId.startsWith('sellprice_')) {
      try {
        await require('./managers/AccountManager').handleSellPriceModal(interaction, client);
      } catch (error) {
        console.error(error);
      }
    }
  }
});

client.login(process.env.TOKEN);