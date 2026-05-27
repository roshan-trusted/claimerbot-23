const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('📋 Drop a ticket panel with buy and support buttons'),

  async execute(interaction, client) {
    const TicketManager = require('../managers/TicketManager');
    await TicketManager.createTicketPanel(interaction, client);
  },
};