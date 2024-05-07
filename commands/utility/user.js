const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');  // Note: EmbedBuilder was corrected to MessageEmbed
const botColours = require('../../botColours.json');

module.exports = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Displays information about a user')
    .addUserOption(option => option.setName('user').setDescription('The user you want to get information about').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getMember('user') || interaction.member; // Fetch member if user option is not provided
    

    const userInfoEmbed = new EmbedBuilder()  // Note: EmbedBuilder was corrected to MessageEmbed
      .setTitle(`${user.user.username}'s Information`)
      .setColor(botColours.primary)
      .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Username:', value: user.user.username, inline: false },
        { name: 'User ID:', value: user.id, inline: false },
        { name: 'Is Bot:', value: user.user.bot ? 'Yes' : 'No', inline: false },
        { name: 'Nickname:', value: user.nickname ? user.nickname : 'None', inline: false },
        { name: 'Account Created:', value: `<t:${Math.floor(user.user.createdAt.getTime() / 1000)}:F>`, inline: false },

        { name: 'Joined Server:', value: user.joinedAt ? `<t:${Math.floor(user.joinedAt.getTime() / 1000)}:F>` : 'Not a member', inline: false },
        
        { name: 'Roles:', value: user.roles ? user.roles.cache.filter(role => role.id !== user.guild.id).map(role => `<@&${role.id}>`).join(', ') : 'Not a member', inline: false },
        {
          name: 'Boosting Since:',
          value: user.premiumSince
            ? `<t:${Math.floor(user.premiumSince.getTime() / 1000)}:F>`
            : 'Not Boosting',
          inline: false
        }

        // Add more fields here as you see fit.
      );

    interaction.reply({ embeds: [userInfoEmbed] });
  },
};
