const Express = require('express')
const path = require('path')

const bodyparser = require('body-parser')
const {MakeModels} = require('./GenModule')

const { type } = require('os')
const app = Express()

app.use(bodyparser.urlencoded({extended:false}))
app.use(bodyparser.json())

app.use(Express.static(path.join(__dirname,"public")))

app.post("/gen",(req,res)=>{
    MakeModels(JSON.parse(req.body.Models),req.body.ID,req,res)
});

app.get("/version",(req,res)=>{
    res.json({version:'0.1.3'})
});

const http = require('http').Server(app);
const io = require('socket.io')(http);

http.listen((process.env.PORT || 8080))