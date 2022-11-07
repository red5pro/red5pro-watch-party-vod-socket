const http = require('http')
const https = require('https')
const express = require('express')
const cors = require('cors')
const app = express()
const fs = require('fs')
const bodyParser = require('body-parser')
let port = process.env.PORT || 3000

const useSSL = process.env.SSL === 'true' || false

let cert
let key

if (useSSL) {
  console.log('Using SSL.')
  cert = fs.readFileSync('./cert/certificate.crt')
  key = fs.readFileSync('./cert/privateKey.key')
  port = 443
}

app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json())
app.use(cors())
app.options('*', cors())

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})

let server
if (useSSL) {
  let options = {
    cert: cert,
    key: key
  }
  server = https.createServer(options, app)
} else {
  server = http.createServer(app)
}
server.listen(port)

const getParams = params => {
    const map = {}
    params.split('&').forEach(item => {
      const string = item.split('=')
      map[string[0]] = string[1]
    })
    return map
  }

app.get('/', function (request, response) {
  response.send('Hello')
})

const InvokeKeys = {
    PLAY: 'play',
    TIME: 'time',
    SELECT: 'select',
    CONTROL: 'control'
}

const baseManifest = {
    currentTime: 0,
    isPlaying: false,
    selectedItem: undefined,
    currentDriver: undefined
}

let map = new Map() // token: manifest
let wsMap = new Map() // token: [<websocket>]

const WebSocketServer = require('ws').Server
const wss = new WebSocketServer({ server })
console.log('Mock Socket Server running on ' + port + '.')

const update = (token, manifest, fromid) => {
    const wsList = wsMap.get(token)
    wsList.forEach(obj => {
        const { userid, ws } = obj
        if (userid !== fromid) {
            ws.send(JSON.stringify({
                'manifestUpdate': manifest
            }))
        }
    })
}

wss.on('connection', (ws, req) => {

    console.log('websocket connection open')
    const query = req.url.split('?')[1]
    if (!query) {
        ws.send(JSON.stringify({ error: 'The following query parameters are required: token, userid.' }))
        ws.close()
        return
    }

    const params = getParams(query)
    console.log(params)

    const { token, userid } = params
    if (!wsMap.has(token)) {
        wsMap.set(token, [])
    }
    let list = wsMap.get(token)
    list.push({ userid, ws })
    wsMap.set(token, list)

    if (!map.has(token)) {
        console.log(`Create new manifest for ${token}.`)
        map.set(token, baseManifest)
    }

    const manifest = map.get(token)
    console.log(`Manifest for ${token}:`, JSON.stringify(manifest))

    ws.send(JSON.stringify({
        'manifestUpdate': manifest
    }))

    ws.on('message', message => {
        let json = message
        if (typeof message === 'string') {
          json = JSON.parse(message)
        }
        console.log('Received: ', JSON.stringify(json, null, 2))

        const { type, value, from } = json
        switch (type) {
            case InvokeKeys.PLAY:
                manifest.isPlaying = value
                return
            case InvokeKeys.TIME:
                manifest.currentTime = value
                return
            case InvokeKeys.SELECT:
                manifest.selectedItem = value
                return
            case InvokeKeys.CONTROL:
                manifest.currentDriver = value
                return
            default:
                console.log(`Unhandled manifest change for ${type}`)
        }
        map.set(params.token, manifest)
        update(params.token, manifest, from)
    })

    ws.on('close', () => {
        console.log('websocket connection close')
        const m = wsMap.get(token)
        const i = m.findIndex(obj => obj.userid = userid)
        if (i > -1) {
            m.splice(i, 1)
            wsMap.set(token, m)
        }
    })
})