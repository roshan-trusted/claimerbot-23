const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('generate')
    .setDescription('Generate a license key (Owner Only)')
    .addIntegerOption(option =>
      option.setName('days')
        .setDescription('Number of days for the license')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({
        content: '❌ Only the owner can use this command!',
        ephemeral: true,
      });
    }

    const days = interaction.options.getInteger('days');

    try {
      const licenseKey = await client.db.generateLicense(days, interaction.user.id);

      await client.db.addLog('license_generated', interaction.user.id, `Days: ${days}, License: ${licenseKey}`);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ License Generated')
        .addFields(
          { name: 'License Key', value: `\`${licenseKey}\`` },
          { name: 'Duration', value: `${days} days` },
          { name: 'Command', value: '/redeem ' + licenseKey }
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ Failed to generate license!',
        ephemeral: true,
      });
    }
  },
};
