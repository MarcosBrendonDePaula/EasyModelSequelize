const Express = require('express')
const path = require('path')

const bodyparser = require('body-parser')

const Sequelize_Builder = require('./Generators/Sequelize')
const MongoDb_Builder   = require('./Generators/MongoDb')
const app = Express()

app.use(bodyparser.urlencoded({limit: '50mb',extended:false}))

app.use(bodyparser.json())

app.use(Express.static(path.join(__dirname,"public")))

app.post("/gen",(req,res)=>{
    if(req.body.type)
    {
        switch (req.body.type) {
            case "sequelize": {
                Sequelize_Builder(JSON.parse(req.body.Models), req.body.ID, req, res)
                break
            }


            case "mongodb"  : {
                MongoDb_Builder(JSON.parse(req.body.Models), req.body.ID, req, res)
                break
            }
            

            default : {
                Sequelize_Builder(JSON.parse(req.body.Models), req.body.ID, req, res)
            }
        }
    }
});

app.get("/version",(req,res)=>{
    res.json({version:'1.5'})
});

const http = require('http').Server(app);
const party = require('./party')(http)
http.listen((process.env.PORT || 25569))