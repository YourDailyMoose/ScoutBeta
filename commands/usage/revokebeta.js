const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revokebeta')
        .setDescription(`Revoke a guild\'s beta access. (Restricted)`)
        .addStringOption(option =>
            option.setName('guild_id')
                .setDescription('The ID of the guild to leave')
                .setRequired(false)),
    async execute(interaction) {
        const guildColours = await require('../../database').getGuildBotColours(interaction.guild.id)
        const guildId = interaction.options.getString('guild_id');
        let targetGuild;

        try {
            if (guildId) {
                targetGuild = await interaction.client.guilds.fetch(guildId);
                if (!targetGuild) {
                    return interaction.reply({ content: 'Guild not found. Please provide a valid Guild ID.', ephemeral: true });
                }
            } else {
                targetGuild = interaction.guild;
            }

            const leaveEmbed = new EmbedBuilder()
                .setColor(guildColours.error)
                .setTitle('Beta Access Revoked')
                .setDescription(`This guild's beta access has been revoked. If you would like to re-enroll in the beta program, please contact support.`)
                .addFields(
                    { name: `Guild Name`, value: targetGuild.name, inline: true },
                    { name: `Guild ID`, value: targetGuild.id, inline: true }
                );

            const supportActionRow = new ActionRowBuilder()
                .addButton(button =>
                    button.setLabel('Contact Support')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://discord.gg/BwD7MgVMuq')
                );

            await interaction.channel.send({ embeds: [leaveEmbed], components: [supportActionRow] });

            await interaction.reply({ embeds: [leaveEmbed], ephemeral: true });

            await targetGuild.leave();

        } catch (error) {
            console.error('Error leaving guild:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(guildColours.error)
                .setTitle('Error')
                .setDescription(`There was an error trying to leave the guild: ${error.message}`)
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};
