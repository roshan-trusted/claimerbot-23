const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subscription')
    .setDescription('Check your subscription status'),
  async execute(interaction, client) {
    try {
      const subscription = await client.db.getSubscription(interaction.user.id);

      if (!subscription) {
        return interaction.reply({
          content: '❌ You don\'t have an active subscription! Use `/redeem` to get one.',
          ephemeral: true,
        });
      }

      const expiresAt = new Date(subscription.expires_at);
      const now = new Date();
      const remainingMs = expiresAt - now;
      const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));

      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📊 Your Subscription')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: 'Remaining Days', value: `${remainingDays} days`, inline: true },
          { name: 'Expires At', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: false },
          { name: 'Accounts Claimed', value: `${subscription.accounts_claimed}` }
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ An error occurred!',
        ephemeral: true,
      });
    }
  },
};
