const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem a license key')
    .addStringOption(option =>
      option.setName('license')
        .setDescription('Your license key')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const licenseKey = interaction.options.getString('license').toUpperCase();

    try {
      // Check if user already has subscription
      const existingSub = await client.db.getSubscription(interaction.user.id);
      if (existingSub) {
        return interaction.reply({
          content: '❌ You already have an active subscription!',
          ephemeral: true,
        });
      }

      const license = await client.db.redeemLicense(licenseKey, interaction.user.id);

      if (!license) {
        return interaction.reply({
          content: '❌ Invalid or already redeemed license!',
          ephemeral: true,
        });
      }

      // Add role
      const accessRole = interaction.guild.roles.cache.get(process.env.ACCESS_ROLE_ID);
      if (accessRole) {
        await interaction.member.roles.add(accessRole);
      }

      // Log action
      await client.db.addLog('license_redeemed', interaction.user.id, `License: ${licenseKey}`);

      // Calculate expiration
      const expiresAt = new Date(Date.now() + license.days * 24 * 60 * 60 * 1000);

      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('💳 License Redeemed Successfully')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: 'User', value: `${interaction.user}` },
          { name: 'Duration', value: `${license.days} days` },
          { name: 'Expires At', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` }
        )
        .setTimestamp();

      const vouchesChannel = client.channels.cache.get(process.env.VOUCHES_CHANNEL_ID);
      if (vouchesChannel) {
        await vouchesChannel.send({ embeds: [embed] });
      }

      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Redemption Success')
        .addFields(
          { name: 'You have been given the @access role!', value: '✔️' }
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [successEmbed],
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
