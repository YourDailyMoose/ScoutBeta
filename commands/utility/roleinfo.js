const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Fetches information about a specified role.')
    .addRoleOption(option => 
      option.setName('role')
        .setDescription('The role to fetch information about')
        .setRequired(true)),
  async execute(interaction) {
    const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
    const role = interaction.options.getRole('role');

    // Fetching role information
    const roleMembers = role.members.size;
    const roleCreated = role.createdAt.toDateString();
    const roleColor = role.hexColor;
    const rolePermissions = new PermissionsBitField(role.permissions.bitfield).toArray().join(', ');

    // Creating the embed
    const embed = new EmbedBuilder()
      .setColor(role.color)
      .setTitle(`Role Information: ${role.name}`)
      .addFields(
        { name: 'Role ID', value: role.id, inline: true },
        { name: 'Role Name', value: role.name, inline: true },
        { name: 'Color', value: roleColor, inline: true },
        { name: 'Members', value: `${roleMembers}`, inline: true },
        { name: 'Created On', value: roleCreated, inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Managed', value: role.managed ? 'Yes' : 'No', inline: true },
        { name: 'Permissions', value: rolePermissions.length ? rolePermissions : 'None' }
      )
      .setFooter({ text: `Role Info requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    // Sending the embed
    await interaction.reply({ embeds: [embed] });
  }
};
