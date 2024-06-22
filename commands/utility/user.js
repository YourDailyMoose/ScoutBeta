const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDMPermission(false)
    .setDescription('Displays information about a user')
    .addUserOption(option => option.setName('user').setDescription('The user you want to get information about').setRequired(false)),
  async execute(interaction) {
    const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
    const user = interaction.options.getUser('user') || interaction.user;
    let member;

    try {
      member = await interaction.guild.members.fetch(user.id);
    } catch (error) {
      member = null;
    }

    const userInfoEmbed = new EmbedBuilder()
      .setTitle(`${user.username}'s Information`)
      .setColor(guildColours.primary)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Username', value: `${user.username}#${user.discriminator}`, inline: true },
        { name: 'User ID', value: user.id, inline: true },
        { name: 'Is Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    if (member) {
      const presenceStatus = member.presence ? member.presence.status : 'offline';
      const highestRole = member.roles.highest;
      const rolesCount = member.roles.cache.filter(role => role.id !== interaction.guild.id).size;

      userInfoEmbed.addFields(
        { name: 'Nickname', value: member.nickname ? member.nickname : 'None', inline: true },
        { name: 'Joined Server', value: `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`, inline: true },
        { name: 'Presence Status', value: presenceStatus, inline: true },
        { name: 'Highest Role', value: highestRole.name, inline: true },
        { name: 'Roles Count', value: `${rolesCount}`, inline: true },
        { name: 'Roles', value: member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => `<@&${role.id}>`).join(', ') || 'None', inline: false },
        { name: 'Boosting Since', value: member.premiumSince ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:F>` : 'Not Boosting', inline: true }
      );
    } else {
      userInfoEmbed.addFields(
        { name: 'Nickname', value: 'Not a member', inline: true },
        { name: 'Joined Server', value: 'Not a member', inline: true },
        { name: 'Presence Status', value: 'offline', inline: true },
        { name: 'Highest Role', value: 'None', inline: true },
        { name: 'Roles Count', value: '0', inline: true },
        { name: 'Roles', value: 'None', inline: false },
        { name: 'Boosting Since', value: 'Not Boosting', inline: true }
      );
    }

    interaction.reply({ embeds: [userInfoEmbed] });
  },
};