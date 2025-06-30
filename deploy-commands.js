const { REST, Routes } = require('discord.js');
const { readdirSync } = require('fs');
require('dotenv').config();

const commands = [];
const commandFolders = readdirSync('./src/commands');

for (const folder of commandFolders) {
    const commandFiles = readdirSync(`./src/commands/${folder}`).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./src/commands/${folder}/${file}`);
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Đang tải ${commands.length} lệnh (/) lên Discord...`);
        const data = await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands },
        );
        console.log(`Đã tải thành công ${data.length} lệnh (/)!`);
    } catch (error) {
        console.error(error);
    }
})();
