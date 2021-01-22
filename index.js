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


app.listen((process.env.PORT || 8080))