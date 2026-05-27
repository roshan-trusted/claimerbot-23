const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('📋 List all your claimed accounts'),

  async execute(interaction, client) {
    const userId = interaction.user.id;
    const userAccounts = client.db.getUserAccounts(userId);

    if (userAccounts.length === 0) {
      return interaction.reply({
        content: '❌ You have no claimed accounts!',
        ephemeral: true,
      });
    }

    // Disable all claim buttons in the channel
    try {
      const messages = await interaction.channel.messages.fetch({ limit: 50 });
      messages.forEach(async (msg) => {
        if (msg.components.length > 0) {
          const disabledRows = msg.components.map(row => {
            const disabledButtons = row.components.map(button => {
              const newButton = new ButtonBuilder(button.toJSON());
              return newButton.setDisabled(true);
            });
            return new ActionRowBuilder().addComponents(disabledButtons);
          });
          try {
            await msg.edit({ components: disabledRows });
          } catch (err) {
            // Ignore errors
          }
        }
      });
    } catch (err) {
      console.error('Error disabling buttons:', err);
    }

    // Create embeds for each account
    const accountEmbeds = userAccounts.map(account =>
      new EmbedBuilder()
        .setColor(account.status === 'selling' ? '#FFD700' : '#00FF00')
        .setTitle(`📊 ${account.username}`)
        .addFields(
          { name: '👤 Username', value: `\`\`\`${account.username}\`\`\``, inline: true },
          { name: '🎮 Rank', value: `\`\`\`${account.rank}\`\`\``, inline: true },
          { name: '📧 Email', value: `\`\`\`${account.email}\`\`\``, inline: false },
          { name: '🔑 Recovery Code', value: `\`\`\`${account.recovery_code}\`\`\``, inline: false },
          { name: '🛡️ Security Email', value: `\`\`\`${account.secret_key}\`\`\``, inline: false },
          { name: '💰 Status', value: `\`\`\`${account.status.toUpperCase()}${account.price ? ` - ${account.price} coins` : ''}\`\`\``, inline: true },
          { name: '📅 Claimed', value: `\`\`\`${new Date(account.claimed_at).toLocaleDateString()}\`\`\``, inline: true }
        )
        .setTimestamp()
    );

    // Split into chunks if too many
    const chunks = [];
    for (let i = 0; i < accountEmbeds.length; i += 10) {
      chunks.push(accountEmbeds.slice(i, i + 10));
    }

    await interaction.reply({
      embeds: chunks[0],
      ephemeral: true,
    });

    // Send additional chunks if needed
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({
        embeds: chunks[i],
        ephemeral: true,
      });
    }

    client.db.addLog('list_command', userId, `Listed ${userAccounts.length} accounts`);
  },
};