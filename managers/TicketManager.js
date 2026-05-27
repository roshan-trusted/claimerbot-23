const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');

module.exports = {
  async createTicketPanel(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🎫 Support & Purchase Panel')
      .setDescription('Choose an option below to get started!')
      .addFields(
        { name: '💰 Buy Account', value: 'Click to browse and purchase accounts', inline: false },
        { name: '💬 Support', value: 'Need help? Contact our support team', inline: false }
      )
      .setThumbnail(client.user.avatarURL())
      .setTimestamp()
      .setFooter({ text: 'Account Management System' });

    const buyButton = new ButtonBuilder()
      .setCustomId('buy_panel')
      .setLabel('💰 Buy Account')
      .setStyle(ButtonStyle.Success);

    const supportButton = new ButtonBuilder()
      .setCustomId('support_panel')
      .setLabel('💬 Support')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(buyButton, supportButton);

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
  },

  async handleBuyButton(interaction, client) {
    const userId = interaction.user.id;
    const userAccounts = client.db.getUserAccounts(userId);
    const sellingAccounts = userAccounts.filter(a => a.status === 'selling');

    if (sellingAccounts.length === 0) {
      return interaction.reply({
        content: '❌ You have no accounts for sale!',
        ephemeral: true,
      });
    }

    // Create dropdown menu
    const options = sellingAccounts.map(acc => ({
      label: `${acc.username} - ${acc.price} coins`,
      value: acc.account_id,
      description: `Rank: ${acc.rank} | Level: ${acc.capes}`,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`account_select_${userId}`)
      .setPlaceholder('Select an account...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: '📋 Select which account you want to buy:',
      components: [row],
      ephemeral: true,
    });
  },

  async handleAccountSelect(interaction, client) {
    const accountId = interaction.values[0];
    const account = client.db.getAccountById(accountId);

    if (!account) {
      return interaction.reply({
        content: '❌ Account not found!',
        ephemeral: true,
      });
    }

    // Disable buttons
    const disabledButton = new ButtonBuilder()
      .setCustomId('disabled_1')
      .setLabel('🔒 Account Listed')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const row = new ActionRowBuilder().addComponents(disabledButton);

    // Create private thread
    try {
      const thread = await interaction.channel.threads.create({
        name: `${account.username}-${Date.now()}`,
        type: ChannelType.PrivateThread,
        reason: `Account listing for ${account.username}`,
      });

      // Private account details embed
      const detailsEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔐 Account Details - PRIVATE')
        .setDescription('⚠️ This information is private and only visible to the owner!')
        .addFields(
          { name: '👤 Username', value: `\`\`\`${account.username}\`\`\``, inline: false },
          { name: '📧 Email', value: `\`\`\`${account.email}\`\`\``, inline: false },
          { name: '🔑 Recovery Code', value: `\`\`\`${account.recovery_code}\`\`\``, inline: false },
          { name: '🛡️ Security Email', value: `\`\`\`${account.secret_key}\`\`\``, inline: false },
          { name: '🎮 Rank', value: `\`\`\`${account.rank}\`\`\``, inline: true },
          { name: '💰 Price', value: `\`\`\`${account.price} coins\`\`\``, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Keep this information safe!' });

      await thread.send({ embeds: [detailsEmbed] });
      await thread.members.add(interaction.user.id);

      await interaction.reply({
        content: `✅ Account thread created! Check your DMs or the thread. [View Thread](${thread.url})`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error creating thread:', error);
      await interaction.reply({
        content: '❌ Error creating thread!',
        ephemeral: true,
      });
    }
  },

  async handleSupportButton(interaction, client) {
    const supportEmbed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('💬 Support Team')
      .setDescription('Our support team is here to help!')
      .addFields(
        { name: '📧 Email', value: '```support@example.com```', inline: false },
        { name: '💬 Discord', value: '```Contact @Support```', inline: false }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [supportEmbed],
      ephemeral: true,
    });
  },
};