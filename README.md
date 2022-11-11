# Watch Party VOD Socket Server

This is a bare-bones socket server written in NodeJS for the VOD HLS playback integration of the Watch Party web app.

It stores VOD Playback information mapped to a join token provided when each client connects to the websocket. This data is then provided to each connected client (Watch Party user) on-demand as Users take control in selecting and scrubbing to times within a VOD HLS stream.

# Run

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