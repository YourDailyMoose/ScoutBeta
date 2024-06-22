const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

let commandIds = {};
const commandIdsPath = path.join(__dirname, '../../command-ids.json');

try {
  if (fs.existsSync(commandIdsPath) && fs.readFileSync(commandIdsPath, 'utf8').trim().length > 0) {
    const commandIdsData = fs.readFileSync(commandIdsPath, 'utf8');
    commandIds = JSON.parse(commandIdsData);
  }
} catch (error) {
  console.error("Failed to read or parse command-ids.json:", error);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays information about the bot.'),
  async execute(interaction) {
    const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
    const introductionMessage = `Hello! I'm Scout, a moderation, utility and fun bot made by YourDailyMoose. I'm currently in development, so expect bugs and missing features. If you find any bugs, please report them in our Support Server.`;

    // Gather bot statistics
    const totalServers = interaction.client.guilds.cache.size;
    const totalUsers = interaction.client.users.cache.size;
    const totalCommands = interaction.client.commands.size;

    const helpmenu = new EmbedBuilder()
      .setTitle("**Help Menu**")
      .setColor("ff9015")
      .setDescription(introductionMessage)
      .addFields(
        { name: 'Total Servers', value: `${totalServers}`, inline: true },
        { name: 'Total Users', value: `${totalUsers}`, inline: true },
        { name: 'Total Commands', value: `${totalCommands}`, inline: true }
      )
      .setFooter({ text: "Scout - Created by YourDailyMoose", iconURL: interaction.client.user.displayAvatarURL() });

    const supportServer = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Support Server')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/BwD7MgVMuq')
      );

    const categoryDisplayNames = {
      'fun': 'Fun',
      'moderation': 'Moderation',
      'utility': 'Utility',
      'usage': 'Usage',
      'levels': 'Levels',
      'function': 'Function',
      'giveaways': 'Giveaways',
      // Add more mappings here as needed
    };

    const categoryEmojis = {
      'fun': '🎉',
      'moderation': '🛡️',
      'utility': '🛠️',
      'usage': '📚',
      'levels': '📈',
      'function': '🔧',
      'giveaways': '🎁',
      // Add more mappings here as needed
    };

    const categories = Array.from(new Set(interaction.client.commands.map(command => command.data.category || 'Uncategorised')));
    const categoryOptions = categories.map(category => {
      const displayName = categoryDisplayNames[category] || category;
      const emoji = categoryEmojis[category] || '';
      return new StringSelectMenuOptionBuilder().setLabel(`${emoji} ${displayName}`).setValue(category);
    });

    const categorySelectMenu = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('help_select_category')
          .setPlaceholder('Select a category')
          .addOptions(categoryOptions)
      );

    await interaction.reply({ embeds: [helpmenu], components: [categorySelectMenu, supportServer], ephemeral: true });

    const filter = i => (i.customId === 'help_show_commands' || i.customId === 'help_select_category') && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'help_select_category') {
        await i.deferUpdate();

        const selectedCategory = i.values[0];
        const commandsInCategory = interaction.client.commands.filter(command => command.data.category === selectedCategory || (selectedCategory === 'Uncategorised' && !command.data.category));

        const displayName = categoryDisplayNames[selectedCategory] || selectedCategory;
        const commandsEmbed = new EmbedBuilder()
          .setTitle(`**Commands in ${displayName}**`)
          .setColor("ff9015");

        commandsInCategory.forEach(command => {
          const commandId = commandIds[command.data.name];
          if (commandId) {
            const commandMention = `</${command.data.name}:${commandId}>`;
            commandsEmbed.addFields({ name: `${commandMention}`, value: `${command.data.description}`, inline: true });
          } else {
            commandsEmbed.addFields({ name: `${command.data.name}`, value: `${command.data.description}`, inline: true });
          }
        });

        await interaction.followUp({ embeds: [commandsEmbed], ephemeral: true });
      }
    });
  },
};
