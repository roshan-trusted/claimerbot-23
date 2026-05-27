const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  async processHitsEmbed(message, client) {
    try {
      if (!message.embeds.length) return;

      const embed = message.embeds[0];
      const hitDescription = embed.description || '';

      // Extract account info from the embed
      const lines = hitDescription.split('\n');
      let username = 'Unknown';
      let email = 'Unknown';

      lines.forEach(line => {
        if (line.includes('Username') || line.includes('username')) {
          username = line.split(':')[1]?.trim() || username;
        }
        if (line.includes('Email') || line.includes('email')) {
          email = line.split(':')[1]?.trim() || email;
        }
      });

      const accountId = `ACC-${Date.now()}`;

      // Create Components v2 Embed
      const claimEmbed = new EmbedBuilder()
        .setColor('#FF6B9D')
        .setTitle('🎮 New Account Available')
        .setDescription(`**Username:** ${username}\n**Email:** ${email}`)
        .addFields(
          { name: '📊 Status', value: '```Unclaimed```', inline: true },
          { name: '⭐ Rank', value: '```Loading...```', inline: true },
          { name: '🎨 Capes', value: '```Unknown```', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Claim this account before it\'s gone!' });

      // Create button row
      const claimButton = new ButtonBuilder()
        .setCustomId(`claim_${accountId}`)
        .setLabel('🚀 Claim Account')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(claimButton);

      // Send the embed
      const sentMessage = await message.channel.send({
        embeds: [claimEmbed],
        components: [row],
      });

      console.log(`✅ Hit processed: ${username}`);
    } catch (error) {
      console.error('Error processing hits embed:', error);
    }
  },
};