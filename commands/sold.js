const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sold')
    .setDescription('💰 View accounts you have sold')
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('Filter by account username (optional)')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const userId = interaction.user.id;
    const filter = interaction.options.getString('username');

    let userAccounts = client.db.getUserAccounts(userId);
    userAccounts = userAccounts.filter(a => a.status === 'sold');

    if (filter) {
      userAccounts = userAccounts.filter(a =>
        a.username.toLowerCase().includes(filter.toLowerCase())
      );
    }

    if (userAccounts.length === 0) {
      return interaction.reply({
        content: '❌ You have no sold accounts!',
        ephemeral: true,
      });
    }

    // Create embeds
    const soldEmbeds = userAccounts.map(account =>
      new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`✅ ${account.username}`)
        .addFields(
          { name: '👤 Username', value: `\`\`\`${account.username}\`\`\``, inline: true },
          { name: '🎮 Rank', value: `\`\`\`${account.rank}\`\`\``, inline: true },
          { name: '💰 Sold Price', value: `\`\`\`${account.price} coins\`\`\``, inline: true },
          { name: '📅 Sold Date', value: `\`\`\`${new Date(account.sold_at).toLocaleDateString()}\`\`\``, inline: true }
        )
        .setTimestamp()
    );

    const chunks = [];
    for (let i = 0; i < soldEmbeds.length; i += 10) {
      chunks.push(soldEmbeds.slice(i, i + 10));
    }

    await interaction.reply({
      embeds: chunks[0],
      ephemeral: true,
    });

    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({
        embeds: chunks[i],
        ephemeral: true,
      });
    }

    client.db.addLog('sold_command', userId, `Viewed ${userAccounts.length} sold accounts`);
  },
};