const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { botColours } = require('../../botColours.json');

//PERMISSIONS
module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Gives or takes away a role from a user.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to give or take the role from.')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to give or take.')
        .setRequired(true)),
    permission: ['adminRoles', 'godRoles', ],
  async execute(interaction) {
    
      const user = interaction.options.getMember('user');
      const role = interaction.options.getRole('role');

      if(interaction.guild && interaction.guild.me && !interaction.guild.me.roles.highest.comparePositionTo(role) > 0) {
        // the rest of your code...


        const errorEmbed = new EmbedBuilder()
          .setColor(botColours.red)
          .setTitle('Error')
          .setDescription('I cannot give a role that is higher than or equal to my highest role.')

        return interaction.reply({ embeds: [errorEmbed] });
      }
      if (!user || !role) {
        const embed = new EmbedBuilder()
          .setTitle('Role Update Error')
          .setDescription(`User or role was not found.`)
          .setColor(botColours.red);

        interaction.reply({ embeds: [embed] });
      }


      let action = ''; // Action string to keep track of what we did

      if (user.roles.cache.has(role.id)) {
        // The user already has the role, so we remove it
        await user.roles.remove(role);
        action = '-';
      } else {
        // The user does not have the role, so we give it to them
        await user.roles.add(role);
        action = '+';
      }

      const embed = new EmbedBuilder()
        .setTitle('Role Update')
        .setDescription(`Changed ${user.user.username}'s roles. \`${action}${role.name}\``)
        .setColor(botColours.green);  

      await interaction.reply({ embeds: [embed] });
    
  },

};
