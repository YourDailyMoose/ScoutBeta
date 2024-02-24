const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unbans the specified user')
    .setDMPermission(false)
    .addUserOption(option => option.setName('user').setDescription('The user to unban').setRequired(true)),
  async execute(interaction) {
    try {
      const user = interaction.options.getUser('user');
      const bans = await interaction.guild.bans.fetch();
      const bannedUser = bans.find(banInfo => banInfo.user.id === user.id);

      if (!bannedUser) {
        const notBannedEmbed = new EmbedBuilder()
          .setTitle('User is not banned')
          .setDescription(`The user ${user.tag} is not banned.`)
          .setColor('#f3786a')



        interaction.reply({ embeds: [notBannedEmbed] });
        return;
      }

      await interaction.guild.bans.remove(bannedUser.user);


      const unbannedEmbed = new EmbedBuilder()
        .setTitle('User has been unbanned')
        .setDescription(`The user ${user.tag} has been unbanned.`)
        .setColor('#bcf7cb')

      interaction.reply({ embeds: [unbannedEmbed] });
    } catch (error) {
      console.error(error);
      const errorEmbed = {
        color: 0xff0000, // Red color
        title: 'Error',
        description: 'An error occurred while trying to unban the user.',
      };
      interaction.reply({ embeds: [errorEmbed] });
    }
  },
};
