const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getPunishment, deletePunishment } = require('../../database.js');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delwarn')
        .setDescription('Delete a warning from a user.')
        .addStringOption(option => option.setName('punishmentid').setDescription('The ID of the warning to delete').setRequired(true)),
    permission: ['warnRoles', 'adminRoles', 'godRoles'],
    async execute(interaction) {
        const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
        const punishmentId = interaction.options.getString('punishmentid');
        const punishment = await getPunishment(punishmentId);

        if (!punishment) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription('Invalid punishment ID.')
                .setColor(guildColours.error);

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (punishment.punishmentType !== 'Warning') {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription('The specified punishment is not a warning.')
                .setColor(guildColours.error);

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const deleteWarning = await deletePunishment(punishmentId);
        if (deleteWarning) {
            const successEmbed = new EmbedBuilder()
                .setTitle('Success')
                .setDescription(`Warning with the ID \`${punishment._id}\` has been deleted.\n\nReason: ${punishment.reason}\nModerator: <@${punishment.moderatorId}>\nTimestamp: ${new Date(punishment.timestamp).toUTCString()}`)
                .setColor(botColours.green);

            return interaction.reply({ embeds: [successEmbed] });
        } else {
            const errorId = uuidv4();
            const errorMessage = `Error ID: ${errorId}, Error Details: ${error.stack}\n`;
            fs.appendFile('errorLog.txt', errorMessage, (err) => {
                if (err) throw err;
            });
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription('An error occurred while deleting the warning.')
                .setFooter({ text: `Please contact support with the following error ID: ${errorId}` })
                .setTimestamp()
                .setColor(guildColours.error);

                const supportServer = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setLabel('Support Server')
                    .setStyle('Link')
                    .setURL('https://discord.gg/BwD7MgVMuq')
                );
        
              interaction.reply({ embeds: [errorEmbed], components: [supportServer], ephemeral: true });
        }
    }
};