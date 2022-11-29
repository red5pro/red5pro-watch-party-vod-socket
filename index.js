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
    CONTROL: 'control',
    RESPONSE: 'response'
}

const baseManifest = {
    currentTime: 0,
    isPlaying: false,
    selectedItem: undefined,
    currentDriver: undefined,
    controller: undefined,
}

const REQUEST_INTERVAL = 2000
let driverActive = false

let map = new Map() // token: manifest
let wsMap = new Map() // token: [{userid, websocket}]
let reqMap = new Map() // token: interval
let playheadMap = new Map() // token: [{userid, number}]
let driverMap = new Map() // token: userid

const WebSocketServer = require('ws').Server
const wss = new WebSocketServer({ server })
console.log('Mock Socket Server running on ' + port + '.')

const assignDriver = (token, userid) => {
    driverMap.set(token, userid)
    console.log(`${token} has a new driver: ${userid}.`)
}

const clearUpInterval = (token) => {
    console.log('clearUpInterval')
    if (reqMap.has(token)) {
        console.log('CLEAR INTERVAL')
        clearInterval(reqMap.get(token).interval)
        reqMap.delete(token)
    }
}

const setUpInterval = (token) => {
    console.log('setupInterval')
    clearUpInterval(token)
    if (!reqMap.has(token)) {
        console.log('SET INTERVAL')
        const fn = playheadUpdate(token)
        reqMap.set(token, {
            interval: setInterval(fn, REQUEST_INTERVAL)
        })
        fn()
    }
}

const playheadUpdate = token => {
    return () => {
        // if (wsMap.has(token)) {
        //     wsMap.get(token).forEach(o =>{
        //         const { ws } = o
        //         ws.send(JSON.stringify({
        //             'request': 'sampleTime'
        //         }))
        //     })
        // }
        if (wsMap.has(token) && driverMap.has(token)) {
            const userid = driverMap.get(token)
            const socket = wsMap.get(token).find(o => o.userid === userid)
            if (socket && !driverActive) {
                const { ws } = socket
                // console.log(`Go ask driver ${userid} for details in ${token}.`)
                ws.send(JSON.stringify({
                    'request': 'sampleTime'
                })) 
            }
        }
    }
}

const clearCurrentDriverIf = (token, userid) => {
    const manifest = map.get(token)
    const { currentDriver } = manifest
    if (currentDriver && currentDriver.userid === userid) {
        const m = {...manifest, currentDriver: undefined}
        map.set(token, m)
        update(token, m, userid)
    }
}

const update = (token, manifest, fromid) => {
    const wsList = wsMap.get(token)
    // console.log('UPDATE', token, manifest)
    wsList.forEach(obj => {
        const { userid, ws } = obj
        if (userid !== fromid) {
            ws.send(JSON.stringify({
                'manifestUpdate': manifest,
            }))
        }
    })
}

const updateDriver = (token, driver, selection, fromid) => {
    const wsList = wsMap.get(token)
    wsList.forEach(obj => {
        const { userid, ws } = obj
        if (userid !== fromid) {
            ws.send(JSON.stringify({
                'driverUpdate': {
                    driver,
                    selection 
                }
            }))
        }
    })
}

const smoothPlayheadTime = (manifest, playheads) => {
    const current = manifest.currentTime
    const len = playheads.length
    const count = playheads.map(o => o.value).reduce((a, b) => a+b, 0)
    const smoothed = count / len
    if (Math.max(smoothed - current) > 1.5) {
        manifest.currentTime = smoothed
    }
    console.log('SMOOTHED', playheads, current, smoothed)
    return manifest
}

const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) return ws.terminate()
      ws.isAlive = false;
      ws.ping()
    })
  }, 30000)

wss.on('connection', (ws, req) => {

    console.log('websocket connection open')
    const query = req.url.split('?')[1]
    if (!query) {
        ws.send(JSON.stringify({ error: 'The following query parameters are required: token, userid.' }))
        ws.close()
        return
    }

    ws.isAlive = true
    ws.on('pong', () => {
        ws.isAlive = true
    })

    const params = getParams(query)
    console.log(params)

    const { token, userid } = params
    if (!wsMap.has(token)) {
        console.log(`Create new socket map for ${token}.`)
        wsMap.set(token, [])
        assignDriver(token, userid)
    }
    let list = wsMap.get(token)

    if (!map.has(token)) {
        console.log(`Create new manifest for ${token}.`)
        map.set(token, baseManifest)
    }

    let manifest = map.get(token)
    console.log(`Manifest for ${token}:`, JSON.stringify(manifest))

    ws.send(JSON.stringify({
        'manifestUpdate': manifest
    }))

    list.forEach(({ userid, ws }) => {
        ws.send(JSON.stringify({
            'request': 'sampleTime'
        }))
    })

    list.push({ userid, ws })
    wsMap.set(token, list)
    
    ws.on('message', message => {
        let json = message
        if (typeof message === 'string') {
          json = JSON.parse(message)
        }
        console.log('Received: ', JSON.stringify(json, null, 2))
        const isCurrentDriver = driverMap.has(token) ? driverMap.get(token) === userid : false
        const { type, value, atTime, from } = json
        if (atTime) {
            manifest.currentTime = atTime
        }
        if (type === InvokeKeys.PLAY) {
            manifest.isPlaying = value
            if (!isCurrentDriver) {
                assignDriver(token, userid)
                manifest.controller = userid
            }
            if (value) {
                setUpInterval(token)
            } else {
                clearUpInterval(token)
            }
        } else if (type === InvokeKeys.TIME) {
            manifest.currentTime = value
            if (!isCurrentDriver) {
                assignDriver(token, userid)
                manifest.controller = userid
            }
        } else if (type === InvokeKeys.SELECT) {
            manifest.selectedItem = value
            if (!isCurrentDriver) {
                assignDriver(token, userid)
                manifest.controller = userid
            }
        } else if (type === InvokeKeys.CONTROL) {
            manifest.currentDriver = value
            if (value && !driverActive) {
                assignDriver(token, userid)
                driverActive = true
                updateDriver(token, value, manifest.selectedItem, from)
                manifest.controller = userid
            } else if (!value) {
                driverActive = false
                updateDriver(token, undefined, manifest.selctedItem, from)
                playheadUpdate()
            }
        } else if (type === InvokeKeys.RESPONSE) {
            const { request, response } = json
            if (request === 'sampleTime' && isCurrentDriver) {
                // console.log('RESPONSE', from, response)
                // const playheads = playheadMap.has(token) ? playheadMap.get(token) : []
                // let index = playheads.findIndex(p => p.userid === userid)
                // index = index === -1 ? playheads.length : index
                // playheads[index] = {userid, value: response}
                // playheadMap.set(token, playheads)
                // if (wsMap.get(token).length === 1) {
                //     return
                // }
                // manifest = smoothPlayheadTime(manifest, playheads)
                manifest.currentTime = response
            }
        } else {
            console.log(`Unhandled manifest change for ${message}`)
        }
        map.set(token, manifest)
        update(token, manifest, from)
    })

    ws.on('close', () => {
        console.log('websocket connection close')
        clearCurrentDriverIf(token, userid)
        const m = wsMap.get(token)
        const p = playheadMap.get(token)
        const u = driverMap.get(token)
        const driverLeaving = u === userid
        let i = m.findIndex(obj => obj.userid === userid)
        if (i > -1) {
            m.splice(i, 1)
            wsMap.set(token, m)
            if (m.length === 0) {
                clearUpInterval(token)
                wsMap.delete(token)
            }
        }
        if (p) {
            i = p.findIndex(obj => obj.userid === userid)
            if (i > -1) {
                p.splice(i, 1)
                playheadMap.set(token, p)
            }
        }
        // If the connection leaving was the driver,
        // see if we can transfer ownership...
        if (driverLeaving) {
            console.log(`Driver ${userid} is leaving ${token}.`)
            driverMap.delete(token)
            if (m.length > 0) {
                assignDriver(token, m[0].userid)
            }
        }
    })
})

wss.on('close', function close() {
    clearInterval(interval)
})