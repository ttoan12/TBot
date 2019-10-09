require("dotenv").config();
const Discord = require("discord.js");
const client = new Discord.Client({ disableEveryone: true });
const ytdl = require("ytdl-core");
const ytSearch = require("yt-search");

const queue = new Map();
const prefix = "t!"

client.login(process.env.TOKEN);

client.once("ready", () => {
    console.log(`${client.user.username} Connected!`);
    client.user.setPresence({
        status: "online",
        game: {
            name: "t!help",
            type: "LISTENING"
        }
    });
});
client.on("message", async message => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content
        .slice(prefix.length)
        .trim()
        .split(/ +/g);
    const cmd = args.shift().toLowerCase();
    const serverQueue = queue.get(message.guild.id);
    if (cmd.length === 0) return;

    if (cmd === "play") {
        execute(message, args, serverQueue);
        return;
    } else if (cmd === "skip") {
        skip(message, args, serverQueue);
        return;
    } else if (cmd === "stop") {
        stop(message, args, serverQueue);
        return;
    } else if (cmd === "repeat") {
        repeat(message, args, serverQueue);
        return;
    } else if (cmd === "help") {
        help(message);
        return;
    }
});

// Function list !!! ---------------------------

function help(message) {
    message.channel.send({
        embed: {
            color: 3447003,
            fields: [
                { name: "Commands", value: "t!play\nt!stop\nt!skip\nt!repeat", inline: true },
                { name: "Descriptions", value: "CLGT?\nWTF?\nĐMM\nCó cl ý", inline: true }
            ]
        }
    });
}

async function execute(message, args, serverQueue) {
    // Check if user is in a voice channel
    const voiceChannel = message.member.voiceChannel;
    if (!voiceChannel) return message.channel.send("Vô Voice chat trước đi đmm!");

    // Check if the bot have permission to join/speak in the channel
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send("Tao đéo đc quyền nói chuyện trong channel này đâu đmm!");
    }

    // Check if there is a name/url
    if (args.length === 0) {
        return message.channel.send("Nhập tên bài hát hoặc link youtube đi đmm!");
    }

    // Validate youtube link
    var songLink = "";
    let ytUrlValidate = await ytdl.validateURL(args[0]);
    if (!ytUrlValidate) {
        addVideoID(message, args, serverQueue);
    } else {
        addVideo(message, args[0], serverQueue);
    }
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .playStream(ytdl(song.url), { filter: "audioonly", quality: "lowestaudio" })
        .on("end", () => {
            console.log("Music ended!");

            // if not repeat, deletes the finished song from the queue
            let playedSong = serverQueue.songs.shift();
            if (serverQueue.repeat) {
                serverQueue.songs.push(playedSong);
            }

            // Calls the play function again with the next song
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => {
            console.error(error);
        });
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

function skip(message, args, serverQueue) {
    if (!message.member.voiceChannel) return message.channel.send("Vô channel đi rồi skip!");
    if (!serverQueue) return message.channel.send("Hết nhạc rồi skip gì nữa!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, args, serverQueue) {
    if (!message.member.voiceChannel) return message.channel.send("Vô channel trước đi đmm!");
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function repeat(message, args, serverQueue) {
    if (!message.member.voiceChannel) return message.channel.send("Vô channel trước đi đmm!");
    if (serverQueue.repeat) {
        serverQueue.repeat = false;
        message.channel.send("Đã tắt lặp lại!");
    } else {
        serverQueue.repeat = true;
        message.channel.send("Đã bật lặp lại!");
    }
}

function addVideoID(message, args, serverQueue) {
    ytSearch(args.join(" "), function(err, r) {
        if (err) return message.channel.send("Xảy ra lỗi khi tìm kiếm bài hát!");

        const videos = r.videos;
        const firstResult = videos[0];

        var songLink = firstResult.videoId;
        addVideo(message, songLink, serverQueue);
    });
}

async function addVideo(message, songLink, serverQueue) {
    const voiceChannel = message.member.voiceChannel;
    const songInfo = await ytdl.getInfo(songLink);
    const song = {
        title: songInfo.title,
        url: songInfo.video_url
    };

    if (!serverQueue) {
        // Creating the contract for our queue
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            repeat: false,
            playing: true
        };

        // Setting the queue using our contract
        queue.set(message.guild.id, queueContruct);

        // Pushing the song to our songs array
        queueContruct.songs.push(song);

        try {
            // Here we try to join the voicechat and save our connection into our object.
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;

            // Calling the play function to start a song
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            // Printing the error message if the bot fails to join the voicechat
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send("Đéo kết nối vô voice chat được!");
        }
    } else {
        serverQueue.songs.push(song);
        console.log(serverQueue.songs);
        return message.channel.send(`${song.title} đã được thêm vào danh sách!`);
    }
}
