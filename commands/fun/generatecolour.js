const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const namedColours = require('color-name');

module.exports = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('generatecolour')
    .setDescription('Generates a random colour or displays the provided colour.')
    .addStringOption(option =>
      option.setName('colour')
        .setDescription('Provide a hex colour code or colour name (e.g., #ff5733 or "red") or leave blank for a random colour.')
        .setRequired(false)),

  async execute(interaction) {
    const userColour = interaction.options.getString('colour');
    
    let r, g, b, hex;

    if (userColour) {
      let isValidHex = /^#[0-9A-Fa-f]{6}$/i.test(userColour);
      if (!isValidHex && namedColours[userColour.toLowerCase()]) {
        [r, g, b] = namedColours[userColour.toLowerCase()];
        hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      } else if (isValidHex) {
        hex = userColour;
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
      } else {
        return interaction.reply({ content: 'Invalid colour provided. Please use a valid hex code or colour name.', ephemeral: true });
      }
    } else {
      r = Math.floor(Math.random() * 256);
      g = Math.floor(Math.random() * 256);
      b = Math.floor(Math.random() * 256);
      hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    const rgb = `${r}, ${g}, ${b}`;
    const hsl = rgbToHsl(r, g, b);
    const cmyk = rgbToCmyk(r, g, b);
    const hsv = rgbToHsv(r, g, b);

    function rgbToHsl(r, g, b) {
      r /= 255, g /= 255, b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }

      return `${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
    }

    function rgbToCmyk(r, g, b) {
      r /= 255;
      g /= 255;
      b /= 255;
      const k = Math.min(1 - r, 1 - g, 1 - b);
      const c = (1 - r - k) / (1 - k) || 0;
      const m = (1 - g - k) / (1 - k) || 0;
      const y = (1 - b - k) / (1 - k) || 0;
      return `${Math.round(c * 100)}%, ${Math.round(m * 100)}%, ${Math.round(y * 100)}%, ${Math.round(k * 100)}%`;
    }

    function rgbToHsv(r, g, b) {
      r /= 255, g /= 255, b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;
      const v = max;
      let h, s = max === 0 ? 0 : d / max;

      if (max === min) h = 0;
      else {
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return `${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(v * 100)}%`;
    }

    const imageUrl = `https://www.colorhexa.com/${hex.slice(1)}.png`;

    const embed = new EmbedBuilder()
      .setColor(hex)
      .setTitle(userColour ? 'Provided Colour' : 'Random Colour')
      .setDescription(`**Hex**: ${hex}\n**RGB**: ${rgb}\n**HSL**: ${hsl}\n**CMYK**: ${cmyk}\n**HSV**: ${hsv}`)
      .setThumbnail(imageUrl);

    await interaction.reply({ embeds: [embed] });
  },
};
