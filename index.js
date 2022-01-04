const Express = require('express')
const path = require('path')

const bodyparser = require('body-parser')
const {MakeModels} = require('./GenModule')

const app = Express()

app.use(bodyparser.urlencoded({limit: '50mb',extended:false}))

app.use(bodyparser.json())

app.use(Express.static(path.join(__dirname,"public")))

app.post("/gen",(req,res)=>{
    MakeModels(JSON.parse(req.body.Models),req.body.ID,req,res)
});

app.get("/version",(req,res)=>{
    res.json({version:'1.5'})
});

const http = require('http').Server(app);
const party = require('./party')(http)
http.listen((process.env.PORT || 25569))