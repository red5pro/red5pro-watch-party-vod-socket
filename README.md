# Red5 TrueTime WatchParty™ VOD Socket Server

This is a bare-bones socket server written in NodeJS for the VOD [HLS playback](https://www.red5.net/hls-server/) integration of the Red5 TrueTime WatchParty™ web app.

It stores VOD Playback information mapped to a join token provided when each client connects to the websocket. This data is then provided to each connected client (Red5 TrueTime WatchParty™ user) on-demand as Users take control in selecting and scrubbing to times within a VOD HLS stream.

### Run

Edit the `index.js` file to have the correct paths to the certs on the system:

```js
cert = fs.readFileSync('./cert/certificate.crt')
key = fs.readFileSync('./cert/privateKey.key')
```

Then issue:

```sh
npm install
npm install -g forever
export SSL=true; forever start index.js
```

### More Info

The open-source example that integrates with this server for VOD Playback Orchestration can be found at: [https://github.com/red5pro/red5pro-watch-party/tree/feature/vod_scrub_sync_RED5DEV-543](https://github.com/red5pro/red5pro-watch-party/tree/feature/vod_scrub_sync_RED5DEV-543).


## Other repositories about Red5 TrueTime WatchParty™:

* [The main repository](https://github.com/red5pro/truetime-watchparty)
* [Red5 TrueTime WatchParty™ Web Client using vanilla JavaScript](https://github.com/red5pro/red5pro-watch-party-VANILLA)


## Red5 AI Skills

Use the **Red5 AI skills** to help your AI coding assistant build real-time video applications with Red5 Pro and Red5 Cloud, with guidance grounded in Red5 documentation. [Download the skill from GitHub](https://github.com/red5pro/red5pro-skills) or install it by running `npx red5pro-skills` in your terminal.
