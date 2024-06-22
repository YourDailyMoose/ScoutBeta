const { SlashCommandBuilder, EmbedBuilder, DiscordAPIError } = require('discord.js');


//PERMISSIONS
module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Gives or takes away a role from a user.')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to give or take the role from.')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to give or take.')
                .setRequired(true)),
    permission: ['adminRoles', 'godRoles'],
    async execute(interaction) {

        const user = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');

        if (interaction.guild && interaction.guild.me && !interaction.guild.me.roles.highest.comparePositionTo(role) > 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor(guildColours.error)
                .setTitle('Error')
                .setDescription('I cannot give a role that is higher than or equal to my highest role.')

            return interaction.reply({ embeds: [errorEmbed] });
        }

        if (!interaction.member.roles.highest.comparePositionTo(user.roles.highest) > 0) {
            if (!(user.id === interaction.member.id)) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(guildColours.error)
                    .setTitle('Error')
                    .setDescription('You cannot change the roles of a member who has a role that is higher than or equal to your highest role.')

                return interaction.reply({ embeds: [errorEmbed] });
            }
        }

        // Check if the command executor can give the role
        if (!interaction.member.roles.highest.comparePositionTo(role) > 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor(guildColours.error)
                .setTitle('Error')
                .setDescription('You cannot give a role that is higher than or equal to your highest role.')

            return interaction.reply({ embeds: [errorEmbed] });
        }


        if (interaction.guild && interaction.guild.me && !interaction.guild.me.roles.highest.comparePositionTo(role) > 0) {


            const errorEmbed = new EmbedBuilder()
                .setColor(guildColours.error)
                .setTitle('Error')
                .setDescription('I cannot give a role that is higher than or equal to my highest role.')

            return interaction.reply({ embeds: [errorEmbed] });
        }
        if (!user || !role) {
            const embed = new EmbedBuilder()
                .setTitle('Role Update Error')
                .setDescription(`User or role was not found.`)
                .setColor(guildColours.error);

            interaction.reply({ embeds: [embed] });
        }


        let action = ''; // Action string to keep track of what we did

        try {
            if (user.roles.cache.has(role.id)) {
                // The user already has the role, so we remove it
                await user.roles.remove(role);
                action = '-';
            } else {
                // The user does not have the role, so we give it to them
                await user.roles.add(role);
                action = '+';
            }
        } catch (error) {
            if (error instanceof DiscordAPIError && error.code === 50013) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(guildColours.error)
                    .setTitle('Error')
                    .setDescription('I do not have the necessary permissions to manage roles OR I am unable to manage this role.');

                return interaction.reply({ embeds: [errorEmbed] });
            }

            // Re-throw the error if it's not a DiscordAPIError with code 50013
            throw error;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Changed ${user.user.username}'s roles`)
            .setDescription(`\`${action}${role.name} (${role.id})\``)
            .setColor(botColours.green);

        await interaction.reply({ embeds: [embed] });

    },

};